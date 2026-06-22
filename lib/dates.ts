// Datas no app são strings "YYYY-MM-DD". `new Date(str)` as interpreta como
// UTC meia-noite, e depois .getFullYear()/.getMonth()/.getDate() usam o fuso
// horário local — em fusos negativos (ex: Brasil) isso pode jogar a data um
// dia para trás. Estas funções extraem os componentes direto da string ou
// constroem o Date já no fuso local, evitando esse deslocamento.

export function getYear(dateStr: string): number {
  return Number(dateStr.slice(0, 4))
}

export function getMonthIndex(dateStr: string): number {
  return Number(dateStr.slice(5, 7)) - 1
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatDatePtBR(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("pt-BR")
}
