import sharp from "sharp"
import { z } from "zod"
import { normalizeBarcode } from "./barcode"
import type { CategoryContext } from "./category-history"

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma4:31b-cloud"

// Comprovantes fotografados pelo celular passam fácil de 4000px; reduzimos
// pra diminuir o payload enviado ao modelo sem perder legibilidade do texto.
const MAX_IMAGE_DIMENSION = 2000

export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null
  categoryGuess: string | null
  newCategoryGuess: string | null
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
  newCategory: z.string().nullable().optional(),
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
// A IA escolhe a categoria entre as já cadastradas (category) e só sugere
// uma nova (newCategory) quando nenhuma tem relação com o pagamento. Os
// exemplos de beneficiário → categoria vêm das despesas já registradas.
// Quando ela não acerta, a rota ainda tenta o histórico
// (lib/category-history.ts) usando o código de barras e o beneficiário.
async function interpretWithOllama(
  imageBase64: string,
  context: CategoryContext,
): Promise<z.infer<typeof llmResultSchema>> {
  const categoryList =
    context.categories.length > 0
      ? context.categories.map((name) => `- "${name}"`).join("\n")
      : "(nenhuma cadastrada)"
  const examples =
    context.examples.length > 0
      ? `\n\nPagamentos já registrados (beneficiário → categoria usada):\n${context.examples
          .map(({ payee, category }) => `- ${payee} → "${category}"`)
          .join("\n")}`
      : ""

  const prompt = `A imagem é um comprovante de pagamento (lotérica brasileira). Extraia:
- amount: o valor pago, como número decimal (ex.: 1483.80)
- date: a data do pagamento (não a de vencimento), no formato YYYY-MM-DD
- barcode: a linha digitável ou o código de barras numérico, só os dígitos
- payee: o nome do beneficiário, empresa ou órgão que recebeu o pagamento
- category: a categoria do pagamento, escolhida da lista abaixo
- newCategory: só quando nenhuma categoria da lista tiver relação com o pagamento

Categorias de despesa já cadastradas (da usada mais recentemente para a menos recente):
${categoryList}${examples}

Regras para category:
- Use exatamente o nome de uma categoria da lista sempre que o pagamento tiver relação com ela, mesmo que o comprovante use outro nome. Exemplos: companhia de água/saneamento (Iguá, Deso, Sabesp...) → a categoria de água; distribuidora de energia (Energisa, Enel, Cemig...) → a categoria de energia; guia DAS/Simples Nacional → a categoria do Simples; DARF → a categoria DARF; honorários de escritório de contabilidade → a categoria do contador; operadora de telefone/internet → a categoria de internet ou telefone.
- Se mais de uma categoria da lista servir, use a que aparece primeiro (a usada mais recentemente).
- Só quando nenhuma categoria da lista tiver relação: category = null e newCategory = um nome curto e genérico para a categoria nova (ex.: "Material de Escritório"), não o nome da empresa.

Use null para qualquer campo que não esteja legível na imagem.

Responda só com o JSON: {"amount": <número decimal ou null>, "date": <YYYY-MM-DD ou null>, "barcode": <dígitos ou null>, "payee": <texto curto ou null>, "category": <nome da lista ou null>, "newCategory": <texto curto ou null>}`

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

export async function extractReceiptDataServer(buffer: Buffer, context: CategoryContext): Promise<ReceiptExtraction> {
  const llmResult = await interpretWithOllama(await toJpegBase64(buffer), context)
  return {
    amountGuess: llmResult.amount,
    dateGuess: llmResult.date,
    categoryGuess: llmResult.category?.trim() || null,
    newCategoryGuess: llmResult.newCategory?.trim() || null,
    barcodeGuess: normalizeBarcode(llmResult.barcode),
    // Mesmo limite do campo payee na rota de transações.
    payeeGuess: llmResult.payee?.trim().slice(0, 200) || null,
  }
}
