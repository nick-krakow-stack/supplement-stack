// Supplement Stack - Auth Routes
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import type { AppEnv } from '../types'
import { hashPassword, verifyPassword, generateSecureToken, validateEmail, validatePassword, sendEmail, apiSuccess, apiError } from '../utils/helpers'
import { authMiddleware } from '../middleware/authMiddleware'

const auth = new Hono<AppEnv>()

// ========================
// REGISTER
// ========================
auth.post('/register', async (c) => {
  try {
    const { email, password, confirmPassword } = await c.req.json()

    if (!email || !password || !confirmPassword) {
      return c.json(apiError('missing_fields', 'Alle Felder sind erforderlich'), 400)
    }
    if (password !== confirmPassword) {
      return c.json(apiError('password_mismatch', 'Die Passwörter stimmen nicht überein'), 400)
    }
    if (!validateEmail(email)) {
      return c.json(apiError('invalid_email', 'Ungültiges E-Mail-Format'), 400)
    }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return c.json(apiError('password_weak', pwCheck.message!), 400)
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check existing user
    const existing = await c.env.DB.prepare(
      'SELECT id, email_verified FROM users WHERE email = ?'
    ).bind(normalizedEmail).first()

    if (existing) {
      if (existing.email_verified) {
        return c.json(apiError('email_exists', 'Diese E-Mail-Adresse ist bereits registriert'), 409)
      }
      // Delete unverified user so they can re-register
      await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(existing.id).run()
    }

    // Create user
    const passwordHash = await hashPassword(password)
    const verificationToken = generateSecureToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, email_verified, email_verification_token, email_verification_expires_at, created_at, updated_at)
      VALUES (?, ?, FALSE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(normalizedEmail, passwordHash, verificationToken, expiresAt).run()

    // Send verification email
    const baseUrl = c.env.ENVIRONMENT === 'production'
      ? 'https://supplementstack.de'
      : `https://${c.req.header('host')}`
    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`

    try {
      await sendEmail(
        c.env.MAILERSEND_API_KEY,
        normalizedEmail,
        'E-Mail-Adresse bestätigen - Supplement Stack',
        buildVerificationEmail(verificationLink),
        `Willkommen bei Supplement Stack! Bestätigen Sie Ihre E-Mail: ${verificationLink}`
      )
    } catch (emailErr) {
      console.error('Verification email failed:', emailErr)
      // Continue - user can request resend
    }

    return c.json(apiSuccess(
      { emailSent: true },
      'Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails.'
    ), 201)
  } catch (error: any) {
    console.error('Registration error:', error)
    return c.json(apiError('internal_error', 'Ein interner Fehler ist aufgetreten'), 500)
  }
})

// ========================
// LOGIN (direct JWT - no 2-step for simplicity)
// ========================
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json(apiError('missing_fields', 'E-Mail und Passwort sind erforderlich'), 400)
    }

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first()

    if (!user) {
      return c.json(apiError('invalid_credentials', 'Ungültige E-Mail-Adresse oder Passwort'), 401)
    }

    const passwordValid = await verifyPassword(password, user.password_hash as string)
    if (!passwordValid) {
      return c.json(apiError('invalid_credentials', 'Ungültige E-Mail-Adresse oder Passwort'), 401)
    }

    if (!user.email_verified) {
      return c.json(apiError('email_not_verified', 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse. Überprüfen Sie Ihr Postfach.'), 403)
    }

    // Generate JWT
    const token = await sign({
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
    }, c.env.JWT_SECRET)

    // Set HttpOnly cookie AND return token for localStorage
    c.header('Set-Cookie', `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`)

    // Update last login
    await c.env.DB.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run()

    return c.json(apiSuccess({
      token,
      user: { id: user.id, email: user.email, email_verified: user.email_verified }
    }, 'Anmeldung erfolgreich'))
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json(apiError('internal_error', 'Ein interner Fehler ist aufgetreten'), 500)
  }
})

// ========================
// VERIFY EMAIL
// ========================
auth.get('/verify-email', async (c) => {
  try {
    const token = c.req.query('token')
    if (!token) {
      return c.html(verificationResultPage(false, 'Kein Token angegeben'))
    }

    const user = await c.env.DB.prepare(`
      SELECT * FROM users
      WHERE email_verification_token = ?
        AND email_verification_expires_at > CURRENT_TIMESTAMP
        AND email_verified = FALSE
    `).bind(token).first()

    if (!user) {
      return c.html(verificationResultPage(false, 'Link ist ungültig oder abgelaufen'))
    }

    // Mark as verified
    await c.env.DB.prepare(`
      UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id).run()

    // Generate JWT and set cookie + pass to frontend via page
    const jwtToken = await sign({
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
    }, c.env.JWT_SECRET)

    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`)

    return c.html(verificationResultPage(true, 'E-Mail erfolgreich bestätigt!', jwtToken, user.email as string))
  } catch (error: any) {
    console.error('Verify email error:', error)
    return c.html(verificationResultPage(false, 'Ein Fehler ist aufgetreten'))
  }
})

// ========================
// FORGOT PASSWORD
// ========================
auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json()
    if (!email) {
      return c.json(apiError('missing_email', 'E-Mail-Adresse ist erforderlich'), 400)
    }

    // Always return success to prevent enumeration
    const successMsg = 'Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link gesendet.'

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND email_verified = TRUE'
    ).bind(email.toLowerCase().trim()).first()

    if (user) {
      const resetToken = generateSecureToken()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      // Clean old tokens, create new
      await c.env.DB.prepare('DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL').bind(user.id).run()
      await c.env.DB.prepare(
        'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
      ).bind(user.id, resetToken, expiresAt).run()

      const baseUrl = c.env.ENVIRONMENT === 'production'
        ? 'https://supplementstack.de'
        : `https://${c.req.header('host')}`
      const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`

      try {
        await sendEmail(
          c.env.MAILERSEND_API_KEY,
          user.email as string,
          'Passwort zurücksetzen - Supplement Stack',
          buildPasswordResetEmail(resetLink),
          `Passwort zurücksetzen: ${resetLink}`
        )
      } catch (emailErr) {
        console.error('Reset email failed:', emailErr)
      }
    }

    return c.json(apiSuccess(null, successMsg))
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return c.json(apiError('internal_error', 'Ein Fehler ist aufgetreten'), 500)
  }
})

// ========================
// RESET PASSWORD
// ========================
auth.post('/reset-password', async (c) => {
  try {
    const { token, password, confirmPassword } = await c.req.json()

    if (!token || !password) {
      return c.json(apiError('missing_fields', 'Token und Passwort sind erforderlich'), 400)
    }
    if (password !== confirmPassword) {
      return c.json(apiError('password_mismatch', 'Passwörter stimmen nicht überein'), 400)
    }
    const pwCheck = validatePassword(password)
    if (!pwCheck.valid) {
      return c.json(apiError('password_weak', pwCheck.message!), 400)
    }

    const tokenRow = await c.env.DB.prepare(`
      SELECT evt.*, u.id as uid FROM email_verification_tokens evt
      JOIN users u ON evt.user_id = u.id
      WHERE evt.token = ? AND evt.expires_at > CURRENT_TIMESTAMP AND evt.used_at IS NULL
    `).bind(token).first()

    if (!tokenRow) {
      return c.json(apiError('invalid_token', 'Reset-Link ist ungültig oder abgelaufen'), 400)
    }

    const newHash = await hashPassword(password)
    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, tokenRow.uid).run()
    await c.env.DB.prepare('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?').bind(token).run()

    return c.json(apiSuccess(null, 'Passwort erfolgreich geändert'))
  } catch (error: any) {
    console.error('Reset password error:', error)
    return c.json(apiError('internal_error', 'Ein Fehler ist aufgetreten'), 500)
  }
})

// ========================
// PROFILE (protected)
// ========================
auth.get('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    return c.json(apiSuccess({
      id: user.id,
      email: user.email,
      email_verified: user.email_verified
    }))
  } catch (error: any) {
    return c.json(apiError('internal_error', 'Profil konnte nicht geladen werden'), 500)
  }
})

// ========================
// LOGOUT
// ========================
auth.post('/logout', async (c) => {
  c.header('Set-Cookie', 'auth_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
  return c.json(apiSuccess(null, 'Erfolgreich abgemeldet'))
})

// ========================
// EMAIL TEMPLATES
// ========================

function buildVerificationEmail(link: string): string {
  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <div style="background:linear-gradient(135deg,#3B82F6,#6366F1);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;">Supplement Stack</h1>
        <p style="margin:10px 0 0;">Ihr intelligenter Supplement Manager</p>
      </div>
      <div style="background:#f9fafb;padding:30px;border-radius:0 0 8px 8px;">
        <h2>E-Mail-Adresse bestätigen</h2>
        <p>Vielen Dank für Ihre Registrierung. Bitte bestätigen Sie Ihre E-Mail-Adresse:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${link}" style="background:#3B82F6;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
            E-Mail bestätigen
          </a>
        </div>
        <p style="font-size:12px;color:#6b7280;">Link gültig für 24 Stunden. Falls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.</p>
      </div>
    </div>`
}

function buildPasswordResetEmail(link: string): string {
  return `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <div style="background:linear-gradient(135deg,#DC2626,#9333EA);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;">Supplement Stack</h1>
        <p style="margin:10px 0 0;">Passwort zurücksetzen</p>
      </div>
      <div style="background:#f9fafb;padding:30px;border-radius:0 0 8px 8px;">
        <h2>Neues Passwort erstellen</h2>
        <p>Klicken Sie auf den Button, um Ihr Passwort zurückzusetzen:</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${link}" style="background:#DC2626;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">
            Passwort zurücksetzen
          </a>
        </div>
        <p style="font-size:12px;color:#6b7280;">Link gültig für 1 Stunde. Falls Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail.</p>
      </div>
    </div>`
}

function verificationResultPage(success: boolean, message: string, token?: string, email?: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'E-Mail bestätigt' : 'Verifizierung fehlgeschlagen'} - Supplement Stack</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 flex items-center justify-center min-h-screen">
  <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center mx-4">
    <div class="text-5xl mb-4">${success ? '✅' : '❌'}</div>
    <h1 class="text-2xl font-bold ${success ? 'text-green-600' : 'text-red-600'} mb-4">${message}</h1>
    ${success ? `
      <p class="text-gray-600 mb-6">Ihr Konto ist jetzt aktiviert. Sie werden in wenigen Sekunden weitergeleitet.</p>
      <a href="/dashboard" class="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium">Zum Dashboard</a>
      <script>
        // Store token in localStorage so frontend can use it
        ${token ? `localStorage.setItem('auth_token', '${token}');` : ''}
        ${email ? `localStorage.setItem('user', JSON.stringify({email:'${email}'}));` : ''}
        setTimeout(() => window.location.href = '/dashboard', 2500);
      </script>
    ` : `
      <p class="text-gray-600 mb-6">Bitte versuchen Sie es erneut oder registrieren Sie sich neu.</p>
      <a href="/auth" class="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium">Zur Anmeldung</a>
    `}
  </div>
</body>
</html>`
}

export default auth
