import type { Transaction } from "@/lib/api-client"
import { categoriesMatch } from "@/lib/categories"

// Considera possível duplicata um lançamento do mesmo tipo com a mesma
// categoria e o mesmo valor no mesmo mês. O mês entra na regra porque
// despesas fixas (aluguel, FGTS) se repetem com o mesmo valor todo mês e
// não são duplicatas. A lista recebida já vem filtrada pelo tipo.
export function findDuplicateTransactions(
  transactions: Transaction[],
  candidate: { date: string; amount: number; category: string },
  excludeId?: string,
): Transaction[] {
  const cents = Math.round(candidate.amount * 100)
  const month = candidate.date.slice(0, 7)
  return transactions.filter(
    (t) =>
      t.id !== excludeId &&
      categoriesMatch(t.category, candidate.category) &&
      Math.round(t.amount * 100) === cents &&
      t.date.slice(0, 7) === month,
  )
}
