import type { Transaction } from "@/lib/api-client"
import { formatDatePtBR } from "@/lib/dates"
import {
  MONTHS,
  MONTHS_SHORT,
  byCategory,
  categoryByMonth,
  inPeriod,
  money,
  monthlyTotals,
  percent,
  periodLabel,
  totals,
  wholeNumber,
  type Period,
} from "@/lib/finance"

// O relatório impresso é montado como string HTML; nomes de categoria vêm do
// usuário, da planilha importada ou da IA e não podem virar marcação.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 12px; }
  .page { padding: 40px 44px 32px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
  .kicker { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #475569; }
  h1 { margin: 4px 0 0; font-size: 26px; letter-spacing: -0.02em; }
  h2 { margin: 18px 0 8px; font-size: 13px; }
  .store { text-align: right; font-size: 15px; font-weight: 700; }
  .store span { display: block; font-size: 12px; font-weight: 400; color: #475569; margin-top: 2px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; }
  .card .l { color: #475569; font-size: 11px; }
  .card .v { font-size: 17px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  td, th { padding: 6px 8px; text-align: left; }
  .r { text-align: right; }
  tr.alt { background: #f8fafc; }
  tr.total td { font-weight: 700; border-top: 1px solid #0f172a; }
  .green { color: #047857; } .red { color: #be123c; } .muted { color: #475569; }
  .bar { display: grid; grid-template-columns: 170px 1fr 150px; gap: 10px; align-items: center; margin-bottom: 6px; }
  .bar .track { height: 9px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
  .bar .fill { height: 100%; background: #e11d48; opacity: .75; }
  .year th { background: #0f172a; color: #fff; font-weight: 600; }
  .year td, .year th { padding: 5px 4px; font-size: 9.5px; }
  .year .group td { font-weight: 700; text-transform: uppercase; letter-spacing: .06em; padding-top: 10px; }
  .year .saldo td { background: #f1f5f9; font-weight: 700; }
  .chart { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; height: 120px; align-items: end; border-bottom: 1px solid #94a3b8; margin-top: 6px; }
  .chart div { display: flex; gap: 2px; align-items: flex-end; justify-content: center; height: 100%; }
  .chart span { width: 40%; display: block; }
  .chart-labels { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; text-align: center; color: #475569; font-size: 10px; margin-top: 4px; }
  footer { margin-top: 24px; display: flex; justify-content: space-between; color: #475569; font-size: 10.5px; border-top: 1px solid #cbd5e1; padding-top: 8px; }
  @media print { @page { size: A4; margin: 0; } }
`

function cardsHtml(list: Transaction[]) {
  const t = totals(list)
  const margem = t.receitas ? (t.saldo / t.receitas) * 100 : 0
  const card = (label: string, value: string, cls = "") =>
    `<div class="card"><div class="l">${label}</div><div class="v ${cls}">${value}</div></div>`
  return `<div class="cards">${card("Receitas", money(t.receitas), "green")}${card("Despesas", money(t.despesas), "red")}${card("Saldo", money(t.saldo))}${card("Margem", percent(margem))}</div>`
}

function categoryTable(list: Transaction[], type: "receita" | "despesa") {
  const rows = byCategory(list, type)
  const total = rows.reduce((a, r) => a + r.value, 0)
  const cls = type === "receita" ? "green" : "red"
  return `<table>${rows
    .map(
      (r, i) =>
        `<tr class="${i % 2 ? "alt" : ""}"><td>${escapeHtml(r.name)}</td><td class="r">${money(r.value)}</td><td class="r muted">${percent(total ? (r.value / total) * 100 : 0)}</td></tr>`,
    )
    .join("")}<tr class="total"><td>Total</td><td class="r ${cls}">${money(total)}</td><td></td></tr></table>`
}

function monthReport(list: Transaction[], period: Extract<Period, { mode: "month" }>) {
  const items = list.filter((t) => inPeriod(t, period))
  const despesas = byCategory(items, "despesa")
  const despTotal = despesas.reduce((a, r) => a + r.value, 0)
  const top = despesas.length ? despesas[0].value : 1
  const biggest = items
    .filter((t) => t.type === "despesa")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
  return `
    ${cardsHtml(items)}
    <div class="cols">
      <div><h2 class="green">Receitas</h2>${categoryTable(items, "receita")}</div>
      <div><h2 class="red">Despesas</h2>${categoryTable(items, "despesa")}</div>
    </div>
    <h2>Para onde foi o dinheiro</h2>
    ${despesas
      .map(
        (r) =>
          `<div class="bar"><span>${escapeHtml(r.name)}</span><span class="track"><span class="fill" style="display:block;width:${((r.value / top) * 100).toFixed(1)}%"></span></span><span class="r">${money(r.value)} · ${percent(despTotal ? (r.value / despTotal) * 100 : 0)}</span></div>`,
      )
      .join("")}
    <h2>5 maiores despesas</h2>
    <table>${biggest
      .map(
        (t, i) =>
          `<tr class="${i % 2 ? "alt" : ""}"><td class="muted">${formatDatePtBR(t.date)}</td><td>${escapeHtml(t.category)}</td><td class="r">${money(t.amount)}</td></tr>`,
      )
      .join("")}</table>`
}

function yearReport(list: Transaction[], year: number) {
  const items = list.filter((t) => inPeriod(t, { mode: "year", year }))
  const { receitas, despesas } = monthlyTotals(items, year)
  const max = Math.max(...receitas, ...despesas, 1)
  const rows = (type: "receita" | "despesa") =>
    categoryByMonth(items, type, year)
      .map(
        (c, i) =>
          `<tr class="${i % 2 ? "alt" : ""}"><td>${escapeHtml(c.name)}</td>${c.months.map((v) => `<td class="r">${wholeNumber(v)}</td>`).join("")}<td class="r"><b>${wholeNumber(c.total)}</b></td></tr>`,
      )
      .join("")
  const line = (label: string, values: number[], cls: string) =>
    `<tr class="total ${cls}"><td>${label}</td>${values.map((v) => `<td class="r">${wholeNumber(v)}</td>`).join("")}<td class="r">${wholeNumber(values.reduce((a, b) => a + b, 0))}</td></tr>`
  const saldo = receitas.map((r, m) => r - despesas[m])
  return `
    ${cardsHtml(items)}
    <div class="chart">${MONTHS_SHORT.map(
      (_, m) =>
        `<div><span style="height:${((receitas[m] / max) * 100).toFixed(1)}%;background:#059669"></span><span style="height:${((despesas[m] / max) * 100).toFixed(1)}%;background:#fda4af"></span></div>`,
    ).join("")}</div>
    <div class="chart-labels">${MONTHS_SHORT.map((m) => `<span>${m}</span>`).join("")}</div>
    <h2>Mês a mês por categoria</h2>
    <table class="year">
      <tr><th>Categoria</th>${MONTHS_SHORT.map((m) => `<th class="r">${m}</th>`).join("")}<th class="r">Total</th></tr>
      <tr class="group green"><td colspan="14">Receitas</td></tr>${rows("receita")}${line("Total de receitas", receitas, "green")}
      <tr class="group red"><td colspan="14">Despesas</td></tr>${rows("despesa")}${line("Total de despesas", despesas, "red")}
      <tr class="saldo"><td>Saldo</td>${saldo.map((v) => `<td class="r">${wholeNumber(v)}</td>`).join("")}<td class="r">${wholeNumber(saldo.reduce((a, b) => a + b, 0))}</td></tr>
    </table>
    <p class="muted" style="font-size:10px">Valores em reais, sem centavos.</p>`
}

/** Abre o relatório do período numa janela pronta para imprimir ou salvar como PDF. */
export function printReport(list: Transaction[], period: Period, storeName: string): boolean {
  const now = new Date()
  const generated = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
  const title = period.mode === "month" ? `${MONTHS[period.month]} de ${period.year}` : String(period.year)
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ${escapeHtml(title)}</title><style>${STYLE}</style></head>
    <body><div class="page">
      <header><div><div class="kicker">${period.mode === "month" ? "Relatório mensal" : "Relatório anual"}</div><h1>${escapeHtml(title)}</h1></div>
      <div class="store">${escapeHtml(storeName)}<span>Gestor de Loterias</span></div></header>
      ${period.mode === "month" ? monthReport(list, period) : yearReport(list, period.year)}
      <footer><span>Gerado em ${generated}</span><span>${escapeHtml(periodLabel(period))}</span></footer>
    </div></body></html>`
  const win = window.open("", "_blank")
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.onload = () => setTimeout(() => win.print(), 250)
  return true
}
