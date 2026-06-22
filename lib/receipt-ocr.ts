export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null // YYYY-MM-DD
  rawText: string
}

export function extractAmount(text: string): number | null {
  const matches = [...text.matchAll(/R\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g)]
  if (matches.length === 0) return null

  const values = matches.map((match) => Number.parseFloat(match[1].replace(/\./g, "").replace(",", ".")))
  return Math.max(...values)
}

export function extractDate(text: string): string | null {
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export async function extractReceiptData(file: File): Promise<ReceiptExtraction> {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("por")

  try {
    const { data } = await worker.recognize(file)
    return {
      amountGuess: extractAmount(data.text),
      dateGuess: extractDate(data.text),
      rawText: data.text,
    }
  } finally {
    await worker.terminate()
  }
}
