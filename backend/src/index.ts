import express from "express"
import path from "path"
import transactionsRouter from "./routes/transactions"
import categoriesRouter from "./routes/categories"
import receiptsRouter from "./routes/receipts"
import importRouter from "./routes/import"
import settingsRouter from "./routes/settings"
import { UPLOADS_DIR } from "./lib/receipt-storage"
import { runMigrations } from "./migrate"

const app = express()
const PORT = process.env.PORT ?? 3000
const FRONTEND_DIST = process.env.FRONTEND_DIST ?? path.join(__dirname, "..", "..", "frontend", "dist")

app.use(express.json())

app.use("/api/transactions", transactionsRouter)
app.use("/api/categories", categoriesRouter)
app.use("/api/receipts", receiptsRouter)
app.use("/api/import", importRouter)
app.use("/api/settings", settingsRouter)

app.use("/uploads", express.static(UPLOADS_DIR))

// Serve o build do frontend e cai no index.html pra qualquer rota que não
// seja /api/* ou /uploads/* — necessário pro react-router funcionar com
// refresh direto em rotas como /relatorios.
app.use(express.static(FRONTEND_DIST))
app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, "index.html"))
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: "Erro interno" })
})

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Gestor de Loterias rodando em http://0.0.0.0:${PORT}`)
    })
  })
  .catch((error) => {
    console.error("Erro ao aplicar migrations:", error)
    process.exit(1)
  })
