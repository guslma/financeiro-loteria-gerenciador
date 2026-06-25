export function normalizeCategory(category: string): string {
  return category.trim().toLowerCase()
}

export function categoriesMatch(a: string, b: string): boolean {
  return normalizeCategory(a) === normalizeCategory(b)
}
