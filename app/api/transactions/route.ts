import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { resolveCategoryId } from "@/lib/categories"

const typeSchema = z.enum(["receita", "despesa"])

const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  amount: z.number().positive(),
  type: typeSchema,
  category: z.string().trim().min(1),
  receiptPhotoPath: z.string().trim().min(1).optional(),
})

function serializeTransaction(t: { id: string; date: string; description: string; amount: number; type: string; receiptPhotoPath: string | null; category: { name: string } }) {
  return {
    id: t.id,
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category.name,
    receiptPhotoPath: t.receiptPhotoPath,
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const typeParam = params.get("type")
  const year = params.get("year")
  const month = params.get("month")
  const categoryParam = params.get("category")

  const where: Record<string, unknown> = {}
  if (typeParam) {
    const parsedType = typeSchema.safeParse(typeParam)
    if (!parsedType.success) {
      return NextResponse.json({ error: "type deve ser 'receita' ou 'despesa'" }, { status: 400 })
    }
    where.type = parsedType.data
  }
  if (categoryParam) {
    where.category = { name: categoryParam }
  }

  let transactions = await prisma.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
  })

  if (year) {
    transactions = transactions.filter((t) => t.date.startsWith(`${year}-`))
  }
  if (month) {
    const monthStr = month.padStart(2, "0")
    transactions = transactions.filter((t) => t.date.slice(5, 7) === monthStr)
  }

  return NextResponse.json(transactions.map(serializeTransaction))
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { date, description, amount, type, category, receiptPhotoPath } = parsed.data
  const categoryId = await resolveCategoryId(prisma, category, type)

  const transaction = await prisma.transaction.create({
    data: { date, description, amount, type, categoryId, receiptPhotoPath },
    include: { category: true },
  })

  return NextResponse.json(serializeTransaction(transaction), { status: 201 })
}
