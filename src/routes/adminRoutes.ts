// Supplement Stack - Admin Routes
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/authMiddleware'
import { apiSuccess, apiError } from '../utils/helpers'

const admin = new Hono<AppEnv>()

// All admin routes require authentication
// TODO: Add admin-role check middleware when user roles are implemented

// ========================
// SYSTEM HEALTH CHECK (public - also mounted at /api/health)
// ========================
admin.get('/health', async (c) => {
  try {
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first()
    return c.json(apiSuccess({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbTest ? 'connected' : 'disconnected',
      environment: c.env.ENVIRONMENT || 'unknown'
    }))
  } catch (error: any) {
    return c.json(apiError('unhealthy', error.message), 500)
  }
})

// ========================
// SYSTEM STATISTICS (protected)
// ========================
admin.get('/stats', authMiddleware, async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE email_verified = TRUE) as verified_users,
        (SELECT COUNT(*) FROM users WHERE email_verified = FALSE) as unverified_users,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM stacks) as total_stacks,
        (SELECT COUNT(*) FROM nutrients) as total_nutrients
    `).first()

    return c.json(apiSuccess(stats))
  } catch (error: any) {
    console.error('Stats error:', error)
    return c.json(apiError('stats_failed', 'Statistiken konnten nicht geladen werden'), 500)
  }
})

// ========================
// CLEANUP EXPIRED TOKENS (protected)
// ========================
admin.post('/cleanup', authMiddleware, async (c) => {
  try {
    // Delete expired email verification tokens
    const tokenResult = await c.env.DB.prepare(
      'DELETE FROM email_verification_tokens WHERE expires_at < CURRENT_TIMESTAMP'
    ).run()

    // Delete unverified users older than 7 days
    const userResult = await c.env.DB.prepare(
      "DELETE FROM users WHERE email_verified = FALSE AND created_at < datetime('now', '-7 days')"
    ).run()

    return c.json(apiSuccess({
      cleaned_tokens: tokenResult.meta.changes || 0,
      cleaned_users: userResult.meta.changes || 0
    }, 'Aufräumen abgeschlossen'))
  } catch (error: any) {
    console.error('Cleanup error:', error)
    return c.json(apiError('cleanup_failed', 'Aufräumen fehlgeschlagen'), 500)
  }
})

// ========================
// DATABASE INFO (protected)
// ========================
admin.get('/db-info', authMiddleware, async (c) => {
  try {
    const tables = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all()

    return c.json(apiSuccess({
      tables: (tables.results || []).map((t: any) => t.name)
    }))
  } catch (error: any) {
    return c.json(apiError('db_info_failed', 'Datenbank-Info konnte nicht geladen werden'), 500)
  }
})

export default admin
