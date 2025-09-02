import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import type { Bindings, LoginRequest, RegisterRequest, User } from '../types'
import { sendEmail, generateVerificationEmail, generateVerificationToken } from '../utils/email'

// Cloudflare Workers compatible password hashing
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const hashedInput = await hashPassword(password)
  return hashedInput === hash
}

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
    const passwordHash = await hashPassword(body.password)
    
    // Generate email verification token
    const verificationToken = generateVerificationToken()
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    // Create user with email verification
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, age, gender, weight, diet_type, personal_goals, guideline_source, email_verified, email_verification_token, email_verification_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.email,
      passwordHash,
      body.age || null,
      body.gender || null,
      body.weight || null,
      body.diet_type || 'omnivore',
      body.personal_goals || null,
      'DGE',
      false, // email_verified
      verificationToken,
      verificationExpiresAt.toISOString()
    ).run()
    
    if (!result.success) {
      return c.json({ error: 'Registrierung fehlgeschlagen' }, 500)
    }
    
    // Send verification email
    const baseUrl = new URL(c.req.url).origin
    const emailTemplate = generateVerificationEmail(body.email, verificationToken, baseUrl)
    
    try {
      await sendEmail({
        to: body.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text
      })
      console.log('[AUTH] Verification email sent to:', body.email)
    } catch (error) {
      console.error('[AUTH] Failed to send verification email:', error)
      // Continue registration even if email fails
    }
    
    // Return success without JWT token (user must verify email first)
    return c.json({ 
      message: 'Registrierung erfolgreich! Bitte überprüfe deine E-Mails und bestätige deine E-Mail-Adresse.',
      email: body.email,
      requiresVerification: true
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
    const isValidPassword = await verifyPassword(body.password, user.password_hash)
    if (!isValidPassword) {
      return c.json({ error: 'Ungültige Anmeldedaten' }, 401)
    }
    
    // Check if email is verified
    if (!user.email_verified) {
      return c.json({ 
        error: 'E-Mail-Adresse noch nicht bestätigt',
        requiresVerification: true,
        email: user.email
      }, 403)
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

// Email verification endpoint
authRoutes.get('/verify-email', async (c) => {
  try {
    const token = c.req.query('token')
    
    if (!token) {
      return c.json({ error: 'Bestätigungstoken fehlt' }, 400)
    }
    
    // Find user with this verification token
    const user = await c.env.DB.prepare(`
      SELECT * FROM users 
      WHERE email_verification_token = ? 
      AND email_verification_expires_at > datetime('now')
      AND email_verified = FALSE
    `).bind(token).first<User>()
    
    if (!user) {
      return c.json({ error: 'Ungültiger oder abgelaufener Bestätigungstoken' }, 400)
    }
    
    // Mark email as verified
    await c.env.DB.prepare(`
      UPDATE users 
      SET email_verified = TRUE, 
          email_verification_token = NULL,
          email_verification_expires_at = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(user.id).run()
    
    // Generate JWT token for automatic login
    const jwtToken = await sign(
      { 
        userId: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
      },
      c.env.JWT_SECRET || 'fallback-secret-for-dev'
    )
    
    // Return HTML confirmation page instead of JSON
    const confirmationHtml = `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>E-Mail bestätigt - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { background: linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #0891b2 100%); }
        </style>
      </head>
      <body class="min-h-screen flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div class="mb-6">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">✅ E-Mail bestätigt!</h1>
            <p class="text-gray-600 mb-6">
              Willkommen bei <strong>Supplement Stack</strong>!<br>
              Dein Account ist jetzt vollständig aktiviert.
            </p>
          </div>
          
          <div class="space-y-4">
            <button 
              onclick="loginAndRedirect()" 
              class="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105">
              🏁 Jetzt loslegen!
            </button>
            
            <p class="text-sm text-gray-500">
              Du wirst automatisch angemeldet und zu deinem Dashboard weitergeleitet.
            </p>
          </div>
        </div>
        
        <script>
          // Store JWT token and redirect
          function loginAndRedirect() {
            localStorage.setItem('auth_token', '${jwtToken}');
            window.location.href = '/?verified=true';
          }
          
          // Auto-redirect after 3 seconds
          setTimeout(() => {
            loginAndRedirect();
          }, 3000);
        </script>
      </body>
      </html>
    `
    
    return c.html(confirmationHtml)
    
  } catch (error) {
    console.error('Email verification error:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Resend verification email
authRoutes.post('/resend-verification', async (c) => {
  try {
    const body = await c.req.json<{ email: string }>()
    
    if (!body.email) {
      return c.json({ error: 'E-Mail-Adresse ist erforderlich' }, 400)
    }
    
    // Find user
    const user = await c.env.DB.prepare(`
      SELECT * FROM users 
      WHERE email = ? AND email_verified = FALSE
    `).bind(body.email).first<User>()
    
    if (!user) {
      return c.json({ error: 'Benutzer nicht gefunden oder bereits bestätigt' }, 404)
    }
    
    // Generate new verification token
    const verificationToken = generateVerificationToken()
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    // Update user with new token
    await c.env.DB.prepare(`
      UPDATE users 
      SET email_verification_token = ?,
          email_verification_expires_at = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(verificationToken, verificationExpiresAt.toISOString(), user.id).run()
    
    // Send new verification email
    const baseUrl = new URL(c.req.url).origin
    const emailTemplate = generateVerificationEmail(body.email, verificationToken, baseUrl)
    
    try {
      await sendEmail({
        to: body.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text
      })
      
      return c.json({ 
        message: 'Bestätigungs-E-Mail wurde erneut gesendet. Bitte überprüfe dein Postfach.' 
      })
    } catch (error) {
      console.error('Failed to resend verification email:', error)
      return c.json({ error: 'Fehler beim Senden der E-Mail' }, 500)
    }
    
  } catch (error) {
    console.error('Resend verification error:', error)
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