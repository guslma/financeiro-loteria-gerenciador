"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, TrendingUp, TrendingDown } from "lucide-react"
import { safeJSONParse } from "@/lib/storage"
import { categoriesMatch } from "@/lib/categories"
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  type: "receita" | "despesa"
  paymentMethod: string
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filterType, setFilterType] = useState("month") // "month", "year"
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())

  useEffect(() => {
    const stored = localStorage.getItem("financial-transactions")
    setTransactions(safeJSONParse<Transaction[]>(stored, []))
  }, [])

  // Processar dados para gráficos mensais
  const processFilteredData = () => {
    let filteredTransactions = [...transactions]

    // Aplicar filtros baseado no tipo selecionado
    if (filterType === "month") {
      filteredTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date)
        return transactionDate.getMonth() === selectedMonth && transactionDate.getFullYear() === selectedYear
      })
    } else if (filterType === "year") {
      filteredTransactions = transactions.filter((t) => {
        const transactionDate = new Date(t.date)
        return transactionDate.getFullYear() === selectedYear
      })
    }

    const sumByCategory = (
      monthTransactions: Transaction[],
      type: Transaction["type"],
      category: string,
    ) =>
      monthTransactions
        .filter((t) => t.type === type && categoriesMatch(t.category, category))
        .reduce((sum, t) => sum + t.amount, 0)

    // Processar dados mensais para gráficos
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
    const monthlyData = months.map((month, index) => {
      const monthTransactions = filteredTransactions.filter((t) => {
        const transactionMonth = new Date(t.date).getMonth()
        return transactionMonth === index
      })

      const comissaoContas = sumByCategory(monthTransactions, "receita", "Comissão Contas")
      const comissaoBolao = sumByCategory(monthTransactions, "receita", "Comissão Bolão")
      const comissaoJogos = sumByCategory(monthTransactions, "receita", "Comissão Jogos")
      const salarios = sumByCategory(monthTransactions, "despesa", "Salários")
      const contasFixas = sumByCategory(monthTransactions, "despesa", "Contas Fixas")
      const suprimentos = sumByCategory(monthTransactions, "despesa", "Suprimentos")
      const manutencao = sumByCategory(monthTransactions, "despesa", "Manutenção")

      const totalReceitas = comissaoContas + comissaoBolao + comissaoJogos
      const totalDespesas = salarios + contasFixas + suprimentos + manutencao
      const fluxoCaixa = totalReceitas - totalDespesas

      return {
        month,
        comissaoContas,
        comissaoBolao,
        comissaoJogos,
        salarios,
        contasFixas,
        suprimentos,
        manutencao,
        totalReceitas,
        totalDespesas,
        fluxoCaixa,
      }
    })

    // Calcular fluxo acumulado
    let acumulado = 0
    return {
      monthlyData: monthlyData.map((data) => {
        acumulado += data.fluxoCaixa
        return { ...data, fluxoAcumulado: acumulado }
      }),
      filteredTransactions,
    }
  }

  const { monthlyData, filteredTransactions } = processFilteredData()

  const totalReceitas = filteredTransactions.filter((t) => t.type === "receita").reduce((sum, t) => sum + t.amount, 0)
  const totalDespesas = filteredTransactions.filter((t) => t.type === "despesa").reduce((sum, t) => sum + t.amount, 0)
  const saldo = totalReceitas - totalDespesas

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Financeiro</h1>
          <p className="text-muted-foreground mt-2">Visão geral das suas finanças</p>
        </div>
        <div className="flex gap-2 items-center">
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
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
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
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
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
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
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
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
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
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
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
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTransactions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
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
                <Bar dataKey="comissaoContas" fill="#22c55e" name="Comissão Contas" />
                <Bar dataKey="comissaoBolao" fill="#3b82f6" name="Comissão Bolão" />
                <Bar dataKey="comissaoJogos" fill="#f59e0b" name="Comissão Jogos" />
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
                <Bar dataKey="salarios" fill="#ef4444" name="Salários" />
                <Bar dataKey="contasFixas" fill="#f97316" name="Contas Fixas" />
                <Bar dataKey="suprimentos" fill="#eab308" name="Suprimentos" />
                <Bar dataKey="manutencao" fill="#84cc16" name="Manutenção" />
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
    </div>
  )
}
