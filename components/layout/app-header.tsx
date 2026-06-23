"use client"

import { Home, TrendingUp, TrendingDown, FileText, Clover, Menu, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    description: "Visão geral das finanças",
  },
  {
    title: "Receitas",
    url: "/receitas",
    icon: TrendingUp,
    description: "Gerenciar receitas",
  },
  {
    title: "Despesas",
    url: "/despesas",
    icon: TrendingDown,
    description: "Gerenciar despesas",
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: FileText,
    description: "Relatórios e exportação",
  },
]

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  if (pathname === "/login") {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full header-glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg float-animation">
            <Clover className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Gestor de Loterias
          </span>
        </div>

        {/* Menu Desktop */}
        <nav className="hidden md:flex items-center space-x-1">
          {items.map((item) => (
            <Link key={item.title} href={item.url}>
              <Button
                variant={pathname === item.url ? "default" : "ghost"}
                className={cn(
                  "flex items-center gap-2 transition-all duration-200",
                  pathname === item.url
                    ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg"
                    : "hover:bg-white/50",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Button>
            </Link>
          ))}
          <Button variant="ghost" className="flex items-center gap-2 hover:bg-white/50" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </nav>

        {/* Menu Mobile */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="hover:bg-white/50">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-white/95 backdrop-blur-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-green-500 rounded-lg">
                  <Clover className="h-4 w-4 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  Gestor de Loterias
                </span>
              </SheetTitle>
              <SheetDescription>Sistema Financeiro para Loteria</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col gap-2 mt-6">
              {items.map((item) => (
                <Link
                  key={item.title}
                  href={item.url}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                    pathname === item.url
                      ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg"
                      : "text-muted-foreground hover:bg-white/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs opacity-70">{item.description}</span>
                  </div>
                </Link>
              ))}
              <button
                onClick={() => {
                  setIsOpen(false)
                  handleLogout()
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/50 hover:text-foreground transition-all duration-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="font-medium">Sair</span>
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
