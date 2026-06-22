"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Filter } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { fetchTransactions } from "@/lib/api-client"
import type { Transaction } from "@/lib/api-client"

interface MonthlyData {
  [category: string]: {
    [month: number]: number
  }
}

interface YearlyReport {
  year: number
  receitas: MonthlyData
  despesas: MonthlyData
  totalReceitas: number[]
  totalDespesas: number[]
  saldoMensal: number[]
}

export default function Relatorios() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    type: "",
    category: "",
    filterType: "year", // Mudado de "custom" para "year"
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth(),
  })

  useEffect(() => {
    fetchTransactions()
      .then((data) => {
        setTransactions(data)
        setFilteredTransactions(data)
      })
      .catch((error) => console.error("Erro ao carregar transações:", error))
  }, [])

  const applyFilters = () => {
    let filtered = [...transactions]

    // Aplicar filtros baseado no tipo selecionado
    if (filters.filterType === "month") {
      filtered = transactions.filter((t) => {
        const transactionDate = new Date(t.date)
        return (
          transactionDate.getMonth() === filters.selectedMonth && transactionDate.getFullYear() === filters.selectedYear
        )
      })
    } else if (filters.filterType === "year") {
      filtered = transactions.filter((t) => {
        const transactionDate = new Date(t.date)
        return transactionDate.getFullYear() === filters.selectedYear
      })
    }

    if (filters.type && filters.type !== "todos") {
      filtered = filtered.filter((t) => t.type === filters.type)
    }

    if (filters.category && filters.category !== "todas") {
      filtered = filtered.filter((t) => t.category === filters.category)
    }

    setFilteredTransactions(filtered)
  }

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      type: "",
      category: "",
      filterType: "year", // Mudado de "custom" para "year"
      selectedYear: new Date().getFullYear(),
      selectedMonth: new Date().getMonth(),
    })
    setFilteredTransactions(transactions)
  }

  const processDataForPDF = (): YearlyReport[] => {
    const yearlyReports: { [year: number]: YearlyReport } = {}

    // Agrupar transações por ano
    filteredTransactions.forEach((transaction) => {
      const date = new Date(transaction.date)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (!yearlyReports[year]) {
        yearlyReports[year] = {
          year,
          receitas: {},
          despesas: {},
          totalReceitas: new Array(12).fill(0),
          totalDespesas: new Array(12).fill(0),
          saldoMensal: new Array(12).fill(0),
        }
      }

      const report = yearlyReports[year]

      if (transaction.type === "receita") {
        if (!report.receitas[transaction.category]) {
          report.receitas[transaction.category] = new Array(12).fill(0)
        }
        report.receitas[transaction.category][month] += transaction.amount
        report.totalReceitas[month] += transaction.amount
      } else {
        if (!report.despesas[transaction.category]) {
          report.despesas[transaction.category] = new Array(12).fill(0)
        }
        report.despesas[transaction.category][month] += transaction.amount
        report.totalDespesas[month] += transaction.amount
      }
    })

    // Calcular saldo mensal
    Object.values(yearlyReports).forEach((report) => {
      for (let month = 0; month < 12; month++) {
        report.saldoMensal[month] = report.totalReceitas[month] - report.totalDespesas[month]
      }
    })

    // Se está filtrando por ano específico, retornar apenas esse ano
    if (filters.filterType === "year") {
      const specificYear = yearlyReports[filters.selectedYear]
      return specificYear ? [specificYear] : []
    }

    // Se está filtrando por mês específico, retornar apenas esse ano
    if (filters.filterType === "month") {
      const specificYear = yearlyReports[filters.selectedYear]
      return specificYear ? [specificYear] : []
    }

    // Para filtros customizados, retornar todos os anos encontrados
    return Object.values(yearlyReports).sort((a, b) => b.year - a.year)
  }

  const exportToPDF = () => {
    const yearlyReports = processDataForPDF()

    if (yearlyReports.length === 0) {
      toast({
        title: "Aviso",
        description: "Não há dados para exportar",
        variant: "destructive",
      })
      return
    }

    // Criar HTML para o PDF
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    // Determinar o período para o cabeçalho
    let periodText = ""
    if (filters.filterType === "month") {
      periodText = `${monthNames[filters.selectedMonth]} de ${filters.selectedYear}`
    } else {
      periodText = `Ano ${filters.selectedYear}`
    }

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório Financeiro - Gestor de Loterias</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #4f46e5;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
          .year-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .year-title {
            background: linear-gradient(135deg, #4f46e5, #06b6d4);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
          }
          .section-title {
            background: #f8fafc;
            color: #1e293b;
            padding: 10px 15px;
            border-left: 4px solid #4f46e5;
            margin: 20px 0 10px 0;
            font-weight: bold;
            font-size: 18px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          th {
            background: #4f46e5;
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: bold;
            font-size: 12px;
          }
          td {
            padding: 10px 8px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
          }
          .category-cell {
            text-align: left;
            font-weight: bold;
            background: #f8fafc;
            color: #1e293b;
          }
          .receita-row {
            background: #f0fdf4;
          }
          .despesa-row {
            background: #fef2f2;
          }
          .total-row {
            background: #1e293b;
            color: white;
            font-weight: bold;
          }
          .saldo-row {
            background: #4f46e5;
            color: white;
            font-weight: bold;
          }
          .positive {
            color: #059669;
            font-weight: bold;
          }
          .negative {
            color: #dc2626;
            font-weight: bold;
          }
          .zero {
            color: #6b7280;
          }
          .summary {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            border: 1px solid #e2e8f0;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            padding: 5px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .summary-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 16px;
          }
          @media print {
            .year-section:not(:last-child) {
              page-break-after: always;
            }
            .year-section:last-child {
              page-break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Relatório Financeiro - Gestor de Loterias</h1>
          <p>Período: ${periodText}</p>
          <p>Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</p>
        </div>
    `

    yearlyReports.forEach((report) => {
      htmlContent += `
        <div class="year-section">
          <div class="year-title">Ano ${report.year}</div>
          
          <div class="section-title">💰 Receitas</div>
          <table>
            <thead>
              <tr>
                <th style="width: 150px;">Categoria</th>
                ${monthNames.map((month) => `<th>${month}</th>`).join("")}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
      `

      // Receitas
      Object.entries(report.receitas).forEach(([category, monthlyValues]) => {
        const total = (monthlyValues as number[]).reduce((sum, val) => sum + val, 0)
        htmlContent += `
          <tr class="receita-row">
            <td class="category-cell">${category}</td>
            ${(monthlyValues as number[])
              .map(
                (value) =>
                  `<td class="${value > 0 ? "positive" : "zero"}">
                ${value > 0 ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
              </td>`,
              )
              .join("")}
            <td class="positive">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          </tr>
        `
      })

      // Total de receitas
      const totalReceitasAnual = report.totalReceitas.reduce((sum, val) => sum + val, 0)
      htmlContent += `
        <tr class="total-row">
          <td class="category-cell">TOTAL RECEITAS</td>
          ${report.totalReceitas
            .map(
              (value) =>
                `<td>${value > 0 ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</td>`,
            )
            .join("")}
          <td>R$ ${totalReceitasAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>
      `

      htmlContent += `
            </tbody>
          </table>

          <div class="section-title">💸 Despesas</div>
          <table>
            <thead>
              <tr>
                <th style="width: 150px;">Categoria</th>
                ${monthNames.map((month) => `<th>${month}</th>`).join("")}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
      `

      // Despesas
      Object.entries(report.despesas).forEach(([category, monthlyValues]) => {
        const total = (monthlyValues as number[]).reduce((sum, val) => sum + val, 0)
        htmlContent += `
          <tr class="despesa-row">
            <td class="category-cell">${category}</td>
            ${(monthlyValues as number[])
              .map(
                (value) =>
                  `<td class="${value > 0 ? "negative" : "zero"}">
                ${value > 0 ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
              </td>`,
              )
              .join("")}
            <td class="negative">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
          </tr>
        `
      })

      // Total de despesas
      const totalDespesasAnual = report.totalDespesas.reduce((sum, val) => sum + val, 0)
      htmlContent += `
        <tr class="total-row">
          <td class="category-cell">TOTAL DESPESAS</td>
          ${report.totalDespesas
            .map(
              (value) =>
                `<td>${value > 0 ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}</td>`,
            )
            .join("")}
          <td>R$ ${totalDespesasAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        </tr>
      `

      htmlContent += `
            </tbody>
          </table>

          <div class="section-title">📈 Saldo Mensal</div>
          <table>
            <thead>
              <tr>
                <th style="width: 150px;">Saldo</th>
                ${monthNames.map((month) => `<th>${month}</th>`).join("")}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr class="saldo-row">
                <td class="category-cell">SALDO MENSAL</td>
                ${report.saldoMensal
                  .map(
                    (saldo) =>
                      `<td class="${saldo > 0 ? "positive" : saldo < 0 ? "negative" : "zero"}">
                    ${saldo !== 0 ? `R$ ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "-"}
                  </td>`,
                  )
                  .join("")}
                <td class="${(totalReceitasAnual - totalDespesasAnual) > 0 ? "positive" : totalReceitasAnual - totalDespesasAnual < 0 ? "negative" : "zero"}">
                  R$ ${(totalReceitasAnual - totalDespesasAnual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item">
              <span>📊 Total de Receitas do Ano:</span>
              <span class="positive">R$ ${totalReceitasAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="summary-item">
              <span>📊 Total de Despesas do Ano:</span>
              <span class="negative">R$ ${totalDespesasAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="summary-item">
              <span>💰 Saldo Final do Ano:</span>
              <span class="${(totalReceitasAnual - totalDespesasAnual) > 0 ? "positive" : "negative"}">
                R$ ${(totalReceitasAnual - totalDespesasAnual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      `
    })

    htmlContent += `
      </body>
      </html>
    `

    // Criar e baixar o PDF
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(htmlContent)
      printWindow.document.close()

      // Aguardar o carregamento e imprimir
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 500)
      }

      toast({
        title: "Sucesso",
        description: "Relatório PDF gerado com sucesso",
      })
    } else {
      toast({
        title: "Erro",
        description:
          "Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desabilitado.",
        variant: "destructive",
      })
    }
  }

  const totalReceitas = filteredTransactions.filter((t) => t.type === "receita").reduce((sum, t) => sum + t.amount, 0)
  const totalDespesas = filteredTransactions.filter((t) => t.type === "despesa").reduce((sum, t) => sum + t.amount, 0)
  const saldo = totalReceitas - totalDespesas
  const categorias = [...new Set(transactions.map((t) => t.category))].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <div className="flex gap-2">
          <Button onClick={exportToPDF} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre os dados para gerar relatórios personalizados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Tipo de filtro */}
            <div className="flex gap-4 items-center">
              <Label className="text-sm font-medium">Tipo de Filtro:</Label>
              <Select
                value={filters.filterType}
                onValueChange={(value: "month" | "year") => setFilters({ ...filters, filterType: value })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Por Mês</SelectItem>
                  <SelectItem value="year">Por Ano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtros condicionais */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {(filters.filterType === "month" || filters.filterType === "year") && (
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Select
                    value={filters.selectedYear.toString()}
                    onValueChange={(value) => setFilters({ ...filters, selectedYear: Number.parseInt(value) })}
                  >
                    <SelectTrigger>
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
                </div>
              )}

              {filters.filterType === "month" && (
                <div className="space-y-2">
                  <Label htmlFor="month">Mês</Label>
                  <Select
                    value={filters.selectedMonth.toString()}
                    onValueChange={(value) => setFilters({ ...filters, selectedMonth: Number.parseInt(value) })}
                  >
                    <SelectTrigger>
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
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={applyFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Aplicar Filtros
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Receitas
              {filters.filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {
                    ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][
                      filters.selectedMonth
                    ]
                  }{" "}
                  {filters.selectedYear}
                </div>
              )}
              {filters.filterType === "year" && (
                <div className="text-xs text-muted-foreground font-normal">{filters.selectedYear}</div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Despesas
              {filters.filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {
                    ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][
                      filters.selectedMonth
                    ]
                  }{" "}
                  {filters.selectedYear}
                </div>
              )}
              {filters.filterType === "year" && (
                <div className="text-xs text-muted-foreground font-normal">{filters.selectedYear}</div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="card-glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Saldo
              {filters.filterType === "month" && (
                <div className="text-xs text-muted-foreground font-normal">
                  {
                    ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][
                      filters.selectedMonth
                    ]
                  }{" "}
                  {filters.selectedYear}
                </div>
              )}
              {filters.filterType === "year" && (
                <div className="text-xs text-muted-foreground font-normal">{filters.selectedYear}</div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
              R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de transações */}
      <Card className="card-glass">
        <CardHeader>
          <CardTitle>Transações Filtradas</CardTitle>
          <CardDescription>{filteredTransactions.length} transação(ões) encontrada(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{new Date(transaction.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <span
                      className={`capitalize px-2 py-1 rounded-full text-xs ${
                        transaction.type === "receita" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {transaction.type}
                    </span>
                  </TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell className="capitalize">{transaction.category}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      transaction.type === "receita" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    R$ {transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
