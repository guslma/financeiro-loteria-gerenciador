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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ? JSON.stringify(body.error) : `Erro ${response.status}`)
  }
  return response.json()
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
  const response = await fetch(url, { method: "POST", body: formData })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Erro ${response.status}`)
  }
  return response.json()
}

export function uploadReceipt(file: File): Promise<{ path: string }> {
  return uploadFile("/api/receipts", file)
}

export interface ImportPreview {
  total: number
  skipped: number
  receitas: number
  despesas: number
  categories: string[]
  preview: { date: string; type: "receita" | "despesa"; category: string; description: string; amount: number }[]
}

export function previewImport(file: File): Promise<ImportPreview> {
  return uploadFile("/api/import?dryRun=true", file)
}

export function confirmImport(file: File): Promise<{ imported: number; skipped: number; duplicates: number }> {
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
