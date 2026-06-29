import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { fetchMe, login as loginRequest, logout as logoutRequest, UNAUTHORIZED_EVENT } from "@/lib/api-client"

interface AuthContextValue {
  isLoading: boolean
  isAuthenticated: boolean
  username: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    fetchMe()
      .then((data) => setUsername(data.username))
      .catch(() => setUsername(null))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => setUsername(null)
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  async function login(usernameInput: string, password: string) {
    const data = await loginRequest(usernameInput, password)
    setUsername(data.username)
  }

  async function logout() {
    await logoutRequest().catch(() => {})
    setUsername(null)
  }

  return (
    <AuthContext.Provider value={{ isLoading, isAuthenticated: username !== null, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth precisa estar dentro de um AuthProvider")
  return context
}
