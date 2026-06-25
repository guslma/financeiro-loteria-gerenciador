import * as XLSX from "xlsx"

export interface ParsedEntry {
  date: string // YYYY-MM-DD (sempre dia 1, já que a planilha só tem totais mensais)
  description: string
  amount: number
  type: "receita" | "despesa"
  category: string
}

export interface ParseResult {
  entries: ParsedEntry[]
  year: number
}

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

// Linhas que marcam o início de uma seção na aba "Despesas". O valor é a
// categoria usada como fallback para linhas sem rótulo dentro da seção (ex:
// um lançamento sem nome dentro do bloco de Impostos).
const SECTION_HEADERS: Record<string, { type: "receita" | "despesa"; fallbackCategory: string }> = {
  receitas: { type: "receita", fallbackCategory: "Receitas" },
  impostos: { type: "despesa", fallbackCategory: "Impostos" },
  "despesas diversas": { type: "despesa", fallbackCategory: "Despesas Diversas" },
}
const STOP_LABEL = "fluxo de caixa"

function normalize(label: string): string {
  return label.trim().toLowerCase()
}

function parseYearFromFilename(filename: string): number | null {
  const match = filename.match(/(\d{4})/)
  return match ? Number(match[1]) : null
}

// Planilha de balanço anual no formato: uma linha por categoria, uma coluna
// por mês (JAN..DEZ), na aba "Despesas". Cada seção (Receitas, Impostos,
// Despesas Diversas) soma as linhas abaixo dela até a próxima seção ou até
// "Fluxo de Caixa", que marca o fim dos dados relevantes.
export function parseBalancoWorkbook(buffer: Buffer, filename: string): ParseResult {
  const year = parseYearFromFilename(filename) ?? new Date().getFullYear()
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Despesas"]
  if (!sheet) {
    throw new Error('Aba "Despesas" não encontrada na planilha. Confira se é uma planilha de balanço anual.')
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" })
  const entries: ParsedEntry[] = []
  let currentSection: { type: "receita" | "despesa"; fallbackCategory: string } | null = null

  for (const row of rows) {
    const rawLabel = row[0]
    const label = typeof rawLabel === "string" ? rawLabel.trim() : ""
    const normalized = normalize(label)

    if (normalized === STOP_LABEL) break

    if (label && SECTION_HEADERS[normalized]) {
      currentSection = SECTION_HEADERS[normalized]
      continue
    }

    const effectiveLabel = label || currentSection?.fallbackCategory
    if (!effectiveLabel || !currentSection) continue

    const type = currentSection.type

    for (let month = 0; month < 12; month++) {
      const value = row[month + 1]
      const amount = typeof value === "number" ? value : Number.parseFloat(String(value))
      if (!amount || Number.isNaN(amount)) continue

      const date = `${year}-${String(month + 1).padStart(2, "0")}-01`
      const description = `${effectiveLabel} - ${MONTHS[month]}/${year}`
      entries.push({ date, description, amount, type, category: effectiveLabel })
    }
  }

  return { entries, year }
}
