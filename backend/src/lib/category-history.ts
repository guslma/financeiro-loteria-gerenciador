import { barcodeIssuerKey } from "./barcode"
import { categoriesMatch, type Queryable } from "./categories"

export type CategorySource = "ia" | "historico"

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

export function normalizePayee(payee: string | null | undefined): string | null {
  const normalized = (payee ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  return normalized || null
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

// Se a IA escolheu uma categoria que já existe, usa ela. Senão, tenta achar
// no histórico uma despesa parecida e reaproveita a categoria dela; se nada
// bater, devolve o palpite da IA como sugestão de categoria nova.
export async function resolveReceiptCategory(
  client: Queryable,
  existingCategories: string[],
  receipt: { category: string | null; barcode: string | null; payee: string | null; amount: number | null },
): Promise<CategorySuggestion> {
  const existing = receipt.category
    ? existingCategories.find((name) => categoriesMatch(name, receipt.category!))
    : undefined
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

  return { category: receipt.category, source: receipt.category ? "ia" : null, reason: null }
}
