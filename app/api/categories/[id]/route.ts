import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { categoriesMatch } from "@/lib/categories"

const renameSchema = z.object({
  name: z.string().trim().min(1),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = renameSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) {
    return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 })
  }

  const { name } = parsed.data
  const siblings = await prisma.category.findMany({ where: { type: category.type, id: { not: id } } })
  if (siblings.some((cat) => categoriesMatch(cat.name, name))) {
    return NextResponse.json({ error: "Já existe uma categoria com este nome" }, { status: 409 })
  }

  const updated = await prisma.category.update({ where: { id }, data: { name } })
  return NextResponse.json(updated)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const usageCount = await prisma.transaction.count({ where: { categoryId: id } })
  if (usageCount > 0) {
    return NextResponse.json(
      { error: "Esta categoria está sendo usada em transações existentes" },
      { status: 409 },
    )
  }

  await prisma.category.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
