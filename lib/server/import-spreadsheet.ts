import "server-only"
import * as XLSX from "xlsx"

export interface ParsedTransaction {
  date: string // YYYY-MM-DD
  type: "receita" | "despesa"
  category: string
  description: string
}

export interface ParsedTransactionWithAmount extends ParsedTransaction {
  amount: number
}

export interface ParseResult {
  transactions: ParsedTransactionWithAmount[]
  skipped: number
}

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

function parseAmountCell(value: unknown): number | null {
  if (typeof value === "number") return value
  if (typeof value !== "string") return null

  const cleaned = value.replace(/[^\d,.-]/g, "")
  if (!cleaned) return null

  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? null : parsed
}

function parseDateCell(value: unknown): string | null {
  if (value instanceof Date) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, "0")
    const day = String(value.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
      const [, day, month, year] = match
      return `${year}-${month}-${day}`
    }
  }

  return null
}

function findColumn(headerMap: Map<string, number>, ...candidates: string[]): number | null {
  for (const candidate of candidates) {
    for (const [header, index] of headerMap) {
      if (header.includes(candidate)) return index
    }
  }
  return null
}

export function parseTransactionsFromWorkbook(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const transactions: ParsedTransactionWithAmount[] = []
  let skipped = 0

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false })
    if (rows.length === 0) continue

    // Encontra a linha de cabeçalho: a primeira com colunas reconhecíveis.
    let headerRowIndex = -1
    let headerMap = new Map<string, number>()
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const candidateMap = new Map<string, number>()
      rows[i].forEach((cell, index) => {
        if (typeof cell === "string" && cell.trim()) {
          candidateMap.set(normalizeHeader(cell), index)
        }
      })
      const hasDate = [...candidateMap.keys()].some((h) => h.includes("data"))
      const hasCategory = [...candidateMap.keys()].some((h) => h.includes("categoria"))
      if (hasDate && hasCategory) {
        headerRowIndex = i
        headerMap = candidateMap
        break
      }
    }
    if (headerRowIndex === -1) continue

    const dateCol = findColumn(headerMap, "data")
    const categoryCol = findColumn(headerMap, "categoria")
    const descriptionCol = findColumn(headerMap, "descricao")
    const entradaCol = findColumn(headerMap, "entrada")
    const saidaCol = findColumn(headerMap, "saida")

    if (dateCol === null || categoryCol === null || (entradaCol === null && saidaCol === null)) {
      continue
    }

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      const date = parseDateCell(row[dateCol])
      const category = typeof row[categoryCol] === "string" ? row[categoryCol].trim() : null
      const entradaAmount = entradaCol !== null ? parseAmountCell(row[entradaCol]) : null
      const saidaAmount = saidaCol !== null ? parseAmountCell(row[saidaCol]) : null

      if (!date || !category || (!entradaAmount && !saidaAmount)) {
        skipped++
        continue
      }

      const type: "receita" | "despesa" = entradaAmount ? "receita" : "despesa"
      const amount = entradaAmount ?? saidaAmount!
      const rawDescription = descriptionCol !== null && typeof row[descriptionCol] === "string" ? row[descriptionCol].trim() : ""

      transactions.push({
        date,
        type,
        category,
        description: rawDescription || category,
        amount,
      })
    }
  }

  return { transactions, skipped }
}
