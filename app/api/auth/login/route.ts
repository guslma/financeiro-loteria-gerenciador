import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifyPassword } from "@/lib/auth"

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 400 })
  }

  const { username, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { username } })
  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false

  if (!user || !passwordOk) {
    return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 })
  }

  const token = await createSessionToken(user.id)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  })
  return response
}
