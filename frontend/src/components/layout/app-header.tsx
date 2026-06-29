import { Home, TrendingUp, TrendingDown, FileText, Clover, LogOut } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

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
  const { pathname } = useLocation()
  const { logout } = useAuth()

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
            <Link key={item.title} to={item.url}>
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
          <Button variant="ghost" className="hover:bg-white/50" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </nav>

        {/* Sair (mobile) */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden hover:bg-white/50"
          onClick={() => logout()}
        >
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Sair</span>
        </Button>
      </div>
    </header>
  )
}

export function AppBottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bottom-nav-glass pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const isActive = pathname === item.url
          return (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors duration-200",
                isActive ? "text-blue-600" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-xl p-1.5 transition-all duration-200",
                  isActive && "bg-gradient-to-br from-blue-500/15 to-green-500/15",
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              <span className={cn(isActive && "font-medium")}>{item.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
