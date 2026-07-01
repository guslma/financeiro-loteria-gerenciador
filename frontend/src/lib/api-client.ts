export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: "receita" | "despesa"
  category: string
  receiptPhotoPath: string | null
}

export interface Category {
  id: string
  name: string
  type: "receita" | "despesa"
}

export interface Settings {
  id: number
  storeName: string
}

// Disparado quando uma chamada à API recebe 401 — o AuthProvider escuta esse
// evento pra derrubar a sessão e mostrar a tela de login, mesmo sem o
// usuário ter interagido com nada nessa página.
export const UNAUTHORIZED_EVENT = "auth:unauthorized"

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", ...init?.headers },
  })
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ? JSON.stringify(body.error) : `Erro ${response.status}`)
  }
  return response.json()
}

export function login(username: string, password: string): Promise<{ username: string }> {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) })
}

export function logout(): Promise<{ ok: true }> {
  return request("/api/auth/logout", { method: "POST" })
}

export function fetchMe(): Promise<{ username: string }> {
  return request("/api/auth/me")
}

export function fetchTransactions(type?: "receita" | "despesa"): Promise<Transaction[]> {
  const query = type ? `?type=${type}` : ""
  return request(`/api/transactions${query}`)
}

export function createTransaction(payload: {
  date: string
  description: string
  amount: number
  type: "receita" | "despesa"
  category: string
  receiptPhotoPath?: string
}): Promise<Transaction> {
  return request("/api/transactions", { method: "POST", body: JSON.stringify(payload) })
}

export function updateTransaction(
  id: string,
  payload: { date: string; description: string; amount: number; category: string; receiptPhotoPath?: string },
): Promise<Transaction> {
  return request(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(payload) })
}

async function uploadFile<T>(url: string, file: File): Promise<T> {
  const formData = new FormData()
  formData.append("file", file)
  const response = await fetch(url, { method: "POST", body: formData, headers: { "X-Requested-With": "XMLHttpRequest" } })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Erro ${response.status}`)
  }
  return response.json()
}

export function uploadReceipt(file: File): Promise<{ path: string }> {
  return uploadFile("/api/receipts", file)
}

export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null
  categoryGuess: string | null
  rawText: string
}

export function extractReceipt(file: File): Promise<ReceiptExtraction> {
  return uploadFile("/api/receipts/extract", file)
}

export interface ImportPreview {
  year: number
  total: number
  receitas: number
  despesas: number
  categories: string[]
  preview: { date: string; type: "receita" | "despesa"; category: string; description: string; amount: number }[]
}

export function previewImport(file: File): Promise<ImportPreview> {
  return uploadFile("/api/import?dryRun=true", file)
}

export function confirmImport(file: File): Promise<{ imported: number; duplicates: number }> {
  return uploadFile("/api/import", file)
}

export function deleteTransaction(id: string): Promise<{ ok: true }> {
  return request(`/api/transactions/${id}`, { method: "DELETE" })
}

export function fetchCategories(type: "receita" | "despesa"): Promise<Category[]> {
  return request(`/api/categories?type=${type}`)
}

export function createCategory(name: string, type: "receita" | "despesa"): Promise<Category> {
  return request("/api/categories", { method: "POST", body: JSON.stringify({ name, type }) })
}

export function renameCategory(id: string, name: string): Promise<Category> {
  return request(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify({ name }) })
}

export function deleteCategory(id: string): Promise<{ ok: true }> {
  return request(`/api/categories/${id}`, { method: "DELETE" })
}

export function fetchSettings(): Promise<Settings> {
  return request("/api/settings")
}

export function updateSettings(storeName: string): Promise<Settings> {
  return request("/api/settings", { method: "PUT", body: JSON.stringify({ storeName }) })
}
