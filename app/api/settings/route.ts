import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const updateSettingsSchema = z.object({
  storeName: z.string().trim().min(1),
})

async function getOrCreateSettings() {
  const existing = await prisma.settings.findFirst()
  if (existing) return existing
  return prisma.settings.create({ data: {} })
}

export async function GET() {
  const settings = await getOrCreateSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const parsed = updateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const settings = await getOrCreateSettings()
  const updated = await prisma.settings.update({
    where: { id: settings.id },
    data: { storeName: parsed.data.storeName },
  })
  return NextResponse.json(updated)
}
