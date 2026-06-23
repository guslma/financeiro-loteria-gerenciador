import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/server/prisma"
import { categoriesMatch, defaultCategories } from "@/lib/categories"

const typeSchema = z.enum(["receita", "despesa"])

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: typeSchema,
})

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type")
  const parsedType = typeSchema.safeParse(type)
  if (!parsedType.success) {
    return NextResponse.json({ error: "type deve ser 'receita' ou 'despesa'" }, { status: 400 })
  }

  let categories = await prisma.category.findMany({
    where: { type: parsedType.data },
    orderBy: { createdAt: "asc" },
  })

  if (categories.length === 0) {
    await prisma.category.createMany({
      data: defaultCategories[parsedType.data].map((name) => ({ name, type: parsedType.data })),
    })
    categories = await prisma.category.findMany({
      where: { type: parsedType.data },
      orderBy: { createdAt: "asc" },
    })
  }

  return NextResponse.json(categories)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name, type } = parsed.data
  const existing = await prisma.category.findMany({ where: { type } })
  if (existing.some((cat) => categoriesMatch(cat.name, name))) {
    return NextResponse.json({ error: "Esta categoria já existe" }, { status: 409 })
  }

  const category = await prisma.category.create({ data: { name, type } })
  return NextResponse.json(category, { status: 201 })
}
