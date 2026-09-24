import { barcodeIssuerKey } from "./barcode"
import type { Queryable } from "./categories"

// "nova" quando nenhuma categoria cadastrada corresponde e a IA sugeriu o
// nome de uma categoria a criar (o usuário confirma antes de salvar).
export type CategorySource = "ia" | "historico" | "nova"

export interface CategorySuggestion {
  category: string | null
  source: CategorySource | null
  reason: string | null
}

// Type em vez de interface: o Queryable exige Record<string, unknown>.
type HistoryRow = {
  amount: number
  barcode: string | null
  payee: string | null
  category: string
}

// Quanto histórico olhar. Uma lotérica lança poucas despesas por mês, então
// isso cobre anos de dados sem pesar na consulta.
const HISTORY_LIMIT = 2000

// Compara nomes ignorando acentos, maiúsculas e pontuação: "Água" = "AGUA".
export function normalizeText(text: string | null | undefined): string | null {
  const normalized = (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  return normalized || null
}

// Sufixos societários que variam entre comprovantes da mesma empresa.
const COMPANY_SUFFIXES = new Set(["sa", "ltda", "me", "epp", "eireli", "cia"])

// Como normalizeText, mas junta abreviações ("S.A.", "S/A" → "sa"), trata
// "&" como "e" e tira sufixos societários: "IGUÁ Saneamento S.A." =
// "Igua Saneamento".
export function normalizePayee(payee: string | null | undefined): string | null {
  const words = normalizeText((payee ?? "").replace(/[./-]/g, "").replace(/&/g, " e "))?.split(" ") ?? []
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop()
  return words.join(" ") || null
}

// Categoria mais usada entre os lançamentos parecidos. Em caso de empate
// vence a do lançamento mais recente (as linhas chegam ordenadas por data).
function mostCommonCategory(rows: HistoryRow[]): string | null {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.category, (counts.get(row.category) ?? 0) + 1)

  let best: string | null = null
  for (const row of rows) {
    if (best === null || counts.get(row.category)! > counts.get(best)!) best = row.category
  }
  return best
}

// Procura despesas antigas parecidas com o comprovante, do critério mais
// confiável pro menos confiável: mesma empresa no código de barras, mesmo
// beneficiário e, por último, exatamente o mesmo valor.
export function suggestFromHistory(
  rows: HistoryRow[],
  receipt: { barcode: string | null; payee: string | null; amount: number | null },
): { category: string; reason: string } | null {
  const issuer = barcodeIssuerKey(receipt.barcode)
  const payee = normalizePayee(receipt.payee)
  const cents = receipt.amount === null ? null : Math.round(receipt.amount * 100)

  const criteria: { reason: string; matches: (row: HistoryRow) => boolean }[] = [
    {
      reason: "mesma empresa no código de barras",
      matches: (row) => issuer !== null && barcodeIssuerKey(row.barcode) === issuer,
    },
    {
      reason: "mesmo beneficiário",
      matches: (row) => payee !== null && normalizePayee(row.payee) === payee,
    },
    {
      reason: "mesmo valor",
      matches: (row) => cents !== null && Math.round(row.amount * 100) === cents,
    },
  ]

  for (const { reason, matches } of criteria) {
    const category = mostCommonCategory(rows.filter(matches))
    if (category) return { category, reason }
  }
  return null
}

export interface CategoryContext {
  // Categorias de despesa da usada mais recentemente pra menos recente, pra
  // IA preferir a atual quando houver duas parecidas (ex.: "DAS Simples" e
  // "SIMPLES NACIONAL").
  categories: string[]
  // Beneficiários já registrados e a última categoria usada pra cada um.
  examples: { payee: string; category: string }[]
}

const EXAMPLES_LIMIT = 50

export async function loadCategoryContext(client: Queryable): Promise<CategoryContext> {
  const { rows: categories } = await client.query<{ name: string }>(
    `SELECT c.name
     FROM "Category" c
     LEFT JOIN "Transaction" t ON t."categoryId" = c.id
     WHERE c.type = 'despesa'
     GROUP BY c.id, c.name
     ORDER BY MAX(t.date) DESC NULLS LAST, c.name`,
  )
  const { rows: examples } = await client.query<{ payee: string; category: string }>(
    `SELECT DISTINCT ON (lower(t.payee)) t.payee, c.name AS category
     FROM "Transaction" t
     JOIN "Category" c ON c.id = t."categoryId"
     WHERE t.type = 'despesa' AND t.payee IS NOT NULL
     ORDER BY lower(t.payee), t.date DESC, t."createdAt" DESC
     LIMIT ${EXAMPLES_LIMIT}`,
  )
  return { categories: categories.map((c) => c.name), examples }
}

// Categoria cadastrada com o mesmo nome (ignorando acentos e maiúsculas).
// A lista vem ordenada pelo uso mais recente, então vence a usada por último.
export function matchExistingCategory(categories: string[], name: string | null): string | null {
  const target = normalizeText(name)
  if (!target) return null
  return categories.find((category) => normalizeText(category) === target) ?? null
}

// Só sugere categoria nova quando nada corresponde: primeiro a escolha da
// IA entre as cadastradas, depois despesas parecidas no histórico e, por
// último, o nome de categoria nova que a IA sugeriu.
export async function resolveReceiptCategory(
  client: Queryable,
  categories: string[],
  receipt: {
    category: string | null
    newCategory: string | null
    barcode: string | null
    payee: string | null
    amount: number | null
  },
): Promise<CategorySuggestion> {
  // newCategory também é conferido: a IA às vezes "sugere" um nome que já
  // existe com outra grafia ("Agua" vs "Água").
  const existing =
    matchExistingCategory(categories, receipt.category) ?? matchExistingCategory(categories, receipt.newCategory)
  if (existing) return { category: existing, source: "ia", reason: null }

  const { rows } = await client.query<HistoryRow>(
    `SELECT t.amount, t.barcode, t.payee, c.name AS category
     FROM "Transaction" t
     JOIN "Category" c ON c.id = t."categoryId"
     WHERE t.type = 'despesa'
     ORDER BY t.date DESC, t."createdAt" DESC
     LIMIT ${HISTORY_LIMIT}`,
  )
  const fromHistory = suggestFromHistory(rows, receipt)
  if (fromHistory) return { category: fromHistory.category, source: "historico", reason: fromHistory.reason }

  const suggested = receipt.newCategory ?? receipt.category
  return { category: suggested, source: suggested ? "nova" : null, reason: null }
}
