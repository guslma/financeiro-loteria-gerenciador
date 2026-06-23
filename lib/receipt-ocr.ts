export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null // YYYY-MM-DD
  categoryGuess: string | null
  rawText: string
}

export function extractAmount(text: string): number | null {
  // Comprovantes da Caixa/lotérica têm o valor rotulado como "VALOR:R$X,XX" —
  // prioriza esse padrão, já que o texto também tem números de agência,
  // terminal e código de barras que não são o valor pago.
  const labeled = text.match(/VALOR\s*:?\s*R\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  if (labeled) {
    return Number.parseFloat(labeled[1].replace(/\./g, "").replace(",", "."))
  }

  const matches = [...text.matchAll(/R\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g)]
  if (matches.length === 0) return null

  const values = matches.map((match) => Number.parseFloat(match[1].replace(/\./g, "").replace(",", ".")))
  return Math.max(...values)
}

export function extractDate(text: string): string | null {
  // Mesma lógica do valor: prioriza a data de pagamento rotulada
  // ("DATA DO PGTO:") em vez da primeira data encontrada no texto.
  const labeled = text.match(/DATA\s*(?:DO)?\s*(?:PGTO|PAGAMENTO)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  const match = labeled ?? text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

// Comprovantes de pagamento da Caixa/lotérica identificam o tipo de guia no
// texto (ex: "COMPROVANTE DE PAGAMENTO SIMPLES NACIONAL"). Mapeamos os tipos
// mais comuns de guia paga em lotérica para as categorias de despesa do app.
const CATEGORY_KEYWORDS: { pattern: RegExp; category: string }[] = [
  { pattern: /simples\s*nacional|\bdas\b/i, category: "DAS Simples" },
  { pattern: /\bfgts\b/i, category: "FGTS" },
  { pattern: /\bgps\b|previd[eê]ncia\s*social|\binss\b/i, category: "GPS" },
  { pattern: /\bdarf\b/i, category: "DARF" },
]

export function extractCategory(text: string): string | null {
  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category
  }
  return null
}

export async function extractReceiptData(file: File): Promise<ReceiptExtraction> {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker("por")

  try {
    const { data } = await worker.recognize(file)
    return {
      amountGuess: extractAmount(data.text),
      dateGuess: extractDate(data.text),
      categoryGuess: extractCategory(data.text),
      rawText: data.text,
    }
  } finally {
    await worker.terminate()
  }
}
