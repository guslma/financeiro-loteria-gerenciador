import { Router } from "express"
import multer from "multer"
import crypto from "crypto"
import { extractReceiptDataServer } from "../lib/receipt-extraction"
import { loadReceiptFile, loadReceiptThumbnail, saveReceipt } from "../lib/receipt-storage"
import { logger } from "../lib/logger"

const router = Router()

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      cb(new Error("Tipo de arquivo não suportado"))
      return
    }
    cb(null, true)
  },
})

// ── Upload ───────────────────────────────────────────────────────────
// Comprime a imagem para WebP, gera thumbnail e criptografa ambos antes
// de salvar no disco.
router.post("/", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "Arquivo muito grande (máximo 10MB)"
          : err.message || "Erro ao enviar arquivo"
      return res.status(400).json({ error: message })
    }

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" })
    }

    const uuid = crypto.randomUUID()
    try {
      await saveReceipt(uuid, req.file.buffer)
      res.status(201).json({ path: uuid })
    } catch (error) {
      logger.error({ error }, "Erro ao salvar comprovante criptografado")
      res.status(500).json({ error: "Erro ao processar imagem do comprovante" })
    }
  })
})

// ── Extrair dados (OCR) ─────────────────────────────────────────────
router.post("/extract", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "Arquivo muito grande (máximo 10MB)"
          : err.message || "Erro ao enviar arquivo"
      return res.status(400).json({ error: message })
    }

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" })
    }

    try {
      const result = await extractReceiptDataServer(req.file.buffer)
      res.json(result)
    } catch (error) {
      logger.error({ error }, "Erro ao extrair dados do comprovante")
      res.status(502).json({ error: "Não foi possível ler os dados do comprovante" })
    }
  })
})

// ── Servir imagem completa ──────────────────────────────────────────
// Busca o arquivo criptografado, descriptografa e serve como WebP.
router.get("/files/:uuid", async (req, res) => {
  const { uuid } = req.params

  // Validação básica do formato UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return res.status(400).json({ error: "UUID inválido" })
  }

  try {
    const image = await loadReceiptFile(uuid)
    if (!image) {
      return res.status(404).json({ error: "Comprovante não encontrado" })
    }
    res.set("Content-Type", "image/webp")
    res.set("Cache-Control", "private, max-age=86400") // 1 dia
    res.send(image)
  } catch (error) {
    logger.error({ error, uuid }, "Erro ao servir comprovante")
    res.status(500).json({ error: "Erro ao carregar comprovante" })
  }
})

// ── Servir thumbnail ─────────────────────────────────────────────────
router.get("/files/:uuid/thumb", async (req, res) => {
  const { uuid } = req.params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return res.status(400).json({ error: "UUID inválido" })
  }

  try {
    const image = await loadReceiptThumbnail(uuid)
    if (!image) {
      return res.status(404).json({ error: "Thumbnail não encontrado" })
    }
    res.set("Content-Type", "image/webp")
    res.set("Cache-Control", "private, max-age=86400")
    res.send(image)
  } catch (error) {
    logger.error({ error, uuid }, "Erro ao servir thumbnail")
    res.status(500).json({ error: "Erro ao carregar thumbnail" })
  }
})

export default router
