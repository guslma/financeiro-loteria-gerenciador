import express from "express"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
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
import { logger } from "./lib/logger"

for (const name of ["APP_USERNAME", "APP_PASSWORD", "APP_JWT_SECRET"]) {
  if (!process.env[name]) {
    logger.error(`Variável de ambiente ${name} não configurada. Defina-a antes de subir o app.`)
    process.exit(1)
  }
}

const app = express()
app.set("trust proxy", 1)
const PORT = process.env.PORT ?? 3000
const FRONTEND_DIST = process.env.FRONTEND_DIST ?? path.join(__dirname, "..", "..", "frontend", "dist")

// Headers de segurança HTTP.
//
// CSP desligado: o vite-plugin-pwa injeta scripts inline para registrar o
// service worker, e o helmet padrão ("script-src: 'self'") bloquearia.
// HSTS desligado: o app roda em rede local/ZimaOS frequentemente via HTTP
// puro — HSTS forçaria HTTPS em visitas futuras, impedindo o acesso.
//
// Os demais headers do helmet (X-Content-Type-Options, X-Frame-Options,
// X-Download-Options, etc.) permanecem ativos.
app.use(
  helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false,
  }),
)

// Rate limiting aplicado APENAS nas rotas /api/* — arquivos estáticos (JS,
// CSS, imagens) não são limitados para não degradar a experiência do usuário.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em breve." },
})
app.use("/api", apiLimiter)

// Proteção CSRF via header customizado X-Requested-With.
// Requisições cross-origin não conseguem enviar esse header sem passar por
// uma pré-verificação CORS (preflight OPTIONS), que não inclui cookies.
// Endpoints de auth são exc luídos porque o login precisa funcionar sem o
// header (o usuário ainda não está autenticado para setá-lo no fetch).
function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.path.startsWith("/api/auth/")) {
    return next()
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    if (req.headers["x-requested-with"] !== "XMLHttpRequest") {
      return res.status(403).json({ error: "Requisição rejeitada por proteção CSRF" })
    }
  }
  next()
}

// Logging estruturado de requisições
app.use((req, res, next) => {
  const start = Date.now()
  res.on("finish", () => {
    logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode, duration: Date.now() - start })
  })
  next()
})

app.use(express.json())
app.use(cookieParser())
app.use(csrfProtection)

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
  logger.error(err)
  res.status(500).json({ error: "Erro interno" })
})

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Gestor de Loterias rodando em http://0.0.0.0:${PORT}`)
    })
  })
  .catch((error) => {
    logger.error("Erro ao aplicar migrations:", error)
    process.exit(1)
  })
