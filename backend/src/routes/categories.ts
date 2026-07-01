import { Router } from "express"
import { z } from "zod"
import { pool } from "../db"
import { categoriesMatch, defaultCategories } from "../lib/categories"

const router = Router()

const typeSchema = z.enum(["receita", "despesa"])

const CATEGORY_NAME_MAX = 100

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
  type: typeSchema,
})

const renameSchema = z.object({
  name: z.string().trim().min(1).max(CATEGORY_NAME_MAX),
})

interface CategoryRow {
  id: string
  name: string
  type: string
  createdAt: string
}

router.get("/", async (req, res) => {
  const parsedType = typeSchema.safeParse(req.query.type)
  if (!parsedType.success) {
    return res.status(400).json({ error: "type deve ser 'receita' ou 'despesa'" })
  }
  const type = parsedType.data

  let { rows: categories } = await pool.query<CategoryRow>(
    'SELECT * FROM "Category" WHERE type = $1 ORDER BY "createdAt" ASC',
    [type],
  )

  if (categories.length === 0) {
    for (const name of defaultCategories[type]) {
      await pool.query('INSERT INTO "Category" (name, type) VALUES ($1, $2)', [name, type])
    }
    const result = await pool.query<CategoryRow>('SELECT * FROM "Category" WHERE type = $1 ORDER BY "createdAt" ASC', [
      type,
    ])
    categories = result.rows
  }

  res.json(categories)
})

router.post("/", async (req, res) => {
  const parsed = createCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { name, type } = parsed.data
  const { rows: existing } = await pool.query<{ name: string }>('SELECT name FROM "Category" WHERE type = $1', [type])
  if (existing.some((cat) => categoriesMatch(cat.name, name))) {
    return res.status(409).json({ error: "Esta categoria já existe" })
  }

  const { rows } = await pool.query<CategoryRow>('INSERT INTO "Category" (name, type) VALUES ($1, $2) RETURNING *', [
    name,
    type,
  ])
  res.status(201).json(rows[0])
})

router.put("/:id", async (req, res) => {
  const { id } = req.params
  const parsed = renameSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { rows: catRows } = await pool.query<CategoryRow>('SELECT * FROM "Category" WHERE id = $1', [id])
  const category = catRows[0]
  if (!category) {
    return res.status(404).json({ error: "Categoria não encontrada" })
  }

  const { name } = parsed.data
  const { rows: siblings } = await pool.query<{ name: string }>(
    'SELECT name FROM "Category" WHERE type = $1 AND id != $2',
    [category.type, id],
  )
  if (siblings.some((cat) => categoriesMatch(cat.name, name))) {
    return res.status(409).json({ error: "Já existe uma categoria com este nome" })
  }

  const { rows } = await pool.query<CategoryRow>('UPDATE "Category" SET name = $1 WHERE id = $2 RETURNING *', [
    name,
    id,
  ])
  res.json(rows[0])
})

router.delete("/:id", async (req, res) => {
  const { id } = req.params

  const { rows: countRows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*) FROM "Transaction" WHERE "categoryId" = $1',
    [id],
  )
  if (Number(countRows[0].count) > 0) {
    return res.status(409).json({ error: "Esta categoria está sendo usada em transações existentes" })
  }

  await pool.query('DELETE FROM "Category" WHERE id = $1', [id])
  res.json({ ok: true })
})

export default router
