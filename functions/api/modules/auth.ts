// ---------------------------------------------------------------------------
// Auth module — login, register, logout, Google OAuth stubs, password reset, /me
// Routes: POST /register, GET /google, GET /google/callback, POST /logout,
//         POST /forgot-password, POST /reset-password, POST /login,
//         GET /me (mounted at /api/auth/* except /me which is /api/me)
// ---------------------------------------------------------------------------
// NOTE: This module is mounted at /api/auth for auth routes.
//       /api/me routes are added directly to the main app in [[path]].ts
//       because they don't share the /auth prefix.
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { AppContext, UserRow } from '../lib/types'
import {
  hashPassword,
  verifyPassword,
  generateRawResetToken,
  hashResetToken,
  ensureAuth,
  checkRateLimit,
} from '../lib/helpers'
import { sendEmailVerificationEmail, sendPasswordResetEmail } from '../lib/mail'

const auth = new Hono<AppContext>()

const ALLOWED_GENDERS = ['männlich', 'weiblich', 'divers'] as const
const ALLOWED_DIETS = ['omnivore', 'vegetarisch', 'vegan'] as const
const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000

function normalizeGuidelineSource(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (trimmed === '') return null
  if (trimmed === 'DGE') return 'DGE'
  if (trimmed === 'Studien' || trimmed === 'studien') return 'studien'
  if (trimmed === 'Influencer' || trimmed === 'influencer') return 'influencer'
  return undefined
}

function frontendUrl(env: AppContext['Bindings']): string {
  return env.FRONTEND_URL ?? 'https://supplementstack.de'
}

function publicProfile(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    age: user.age,
    gender: user.gender,
    weight: user.weight,
    diet: user.diet_type,
    goals: user.personal_goals,
    guideline_source: user.guideline_source,
    is_smoker: user.is_smoker,
    health_consent: user.health_consent,
    health_consent_at: user.health_consent_at,
    email_verified_at: user.email_verified_at,
    role: user.role ?? 'user',
  }
}

function parseVerificationExpiry(value: number | string): number {
  if (typeof value === 'number') return value
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

async function createEmailVerificationToken(
  db: D1Database,
  userId: number,
): Promise<string> {
  const rawToken = generateRawResetToken()
  const tokenHash = await hashResetToken(rawToken)
  const expiresAt = Date.now() + EMAIL_VERIFICATION_TTL_MS
  await db.prepare(
    'DELETE FROM email_verification_tokens WHERE user_id = ?'
  ).bind(userId).run()
  await db.prepare(
    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(userId, tokenHash, expiresAt).run()
  return rawToken
}

// POST /api/auth/register
auth.post('/register', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `register:${ip}`, 5, 15 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Versuche. Bitte warte kurz.' }, 429)

  const body = await c.req.json()
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@'))
    return c.json({ error: 'Valid email required' }, 400)
  if (!body.password || typeof body.password !== 'string' || body.password.length < 8)
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  if (!body.health_consent)
    return c.json({ error: 'Gesundheits-Einwilligung erforderlich (DSGVO Art. 9)' }, 400)
  const data = body as { email: string; password: string; age?: number; gender?: string; weight?: number; diet?: string; goals?: string; guideline_source?: string }

  // Normalize: empty strings → undefined (treat as not provided)
  const ageRaw = data.age
  const genderRaw = typeof data.gender === 'string' ? data.gender.trim() : data.gender
  const guidelineValue = normalizeGuidelineSource(data.guideline_source)

  let ageValue: number | null = null
  if (ageRaw !== undefined && ageRaw !== null && (ageRaw as unknown) !== '') {
    if (typeof ageRaw !== 'number' || !Number.isInteger(ageRaw) || ageRaw < 1 || ageRaw > 120) {
      return c.json({ error: 'Alter muss eine ganze Zahl zwischen 1 und 120 sein.' }, 400)
    }
    ageValue = ageRaw
  }

  let genderValue: string | null = null
  if (genderRaw !== undefined && genderRaw !== null && genderRaw !== '') {
    if (!ALLOWED_GENDERS.includes(genderRaw as typeof ALLOWED_GENDERS[number])) {
      return c.json({ error: 'Geschlecht muss "männlich", "weiblich" oder "divers" sein.' }, 400)
    }
    genderValue = genderRaw
  }

  if (data.guideline_source !== undefined && guidelineValue === undefined) {
    return c.json({ error: 'Leitlinienquelle muss "DGE", "Studien" oder "Influencer" sein.' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(data.email).first<{ id: number }>()
  if (existing) return c.json({ error: 'E-Mail already exists' }, 409)

  const password_hash = await hashPassword(data.password)
  const result = await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, age, gender, weight, diet_type, personal_goals, guideline_source, health_consent, health_consent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`
  ).bind(
    data.email,
    password_hash,
    ageValue,
    genderValue,
    data.weight ?? null,
    data.diet ?? null,
    data.goals ?? null,
    guidelineValue ?? null,
  ).run()

  const userId = result.meta.last_row_id
  const verificationToken = await createEmailVerificationToken(c.env.DB, userId)
  await c.env.DB.prepare(
    `INSERT INTO consent_log (user_id, consent_type, granted) VALUES (?, 'health_data', 1)`
  ).bind(userId).run()

  const mailResult = await sendEmailVerificationEmail(c.env, frontendUrl(c.env), data.email, verificationToken)
  const token = await sign(
    { userId, email: data.email, role: 'user', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    c.env.JWT_SECRET,
  )
  return c.json({
    token,
    email_verification_email_sent: mailResult.ok,
    message: mailResult.ok
      ? 'Konto erstellt. Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.'
      : 'Konto erstellt. Die Bestätigungs-E-Mail konnte gerade nicht gesendet werden. Du kannst sie im Profil erneut anfordern.',
  })
})

// GET /api/auth/google (stub — Phase 5)
auth.get('/google', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID) return c.json({ error: 'Google OAuth nicht konfiguriert' }, 501)
  const redirectUri = `${c.env.FRONTEND_URL}/auth/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email')
  return Response.redirect(url.toString(), 302)
})

// GET /api/auth/google/callback (stub — Phase 5)
auth.get('/google/callback', async (_c) => {
  return Response.json({ error: 'Google OAuth callback noch nicht implementiert' }, { status: 501 })
})

// POST /api/auth/logout
auth.post('/logout', async (_c) => {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})

// POST /api/auth/verify-email
auth.post('/verify-email', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `verify-email:${ip}`, 20, 15 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Versuche. Bitte warte kurz.' }, 429)

  const body = await c.req.json().catch(() => null) as { token?: unknown } | null
  const rawToken = body && typeof body.token === 'string' ? body.token.trim() : ''
  if (!rawToken) return c.json({ error: 'Ungültiger oder abgelaufener Bestätigungslink.' }, 400)

  const tokenHash = await hashResetToken(rawToken)
  const row = await c.env.DB.prepare(
    'SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ? AND used_at IS NULL'
  ).bind(tokenHash).first<{ user_id: number; expires_at: number | string }>()

  const expiresAt = row ? parseVerificationExpiry(row.expires_at) : Number.NaN
  if (!row || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    if (row) {
      await c.env.DB.prepare(
        'DELETE FROM email_verification_tokens WHERE user_id = ?'
      ).bind(row.user_id).run()
    }
    return c.json({ error: 'Ungültiger oder abgelaufener Bestätigungslink.' }, 400)
  }

  await c.env.DB.prepare(
    `UPDATE users
     SET email_verified_at = datetime('now')
     WHERE id = ?`
  ).bind(row.user_id).run()
  await c.env.DB.prepare(
    'DELETE FROM email_verification_tokens WHERE user_id = ?'
  ).bind(row.user_id).run()

  return c.json({ message: 'E-Mail-Adresse erfolgreich bestätigt.' })
})

// POST /api/auth/resend-verification
auth.post('/resend-verification', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const currentUser = c.get('user')

  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `resend-verification:${currentUser.userId}`, 3, 60 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Versuche. Bitte warte vor dem erneuten Versand.' }, 429)

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(currentUser.userId)
    .first<UserRow>()
  if (!user) return c.json({ error: 'User not found' }, 404)
  if (user.email_verified_at) {
    return c.json({ message: 'Deine E-Mail-Adresse ist bereits bestätigt.', already_verified: true })
  }

  const rawToken = await createEmailVerificationToken(c.env.DB, user.id)
  const result = await sendEmailVerificationEmail(c.env, frontendUrl(c.env), user.email, rawToken)
  if (!result.ok) {
    return c.json({ error: 'Bestätigungs-E-Mail konnte nicht gesendet werden.' }, 500)
  }

  return c.json({ message: 'Bestätigungs-E-Mail wurde erneut gesendet.' })
})

// POST /api/auth/forgot-password
auth.post('/forgot-password', async (c) => {
  const body = await c.req.json()
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const ok = () => c.json({ message: 'Falls ein Account mit dieser E-Mail existiert, wurde ein Link verschickt.' })

  if (!email || !email.includes('@')) return ok()

  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE email = ?').bind(email).first<{ id: number; email: string }>()
  if (!user) return ok()

  // Generate raw token (sent in mail) + SHA-256 hash (stored in DB)
  const rawToken = generateRawResetToken()
  const tokenHash = await hashResetToken(rawToken)
  const expiresAt = Date.now() + 3600000

  await c.env.DB.prepare(
    // stored as SHA-256 hash — raw token only travels in the reset-mail link
    'UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?'
  ).bind(tokenHash, expiresAt, user.id).run()

  const result = await sendPasswordResetEmail(c.env, frontendUrl(c.env), user.email, rawToken)
  if (!result.ok) {
    return c.json({ error: 'E-Mail konnte nicht gesendet werden.', debug: result.error }, 500)
  }

  return ok()
})

// POST /api/auth/reset-password
auth.post('/reset-password', async (c) => {
  const body = await c.req.json()
  const rawToken = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!rawToken) return c.json({ error: 'Ungültiger oder abgelaufener Link.' }, 400)
  if (!password || password.length < 8) return c.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' }, 400)

  // Hash the incoming raw token to compare against the stored SHA-256 hash
  const tokenHash = await hashResetToken(rawToken)

  const user = await c.env.DB.prepare(
    'SELECT id, reset_token_expires_at FROM users WHERE reset_token = ?'
  ).bind(tokenHash).first<{ id: number; reset_token_expires_at: number | null }>()

  if (!user || !user.reset_token_expires_at || user.reset_token_expires_at < Date.now()) {
    return c.json({ error: 'Ungültiger oder abgelaufener Link.' }, 400)
  }

  const password_hash = await hashPassword(password)
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?'
  ).bind(password_hash, user.id).run()

  return c.json({ message: 'Passwort erfolgreich geändert.' })
})

// POST /api/auth/login
auth.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown'
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `login:${ip}`, 10, 15 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Versuche. Bitte warte kurz.' }, 429)

  const body = await c.req.json()
  if (!body.email || typeof body.email !== 'string') return c.json({ error: 'Email required' }, 400)
  if (!body.password || typeof body.password !== 'string') return c.json({ error: 'Password required' }, 400)
  const data = body as { email: string; password: string }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(data.email).first<UserRow>()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(data.password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = await sign(
    { userId: user.id, email: user.email, role: user.role ?? 'user', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    c.env.JWT_SECRET,
  )
  return c.json({
    token,
    profile: publicProfile(user),
  })
})

// ---------------------------------------------------------------------------
// /api/me routes — exported separately to be mounted at /api/me in main app
// ---------------------------------------------------------------------------

export const meApp = new Hono<AppContext>()

// GET /api/me
meApp.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    'SELECT id, email, age, gender, weight, diet_type, personal_goals, guideline_source, is_smoker, health_consent, health_consent_at, email_verified_at, role FROM users WHERE id = ?'
  ).bind(user.userId).first<UserRow>()
  if (!row) return c.json({ error: 'User not found' }, 404)
  const profile = publicProfile(row)
  return c.json({ profile })
})

// PATCH /api/me/password — Self-Service Passwortwechsel (DSGVO Art. 16)
meApp.patch('/password', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')

  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `pwchange:${user.userId}`, 5, 15 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Versuche. Bitte warte kurz.' }, 429)

  const body = await c.req.json().catch(() => null) as { current_password?: unknown; new_password?: unknown } | null
  const currentPassword = body && typeof body.current_password === 'string' ? body.current_password : ''
  const newPassword = body && typeof body.new_password === 'string' ? body.new_password : ''

  if (!currentPassword) return c.json({ error: 'Aktuelles Passwort erforderlich.' }, 400)
  if (newPassword.length < 8) return c.json({ error: 'Neues Passwort muss mindestens 8 Zeichen lang sein.' }, 400)
  if (newPassword === currentPassword) return c.json({ error: 'Neues Passwort muss sich vom aktuellen unterscheiden.' }, 400)

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ password_hash: string }>()
  if (!row) return c.json({ error: 'User not found' }, 404)

  const valid = await verifyPassword(currentPassword, row.password_hash)
  if (!valid) return c.json({ error: 'Aktuelles Passwort ist falsch.' }, 401)

  const newHash = await hashPassword(newPassword)
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(newHash, user.userId)
    .run()

  return c.json({ ok: true })
})

// DELETE /api/me — Account-Löschung (DSGVO Art. 17, Recht auf Löschung)
meApp.delete('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')

  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `accdel:${user.userId}`, 3, 60 * 60)
  if (!allowed) return c.json({ error: 'Zu viele Versuche. Bitte warte kurz.' }, 429)

  const body = await c.req.json().catch(() => null) as { password?: unknown } | null
  const password = body && typeof body.password === 'string' ? body.password : ''
  if (!password) return c.json({ error: 'Passwort erforderlich.' }, 400)

  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{ password_hash: string }>()
  if (!row) return c.json({ error: 'User not found' }, 404)

  const valid = await verifyPassword(password, row.password_hash)
  if (!valid) return c.json({ error: 'Passwort ist falsch.' }, 401)

  // DSGVO Art. 17: harte Löschung. D1 erzwingt FK-Constraints nicht zuverlässig
  // → dependent rows explizit in Transaktion löschen.
  // Reihenfolge: Kinder vor Eltern. stack_items hängt an stacks(id), nicht an
  // users(id) direkt — daher zuerst stack_items via Sub-Select, dann stacks.
  const userId = user.userId
  const coreStmts = [
    c.env.DB.prepare('DELETE FROM stack_items WHERE stack_id IN (SELECT id FROM stacks WHERE user_id = ?)').bind(userId),
    c.env.DB.prepare('DELETE FROM stacks WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM wishlist WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM user_products WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM consent_log WHERE user_id = ?').bind(userId),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]
  await c.env.DB.batch(coreStmts)

  // Optionale Tabellen aus späteren Migrationen (0029+, 0031+, 0032+, 0033+).
  // Live-DB hat aktuell nur 0001-0022 angewendet — diese Tabellen fehlen evtl.
  // Best-Effort-Cleanup: einzeln, jeder Fehler stillschweigend ignoriert.
  const optionalCleanup: Array<[string, unknown[]]> = [
    ['UPDATE admin_audit_log SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE dose_recommendations SET created_by_user_id = NULL WHERE created_by_user_id = ?', [userId]],
    ['UPDATE share_links SET creator_user_id = NULL WHERE creator_user_id = ?', [userId]],
    ['UPDATE blog_posts SET author_id = NULL WHERE author_id = ?', [userId]],
    ['DELETE FROM api_tokens WHERE created_by_user_id = ?', [userId]],
  ]
  for (const [sql, params] of optionalCleanup) {
    try {
      await c.env.DB.prepare(sql).bind(...params).run()
    } catch {
      // Tabelle existiert noch nicht in der Live-DB — überspringen.
    }
  }

  return c.json({ ok: true })
})

// PUT /api/me
meApp.put('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const hasKey = (key: string): boolean => Object.prototype.hasOwnProperty.call(body, key)

  const age = !hasKey('age') || body.age === null || body.age === ''
    ? null
    : typeof body.age === 'number'
      ? body.age
      : Number.NaN
  const weight = !hasKey('weight') || body.weight === null || body.weight === ''
    ? null
    : typeof body.weight === 'number'
      ? body.weight
      : Number.NaN
  const gender = hasKey('gender') && typeof body.gender === 'string' && body.gender.trim() !== '' ? body.gender.trim() : null
  const diet = hasKey('diet') && typeof body.diet === 'string' && body.diet.trim() !== '' ? body.diet.trim() : null
  const goals = hasKey('goals') && typeof body.goals === 'string' && body.goals.trim() !== '' ? body.goals.trim() : null
  const guidelineSource = hasKey('guideline_source') ? normalizeGuidelineSource(body.guideline_source) : undefined
  const isSmoker = body.is_smoker === true || body.is_smoker === 1 ? 1 : body.is_smoker === false || body.is_smoker === 0 ? 0 : null

  if (hasKey('age') && age !== null && (!Number.isInteger(age) || age < 1 || age > 120)) {
    return c.json({ error: 'age must be an integer between 1 and 120' }, 400)
  }
  if (hasKey('weight') && weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 500)) {
    return c.json({ error: 'weight must be greater than 0' }, 400)
  }
  if (hasKey('gender') && body.gender !== null && body.gender !== '' && typeof body.gender !== 'string') {
    return c.json({ error: 'gender must be männlich, weiblich, or divers' }, 400)
  }
  if (hasKey('gender') && gender !== null && !ALLOWED_GENDERS.includes(gender as typeof ALLOWED_GENDERS[number])) {
    return c.json({ error: 'gender must be männlich, weiblich, or divers' }, 400)
  }
  if (hasKey('diet') && body.diet !== null && body.diet !== '' && typeof body.diet !== 'string') {
    return c.json({ error: 'diet must be omnivore, vegetarisch, or vegan' }, 400)
  }
  if (hasKey('diet') && diet !== null && !ALLOWED_DIETS.includes(diet as typeof ALLOWED_DIETS[number])) {
    return c.json({ error: 'diet must be omnivore, vegetarisch, or vegan' }, 400)
  }
  if (hasKey('guideline_source') && guidelineSource === undefined) {
    return c.json({ error: 'guideline_source must be DGE, studien, or influencer' }, 400)
  }
  if (hasKey('is_smoker') && isSmoker === null) {
    return c.json({ error: 'is_smoker must be true/false or 1/0' }, 400)
  }

  const existing = await c.env.DB.prepare(
    'SELECT id, email, age, gender, weight, diet_type, personal_goals, guideline_source, is_smoker, health_consent, health_consent_at, email_verified_at, role FROM users WHERE id = ?'
  ).bind(user.userId).first<UserRow>()
  if (!existing) return c.json({ error: 'User not found' }, 404)

  const target = {
    age: hasKey('age') ? age : existing.age,
    gender: hasKey('gender') ? gender : existing.gender,
    weight: hasKey('weight') ? weight : existing.weight,
    diet: hasKey('diet') ? diet : existing.diet_type,
    goals: hasKey('goals') ? goals : existing.personal_goals,
    guideline_source: hasKey('guideline_source') ? guidelineSource ?? null : existing.guideline_source,
    is_smoker: hasKey('is_smoker') ? isSmoker as number : existing.is_smoker,
  }

  await c.env.DB.prepare(`
    UPDATE users SET
      age = ?,
      gender = ?,
      weight = ?,
      diet_type = ?,
      personal_goals = ?,
      guideline_source = ?,
      is_smoker = ?
    WHERE id = ?
  `).bind(
    target.age,
    target.gender,
    target.weight,
    target.diet,
    target.goals,
    target.guideline_source,
    target.is_smoker,
    user.userId,
  ).run()

  return c.json({ profile: {
    id: existing.id, email: existing.email, age: target.age, gender: target.gender, weight: target.weight,
    diet: target.diet, goals: target.goals, guideline_source: target.guideline_source,
    is_smoker: target.is_smoker, health_consent: existing.health_consent, health_consent_at: existing.health_consent_at,
    email_verified_at: existing.email_verified_at,
    role: existing.role ?? 'user',
  }})
})

export default auth
