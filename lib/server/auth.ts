import "server-only"
import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "session"
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60 // 30 dias

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error("SESSION_SECRET não configurado")
  }
  return new TextEncoder().encode(secret)
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret())
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    if (typeof payload.userId !== "string") return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}

export const SESSION_MAX_AGE = SESSION_DURATION_SECONDS
