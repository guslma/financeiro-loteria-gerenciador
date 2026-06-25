// Migra dados de uma instalação antiga (SQLite) para o Postgres atual.
// Uso: npm run migrate:sqlite -- /caminho/para/app.db [--dry-run]
//
// Preserva os IDs originais de Category e Transaction (a foreign key
// Transaction.categoryId depende disso). Roda como uma transação só —
// se algo falhar no meio, nada é gravado.
import Database from "better-sqlite3"
import { Pool } from "pg"

interface SqliteCategory {
  id: string
  name: string
  type: string
  createdAt: number
}

interface SqliteTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: string
  categoryId: string
  receiptPhotoPath: string | null
  createdAt: number
  updatedAt: number
}

interface SqliteSettings {
  id: number
  storeName: string
}

async function main() {
  const dbPath = process.argv[2]
  const dryRun = process.argv.includes("--dry-run")

  if (!dbPath) {
    console.error("Uso: npm run migrate:sqlite -- /caminho/para/app.db [--dry-run]")
    process.exit(1)
  }

  const sqlite = new Database(dbPath, { readonly: true })

  const categories = sqlite.prepare("SELECT * FROM Category").all() as SqliteCategory[]
  const transactions = sqlite.prepare('SELECT * FROM "Transaction"').all() as SqliteTransaction[]
  const settings = sqlite.prepare("SELECT * FROM Settings").all() as SqliteSettings[]

  sqlite.close()

  console.log(
    `Origem (SQLite): ${categories.length} categorias, ${transactions.length} transações, ${settings.length} settings`,
  )

  const sourceReceita = transactions.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0)
  const sourceDespesa = transactions.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0)
  console.log(`Origem: total receita R$ ${sourceReceita.toFixed(2)} | total despesa R$ ${sourceDespesa.toFixed(2)}`)

  if (dryRun) {
    console.log("\n--dry-run: nada foi escrito no Postgres.")
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    for (const cat of categories) {
      await client.query(
        `INSERT INTO "Category" (id, name, type, "createdAt") VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [cat.id, cat.name, cat.type, new Date(cat.createdAt)],
      )
    }

    for (const t of transactions) {
      await client.query(
        `INSERT INTO "Transaction" (id, date, description, amount, type, "categoryId", "receiptPhotoPath", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.date, t.description, t.amount, t.type, t.categoryId, t.receiptPhotoPath, new Date(t.createdAt), new Date(t.updatedAt)],
      )
    }

    for (const s of settings) {
      await client.query(
        `INSERT INTO "Settings" (id, "storeName") VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET "storeName" = EXCLUDED."storeName"`,
        [s.id, s.storeName],
      )
    }

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }

  const destCategoryCount = await pool.query<{ count: string }>('SELECT COUNT(*) FROM "Category"')
  const destTransactionCount = await pool.query<{ count: string }>('SELECT COUNT(*) FROM "Transaction"')
  const destReceita = await pool.query<{ sum: string | null }>(
    `SELECT SUM(amount) FROM "Transaction" WHERE type = 'receita'`,
  )
  const destDespesa = await pool.query<{ sum: string | null }>(
    `SELECT SUM(amount) FROM "Transaction" WHERE type = 'despesa'`,
  )

  const destCategories = Number(destCategoryCount.rows[0].count)
  const destTransactions = Number(destTransactionCount.rows[0].count)
  const destReceitaSum = Number(destReceita.rows[0].sum ?? 0)
  const destDespesaSum = Number(destDespesa.rows[0].sum ?? 0)

  console.log(`\nDestino (Postgres): ${destCategories} categorias, ${destTransactions} transações`)
  console.log(`Destino: total receita R$ ${destReceitaSum.toFixed(2)} | total despesa R$ ${destDespesaSum.toFixed(2)}`)

  const countsMatch = destTransactions === transactions.length && destCategories >= categories.length
  const sumsMatch =
    Math.abs(destReceitaSum - sourceReceita) < 0.01 && Math.abs(destDespesaSum - sourceDespesa) < 0.01

  if (countsMatch && sumsMatch) {
    console.log("\n✓ Migração validada: contagens e somas batem com a origem.")
  } else {
    console.error(
      "\n✗ ATENÇÃO: contagens ou somas não batem com a origem — confira manualmente antes de descartar o backup.",
    )
    process.exitCode = 1
  }

  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
