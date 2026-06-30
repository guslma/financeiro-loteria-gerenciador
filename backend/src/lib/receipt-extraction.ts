import { z } from "zod"

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? "http://localhost:8001"
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5vl:3b"

export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null
  categoryGuess: string | null
  rawText: string
}

const llmResultSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .nullable()
    .transform((value) => (value === null ? null : Number(value))),
  date: z.string().nullable(),
  category: z.string().nullable(),
})

async function extractText(buffer: Buffer): Promise<string> {
  const formData = new FormData()
  formData.append("file", new Blob([buffer]), "receipt.jpg")

  const response = await fetch(`${OCR_SERVICE_URL}/extract`, { method: "POST", body: formData })
  if (!response.ok) throw new Error(`Erro no serviço de OCR: ${response.status}`)

  const { text } = (await response.json()) as { text: string }
  return text
}

// Em vez da extração baseada em regex (frontend/src/lib/receipt-ocr.ts), pede
// pro modelo interpretar o texto bruto do OCR — mais robusto a layouts de
// comprovante que a regex não cobre, ao custo de depender de um LLM externo
// rodando no servidor zimaos.
//
// O exemplo (few-shot) abaixo é necessário: sem ele, o qwen2.5vl:3b
// frequentemente retorna "amount: null" mesmo com o valor claramente presente
// no texto — pedir os 3 campos de uma vez sem exemplo confunde o modelo
// nesse campo especificamente (testado manualmente contra o Ollama).
async function interpretWithOllama(rawText: string): Promise<z.infer<typeof llmResultSchema>> {
  const prompt = `Extraia os dados do texto de um comprovante de pagamento (lotérica brasileira) abaixo e responda em JSON.

Exemplo:
Texto: "VALOR: R$ 250,00\nDATA: 01/02/2026\nGPS"
Resposta: {"amount": 250.00, "date": "2026-02-01", "category": "GPS"}

Agora faça o mesmo para este texto:
"""
${rawText}
"""

Responda só com o JSON: {"amount": <número decimal ou null>, "date": <YYYY-MM-DD ou null>, "category": <texto curto ou null>}`

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false, format: "json" }),
  })
  if (!response.ok) throw new Error(`Erro ao consultar o Ollama: ${response.status}`)

  const { response: raw } = (await response.json()) as { response: string }
  const parsed = llmResultSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) throw new Error("Resposta do modelo em formato inesperado")
  return parsed.data
}

export async function extractReceiptDataServer(buffer: Buffer): Promise<ReceiptExtraction> {
  const rawText = await extractText(buffer)
  if (!rawText.trim()) {
    return { amountGuess: null, dateGuess: null, categoryGuess: null, rawText: "" }
  }

  const llmResult = await interpretWithOllama(rawText)
  return {
    amountGuess: llmResult.amount,
    dateGuess: llmResult.date,
    categoryGuess: llmResult.category,
    rawText,
  }
}
