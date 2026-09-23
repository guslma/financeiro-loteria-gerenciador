// Aceita o código de barras (44 dígitos) ou a linha digitável (47 dígitos em
// boleto bancário, 48 em guia de arrecadação) e devolve só os dígitos, ou
// null se o tamanho não bater com nenhum dos formatos.
export function normalizeBarcode(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  return [44, 47, 48].includes(digits.length) ? digits : null
}

// Converte a linha digitável para o código de barras de 44 dígitos, que é
// onde as posições da FEBRABAN valem.
function toBarcode44(digits: string): string {
  if (digits.length === 48) {
    // Arrecadação: 4 blocos de 11 dígitos + 1 dígito verificador cada.
    return digits.slice(0, 11) + digits.slice(12, 23) + digits.slice(24, 35) + digits.slice(36, 47)
  }
  if (digits.length === 47) {
    // Boleto bancário: banco+moeda, DV geral, fator+valor, campo livre.
    return (
      digits.slice(0, 4) +
      digits.slice(32, 33) +
      digits.slice(33, 47) +
      digits.slice(4, 9) +
      digits.slice(10, 20) +
      digits.slice(21, 31)
    )
  }
  return digits
}

// Identifica quem emitiu a guia. Cada guia tem um código de barras diferente,
// mas nas guias de arrecadação (começam com 8: DAS, FGTS, GPS, água, luz...)
// o segmento e o código da empresa/órgão se repetem entre um mês e outro.
// Em boleto bancário o campo que identifica o beneficiário varia de banco
// pra banco, então não dá pra extrair com segurança — aí devolve null e a
// sugestão cai no beneficiário.
export function barcodeIssuerKey(raw: string | null | undefined): string | null {
  const digits = normalizeBarcode(raw)
  if (!digits) return null

  const barcode = toBarcode44(digits)
  if (barcode[0] !== "8") return null

  const segment = barcode[1]
  // Segmento 6 identifica a empresa pelos 8 primeiros dígitos do CNPJ;
  // os demais, por um código de 4 dígitos (posições 16-19).
  const issuer = segment === "6" ? barcode.slice(15, 23) : barcode.slice(15, 19)
  return `${segment}:${issuer}`
}
