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

export async function uploadReceipt(file: File): Promise<{ path: string }> {
  const formData = new FormData()
  formData.append("file", file)
  const response = await fetch("/api/receipts", { method: "POST", body: formData })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Erro ${response.status}`)
  }
  return response.json()
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
