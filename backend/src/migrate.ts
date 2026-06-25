import fs from "fs"
import path from "path"
import { pool } from "./db"

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.join(__dirname, "..", "..", "database", "migrations")

export async function runMigrations() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "_migrations" (name TEXT PRIMARY KEY, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`,
  )

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM "_migrations" WHERE name = $1', [file])
    if (rows.length > 0) continue

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query(sql)
      await client.query('INSERT INTO "_migrations" (name) VALUES ($1)', [file])
      await client.query("COMMIT")
      console.log(`Migration aplicada: ${file}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}
