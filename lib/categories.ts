export function normalizeCategory(category: string): string {
  return category.trim().toLowerCase()
}

export function categoriesMatch(a: string, b: string): boolean {
  return normalizeCategory(a) === normalizeCategory(b)
}

export const defaultCategories: Record<"receita" | "despesa", string[]> = {
  receita: ["Comissão Contas", "Comissão Bolão", "Comissão Jogos"],
  despesa: ["Salários", "Suprimentos", "Manutenção", "Contas Fixas", "Impostos"],
}
