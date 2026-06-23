import "server-only"
import { unlink } from "fs/promises"
import path from "path"

const PUBLIC_DIR = path.join(process.cwd(), "public")

export async function deleteReceiptFile(receiptPhotoPath: string | null | undefined) {
  if (!receiptPhotoPath) return

  const resolved = path.normalize(path.join(PUBLIC_DIR, receiptPhotoPath))
  if (!resolved.startsWith(PUBLIC_DIR)) {
    console.error("Caminho de comprovante fora do diretório público, ignorando remoção:", receiptPhotoPath)
    return
  }

  try {
    await unlink(resolved)
  } catch (error) {
    console.error("Erro ao remover arquivo de comprovante:", error)
  }
}
