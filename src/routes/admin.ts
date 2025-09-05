// Admin routes for system management
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import DatabaseService from '../utils/database';

type Bindings = {
  DB: D1Database;
}

const adminRoutes = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all admin routes
adminRoutes.use('*', authMiddleware);

// System health check
adminRoutes.get('/health', async (c) => {
  try {
    // Test database connection
    const testQuery = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({
      status: 'healthy',
      database: testQuery ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    }, 200);

  } catch (error) {
    console.error('Health check error:', error);
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Cleanup expired tokens
adminRoutes.post('/cleanup', async (c) => {
  try {
    const dbService = new DatabaseService(c.env.DB);
    const cleanedCount = await dbService.cleanupExpiredTokens();

    return c.json({
      message: 'Aufräumen abgeschlossen',
      cleanedTokens: cleanedCount
    }, 200);

  } catch (error) {
    console.error('Cleanup error:', error);
    return c.json({
      error: 'cleanup_failed',
      message: 'Aufräumen fehlgeschlagen'
    }, 500);
  }
});

// Get system statistics
adminRoutes.get('/stats', async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE email_verified = TRUE) as verified_users,
        (SELECT COUNT(*) FROM users WHERE email_verified = FALSE) as unverified_users,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM stacks) as total_stacks,
        (SELECT COUNT(*) FROM email_verification_tokens WHERE expires_at > CURRENT_TIMESTAMP) as active_tokens
    `).first();

    return c.json({
      stats
    }, 200);

  } catch (error) {
    console.error('Get stats error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Statistiken'
    }, 500);
  }
});

export { adminRoutes };