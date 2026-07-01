import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"
import crypto from "crypto"
import sharp from "sharp"
import { logger } from "./logger"

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads")

// ── Chave de criptografia ──────────────────────────────────────────────
// Usa STORAGE_ENCRYPTION_KEY se definida; senão deriva de APP_JWT_SECRET.
function getEncryptionKey(): Buffer {
  const raw = process.env.STORAGE_ENCRYPTION_KEY ?? process.env.APP_JWT_SECRET
  if (!raw) {
    throw new Error(
      "STORAGE_ENCRYPTION_KEY ou APP_JWT_SECRET é necessário para criptografia dos uploads",
    )
  }
  return crypto.createHash("sha256").update(raw).digest()
}

const IV_LENGTH = 12 // 96 bits — recomendado para GCM
const AUTH_TAG_LENGTH = 16

// ── Compressão ─────────────────────────────────────────────────────────
const MAX_WIDTH = 1920
const THUMB_WIDTH = 200
const WEBP_QUALITY = 80

/**
 * Redimensiona e converte a imagem para WebP.
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // respeita orientação EXIF
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

/**
 * Gera thumbnail (webp, 200px de largura).
 */
export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

// ── Criptografia AES-256-GCM ───────────────────────────────────────────
// Formato no disco: [nonce 12B][ciphertext][authTag 16B]

function encrypt(buffer: Buffer): Buffer {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()])
}

function decrypt(data: Buffer): Buffer {
  const key = getEncryptionKey()
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ── Salvamento ─────────────────────────────────────────────────────────

/**
 * Salva o arquivo de comprovante: comprime → criptografa → disco.
 * Também gera e salva a thumbnail criptografada.
 * @returns o UUID do arquivo salvo.
 */
export async function saveReceipt(
  uuid: string,
  originalBuffer: Buffer,
): Promise<void> {
  const receiptsDir = path.join(UPLOADS_DIR, "receipts")
  const thumbDir = path.join(receiptsDir, "thumb")
  await mkdir(thumbDir, { recursive: true })

  // Full image
  const compressed = await compressImage(originalBuffer)
  const encrypted = encrypt(compressed)
  await writeFile(path.join(receiptsDir, `${uuid}.enc`), encrypted)

  // Thumbnail
  const thumb = await generateThumbnail(originalBuffer)
  const encryptedThumb = encrypt(thumb)
  await writeFile(path.join(thumbDir, `${uuid}.enc`), encryptedThumb)
}

// ── Leitura ────────────────────────────────────────────────────────────

/**
 * Carrega e descriptografa um comprovante salvo.
 * Retorna o buffer da imagem (decodificado, pronto pra servir).
 */
export async function loadReceiptFile(uuid: string): Promise<Buffer | null> {
  // Tenta formato novo (criptografado)
  const receiptsDir = path.join(UPLOADS_DIR, "receipts")
  const encPath = path.join(receiptsDir, `${uuid}.enc`)
  try {
    const data = await readFile(encPath)
    return decrypt(data)
  } catch {
    // Tenta formato antigo (sem criptografia, compatibilidade retroativa)
    for (const ext of ["webp", "jpg", "jpeg", "png"]) {
      try {
        return await readFile(path.join(receiptsDir, `${uuid}.${ext}`))
      } catch {
        /* tenta próximo */
      }
    }
    return null
  }
}

/**
 * Carrega e descriptografa a thumbnail de um comprovante.
 */
export async function loadReceiptThumbnail(uuid: string): Promise<Buffer | null> {
  const thumbDir = path.join(UPLOADS_DIR, "receipts", "thumb")
  const encPath = path.join(thumbDir, `${uuid}.enc`)
  try {
    const data = await readFile(encPath)
    return decrypt(data)
  } catch {
    // Sem thumbnail antiga — tenta carregar a full e gerar na hora
    const full = await loadReceiptFile(uuid)
    if (!full) return null
    return generateThumbnail(full)
  }
}

// ── Exclusão ──────────────────────────────────────────────────────────

/**
 * Extrai o UUID de qualquer formato de receiptPhotoPath.
 */
function extractUuid(receiptPhotoPath: string): string | null {
  // Já é um UUID puro
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiptPhotoPath)) {
    return receiptPhotoPath
  }
  // /api/receipts/files/{uuid} ou /api/receipts/files/{uuid}/thumb
  let m = receiptPhotoPath.match(/\/api\/receipts\/files\/([0-9a-f-]+)/i)
  if (m) return m[1]
  // /uploads/receipts/{uuid}.ext
  m = receiptPhotoPath.match(/\/uploads\/receipts\/([0-9a-f-]+)/i)
  if (m) return m[1]
  return null
}

export async function deleteReceiptFile(receiptPhotoPath: string | null | undefined) {
  if (!receiptPhotoPath) return

  const uuid = extractUuid(receiptPhotoPath)
  if (!uuid) {
    logger.warn({ receiptPhotoPath }, "Não foi possível extrair UUID do caminho do comprovante")
    return
  }

  const receiptsDir = path.join(UPLOADS_DIR, "receipts")

  // Novo formato criptografado
  for (const filename of [`${uuid}.enc`, path.join("thumb", `${uuid}.enc`)]) {
    try {
      await unlink(path.join(receiptsDir, filename))
    } catch {
      // Arquivo pode não existir
    }
  }

  // Formato antigo (backward compat)
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    try {
      await unlink(path.join(receiptsDir, `${uuid}.${ext}`))
    } catch {
      /* ignora */
    }
  }
}

export { UPLOADS_DIR }
