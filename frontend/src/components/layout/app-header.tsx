import { LayoutDashboard, TrendingUp, TrendingDown, Clover, LogOut } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"

const items = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard },
  { title: "Receitas", url: "/receitas", icon: TrendingUp },
  { title: "Despesas", url: "/despesas", icon: TrendingDown },
]

export function AppHeader() {
  const { pathname } = useLocation()
  const { logout } = useAuth()

  // Marca, menu e Sair sempre nas mesmas três colunas: o menu não muda de lugar
  // de uma página para outra.
  return (
    <header className="sticky top-0 z-50 w-full header-glass">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr] md:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-blue-500 to-green-500">
            <Clover className="h-5 w-5 text-white" />
          </div>
          <span className="text-[17px] font-bold text-blue-700">Gestor de Loterias</span>
          <span className="text-xs text-slate-500" title="Versão do app">
            v{__APP_VERSION__}
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Menu">
          {items.map((item) => {
            const active = pathname === item.url
            return (
              <Link
                key={item.title}
                to={item.url}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] px-3.5 py-2 font-medium transition-colors",
                  active
                    ? "bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-md"
                    : "text-slate-700 hover:bg-white/70",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 font-medium text-slate-700 hover:bg-white/70"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
            <span className="sr-only sm:hidden">Sair</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export function AppBottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bottom-nav-glass pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Menu">
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const isActive = pathname === item.url
          return (
            <Link
              key={item.title}
              to={item.url}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors duration-200",
                isActive ? "text-blue-700" : "text-slate-600",
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
