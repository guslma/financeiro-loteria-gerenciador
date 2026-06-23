import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/auth"

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = token ? await verifySessionToken(token) : null

  if (session) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|icon-.*\\.png|apple-icon.png).*)",
  ],
}
