import { Router } from "express"
import { z } from "zod"
import { pool } from "../db"

const router = Router()

const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(1),
})

async function getOrCreateSettings() {
  const existing = await pool.query<{ id: number; storeName: string }>('SELECT id, "storeName" FROM "Settings" LIMIT 1')
  if (existing.rows.length > 0) return existing.rows[0]

  const created = await pool.query<{ id: number; storeName: string }>(
    'INSERT INTO "Settings" DEFAULT VALUES RETURNING id, "storeName"',
  )
  return created.rows[0]
}

router.get("/", async (_req, res) => {
  res.json(await getOrCreateSettings())
})

router.put("/", async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const settings = await getOrCreateSettings()
  const updated = await pool.query<{ id: number; storeName: string }>(
    'UPDATE "Settings" SET "storeName" = $1 WHERE id = $2 RETURNING id, "storeName"',
    [parsed.data.storeName, settings.id],
  )
  res.json(updated.rows[0])
})

export default router
