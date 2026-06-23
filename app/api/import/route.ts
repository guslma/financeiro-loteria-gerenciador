import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/server/prisma"
import { resolveCategoryId } from "@/lib/categories"
import { parseTransactionsFromWorkbook } from "@/lib/server/import-spreadsheet"

export async function POST(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true"

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let result: ReturnType<typeof parseTransactionsFromWorkbook>
  try {
    result = parseTransactionsFromWorkbook(buffer)
  } catch (error) {
    console.error("Erro ao ler planilha:", error)
    return NextResponse.json({ error: "Não foi possível ler o arquivo. Confirme que é um .xlsx ou .xls válido." }, { status: 400 })
  }

  const { transactions, skipped } = result

  if (dryRun) {
    return NextResponse.json({
      total: transactions.length,
      skipped,
      receitas: transactions.filter((t) => t.type === "receita").length,
      despesas: transactions.filter((t) => t.type === "despesa").length,
      categories: [...new Set(transactions.map((t) => t.category))],
      preview: transactions.slice(0, 10),
    })
  }

  if (transactions.length === 0) {
    return NextResponse.json({ error: "Nenhuma transação reconhecida no arquivo" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    for (const t of transactions) {
      const categoryId = await resolveCategoryId(tx, t.category, t.type)
      await tx.transaction.create({
        data: { date: t.date, description: t.description, amount: t.amount, type: t.type, categoryId },
      })
    }
  })

  return NextResponse.json({ imported: transactions.length, skipped })
}
