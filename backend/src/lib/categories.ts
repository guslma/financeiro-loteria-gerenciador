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

export interface Queryable {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>
}

export async function resolveCategoryId(
  client: Queryable,
  name: string,
  type: "receita" | "despesa",
): Promise<string> {
  const { rows: existing } = await client.query<{ id: string; name: string }>(
    'SELECT id, name FROM "Category" WHERE type = $1',
    [type],
  )
  const match = existing.find((cat) => categoriesMatch(cat.name, name))
  if (match) return match.id

  const { rows: created } = await client.query<{ id: string }>(
    'INSERT INTO "Category" (name, type) VALUES ($1, $2) RETURNING id',
    [name.trim(), type],
  )
  return created[0].id
}
