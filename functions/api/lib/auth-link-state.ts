import { hashResetToken } from './helpers'

export type VerificationTokenRow = { user_id: number; expires_at: number | string }
export type ResetTokenRow = { id: number; reset_token_expires_at: number | null }

export function parseVerificationExpiry(value: number | string): number {
  if (typeof value === 'number') return value
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export async function readVerificationToken(db: D1Database, rawToken: string): Promise<VerificationTokenRow | null> {
  const tokenHash = await hashResetToken(rawToken)
  return db.prepare('SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ? AND used_at IS NULL')
    .bind(tokenHash).first<VerificationTokenRow>()
}

export async function readResetToken(db: D1Database, rawToken: string): Promise<ResetTokenRow | null> {
  const tokenHash = await hashResetToken(rawToken)
  return db.prepare('SELECT id, reset_token_expires_at FROM users WHERE reset_token = ?')
    .bind(tokenHash).first<ResetTokenRow>()
}

export function verificationTokenExpired(row: VerificationTokenRow, now = Date.now()): boolean {
  const expiresAt = parseVerificationExpiry(row.expires_at)
  return !Number.isFinite(expiresAt) || expiresAt < now
}

export function resetTokenExpired(row: ResetTokenRow, now = Date.now()): boolean {
  return !row.reset_token_expires_at || row.reset_token_expires_at < now
}

/** Safe for page GET/HEAD: never verifies, consumes, cleans up or updates an account. */
export async function authLinkPageStatus(db: D1Database, kind: 'verify-email' | 'reset-password', token: string | null): Promise<200 | 400 | 410> {
  const rawToken = token?.trim() ?? ''
  if (!rawToken) return kind === 'verify-email' && token === null ? 200 : 400
  if (kind === 'verify-email') {
    const row = await readVerificationToken(db, rawToken)
    return !row ? 400 : verificationTokenExpired(row) ? 410 : 200
  }
  const row = await readResetToken(db, rawToken)
  return !row ? 400 : resetTokenExpired(row) ? 410 : 200
}
