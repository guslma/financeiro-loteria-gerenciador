import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  FileSpreadsheet,
  Minus,
  Percent,
  Plus,
  Printer,
  ScanLine,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { fetchSettings, fetchTransactions } from "@/lib/api-client"
import type { Transaction } from "@/lib/api-client"
import { formatDatePtBR, getMonthIndex, getYear } from "@/lib/dates"
import {
  MONTHS,
  MONTHS_SHORT,
  byCategory,
  categoryByMonth,
  change,
  inPeriod,
  money,
  monthlyTotals,
  percent,
  periodLabel,
  previousPeriod,
  totals,
  wholeNumber,
  type Period,
} from "@/lib/finance"
import { exportExcel, printReport } from "@/lib/report-export"
import { cn } from "@/lib/utils"

const GOOD = "text-emerald-700"
const BAD = "text-rose-700"

function Panel({ title, subtitle, action, className, children }: { title: string; subtitle?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("min-w-0 rounded-[14px] border border-slate-200 bg-white/90 p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]", className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold">{title}</h2>
          {subtitle && <p className="text-[13px] text-slate-600">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Delta({ value, unit, upIsGood }: { value: number | null; unit: string; upIsGood: boolean }) {
  if (value === null) return <span className="font-semibold text-slate-600">—</span>
  const good = value >= 0 === upIsGood
  return (
    <span className={cn("font-semibold", good ? GOOD : BAD)}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {unit}
    </span>
  )
}

function CategoryBars({ rows, total, color }: { rows: { name: string; value: number }[]; total: number; color: string }) {
  if (!rows.length) return <p className="text-slate-500">Nada lançado neste período.</p>
  const top = rows[0].value || 1
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1.5 flex justify-between gap-3 tabular-nums">
            <span className="font-medium capitalize">{r.name}</span>
            <span className="text-slate-700">
              {money(r.value)} <span className="text-slate-500">· {percent(total ? (r.value / total) * 100 : 0)}</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${((r.value / top) * 100).toFixed(1)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [storeName, setStoreName] = useState("Minha Lotérica")
  const [period, setPeriod] = useState<Period | null>(null)

  useEffect(() => {
    fetchTransactions()
      .then((data) => {
        setTransactions(data)
        // Abre no mês mais recente que já tem receitas: as receitas entram no fim do mês,
        // então o mês em andamento costuma ter só despesas e pareceria um prejuízo.
        const withIncome = data.filter((t) => t.type === "receita")
        const latest = (withIncome.length ? withIncome : data).reduce((max, t) => (t.date > max ? t.date : max), "")
        const now = new Date()
        setPeriod(
          latest
            ? { mode: "month", year: getYear(latest), month: getMonthIndex(latest) }
            : { mode: "month", year: now.getFullYear(), month: now.getMonth() },
        )
      })
      .catch((error) => {
        console.error("Erro ao carregar lançamentos:", error)
        toast({ title: "Erro", description: "Erro ao carregar os lançamentos", variant: "destructive" })
      })
    fetchSettings()
      .then((s) => s.storeName && setStoreName(s.storeName))
      .catch(() => {})
  }, [])

  const years = useMemo(() => {
    const set = new Set(transactions.map((t) => getYear(t.date)))
    set.add(new Date().getFullYear())
    return [...set].sort((a, b) => a - b)
  }, [transactions])

  if (!period) {
    return <div className="py-20 text-center text-slate-500">Carregando...</div>
  }

  const year = period.year
  const items = transactions.filter((t) => inPeriod(t, period))
  const cur = totals(items)
  const monthly = monthlyTotals(transactions, year)
  const lastMonthWithData = monthly.receitas.reduce((last, r, m) => (r || monthly.despesas[m] ? m : last), -1)
  const prev = previousPeriod(period, lastMonthWithData)
  const before = totals(transactions.filter(prev.matches))
  const margem = cur.receitas ? (cur.saldo / cur.receitas) * 100 : 0
  const margemAntes = before.receitas ? (before.saldo / before.receitas) * 100 : null

  const cards = [
    { label: "Receitas", value: money(cur.receitas), valueClass: GOOD, icon: TrendingUp, iconClass: "bg-emerald-100 text-emerald-700", delta: change(cur.receitas, before.receitas), unit: "%", upIsGood: true, note: prev.label },
    { label: "Despesas", value: money(cur.despesas), valueClass: BAD, icon: TrendingDown, iconClass: "bg-rose-100 text-rose-700", delta: change(cur.despesas, before.despesas), unit: "%", upIsGood: false, note: prev.label },
    { label: "Saldo", value: money(cur.saldo), valueClass: cur.saldo >= 0 ? "text-slate-900" : BAD, icon: DollarSign, iconClass: "bg-blue-100 text-blue-700", delta: change(cur.saldo, before.saldo), unit: "%", upIsGood: true, note: prev.label },
    { label: "Margem", value: percent(margem), valueClass: "text-slate-900", icon: Percent, iconClass: "bg-violet-100 text-violet-700", delta: margemAntes === null ? null : margem - margemAntes, unit: " p.p.", upIsGood: true, note: "do que entra vira lucro" },
  ]

  const max = Math.max(...monthly.receitas, ...monthly.despesas, 1)
  const saldoPoints = monthly.receitas
    .map((r, m) => (r || monthly.despesas[m] ? `${((m + 0.5) * 100).toFixed(1)},${(220 - (Math.max(0, r - monthly.despesas[m]) / max) * 220).toFixed(1)}` : null))
    .filter(Boolean)
    .join(" ")
  // Melhor e pior mês só entre os meses que já têm receitas: o mês em andamento ainda não fechou.
  const closed = monthly.receitas.map((r, m) => ({ m, saldo: r - monthly.despesas[m] })).filter(({ m }) => monthly.receitas[m] > 0)
  const best = closed.length ? closed.reduce((a, b) => (b.saldo > a.saldo ? b : a)) : null
  const worst = closed.length ? closed.reduce((a, b) => (b.saldo < a.saldo ? b : a)) : null
  const yearRec = monthly.receitas.reduce((a, b) => a + b, 0)
  const yearDesp = monthly.despesas.reduce((a, b) => a + b, 0)

  const recBars = byCategory(items, "receita")
  const despBars = byCategory(items, "despesa")
  const biggest = items.filter((t) => t.type === "despesa").sort((a, b) => b.amount - a.amount).slice(0, 5)
  const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const heatRec = categoryByMonth(transactions, "receita", year)
  const heatDesp = categoryByMonth(transactions, "despesa", year)

  const minYear = years[0]
  const maxYear = years[years.length - 1]
  const goPrev = () => {
    if (period.mode === "month") {
      if (period.month > 0) setPeriod({ ...period, month: period.month - 1 })
      else if (year > minYear) setPeriod({ mode: "month", year: year - 1, month: 11 })
    } else if (year > minYear) setPeriod({ mode: "year", year: year - 1 })
  }
  const goNext = () => {
    if (period.mode === "month") {
      if (period.month < 11) setPeriod({ ...period, month: period.month + 1 })
      else if (year < maxYear) setPeriod({ mode: "month", year: year + 1, month: 0 })
    } else if (year < maxYear) setPeriod({ mode: "year", year: year + 1 })
  }
  const selectedMonth = period.mode === "month" ? period.month : -1

  const heatRows = (rows: ReturnType<typeof categoryByMonth>, rgb: string) =>
    rows.map((c) => {
      const cmax = Math.max(...c.months, 1)
      return (
        <tr key={c.name} className="hover:bg-slate-50">
          <th scope="row" className="sticky left-0 bg-white px-2.5 py-1.5 text-left font-medium capitalize">{c.name}</th>
          {c.months.map((v, m) => (
            <td
              key={m}
              className={cn("rounded px-2 py-1.5 text-right", !v && "text-slate-400")}
              style={{ background: v ? `rgba(${rgb},${(0.08 + 0.5 * (v / cmax)).toFixed(2)})` : undefined }}
            >
              {wholeNumber(v)}
            </td>
          ))}
          <td className="px-2.5 py-1.5 text-right font-semibold">{wholeNumber(c.total)}</td>
        </tr>
      )
    })

  return (
    <div className="flex flex-col gap-5 text-[14px] text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-medium text-slate-600">{storeName}</p>
          <h1 className="text-[28px] font-bold tracking-tight">Visão geral</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/importar" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3.5 font-medium hover:bg-slate-50">
            <Download className="h-4 w-4" /> Importar planilha
          </Link>
          <button type="button" onClick={() => exportExcel(transactions, period)} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-300 bg-white px-3.5 font-medium hover:bg-slate-50">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!printReport(transactions, period, storeName)) {
                toast({ title: "Aviso", description: "Permita janelas pop-up para gerar o PDF", variant: "destructive" })
              }
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-blue-700 px-3.5 font-semibold text-white hover:bg-blue-800"
          >
            <Printer className="h-4 w-4" /> Gerar PDF
          </button>
        </div>
      </div>

      <section aria-label="Atalhos" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/receitas?novo=1" className="flex items-center gap-3 rounded-[14px] bg-emerald-700 px-4 py-3.5 font-semibold text-white shadow-[0_6px_16px_rgba(4,120,87,0.22)] hover:bg-emerald-800">
          <Plus className="h-5 w-5" /> Nova receita
        </Link>
        <Link to="/despesas?novo=1" className="flex items-center gap-3 rounded-[14px] bg-rose-700 px-4 py-3.5 font-semibold text-white shadow-[0_6px_16px_rgba(190,18,60,0.22)] hover:bg-rose-800">
          <Minus className="h-5 w-5" /> Nova despesa
        </Link>
        <Link to="/despesas?novo=1&escanear=1" className="flex items-center gap-3 rounded-[14px] border border-slate-300 bg-white px-4 py-3.5 font-semibold hover:bg-slate-50">
          <ScanLine className="h-5 w-5 text-blue-700" /> Escanear comprovante
        </Link>
      </section>

      <section aria-label="Período" className="flex flex-wrap items-center gap-3 rounded-[14px] border border-slate-200 bg-white/85 p-3">
        <div role="group" aria-label="Ver por" className="inline-flex rounded-[10px] bg-slate-100 p-[3px]">
          {(["month", "year"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={period.mode === mode}
              onClick={() =>
                setPeriod(mode === "year" ? { mode, year } : { mode, year, month: selectedMonth >= 0 ? selectedMonth : Math.max(0, lastMonthWithData) })
              }
              className={cn("h-[34px] rounded-lg px-4 font-semibold", period.mode === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-600")}
            >
              {mode === "month" ? "Mês" : "Ano"}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={goPrev} aria-label="Período anterior" className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50">
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <span className="min-w-[150px] text-center text-base font-bold">{periodLabel(period)}</span>
          <button type="button" onClick={goNext} aria-label="Próximo período" className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50">
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
        <span className="text-slate-600">Tudo abaixo mostra este período.</span>
      </section>

      <section aria-label="Resumo" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="flex flex-col gap-1.5 rounded-[14px] border border-slate-200 bg-white/90 p-[18px] shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">{c.label}</span>
              <span className={cn("flex h-[34px] w-[34px] items-center justify-center rounded-[10px]", c.iconClass)}>
                <c.icon className="h-[18px] w-[18px]" />
              </span>
            </div>
            <div className={cn("text-[28px] font-bold tracking-tight tabular-nums", c.valueClass)}>{c.value}</div>
            <div className="text-[13px] text-slate-600 tabular-nums">
              <Delta value={c.delta} unit={c.unit} upIsGood={c.upIsGood} /> {c.note}
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-5">
        <Panel
          title={`Receitas e despesas em ${year}`}
          className="flex-[999_1_600px]"
          action={
            <div className="flex flex-wrap gap-4 text-[13px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-emerald-600" />Receitas</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-rose-300" />Despesas</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-4 rounded bg-blue-700" />Saldo</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <div className="relative min-w-[560px]">
              <div className="relative grid h-[220px] grid-cols-12 items-end gap-2 border-b border-slate-300">
                {MONTHS_SHORT.map((label, m) => {
                  const has = monthly.receitas[m] > 0 || monthly.despesas[m] > 0
                  const title = has
                    ? `${MONTHS[m]}: receitas ${money(monthly.receitas[m])}, despesas ${money(monthly.despesas[m])}, saldo ${money(monthly.receitas[m] - monthly.despesas[m])}`
                    : `${MONTHS[m]}: sem lançamentos`
                  return (
                    <button
                      key={label}
                      type="button"
                      title={title}
                      aria-label={title}
                      onClick={() => has && setPeriod({ mode: "month", year, month: m })}
                      className={cn("flex h-full items-end justify-center gap-[3px] rounded-t-lg px-0.5", selectedMonth === m && "bg-blue-50")}
                    >
                      <span className="w-[38%] max-w-[22px] rounded-t bg-emerald-600" style={{ height: `${((monthly.receitas[m] / max) * 100).toFixed(1)}%` }} />
                      <span className="w-[38%] max-w-[22px] rounded-t bg-rose-300" style={{ height: `${((monthly.despesas[m] / max) * 100).toFixed(1)}%` }} />
                    </button>
                  )
                })}
                <svg viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                  <polyline points={saldoPoints} fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-12 gap-2">
                {MONTHS_SHORT.map((label, m) => (
                  <span key={label} className={cn("text-center text-xs", selectedMonth === m ? "font-bold text-blue-700" : "text-slate-600")}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-slate-500">Clique num mês para ver só ele.</p>
        </Panel>

        <Panel title={`${year} até agora`} className="flex-[1_1_280px]">
          {[
            { label: "Receitas", value: money(yearRec), cls: GOOD },
            { label: "Despesas", value: money(yearDesp), cls: BAD },
            { label: "Saldo", value: money(yearRec - yearDesp), cls: "" },
            { label: "Melhor mês", value: best ? `${MONTHS[best.m]} · ${money(best.saldo)}` : "—", cls: "" },
            { label: "Mês mais fraco", value: worst ? `${MONTHS[worst.m]} · ${money(worst.saldo)}` : "—", cls: "" },
          ].map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2.5 tabular-nums">
              <span className="text-slate-600">{line.label}</span>
              <span className={cn("text-right font-bold", line.cls)}>{line.value}</span>
            </div>
          ))}
        </Panel>
      </div>

      <div className="flex flex-wrap gap-5">
        <Panel title="De onde veio o dinheiro" subtitle={`Receitas de ${periodLabel(period)} por categoria`} className="flex-[1_1_380px]">
          <CategoryBars rows={recBars} total={cur.receitas} color="bg-emerald-600" />
        </Panel>
        <Panel title="Para onde foi o dinheiro" subtitle={`Despesas de ${periodLabel(period)} por categoria`} className="flex-[1_1_380px]">
          <CategoryBars rows={despBars} total={cur.despesas} color="bg-rose-600/80" />
        </Panel>
      </div>

      <div className="flex flex-wrap gap-5">
        <Panel title="5 maiores despesas" subtitle={periodLabel(period)} className="flex-[1_1_380px]">
          {biggest.length === 0 && <p className="text-slate-500">Nenhuma despesa neste período.</p>}
          <ol>
            {biggest.map((t, i) => (
              <li key={t.id} className="flex items-center gap-3 border-t border-slate-100 py-2.5">
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-rose-50 text-[13px] font-bold text-rose-700">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium capitalize">{t.category}</span>
                  <span className="block text-xs text-slate-500">{formatDatePtBR(t.date)}</span>
                </span>
                <span className="font-semibold tabular-nums text-rose-700">{money(t.amount)}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel
          title="Últimos lançamentos"
          subtitle={periodLabel(period)}
          className="flex-[1_1_380px]"
          action={
            <span className="flex gap-3.5 font-semibold">
              <Link to="/receitas" className="text-blue-700 hover:text-blue-900">Receitas →</Link>
              <Link to="/despesas" className="text-blue-700 hover:text-blue-900">Despesas →</Link>
            </span>
          }
        >
          {recent.length === 0 && <p className="text-slate-500">Nada lançado neste período.</p>}
          {recent.map((t) => {
            const isRec = t.type === "receita"
            return (
              <div key={t.id} className="flex items-center gap-3 border-t border-slate-100 py-2.5">
                <span className={cn("flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px]", isRec ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                  {isRec ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium capitalize">{t.category}</span>
                  <span className="block text-xs text-slate-500">{formatDatePtBR(t.date)}</span>
                </span>
                <span className={cn("font-semibold tabular-nums", isRec ? GOOD : BAD)}>
                  {isRec ? "+ " : "− "}
                  {money(t.amount)}
                </span>
              </div>
            )
          })}
        </Panel>
      </div>

      <Panel title={`Mês a mês por categoria — ${year}`} action={<span className="text-xs text-slate-500">Quanto mais forte a cor, maior o valor dentro da categoria</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-[12.5px] tabular-nums">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 min-w-[170px] bg-white px-2.5 py-2 text-left font-semibold text-slate-600">Categoria</th>
                {MONTHS_SHORT.map((label, m) => (
                  <th key={label} scope="col" className={cn("rounded-t-md px-2 py-2 text-right font-semibold", selectedMonth === m ? "bg-blue-50 text-blue-700" : "text-slate-600")}>
                    {label}
                  </th>
                ))}
                <th scope="col" className="px-2.5 py-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr><th colSpan={14} scope="colgroup" className="px-2.5 pb-1.5 pt-3 text-left text-xs uppercase tracking-wider text-emerald-700">Receitas</th></tr>
              {heatRows(heatRec, "5,150,105")}
              <tr className="font-bold text-emerald-700">
                <th scope="row" className="sticky left-0 border-t border-slate-300 bg-white px-2.5 py-2 text-left">Total de receitas</th>
                {monthly.receitas.map((v, m) => <td key={m} className="border-t border-slate-300 px-2 py-2 text-right">{wholeNumber(v)}</td>)}
                <td className="border-t border-slate-300 px-2.5 py-2 text-right">{wholeNumber(yearRec)}</td>
              </tr>
              <tr><th colSpan={14} scope="colgroup" className="px-2.5 pb-1.5 pt-4 text-left text-xs uppercase tracking-wider text-rose-700">Despesas</th></tr>
              {heatRows(heatDesp, "225,29,72")}
              <tr className="font-bold text-rose-700">
                <th scope="row" className="sticky left-0 border-t border-slate-300 bg-white px-2.5 py-2 text-left">Total de despesas</th>
                {monthly.despesas.map((v, m) => <td key={m} className="border-t border-slate-300 px-2 py-2 text-right">{wholeNumber(v)}</td>)}
                <td className="border-t border-slate-300 px-2.5 py-2 text-right">{wholeNumber(yearDesp)}</td>
              </tr>
              <tr className="font-bold">
                <th scope="row" className="sticky left-0 rounded-l-lg bg-slate-100 px-2.5 py-2.5 text-left">Saldo do mês</th>
                {monthly.receitas.map((r, m) => {
                  const s = r - monthly.despesas[m]
                  return <td key={m} className={cn("bg-slate-100 px-2 py-2.5 text-right", s >= 0 ? GOOD : BAD)}>{r || monthly.despesas[m] ? wholeNumber(s) : "—"}</td>
                })}
                <td className={cn("rounded-r-lg bg-slate-100 px-2.5 py-2.5 text-right", yearRec - yearDesp >= 0 ? GOOD : BAD)}>{wholeNumber(yearRec - yearDesp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
