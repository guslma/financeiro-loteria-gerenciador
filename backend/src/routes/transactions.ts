import { Router } from "express"
import { z } from "zod"
import { pool } from "../db"
import { resolveCategoryId } from "../lib/categories"
import { deleteReceiptFile } from "../lib/receipt-storage"

const router = Router()

const typeSchema = z.enum(["receita", "despesa"])

const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  amount: z.number().positive(),
  type: typeSchema,
  category: z.string().trim().min(1),
  receiptPhotoPath: z.string().trim().min(1).optional(),
})

const updateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  amount: z.number().positive(),
  category: z.string().trim().min(1),
  receiptPhotoPath: z.string().trim().min(1).optional(),
})

interface TransactionRow {
  id: string
  date: string
  description: string
  amount: number
  type: string
  categoryId: string
  categoryName: string
  receiptPhotoPath: string | null
}

const SELECT_WITH_CATEGORY = `
  SELECT t.id, t.date, t.description, t.amount, t.type, t."categoryId", t."receiptPhotoPath", c.name AS "categoryName"
  FROM "Transaction" t
  JOIN "Category" c ON c.id = t."categoryId"
`

function serializeTransaction(t: TransactionRow) {
  return {
    id: t.id,
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.categoryName,
    receiptPhotoPath: t.receiptPhotoPath,
  }
}

router.get("/", async (req, res) => {
  const typeParam = req.query.type as string | undefined
  const year = req.query.year as string | undefined
  const month = req.query.month as string | undefined
  const categoryParam = req.query.category as string | undefined

  const conditions: string[] = []
  const params: unknown[] = []

  if (typeParam) {
    const parsedType = typeSchema.safeParse(typeParam)
    if (!parsedType.success) {
      return res.status(400).json({ error: "type deve ser 'receita' ou 'despesa'" })
    }
    params.push(parsedType.data)
    conditions.push(`t.type = $${params.length}`)
  }
  if (categoryParam) {
    params.push(categoryParam)
    conditions.push(`c.name = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const { rows } = await pool.query<TransactionRow>(`${SELECT_WITH_CATEGORY} ${where} ORDER BY t.date DESC`, params)

  let transactions = rows
  if (year) {
    transactions = transactions.filter((t) => t.date.startsWith(`${year}-`))
  }
  if (month) {
    const monthStr = month.padStart(2, "0")
    transactions = transactions.filter((t) => t.date.slice(5, 7) === monthStr)
  }

  res.json(transactions.map(serializeTransaction))
})

router.post("/", async (req, res) => {
  const parsed = createTransactionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { date, description, amount, type, category, receiptPhotoPath } = parsed.data
  const categoryId = await resolveCategoryId(pool, category, type)

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO "Transaction" (date, description, amount, type, "categoryId", "receiptPhotoPath")
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [date, description, amount, type, categoryId, receiptPhotoPath ?? null],
  )
  const { rows: full } = await pool.query<TransactionRow>(`${SELECT_WITH_CATEGORY} WHERE t.id = $1`, [rows[0].id])
  res.status(201).json(serializeTransaction(full[0]))
})

router.put("/:id", async (req, res) => {
  const { id } = req.params
  const parsed = updateTransactionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { rows: existingRows } = await pool.query<{ type: string; receiptPhotoPath: string | null }>(
    'SELECT type, "receiptPhotoPath" FROM "Transaction" WHERE id = $1',
    [id],
  )
  const existing = existingRows[0]
  if (!existing) {
    return res.status(404).json({ error: "Transação não encontrada" })
  }

  const { date, description, amount, category, receiptPhotoPath } = parsed.data
  const categoryId = await resolveCategoryId(pool, category, existing.type as "receita" | "despesa")

  await pool.query(
    `UPDATE "Transaction"
     SET date = $1, description = $2, amount = $3, "categoryId" = $4,
         "receiptPhotoPath" = COALESCE($5, "receiptPhotoPath"), "updatedAt" = now()
     WHERE id = $6`,
    [date, description, amount, categoryId, receiptPhotoPath ?? null, id],
  )

  if (receiptPhotoPath && existing.receiptPhotoPath && existing.receiptPhotoPath !== receiptPhotoPath) {
    await deleteReceiptFile(existing.receiptPhotoPath)
  }

  const { rows: full } = await pool.query<TransactionRow>(`${SELECT_WITH_CATEGORY} WHERE t.id = $1`, [id])
  res.json(serializeTransaction(full[0]))
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params
  const { rows: existingRows } = await pool.query<{ receiptPhotoPath: string | null }>(
    'SELECT "receiptPhotoPath" FROM "Transaction" WHERE id = $1',
    [id],
  )
  await pool.query('DELETE FROM "Transaction" WHERE id = $1', [id])
  await deleteReceiptFile(existingRows[0]?.receiptPhotoPath)
  res.json({ ok: true })
})

export default router
