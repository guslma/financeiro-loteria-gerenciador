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

interface CategoryClient {
  category: {
    findMany: (args: { where: { type: string } }) => Promise<{ id: string; name: string }[]>
    create: (args: { data: { name: string; type: string } }) => Promise<{ id: string; name: string }>
  }
}

export async function resolveCategoryId(
  client: CategoryClient,
  name: string,
  type: "receita" | "despesa",
): Promise<string> {
  const existing = await client.category.findMany({ where: { type } })
  const match = existing.find((cat) => categoriesMatch(cat.name, name))
  if (match) return match.id

  const created = await client.category.create({ data: { name: name.trim(), type } })
  return created.id
}
