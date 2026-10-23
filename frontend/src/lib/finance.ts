import type { Transaction } from "@/lib/api-client"
import { getMonthIndex, getYear } from "@/lib/dates"

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]
export const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

export function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Sem centavos, para as tabelas de 12 meses onde a largura conta mais que o centavo.
export function wholeNumber(value: number): string {
  return value ? value.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"
}

export function percent(value: number, digits = 1): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`
}

/** Um período do relatório: um mês de um ano, ou o ano inteiro. */
export type Period = { mode: "month"; year: number; month: number } | { mode: "year"; year: number }

export function periodLabel(period: Period): string {
  return period.mode === "month" ? `${MONTHS[period.month]} ${period.year}` : String(period.year)
}

export function inPeriod(t: Transaction, period: Period): boolean {
  if (getYear(t.date) !== period.year) return false
  return period.mode === "year" || getMonthIndex(t.date) === period.month
}

/**
 * O período com que este é comparado: o mês anterior, ou o mesmo trecho do ano
 * anterior (até o último mês com lançamentos), para não comparar um ano em
 * andamento com um ano completo.
 */
export function previousPeriod(period: Period, lastMonthWithData: number): { matches: (t: Transaction) => boolean; label: string } {
  if (period.mode === "month") {
    const year = period.month === 0 ? period.year - 1 : period.year
    const month = period.month === 0 ? 11 : period.month - 1
    return {
      matches: (t) => getYear(t.date) === year && getMonthIndex(t.date) === month,
      label: `vs. ${MONTHS[month].toLowerCase()}`,
    }
  }
  const year = period.year - 1
  return {
    matches: (t) => getYear(t.date) === year && getMonthIndex(t.date) <= lastMonthWithData,
    label: `vs. o mesmo período de ${year}`,
  }
}

export function totals(list: Transaction[]) {
  let receitas = 0
  let despesas = 0
  for (const t of list) {
    if (t.type === "receita") receitas += t.amount
    else despesas += t.amount
  }
  return { receitas, despesas, saldo: receitas - despesas }
}

/** Receitas e despesas de cada mês de um ano. */
export function monthlyTotals(list: Transaction[], year: number) {
  const receitas = new Array(12).fill(0)
  const despesas = new Array(12).fill(0)
  for (const t of list) {
    if (getYear(t.date) !== year) continue
    const m = getMonthIndex(t.date)
    if (t.type === "receita") receitas[m] += t.amount
    else despesas[m] += t.amount
  }
  return { receitas, despesas }
}

/** Total de cada categoria de um tipo, do maior para o menor. */
export function byCategory(list: Transaction[], type: "receita" | "despesa") {
  const map = new Map<string, number>()
  for (const t of list) {
    if (t.type !== type) continue
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

/** Cada categoria de um tipo com o valor de cada mês do ano. */
export function categoryByMonth(list: Transaction[], type: "receita" | "despesa", year: number) {
  const map = new Map<string, number[]>()
  for (const t of list) {
    if (t.type !== type || getYear(t.date) !== year) continue
    const months = map.get(t.category) ?? new Array(12).fill(0)
    months[getMonthIndex(t.date)] += t.amount
    map.set(t.category, months)
  }
  return [...map.entries()]
    .map(([name, months]) => ({ name, months, total: months.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
}

/** Variação em % entre dois valores, null quando não há base de comparação. */
export function change(current: number, previous: number): number | null {
  return previous ? ((current - previous) / Math.abs(previous)) * 100 : null
}
