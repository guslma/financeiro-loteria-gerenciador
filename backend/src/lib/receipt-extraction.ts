import sharp from "sharp"
import { z } from "zod"
import { normalizeBarcode } from "./barcode"

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:31b-cloud"

// Comprovantes fotografados pelo celular passam fácil de 4000px; reduzimos
// pra diminuir o payload enviado ao modelo sem perder legibilidade do texto.
const MAX_IMAGE_DIMENSION = 2000

export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null
  categoryGuess: string | null
  barcodeGuess: string | null
  payeeGuess: string | null
}

const llmResultSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((value) => (value === null ? null : Number(value))),
  date: z.string().nullable(),
  category: z.string().nullable(),
  barcode: z.string().nullable().optional(),
  payee: z.string().nullable().optional(),
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
//
// As categorias já cadastradas vão no prompt pra IA reaproveitar o nome
// exato quando o pagamento se encaixa numa delas; quando ela não consegue,
// a rota tenta achar a categoria no histórico (lib/category-history.ts)
// usando o código de barras e o beneficiário lidos aqui.
async function interpretWithOllama(
  imageBase64: string,
  existingCategories: string[],
): Promise<z.infer<typeof llmResultSchema>> {
  const categoryHint =
    existingCategories.length > 0
      ? `\n\nCategorias já cadastradas: ${existingCategories.map((name) => `"${name}"`).join(", ")}. Se o pagamento se encaixar claramente em uma delas, use exatamente esse nome em category. Se não tiver certeza, use o tipo de guia/pagamento.`
      : ""

  const prompt = `A imagem é um comprovante de pagamento (lotérica brasileira). Extraia:
- amount: o valor pago, como número decimal (ex.: 1483.80)
- date: a data do pagamento (não a de vencimento), no formato YYYY-MM-DD
- category: o tipo de guia/pagamento em texto curto (ex.: "DAS Simples", "FGTS", "GPS", "DARF")
- barcode: a linha digitável ou o código de barras numérico, só os dígitos
- payee: o nome do beneficiário, empresa ou órgão que recebeu o pagamento${categoryHint}

Use null para qualquer campo que não esteja legível na imagem.

Responda só com o JSON: {"amount": <número decimal ou null>, "date": <YYYY-MM-DD ou null>, "category": <texto curto ou null>, "barcode": <dígitos ou null>, "payee": <texto curto ou null>}`

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

export async function extractReceiptDataServer(
  buffer: Buffer,
  existingCategories: string[],
): Promise<ReceiptExtraction> {
  const llmResult = await interpretWithOllama(await toJpegBase64(buffer), existingCategories)
  return {
    amountGuess: llmResult.amount,
    dateGuess: llmResult.date,
    categoryGuess: llmResult.category,
    barcodeGuess: normalizeBarcode(llmResult.barcode),
    // Mesmo limite do campo payee na rota de transações.
    payeeGuess: llmResult.payee?.trim().slice(0, 200) || null,
  }
}
