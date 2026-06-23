export interface ReceiptExtraction {
  amountGuess: number | null
  dateGuess: string | null // YYYY-MM-DD
  categoryGuess: string | null
  rawText: string
}

// Converte um token de dinheiro reconhecido pelo OCR (ex: "1.483,80",
// "1,483,80", "715,89") em número. Em vez de assumir qual caractere é o
// separador de milhar, removemos toda pontuação e tratamos os últimos 2
// dígitos como centavos — isso resolve o caso comum do OCR confundir "."
// com "," em valores acima de mil reais.
function parseAmountToken(token: string): number | null {
  const digitsOnly = token.replace(/[.,]/g, "")
  if (digitsOnly.length < 3) return null

  const cents = digitsOnly.slice(-2)
  const integerPart = digitsOnly.slice(0, -2)
  const value = Number.parseFloat(`${integerPart}.${cents}`)
  return Number.isNaN(value) ? null : value
}

// Procura um valor monetário perto de um rótulo (ex: "VALOR", "VALOR DO
// PAGAMENTO"). Permite até 30 caracteres não-numéricos entre o rótulo e o
// número, já que comprovantes variam ("VALOR:", "VALOR DO DOCUMENTO:",
// "VALOR NOMINAL:", sem "R$" em vários casos).
function findLabeledAmount(text: string, label: RegExp): number | null {
  const match = text.match(new RegExp(`${label.source}[^\\d\\n]{0,30}([\\d.,]{3,})`, "i"))
  return match ? parseAmountToken(match[1]) : null
}

export function extractAmount(text: string): number | null {
  return (
    findLabeledAmount(text, /valor\s*(?:do)?\s*pagamento/i) ??
    findLabeledAmount(text, /valor/i) ??
    (() => {
      const matches = [...text.matchAll(/R\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)]
      if (matches.length === 0) return null
      const values = matches.map((match) => parseAmountToken(match[1])).filter((v): v is number => v !== null)
      return values.length > 0 ? Math.max(...values) : null
    })()
  )
}

export function extractDate(text: string): string | null {
  // Mesma lógica do valor: prioriza a data de pagamento rotulada
  // ("DATA DO PGTO:", "DATA DE PAGAMENTO:") em vez da primeira data
  // encontrada no texto, que pode ser a de vencimento.
  const labeled = text.match(/DATA\s*(?:DE|DO)?\s*(?:PGTO|PAGAMENTO)\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i)
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
