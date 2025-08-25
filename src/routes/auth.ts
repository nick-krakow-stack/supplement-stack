import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { Bindings, LoginRequest, RegisterRequest, User } from '../types'
import bcrypt from 'bcryptjs'

export const authRoutes = new Hono<{ Bindings: Bindings }>()

// User registration
authRoutes.post('/register', async (c) => {
  try {
    const body = await c.req.json<RegisterRequest>()
    
    // Validate required fields
    if (!body.email || !body.password) {
      return c.json({ error: 'E-Mail und Passwort sind erforderlich' }, 400)
    }
    
    if (body.password.length < 8) {
      return c.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, 400)
    }
    
    // Check if user already exists
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(body.email)
      .first()
    
    if (existingUser) {
      return c.json({ error: 'E-Mail-Adresse ist bereits registriert' }, 409)
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10)
    
    // Create user
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, age, gender, weight, diet_type, personal_goals, guideline_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.email,
      passwordHash,
      body.age || null,
      body.gender || null,
      body.weight || null,
      body.diet_type || 'omnivore',
      body.personal_goals || null,
      'DGE'
    ).run()
    
    if (!result.success) {
      return c.json({ error: 'Registrierung fehlgeschlagen' }, 500)
    }
    
    // Generate JWT token
    const token = await sign(
      { 
        userId: result.meta.last_row_id,
        email: body.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
      },
      c.env.JWT_SECRET || 'fallback-secret-for-dev'
    )
    
    return c.json({
      message: 'Registrierung erfolgreich',
      token,
      user: {
        id: result.meta.last_row_id,
        email: body.email,
        guideline_source: 'DGE'
      }
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// User login
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json<LoginRequest>()
    
    if (!body.email || !body.password) {
      return c.json({ error: 'E-Mail und Passwort sind erforderlich' }, 400)
    }
    
    // Find user
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(body.email)
      .first<User>()
    
    if (!user) {
      return c.json({ error: 'Ungültige Anmeldedaten' }, 401)
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, user.password_hash)
    if (!isValidPassword) {
      return c.json({ error: 'Ungültige Anmeldedaten' }, 401)
    }
    
    // Generate JWT token
    const token = await sign(
      { 
        userId: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
      },
      c.env.JWT_SECRET || 'fallback-secret-for-dev'
    )
    
    return c.json({
      message: 'Anmeldung erfolgreich',
      token,
      user: {
        id: user.id,
        email: user.email,
        guideline_source: user.guideline_source
      }
    })
    
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Get current user profile (protected route would handle this)
authRoutes.get('/me', async (c) => {
  // This would be handled by protected routes with JWT middleware
  return c.json({ message: 'Use /api/protected/auth/me instead' })
})

// Logout (client-side token removal)
authRoutes.post('/logout', (c) => {
  return c.json({ message: 'Abmeldung erfolgreich' })
})