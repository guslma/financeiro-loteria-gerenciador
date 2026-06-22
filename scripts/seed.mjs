import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const username = process.env.SEED_USERNAME
  const password = process.env.SEED_PASSWORD

  if (!username || !password) {
    console.log("SEED_USERNAME/SEED_PASSWORD não definidos, pulando seed de usuário.")
    return
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    console.log(`Usuário "${username}" já existe, nada a fazer.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({ data: { username, passwordHash } })
  console.log(`Usuário "${username}" criado com sucesso.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
