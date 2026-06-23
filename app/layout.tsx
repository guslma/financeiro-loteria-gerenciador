import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { AppHeader } from "@/components/layout/app-header"
import { Toaster } from "@/components/ui/toaster"
import { DevServiceWorkerCleanup } from "@/components/dev-sw-cleanup"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <DevServiceWorkerCleanup />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 relative">
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
  title: "Gestor de Loterias",
  description: "Gestão financeira para lotéricas",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-192x192.png", sizes: "192x192" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gestor de Loterias",
  },
}

export const viewport = {
  themeColor: "#4f46e5",
}
