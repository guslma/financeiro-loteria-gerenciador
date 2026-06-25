import { Router } from "express"
import multer from "multer"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import crypto from "crypto"
import { UPLOADS_DIR } from "../lib/receipt-storage"

const router = Router()

const RECEIPTS_DIR = path.join(UPLOADS_DIR, "receipts")
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      cb(new Error("Tipo de arquivo não suportado"))
      return
    }
    cb(null, true)
  },
})

router.post("/", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "Arquivo muito grande (máximo 10MB)"
        : err.message || "Erro ao enviar arquivo"
      return res.status(400).json({ error: message })
    }

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" })
    }

    const extension = ALLOWED_TYPES[req.file.mimetype]
    await mkdir(RECEIPTS_DIR, { recursive: true })
    const filename = `${crypto.randomUUID()}.${extension}`
    await writeFile(path.join(RECEIPTS_DIR, filename), req.file.buffer)

    res.status(201).json({ path: `/uploads/receipts/${filename}` })
  })
})

export default router
