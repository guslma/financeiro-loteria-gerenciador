import { useState, type FormEvent } from "react"
import { Clover, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(username, password)
    } catch {
      setError("Usuário ou senha inválidos")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-wrap bg-slate-50 text-[14px] text-slate-900">
      <section className="flex min-h-[260px] flex-[1_1_420px] flex-col justify-between gap-8 bg-gradient-to-br from-blue-700 via-cyan-700 to-green-700 p-8 text-white md:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
            <Clover className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold">Gestor de Loterias</span>
        </div>
        <div className="max-w-[460px]">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight md:text-[38px]">As contas da lotérica num lugar só.</h1>
          <p className="mt-3.5 text-[17px] leading-relaxed text-white/90">
            Receitas, despesas, comprovantes e relatórios do mês, no computador ou no celular.
          </p>
        </div>
        <span className="text-[13px] text-white/85">Versão {__APP_VERSION__}</span>
      </section>

      <section className="flex flex-[1_1_420px] items-center justify-center px-5 py-10">
        <form onSubmit={handleSubmit} className="flex w-full max-w-[380px] flex-col gap-[18px]">
          <div>
            <h2 className="text-[26px] font-bold">Entrar</h2>
            <p className="mt-1.5 text-slate-600">Use o usuário e a senha da lotérica.</p>
          </div>
          <div>
            <label htmlFor="username" className="mb-1.5 block font-semibold">
              Usuário
            </label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block font-semibold">
              Senha
            </label>
            <div className="flex h-12 items-center rounded-xl border border-slate-300 bg-white pl-3.5 pr-1.5 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-200">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                className="flex h-10 w-10 items-center justify-center rounded-[9px] text-slate-600 hover:bg-slate-100"
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm font-medium text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-[50px] rounded-xl bg-blue-700 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </div>
  )
}
