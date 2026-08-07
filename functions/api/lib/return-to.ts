const RETURN_TO_MAX_LENGTH = 2048
const INTERNAL_BASE = 'https://supplement-stack.invalid'

function isSafeInternalStage(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false
  if (value.includes('\\') || [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })) return false
  try {
    const parsed = new URL(value, INTERNAL_BASE)
    return parsed.origin === INTERNAL_BASE && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

export function validateReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > RETURN_TO_MAX_LENGTH) return null
  if (value.trim() !== value) return null
  let stage = value
  for (let depth = 0; depth < 8; depth += 1) {
    if (!isSafeInternalStage(stage)) return null
    let decoded: string
    try {
      decoded = decodeURIComponent(stage)
    } catch {
      return null
    }
    if (decoded === stage) return value
    stage = decoded
  }
  return null
}
