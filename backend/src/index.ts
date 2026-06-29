import express from "express"
import cookieParser from "cookie-parser"
import path from "path"
import transactionsRouter from "./routes/transactions"
import categoriesRouter from "./routes/categories"
import receiptsRouter from "./routes/receipts"
import importRouter from "./routes/import"
import settingsRouter from "./routes/settings"
import authRouter from "./routes/auth"
import { requireAuth } from "./lib/auth"
import { UPLOADS_DIR } from "./lib/receipt-storage"
import { runMigrations } from "./migrate"

for (const name of ["APP_USERNAME", "APP_PASSWORD", "APP_JWT_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Variável de ambiente ${name} não configurada. Defina-a antes de subir o app.`)
    process.exit(1)
  }
}

const app = express()
app.set("trust proxy", 1)
const PORT = process.env.PORT ?? 3000
const FRONTEND_DIST = process.env.FRONTEND_DIST ?? path.join(__dirname, "..", "..", "frontend", "dist")

app.use(express.json())
app.use(cookieParser())

app.use("/api/auth", authRouter)

app.use("/api/transactions", requireAuth, transactionsRouter)
app.use("/api/categories", requireAuth, categoriesRouter)
app.use("/api/receipts", requireAuth, receiptsRouter)
app.use("/api/import", requireAuth, importRouter)
app.use("/api/settings", requireAuth, settingsRouter)

app.use("/uploads", requireAuth, express.static(UPLOADS_DIR))

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
