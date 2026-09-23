import sharp from "sharp"
import { z } from "zod"

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:31b-cloud"

// Comprovantes fotografados pelo celular passam fácil de 4000px; reduzimos
// pra diminuir o payload enviado ao modelo sem perder legibilidade do texto.
const MAX_IMAGE_DIMENSION = 2000

export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null
  categoryGuess: string | null
}

const llmResultSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((value) => (value === null ? null : Number(value))),
  date: z.string().nullable(),
  category: z.string().nullable(),
})

// O Ollama só decodifica JPEG/PNG, então normalizamos qualquer upload
// (inclusive WebP) para JPEG antes de enviar.
async function toJpegBase64(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer()
  return jpeg.toString("base64")
}

// O modelo (com visão) lê a imagem do comprovante diretamente e devolve os
// campos já interpretados — sem etapa separada de OCR.
async function interpretWithOllama(imageBase64: string): Promise<z.infer<typeof llmResultSchema>> {
  const prompt = `A imagem é um comprovante de pagamento (lotérica brasileira). Extraia:
- amount: o valor pago, como número decimal (ex.: 1483.80)
- date: a data do pagamento (não a de vencimento), no formato YYYY-MM-DD
- category: o tipo de guia/pagamento em texto curto (ex.: "DAS Simples", "FGTS", "GPS", "DARF")

Use null para qualquer campo que não esteja legível na imagem.

Responda só com o JSON: {"amount": <número decimal ou null>, "date": <YYYY-MM-DD ou null>, "category": <texto curto ou null>}`

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, images: [imageBase64], stream: false, format: "json" }),
  })
  if (!response.ok) throw new Error(`Erro ao consultar o Ollama: ${response.status}`)

  const { response: raw } = (await response.json()) as { response: string }
  // Modelos cloud (ex.: gemma4:31b-cloud) ignoram `format: "json"` e embrulham
  // a resposta em ```json ... ```, então removemos a cerca antes do parse.
  const json = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const parsed = llmResultSchema.safeParse(JSON.parse(json))
  if (!parsed.success) throw new Error("Resposta do modelo em formato inesperado")
  return parsed.data
}

export async function extractReceiptDataServer(buffer: Buffer): Promise<ReceiptExtraction> {
  const llmResult = await interpretWithOllama(await toJpegBase64(buffer))
  return {
    amountGuess: llmResult.amount,
    dateGuess: llmResult.date,
    categoryGuess: llmResult.category,
  }
}
