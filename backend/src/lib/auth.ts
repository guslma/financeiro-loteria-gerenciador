import crypto from "crypto"
import jwt from "jsonwebtoken"
import type { Request, Response, NextFunction } from "express"

export const SESSION_COOKIE = "session"
const SESSION_DURATION = "7d"

function getJwtSecret(): string {
  const secret = process.env.APP_JWT_SECRET
  if (!secret) {
    throw new Error("APP_JWT_SECRET não configurado. Defina essa variável de ambiente antes de subir o app.")
  }
  return secret
}

/**
 * Versão da sessão usada no JWT para permitir revogação remota de todas
 * as sessões. Ao incrementar SESSION_VERSION, todos os tokens existentes
 * se tornam inválidos e os usuários precisam fazer login novamente.
 *
 * Use: export SESSION_VERSION=2  # invalida todas as sessões atuais
 */
function getSessionVersion(): number {
  const raw = process.env.SESSION_VERSION
  if (!raw) return 1 // versão padrão para backward compatibility
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.APP_USERNAME
  const expectedPassword = process.env.APP_PASSWORD
  if (!expectedUser || !expectedPassword) {
    throw new Error("APP_USERNAME/APP_PASSWORD não configurados. Defina essas variáveis de ambiente antes de subir o app.")
  }
  return timingSafeEqual(username, expectedUser) && timingSafeEqual(password, expectedPassword)
}

export function createSessionToken(username: string): string {
  return jwt.sign({ sub: username, ver: getSessionVersion() }, getJwtSecret(), { expiresIn: SESSION_DURATION })
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Marca o cookie como Secure só quando a conexão realmente é HTTPS
    // (direto ou via reverse proxy com X-Forwarded-Proto, com "trust proxy"
    // configurado no index.ts). Setar Secure sempre quebraria o login em
    // deploys sem TLS, como o ZimaOS expondo a porta 3000 em HTTP puro —
    // o navegador descarta cookies Secure recebidos por HTTP.
    secure: req.secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE)
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) {
    return res.status(401).json({ error: "Não autenticado" })
  }
  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload

    // Verifica versão do token para permitir revogação remota de sessões.
    if ((payload.ver as number | undefined) !== getSessionVersion()) {
      return res.status(401).json({ error: "Sessão expirada (versão do token desatualizada). Faça login novamente." })
    }

    req.auth = { username: payload.sub as string }

    // Rotação de sessão nas requisições de mutação (POST/PUT/DELETE): emite
    // um novo token com validade renovada (sliding expiration), reduzindo a
    // janela de uso de um token vazado. Em GETs apenas validamos sem girar
    // o token para evitar o overhead de assinar JWT em toda listagem.
    if (MUTATION_METHODS.has(req.method)) {
      const newToken = createSessionToken(payload.sub as string)
      setSessionCookie(req, res, newToken)
    }

    next()
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" })
  }
}

declare global {
  namespace Express {
    interface Request {
      auth?: { username: string }
    }
  }
}
