import { Routes, Route } from "react-router-dom"
import { AppHeader } from "@/components/layout/app-header"
import { Toaster } from "@/components/ui/toaster"
import Dashboard from "@/pages/Dashboard"
import Receitas from "@/pages/Receitas"
import Despesas from "@/pages/Despesas"
import Relatorios from "@/pages/Relatorios"
import Importar from "@/pages/Importar"
import Login from "@/pages/Login"
import { useAuth } from "@/lib/auth-context"

function App() {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>
  }

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 relative">
      <div className="fixed inset-0 bg-gradient-to-br from-white/80 via-transparent to-white/60 pointer-events-none" />
      <div className="relative z-10">
        <AppHeader />
        <main className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/receitas" element={<Receitas />} />
            <Route path="/despesas" element={<Despesas />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/importar" element={<Importar />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </div>
  )
}

export default App
