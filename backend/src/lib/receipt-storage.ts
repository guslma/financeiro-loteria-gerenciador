import { unlink } from "fs/promises"
import path from "path"

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads")

export async function deleteReceiptFile(receiptPhotoPath: string | null | undefined) {
  if (!receiptPhotoPath) return

  // receiptPhotoPath é algo como "/uploads/receipts/{uuid}.jpg" — remove o
  // prefixo "/uploads" antes de juntar com UPLOADS_DIR.
  const relative = receiptPhotoPath.replace(/^\/uploads\/?/, "")
  const resolved = path.normalize(path.join(UPLOADS_DIR, relative))
  if (!resolved.startsWith(UPLOADS_DIR)) {
    console.error("Caminho de comprovante fora do diretório de uploads, ignorando remoção:", receiptPhotoPath)
    return
  }

  try {
    await unlink(resolved)
  } catch (error) {
    console.error("Erro ao remover arquivo de comprovante:", error)
  }
}

export { UPLOADS_DIR }
