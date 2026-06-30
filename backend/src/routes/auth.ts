import { Router } from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"
import { checkCredentials, clearSessionCookie, createSessionToken, requireAuth, setSessionCookie } from "../lib/auth"

const router = Router()

// Rate limiting específico do login: 5 tentativas por minuto
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Aguarde 1 minuto." },
})

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

router.post("/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() })
  }

  const { username, password } = parsed.data
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: "Usuário ou senha inválidos" })
  }

  const token = createSessionToken(username)
  setSessionCookie(req, res, token)
  res.json({ username })
})

router.post("/logout", (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.get("/me", requireAuth, (req, res) => {
  res.json({ username: req.auth!.username })
})

export default router
