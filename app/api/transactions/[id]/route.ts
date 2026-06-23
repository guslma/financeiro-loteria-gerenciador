import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/server/prisma"
import { resolveCategoryId } from "@/lib/categories"

const updateTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1),
  amount: z.number().positive(),
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = updateTransactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 })
  }

  const { date, description, amount, category, receiptPhotoPath } = parsed.data
  const categoryId = await resolveCategoryId(prisma, category, existing.type as "receita" | "despesa")

  const updated = await prisma.transaction.update({
    where: { id },
    data: { date, description, amount, categoryId, ...(receiptPhotoPath ? { receiptPhotoPath } : {}) },
    include: { category: true },
  })

  return NextResponse.json(serializeTransaction(updated))
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.transaction.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
