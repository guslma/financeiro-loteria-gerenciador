// Importa os balanços anuais reais (planilhas "Despesas") para o banco.
// Uso: node scripts/import-balanco.mjs "<arquivo1.xlsx>" "<arquivo2.xlsx>" ...
import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import { readFileSync } from "fs"
import path from "path"

const prisma = new PrismaClient()

const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]

// Linhas que marcam o início de uma seção. O valor é o nome de categoria
// usado como fallback para linhas sem rótulo dentro dessa seção (ex: valores
// lançados sem nome dentro do bloco de Impostos).
const SECTION_HEADERS = {
  receitas: { type: "receita", fallbackCategory: "Receitas" },
  impostos: { type: "despesa", fallbackCategory: "Impostos" },
  "despesas diversas": { type: "despesa", fallbackCategory: "Despesas Diversas" },
}
const STOP_LABEL = "fluxo de caixa"

function normalize(label) {
  return label.trim().toLowerCase()
}

function parseYearFromFilename(filePath) {
  const match = path.basename(filePath).match(/(\d{4})/)
  if (!match) throw new Error(`Não consegui extrair o ano do nome do arquivo: ${filePath}`)
  return Number(match[1])
}

function extractLeafEntries(filePath) {
  const buffer = readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Despesas"]
  if (!sheet) throw new Error(`Aba "Despesas" não encontrada em ${filePath}`)

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
  const year = parseYearFromFilename(filePath)

  const entries = []
  let currentSection = null

  for (const row of rows) {
    const rawLabel = row[0]
    const label = typeof rawLabel === "string" ? rawLabel.trim() : ""
    const normalized = normalize(label)

    if (normalized === STOP_LABEL) break

    if (label && SECTION_HEADERS[normalized]) {
      currentSection = SECTION_HEADERS[normalized]
      continue // linha de cabeçalho de seção, é a soma das linhas abaixo — não é um lançamento próprio
    }

    // Linha sem rótulo: só vale a pena processar se estiver dentro de uma
    // seção conhecida e tiver algum valor (caso real: lançamentos sem nome
    // dentro do bloco de Impostos em Balanço 2024).
    const effectiveLabel = label || currentSection?.fallbackCategory
    if (!effectiveLabel || !currentSection) continue

    const type = currentSection.type

    for (let month = 0; month < 12; month++) {
      const value = row[month + 1]
      const amount = typeof value === "number" ? value : Number.parseFloat(value)
      if (!amount || Number.isNaN(amount)) continue

      const date = `${year}-${String(month + 1).padStart(2, "0")}-01`
      const description = `${effectiveLabel} - ${MONTHS[month]}/${year}`
      entries.push({ date, description, amount, type, category: effectiveLabel })
    }
  }

  return entries
}

async function resolveCategoryId(name, type) {
  const existing = await prisma.category.findMany({ where: { type } })
  const match = existing.find((cat) => normalize(cat.name) === normalize(name))
  if (match) return match.id

  const created = await prisma.category.create({ data: { name, type } })
  return created.id
}

async function main() {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error("Uso: node scripts/import-balanco.mjs <arquivo1.xlsx> [arquivo2.xlsx ...]")
    process.exit(1)
  }

  let imported = 0
  let duplicates = 0

  for (const file of files) {
    const entries = extractLeafEntries(file)
    console.log(`${path.basename(file)}: ${entries.length} lançamentos encontrados`)

    for (const entry of entries) {
      const categoryId = await resolveCategoryId(entry.category, entry.type)

      const existing = await prisma.transaction.findFirst({
        where: { date: entry.date, amount: entry.amount, type: entry.type, description: entry.description, categoryId },
      })
      if (existing) {
        duplicates += 1
        continue
      }

      await prisma.transaction.create({
        data: { date: entry.date, description: entry.description, amount: entry.amount, type: entry.type, categoryId },
      })
      imported += 1
    }
  }

  console.log(`\nImportado: ${imported} | Duplicados ignorados: ${duplicates}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
