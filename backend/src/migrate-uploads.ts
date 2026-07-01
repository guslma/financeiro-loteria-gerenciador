/**
 * migrate-uploads.ts
 *
 * Varre o diretório de uploads em busca de comprovantes salvos no formato
 * antigo (sem criptografia, .jpg/.png/.webp) e os converte para o novo
 * formato criptografado (.enc), gerando também as thumbnails.
 *
 * Uso como CLI:
 *   npx tsx src/migrate-uploads.ts                          # dry-run
 *   npx tsx src/migrate-uploads.ts --execute                 # executa de verdade
 *   npx tsx src/migrate-uploads.ts --execute --delete-old    # apaga os originais
 *   npx tsx src/migrate-uploads.ts --execute --update-db     # atualiza receiptPhotoPath no banco
 *
 * Também é chamado automaticamente na inicialização do servidor (index.ts)
 * com --quiet, para migrar arquivos sem intervenção manual.
 *
 * Requer DATABASE_URL configurada se usar --update-db.
 * Requer STORAGE_ENCRYPTION_KEY ou APP_JWT_SECRET para criptografar.
 */

import { readdir, unlink } from "fs/promises"
import path from "path"
import { readFile } from "fs/promises"
import { saveReceipt, UPLOADS_DIR } from "./lib/receipt-storage"
import { logger } from "./lib/logger"

// ── Config ─────────────────────────────────────────────────────────────

const RECEIPTS_DIR = path.join(UPLOADS_DIR, "receipts")
const OLD_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const UUID_REGEX = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

// ── Função principal (exportada para uso programático) ─────────────────

export interface MigrateOptions {
  /** Se true, executa de verdade. Se false, só mostra o que faria. */
  execute?: boolean
  /** Apaga os arquivos .jpg/.png originais depois de migrar. */
  deleteOld?: boolean
  /** Atualiza receiptPhotoPath no banco para o formato UUID. */
  updateDb?: boolean
  /** Se true, não loga informações de progresso (só erros e resumo). */
  quiet?: boolean
}

export interface MigrateResult {
  found: number
  migrated: number
  errors: number
}

/**
 * Varre o diretório de uploads e migra fotos antigas para o novo formato
 * criptografado. É seguro chamar múltiplas vezes (idempotente: arquivos
 * que já têm .enc são ignorados).
 */
export async function migrateUploads(opts: MigrateOptions = {}): Promise<MigrateResult> {
  const { execute = false, deleteOld = false, updateDb = false, quiet = false } = opts
  const result: MigrateResult = { found: 0, migrated: 0, errors: 0 }

  if (!quiet) {
    if (execute) {
      logger.info("Migracao de uploads: modo execucao")
    } else {
      logger.info("Migracao de uploads: dry-run (nada sera alterado)")
    }
  }

  let files: string[]
  try {
    files = await readdir(RECEIPTS_DIR)
  } catch {
    if (!quiet) logger.info("Diretorio de uploads nao existe — nada a migrar.")
    return result
  }

  // Identifica arquivos antigos sem .enc correspondente
  const oldFiles: Map<string, string> = new Map() // uuid → filename
  for (const file of files) {
    const ext = path.extname(file).toLowerCase()
    if (!OLD_EXTS.has(ext)) continue
    const base = path.basename(file, ext)
    if (!UUID_REGEX.test(base)) continue
    if (files.includes(`${base}.enc`)) continue // já migrado
    oldFiles.set(base, file)
  }

  result.found = oldFiles.size

  if (result.found === 0) {
    if (!quiet) logger.info("Nenhum arquivo antigo para migrar.")
    return result
  }

  if (!quiet) logger.info(`Encontrados ${result.found} arquivo(s) antigo(s) para migrar.`)

  // ── Com atualização do banco ────────────────────────────────────────
  if (updateDb) {
    const { pool } = await import("./db.js")
    const client = await pool.connect()
    try {
      for (const [uuid, filename] of oldFiles) {
        const oldPath = path.join(RECEIPTS_DIR, filename)
        const oldReceiptPath = `/uploads/receipts/${filename}`

        if (!execute) {
          if (!quiet) logger.info({ uuid, file: filename }, "[dry-run] Migraria este arquivo")
          result.migrated++
          continue
        }

        try {
          const buffer = await readFile(oldPath)
          await saveReceipt(uuid, buffer)
          const dbResult = await client.query(
            `UPDATE "Transaction" SET "receiptPhotoPath" = $1 WHERE "receiptPhotoPath" = $2`,
            [uuid, oldReceiptPath],
          )
          if (!quiet) logger.info({ uuid, file: filename, dbRows: dbResult.rowCount }, "Migrado")
          result.migrated++
          if (deleteOld) {
            await unlink(oldPath)
            if (!quiet) logger.info({ uuid }, "Original removido")
          }
        } catch (error) {
          logger.error({ uuid, file: filename, error }, "Erro ao migrar")
          result.errors++
        }
      }
    } finally {
      client.release()
    }
    return result
  }

  // ── Sem banco ───────────────────────────────────────────────────────
  for (const [uuid, filename] of oldFiles) {
    const oldPath = path.join(RECEIPTS_DIR, filename)

    if (!execute) {
      if (!quiet) logger.info({ uuid, file: filename }, "[dry-run] Migraria este arquivo")
      result.migrated++
      continue
    }

    try {
      const buffer = await readFile(oldPath)
      await saveReceipt(uuid, buffer)
      if (!quiet) logger.info({ uuid, file: filename }, "Migrado")
      result.migrated++
      if (deleteOld) {
        await unlink(oldPath)
        if (!quiet) logger.info({ uuid }, "Original removido")
      }
    } catch (error) {
      logger.error({ uuid, file: filename, error }, "Erro ao migrar")
      result.errors++
    }
  }

  return result
}

// ── CLI ────────────────────────────────────────────────────────────────

async function cli() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
 Uso: npx tsx src/migrate-uploads.ts [opcoes]

 Opcoes:
   --execute        Executa a migracao de verdade (padrao: dry-run)
   --delete-old     Apaga os arquivos .jpg/.png/.webp originais apos migrar
   --update-db      Atualiza receiptPhotoPath no banco para o formato UUID
   --quiet          Modo silencioso (so erros e resumo)
   --help, -h       Mostra esta ajuda

 Sem --execute o script apenas lista o que sera feito.
 `.trim())
    process.exit(0)
  }

  const result = await migrateUploads({
    execute: args.includes("--execute"),
    deleteOld: args.includes("--delete-old"),
    updateDb: args.includes("--update-db"),
    quiet: args.includes("--quiet"),
  })

  logger.info(
    { encontrados: result.found, migrados: result.migrated, erros: result.errors },
    "Migracao concluida",
  )

  if (!args.includes("--execute")) {
    logger.info("Dica: rode com --execute para aplicar as alteracoes.")
  }

  process.exit(result.errors > 0 ? 1 : 0)
}

// Detecta se está sendo executado diretamente (CLI) ou importado
const isCli = process.argv[1]?.endsWith("migrate-uploads.ts") ||
              process.argv[1]?.endsWith("migrate-uploads.js")

if (isCli) {
  cli().catch((error) => {
    logger.error({ error }, "Erro fatal na migracao")
    process.exit(1)
  })
}
