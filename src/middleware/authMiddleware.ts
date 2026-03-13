// Supplement Stack - Auth Middleware (Unified)
// Supports both: Authorization header (Bearer token) AND HttpOnly cookie
import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { AppEnv } from '../types'

export async function authMiddleware(c: any, next: any) {
  try {
    // 1. Try Authorization header first (frontend sends this)
    let token: string | undefined
    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }

    // 2. Fallback to HttpOnly cookie (set by email verification)
    if (!token) {
      const cookieHeader = c.req.header('Cookie') || ''
      const match = cookieHeader.match(/auth_token=([^;]+)/)
      if (match) {
        token = match[1]
      }
    }

    if (!token) {
      return c.json({ success: false, error: 'missing_token', message: 'Authentifizierung erforderlich' }, 401)
    }

    // 3. Verify JWT
    const payload = await verify(token, c.env.JWT_SECRET) as { userId: number; email: string }

    // 4. Load user from DB
    const user = await c.env.DB.prepare(
      'SELECT id, email, email_verified FROM users WHERE id = ?'
    ).bind(payload.userId).first()

    if (!user) {
      return c.json({ success: false, error: 'user_not_found', message: 'Benutzer nicht gefunden' }, 401)
    }

    // 5. Set both user and userId in context for compatibility
    c.set('user', user)
    c.set('userId', user.id)

    await next()
  } catch (error: any) {
    return c.json({
      success: false,
      error: 'invalid_token',
      message: 'Token ungültig oder abgelaufen'
    }, 401)
  }
}

// Optional auth - doesn't block if not authenticated
export async function optionalAuthMiddleware(c: any, next: any) {
  try {
    let token: string | undefined
    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1]
    }
    if (!token) {
      const cookieHeader = c.req.header('Cookie') || ''
      const match = cookieHeader.match(/auth_token=([^;]+)/)
      if (match) token = match[1]
    }
    if (token) {
      const payload = await verify(token, c.env.JWT_SECRET) as { userId: number }
      const user = await c.env.DB.prepare(
        'SELECT id, email, email_verified FROM users WHERE id = ?'
      ).bind(payload.userId).first()
      if (user) {
        c.set('user', user)
        c.set('userId', user.id)
      }
    }
  } catch {
    // Silently fail - user is just not authenticated
  }
  await next()
}

// Security headers middleware
export async function securityHeaders(c: any, next: any) {
  await next()
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (c.env.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}
