// ---------------------------------------------------------------------------
// Shared helpers: password, reset-token, auth, rate-limiting, email
// ---------------------------------------------------------------------------

import { verify } from 'hono/jwt'
import type { Context } from 'hono'
import type { AppContext } from './types'

// ---------------------------------------------------------------------------
// Password helpers (Web Crypto PBKDF2)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored?.startsWith('pbkdf2:')) return false
  const [, saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16)))
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const newHash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
  return newHash === hashHex
}

// ---------------------------------------------------------------------------
// Reset-token helpers (Web Crypto SHA-256)
// DB column `reset_token` stores the SHA-256 hex-hash of the raw token.
// The raw token is only ever sent in the reset-mail link — never stored.
// ---------------------------------------------------------------------------

/** Generate a cryptographically random raw token (Base64URL, 32 bytes). */
export function generateRawResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/** SHA-256 hex-hash of a token string (for DB storage / lookup). */
export async function hashResetToken(rawToken: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawToken)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function ensureAuth(c: Context<AppContext>): Promise<Response | null> {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401) as never
  try {
    const payload = await verify(header.slice(7), c.env.JWT_SECRET, 'HS256') as AppContext['Variables']['user']
    c.set('user', payload)
    return null
  } catch {
    return c.json({ error: 'Unauthorized' }, 401) as never
  }
}

export function requireAdmin(c: Context<AppContext>): Response | null {
  const user = c.get('user')
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403) as never
  return null
}

export async function ensureAdmin(c: Context<AppContext>): Promise<Response | null> {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  return requireAdmin(c)
}

// ---------------------------------------------------------------------------
// Rate limiting (KV-backed, fixed window)
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (!kv) return true // KV nicht konfiguriert → kein Limiting

  const now = Math.floor(Date.now() / 1000)
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`

  const current = await kv.get(windowKey)
  const count = current ? parseInt(current, 10) : 0

  if (count >= limit) return false

  await kv.put(windowKey, String(count + 1), { expirationTtl: windowSeconds * 2 })
  return true
}

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(
  resendApiKey: string,
  frontendUrl: string,
  toEmail: string,
  resetToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Supplement Stack <stack@dragoncity.eu>',
      to: toEmail,
      subject: 'Passwort zurücksetzen',
      html: `
        <p>Hallo,</p>
        <p>du hast eine Passwort-Zurücksetzen-Anfrage gestellt.</p>
        <p><a href="${resetUrl}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Passwort zurücksetzen</a></p>
        <p>Oder kopiere diesen Link: ${resetUrl}</p>
        <p>Der Link ist 1 Stunde gültig. Falls du keine Anfrage gestellt hast, ignoriere diese Mail.</p>
      `,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `Resend ${res.status}: ${body}` }
  }
  return { ok: true }
}
