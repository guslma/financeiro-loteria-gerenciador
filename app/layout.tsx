import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { AppHeader } from "@/components/app-header"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 relative">
          {/* Imagem de fundo */}
          <div
            className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-5 pointer-events-none"
            style={{
              backgroundImage: "url('/images/financial-bg.png')",
            }}
          />

          {/* Overlay sutil */}
          <div className="fixed inset-0 bg-gradient-to-br from-white/80 via-transparent to-white/60 pointer-events-none" />

          {/* Conteúdo */}
          <div className="relative z-10">
            <AppHeader />
            <main className="container mx-auto px-4 py-6">{children}</main>
            <Toaster />
          </div>
        </div>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
