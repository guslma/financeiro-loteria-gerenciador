
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, TrendingUp, TrendingDown } from "lucide-react"
import { getYear, getMonthIndex } from "@/lib/dates"
import { fetchTransactions } from "@/lib/api-client"
import type { Transaction } from "@/lib/api-client"
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

// Gera uma cor distinta por índice, sem precisar manter uma paleta fixa —
// importante porque o número de categorias varia (cada lotérico tem as suas).
function categoryColor(index: number, total: number) {
  const hue = total > 0 ? Math.round((index * 360) / total) : 0
  return `hsl(${hue}, 70%, 50%)`
}

// Lotéricas reais costumam ter muito mais categorias de despesa do que de
// receita, com escalas bem diferentes (Folha Salarial vs. Água, por
// exemplo) — mostrar todas como barras lado a lado vira poluição visual.
// Mantemos só as maiores e agrupamos o resto em "Outras Despesas".
const DESPESA_CHART_LIMIT = 5
const OUTRAS_DESPESAS_LABEL = "Outras Despesas"

// Mesma lógica de "top N + Outras" aplicada às pizzas de receita/despesa do
// modo "Por Mês" — sem isso, lotéricas com muitas categorias acabam com uma
// pizza ilegível de fatias minúsculas.
const PIE_CHART_LIMIT = 5

function pieDataFromTotals(totals: Map<string, number>, outrasLabel: string) {
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, PIE_CHART_LIMIT)
  const outrasTotal = sorted.slice(PIE_CHART_LIMIT).reduce((sum, [, value]) => sum + value, 0)
  const data = top.map(([name, value]) => ({ name, value }))
  if (outrasTotal > 0) data.push({ name: outrasLabel, value: outrasTotal })
  return data
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filterType, setFilterType] = useState("year") // "month", "year"
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())

  useEffect(() => {
    fetchTransactions()
      .then(setTransactions)
      .catch((error) => console.error("Erro ao carregar transações:", error))
  }, [])

  // Processar dados para gráficos mensais
  const processFilteredData = () => {
    let filteredTransactions = [...transactions]

    // Aplicar filtros baseado no tipo selecionado
    if (filterType === "month") {
      filteredTransactions = transactions.filter(
        (t) => getMonthIndex(t.date) === selectedMonth && getYear(t.date) === selectedYear,
      )
    } else if (filterType === "year") {
      filteredTransactions = transactions.filter((t) => getYear(t.date) === selectedYear)
    }

    // Categorias usadas dinamicamente, em vez de uma lista fixa no código —
    // cada lotérico tem suas próprias categorias de receita/despesa.
    const receitaCategories = [...new Set(filteredTransactions.filter((t) => t.type === "receita").map((t) => t.category))]
    const despesaCategories = [...new Set(filteredTransactions.filter((t) => t.type === "despesa").map((t) => t.category))]

    // Categorias de despesa que ganham barra própria no gráfico: as maiores
    // pelo total do período filtrado, com o restante agrupado em "Outras".
    const receitaTotals = new Map<string, number>()
    const despesaTotals = new Map<string, number>()
    for (const t of filteredTransactions) {
      const totals = t.type === "receita" ? receitaTotals : despesaTotals
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
    }
    const topDespesaCategories = [...despesaTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, DESPESA_CHART_LIMIT)
      .map(([category]) => category)
    const hasOutrasDespesas = despesaCategories.length > topDespesaCategories.length
    const despesaChartCategories = hasOutrasDespesas
      ? [...topDespesaCategories, OUTRAS_DESPESAS_LABEL]
      : topDespesaCategories
    const despesaChartKey = (category: string) =>
      topDespesaCategories.includes(category) ? category : OUTRAS_DESPESAS_LABEL

    // Processar dados mensais para gráficos
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
    const monthlyData = months.map((month, index) => {
      const monthTransactions = filteredTransactions.filter((t) => getMonthIndex(t.date) === index)

      const data: Record<string, string | number> = { month }
      let totalReceitas = 0
      let totalDespesas = 0

      for (const category of receitaCategories) {
        const sum = monthTransactions
          .filter((t) => t.type === "receita" && t.category === category)
          .reduce((s, t) => s + t.amount, 0)
        data[category] = sum
        totalReceitas += sum
      }

      for (const category of despesaCategories) {
        const sum = monthTransactions
          .filter((t) => t.type === "despesa" && t.category === category)
          .reduce((s, t) => s + t.amount, 0)
        const key = despesaChartKey(category)
        data[key] = ((data[key] as number) ?? 0) + sum
        totalDespesas += sum
      }

      const fluxoCaixa = totalReceitas - totalDespesas

      return { ...data, totalReceitas, totalDespesas, fluxoCaixa }
    })

    // Calcular fluxo acumulado
    let acumulado = 0
    return {
      monthlyData: monthlyData.map((data) => {
        acumulado += data.fluxoCaixa
        return { ...data, fluxoAcumulado: acumulado }
      }),
      filteredTransactions,
      receitaCategories,
      despesaChartCategories,
      receitaPieData: pieDataFromTotals(receitaTotals, "Outras Receitas"),
      despesaPieData: pieDataFromTotals(despesaTotals, OUTRAS_DESPESAS_LABEL),
    }
  }

  const {
    monthlyData,
    filteredTransactions,
    receitaCategories,
    despesaChartCategories,
    receitaPieData,
    despesaPieData,
  } = processFilteredData()

  const availableYears = [...new Set([new Date().getFullYear(), ...transactions.map((t) => getYear(t.date))])].sort(
    (a, b) => b - a,
  )

  const totalReceitas = filteredTransactions.filter((t) => t.type === "receita").reduce((sum, t) => sum + t.amount, 0)
  const totalDespesas = filteredTransactions.filter((t) => t.type === "despesa").reduce((sum, t) => sum + t.amount, 0)
  const saldo = totalReceitas - totalDespesas

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Dashboard Financeiro</h1>
          <p className="text-muted-foreground mt-2">Visão geral das suas finanças</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Por Mês</SelectItem>
              <SelectItem value="year">Por Ano</SelectItem>
            </SelectContent>
          </Select>

          {filterType === "month" && (
            <>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(Number.parseInt(value))}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(Number.parseInt(value))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
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
                  ].map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {filterType === "year" && (
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number.parseInt(value))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Receitas
              {filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][selectedMonth]}{" "}
                  {selectedYear}
                </div>
              )}
              {filterType === "year" && <div className="text-xs text-muted-foreground font-normal">{selectedYear}</div>}
            </CardTitle>
            <div className="rounded-xl bg-green-100 p-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-green-600">
              R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Despesas
              {filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][selectedMonth]}{" "}
                  {selectedYear}
                </div>
              )}
              {filterType === "year" && <div className="text-xs text-muted-foreground font-normal">{selectedYear}</div>}
            </CardTitle>
            <div className="rounded-xl bg-red-100 p-2 text-red-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-red-600">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo do Período
              {filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][selectedMonth]}{" "}
                  {selectedYear}
                </div>
              )}
              {filterType === "year" && <div className="text-xs text-muted-foreground font-normal">{selectedYear}</div>}
            </CardTitle>
            <div className="rounded-xl bg-blue-100 p-2 text-blue-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold tracking-tight ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
              R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Transações
              {filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][selectedMonth]}{" "}
                  {selectedYear}
                </div>
              )}
              {filterType === "year" && <div className="text-xs text-muted-foreground font-normal">{selectedYear}</div>}
            </CardTitle>
            <div className="rounded-xl bg-purple-100 p-2 text-purple-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{filteredTransactions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      {filterType === "month" ? (
        // Sem evolução mensal nem fluxo acumulado nesse modo — não fazem
        // sentido pra um único mês. Pizzas mostram a composição por categoria.
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Receitas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {receitaPieData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem receitas no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={receitaPieData} dataKey="value" nameKey="name" outerRadius={100} label={(entry) => entry.name}>
                      {receitaPieData.map((entry, index) => (
                        <Cell key={entry.name} fill={categoryColor(index, receitaPieData.length)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              {despesaPieData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem despesas no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={despesaPieData} dataKey="value" nameKey="name" outerRadius={100} label={(entry) => entry.name}>
                      {despesaPieData.map((entry, index) => (
                        <Cell key={entry.name} fill={categoryColor(index, despesaPieData.length)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Evolução das Receitas */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução das Receitas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    {receitaCategories.map((category, index) => (
                      <Bar
                        key={category}
                        dataKey={category}
                        fill={categoryColor(index, receitaCategories.length)}
                        name={category}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fluxo de Caixa */}
            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Caixa Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                    <Line type="monotone" dataKey="fluxoCaixa" stroke="#8884d8" strokeWidth={2} name="Fluxo de Caixa" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Evolução das Despesas */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Evolução das Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    {despesaChartCategories.map((category, index) => (
                      <Bar
                        key={category}
                        dataKey={category}
                        fill={categoryColor(index, despesaChartCategories.length)}
                        name={category}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Fluxo de Caixa Acumulado */}
            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Caixa Acumulado</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                    <Line type="monotone" dataKey="fluxoAcumulado" stroke="#06b6d4" strokeWidth={3} name="Acumulado" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Comparativo Receitas vs Despesas */}
          <Card>
            <CardHeader>
              <CardTitle>Comparativo Anual - Receitas vs Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Bar dataKey="totalReceitas" fill="#22c55e" name="Total Receitas" />
                  <Bar dataKey="totalDespesas" fill="#ef4444" name="Total Despesas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
