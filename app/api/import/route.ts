import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/server/prisma"
import { resolveCategoryId } from "@/lib/categories"
import { parseBalancoWorkbook } from "@/lib/server/import-balanco"

export async function POST(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let result: ReturnType<typeof parseBalancoWorkbook>
  try {
    result = parseBalancoWorkbook(buffer, file.name)
  } catch (error) {
    console.error("Erro ao ler planilha:", error)
    const message = error instanceof Error ? error.message : "Não foi possível ler o arquivo."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { entries, year } = result

  if (dryRun) {
    return NextResponse.json({
      year,
      total: entries.length,
      receitas: entries.filter((e) => e.type === "receita").length,
      despesas: entries.filter((e) => e.type === "despesa").length,
      categories: [...new Set(entries.map((e) => e.category))],
      preview: entries.slice(0, 10),
    })
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "Nenhum lançamento reconhecido no arquivo" }, { status: 400 })
  }

  let imported = 0
  let duplicates = 0

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const categoryId = await resolveCategoryId(tx, entry.category, entry.type)

      const existing = await tx.transaction.findFirst({
        where: { date: entry.date, amount: entry.amount, type: entry.type, description: entry.description, categoryId },
      })
      if (existing) {
        duplicates += 1
        continue
      }

      await tx.transaction.create({
        data: { date: entry.date, description: entry.description, amount: entry.amount, type: entry.type, categoryId },
      })
      imported += 1
    }
  })

  return NextResponse.json({ imported, duplicates })
}
