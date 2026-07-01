import { Router } from "express"
import multer from "multer"
import { pool } from "../db"
import { resolveCategoryId } from "../lib/categories"
import { parseBalancoWorkbook } from "../lib/import-balanco"

const router = Router()

const IMPORT_MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMPORT_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const extMatch = file.originalname.match(/\.(xlsx|xls)$/i)
    if (ALLOWED_IMPORT_MIMES.includes(file.mimetype) || extMatch) {
      cb(null, true)
    } else {
      cb(new Error("Formato de arquivo não suportado. Envie um arquivo .xlsx"))
    }
  },
})

router.post("/", upload.single("file"), async (req, res) => {
  const dryRun = req.query.dryRun === "true"

  if (!req.file) {
    return res.status(400).json({ error: "Arquivo não enviado" })
  }

  let result: ReturnType<typeof parseBalancoWorkbook>
  try {
    result = parseBalancoWorkbook(req.file.buffer, req.file.originalname)
  } catch (error) {
    console.error("Erro ao ler planilha:", error)
    const message = error instanceof Error ? error.message : "Não foi possível ler o arquivo."
    return res.status(400).json({ error: message })
  }

  const { entries, year } = result

  if (dryRun) {
    return res.json({
      year,
      total: entries.length,
      receitas: entries.filter((e) => e.type === "receita").length,
      despesas: entries.filter((e) => e.type === "despesa").length,
      categories: [...new Set(entries.map((e) => e.category))],
      preview: entries.slice(0, 10),
    })
  }

  if (entries.length === 0) {
    return res.status(400).json({ error: "Nenhum lançamento reconhecido no arquivo" })
  }

  let imported = 0
  let duplicates = 0

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    for (const entry of entries) {
      const categoryId = await resolveCategoryId(client, entry.category, entry.type)

      const { rows: existing } = await client.query(
        `SELECT id FROM "Transaction"
         WHERE date = $1 AND amount = $2 AND type = $3 AND description = $4 AND "categoryId" = $5`,
        [entry.date, entry.amount, entry.type, entry.description, categoryId],
      )
      if (existing.length > 0) {
        duplicates += 1
        continue
      }

      await client.query(
        `INSERT INTO "Transaction" (date, description, amount, type, "categoryId") VALUES ($1, $2, $3, $4, $5)`,
        [entry.date, entry.description, entry.amount, entry.type, categoryId],
      )
      imported += 1
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  res.json({ imported, duplicates })
})

export default router
