import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import type { CloudflareBindings, User, CreateUserRequest, LoginRequest, ApiResponse } from '../types'

const auth = new Hono<{ Bindings: CloudflareBindings }>()

// Hilfsfunktionen für Passwort-Hashing (vereinfacht für Cloudflare Workers)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'supplement-stack-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password)
  return hashedInput === hash
}

// JWT Secret (in production über environment variable)
const JWT_SECRET = 'supplement-stack-jwt-secret-2024'

// Registrierung
auth.post('/register', async (c) => {
  try {
    const body: CreateUserRequest = await c.req.json()
    
    // Validierung
    if (!body.email || !body.password) {
      return c.json<ApiResponse>({
        success: false,
        error: 'E-Mail und Passwort sind erforderlich'
      }, 400)
    }

    if (body.password.length < 6) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Passwort muss mindestens 6 Zeichen haben'
      }, 400)
    }

    // E-Mail-Format prüfen
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültige E-Mail-Adresse'
      }, 400)
    }

    // Prüfen ob User bereits existiert
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(body.email).first()

    if (existingUser) {
      return c.json<ApiResponse>({
        success: false,
        error: 'E-Mail-Adresse bereits registriert'
      }, 409)
    }

    // Passwort hashen
    const passwordHash = await hashPassword(body.password)

    // User erstellen
    const result = await c.env.DB.prepare(`
      INSERT INTO users (
        email, password_hash, name, alter, geschlecht, gewicht, 
        ernaehrungsweise, ziele, guideline_quelle
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.email,
      passwordHash,
      body.name || null,
      body.alter || null,
      body.geschlecht || null,
      body.gewicht || null,
      body.ernaehrungsweise || null,
      body.ziele || null,
      body.guideline_quelle || 'DGE'
    ).run()

    // User-Daten für Response
    const user: Partial<User> = {
      id: result.meta.last_row_id as number,
      email: body.email,
      name: body.name,
      alter: body.alter,
      geschlecht: body.geschlecht,
      gewicht: body.gewicht,
      ernaehrungsweise: body.ernaehrungsweise,
      ziele: body.ziele,
      guideline_quelle: body.guideline_quelle || 'DGE',
      role: 'user'
    }

    // JWT Token generieren
    const token = await sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h
    }, JWT_SECRET)

    return c.json<ApiResponse<{ user: Partial<User>, token: string }>>({
      success: true,
      data: { user, token },
      message: 'Registrierung erfolgreich'
    })

  } catch (error) {
    console.error('Registration error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Interner Serverfehler'
    }, 500)
  }
})

// Login
auth.post('/login', async (c) => {
  try {
    const body: LoginRequest = await c.req.json()

    if (!body.email || !body.password) {
      return c.json<ApiResponse>({
        success: false,
        error: 'E-Mail und Passwort sind erforderlich'
      }, 400)
    }

    // User finden
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(body.email).first() as User | null

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültige Anmeldedaten'
      }, 401)
    }

    // Passwort prüfen
    const isValidPassword = await verifyPassword(body.password, user.password_hash)
    if (!isValidPassword) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Ungültige Anmeldedaten'
      }, 401)
    }

    // Passwort-Hash aus Response entfernen
    const { password_hash, ...userWithoutPassword } = user

    // JWT Token generieren
    const token = await sign({
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h
    }, JWT_SECRET)

    return c.json<ApiResponse<{ user: Partial<User>, token: string }>>({
      success: true,
      data: { user: userWithoutPassword, token },
      message: 'Anmeldung erfolgreich'
    })

  } catch (error) {
    console.error('Login error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Interner Serverfehler'
    }, 500)
  }
})

// Token validieren
auth.post('/validate', async (c) => {
  try {
    const { token } = await c.req.json()

    if (!token) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Token fehlt'
      }, 400)
    }

    const payload = await verify(token, JWT_SECRET)
    
    // User aus DB laden für aktuelle Daten
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, alter, geschlecht, gewicht, ernaehrungsweise, ziele, guideline_quelle, role, created_at, updated_at FROM users WHERE id = ?'
    ).bind(payload.userId).first() as User | null

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User nicht gefunden'
      }, 404)
    }

    return c.json<ApiResponse<{ user: User }>>({
      success: true,
      data: { user }
    })

  } catch (error) {
    return c.json<ApiResponse>({
      success: false,
      error: 'Ungültiger Token'
    }, 401)
  }
})

// Profil aktualisieren
auth.put('/profile', async (c) => {
  try {
    // Token aus Authorization Header
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Authorization Header fehlt'
      }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await verify(token, JWT_SECRET)

    const body = await c.req.json()

    // Profil aktualisieren
    await c.env.DB.prepare(`
      UPDATE users 
      SET name = ?, alter = ?, geschlecht = ?, gewicht = ?, 
          ernaehrungsweise = ?, ziele = ?, guideline_quelle = ?, 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      body.name || null,
      body.alter || null,
      body.geschlecht || null,
      body.gewicht || null,
      body.ernaehrungsweise || null,
      body.ziele || null,
      body.guideline_quelle || null,
      payload.userId
    ).run()

    // Aktualisierte User-Daten laden
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, alter, geschlecht, gewicht, ernaehrungsweise, ziele, guideline_quelle, role, created_at, updated_at FROM users WHERE id = ?'
    ).bind(payload.userId).first() as User

    return c.json<ApiResponse<{ user: User }>>({
      success: true,
      data: { user },
      message: 'Profil erfolgreich aktualisiert'
    })

  } catch (error) {
    console.error('Profile update error:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Fehler beim Aktualisieren des Profils'
    }, 500)
  }
})

export default auth