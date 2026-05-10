export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''

  const text = neutralizeSpreadsheetFormula(String(value))
  const escaped = text.replace(/"/g, '""')
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function neutralizeSpreadsheetFormula(text: string): string {
  const first = text[0]
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') {
    return `'${text}`
  }
  return text
}
