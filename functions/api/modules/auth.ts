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
  sendPasswordResetEmail,
} from '../lib/helpers'

const auth = new Hono<AppContext>()

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
  const guidelineRaw = typeof data.guideline_source === 'string' ? data.guideline_source.trim() : data.guideline_source

  let ageValue: number | null = null
  if (ageRaw !== undefined && ageRaw !== null && (ageRaw as unknown) !== '') {
    if (typeof ageRaw !== 'number' || !Number.isInteger(ageRaw) || ageRaw < 1 || ageRaw > 120) {
      return c.json({ error: 'Alter muss eine ganze Zahl zwischen 1 und 120 sein.' }, 400)
    }
    ageValue = ageRaw
  }

  let genderValue: string | null = null
  if (genderRaw !== undefined && genderRaw !== null && genderRaw !== '') {
    const allowed = ['männlich', 'weiblich', 'divers'] as const
    if (!allowed.includes(genderRaw as typeof allowed[number])) {
      return c.json({ error: 'Geschlecht muss "männlich", "weiblich" oder "divers" sein.' }, 400)
    }
    genderValue = genderRaw
  }

  let guidelineValue: string | null = null
  if (guidelineRaw !== undefined && guidelineRaw !== null && guidelineRaw !== '') {
    const allowed = ['DGE', 'Studien', 'Influencer'] as const
    if (!allowed.includes(guidelineRaw as typeof allowed[number])) {
      return c.json({ error: 'Leitlinienquelle muss "DGE", "Studien" oder "Influencer" sein.' }, 400)
    }
    guidelineValue = guidelineRaw
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
    guidelineValue,
  ).run()

  const userId = result.meta.last_row_id
  await c.env.DB.prepare(
    `INSERT INTO consent_log (user_id, consent_type, granted) VALUES (?, 'health_data', 1)`
  ).bind(userId).run()
  const token = await sign(
    { userId, email: data.email, role: 'user', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    c.env.JWT_SECRET,
  )
  return c.json({ token })
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

  const apiKey = c.env.RESEND_API_KEY
  if (!apiKey) return ok()

  const frontendUrl = c.env.FRONTEND_URL ?? 'https://supplementstack.pages.dev'
  const result = await sendPasswordResetEmail(apiKey, frontendUrl, user.email, rawToken)
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
    profile: {
      id: user.id,
      email: user.email,
      age: user.age,
      gender: user.gender,
      weight: user.weight,
      diet: user.diet_type,
      goals: user.personal_goals,
      guideline_source: user.guideline_source,
      role: user.role ?? 'user',
    },
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
    'SELECT id, email, age, gender, weight, diet_type, personal_goals, guideline_source, is_smoker, health_consent, health_consent_at, role FROM users WHERE id = ?'
  ).bind(user.userId).first<UserRow>()
  if (!row) return c.json({ error: 'User not found' }, 404)
  const profile = {
    id: row.id, email: row.email, age: row.age, gender: row.gender, weight: row.weight,
    diet: row.diet_type, goals: row.personal_goals, guideline_source: row.guideline_source,
    is_smoker: row.is_smoker, health_consent: row.health_consent, health_consent_at: row.health_consent_at,
    role: row.role ?? 'user',
  }
  return c.json({ profile })
})

// PUT /api/me
meApp.put('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const body = await c.req.json()
  const data = body as { age?: number; gender?: string; weight?: number; diet?: string; goals?: string; guideline_source?: string; is_smoker?: number }
  await c.env.DB.prepare(`
    UPDATE users SET
      age = COALESCE(?, age),
      gender = COALESCE(?, gender),
      weight = COALESCE(?, weight),
      diet_type = COALESCE(?, diet_type),
      personal_goals = COALESCE(?, personal_goals),
      guideline_source = COALESCE(?, guideline_source),
      is_smoker = COALESCE(?, is_smoker)
    WHERE id = ?
  `).bind(
    data.age ?? null,
    data.gender ?? null,
    data.weight ?? null,
    data.diet ?? null,
    data.goals ?? null,
    data.guideline_source ?? null,
    data.is_smoker ?? null,
    user.userId,
  ).run()
  const updated = await c.env.DB.prepare(
    'SELECT id, email, age, gender, weight, diet_type, personal_goals, guideline_source, is_smoker, health_consent, health_consent_at, role FROM users WHERE id = ?'
  ).bind(user.userId).first<UserRow>()
  if (!updated) return c.json({ error: 'User not found' }, 404)
  return c.json({ profile: {
    id: updated.id, email: updated.email, age: updated.age, gender: updated.gender, weight: updated.weight,
    diet: updated.diet_type, goals: updated.personal_goals, guideline_source: updated.guideline_source,
    is_smoker: updated.is_smoker, health_consent: updated.health_consent, health_consent_at: updated.health_consent_at,
    role: updated.role ?? 'user',
  }})
})

export default auth
