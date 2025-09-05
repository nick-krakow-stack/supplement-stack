// Affiliate link management routes
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
}

const affiliateRoutes = new Hono<{ Bindings: Bindings }>();

// Process affiliate link (no auth required)
affiliateRoutes.post('/process', async (c) => {
  try {
    const { original_url } = await c.req.json();

    if (!original_url) {
      return c.json({
        error: 'missing_url',
        message: 'URL ist erforderlich'
      }, 400);
    }

    // Store for processing
    const result = await c.env.DB.prepare(`
      INSERT INTO affiliate_links (original_url, needs_processing)
      VALUES (?, TRUE)
    `).bind(original_url).run();

    return c.json({
      message: 'Affiliate-Link zur Verarbeitung hinzugefügt',
      linkId: result.meta.last_row_id
    }, 201);

  } catch (error) {
    console.error('Process affiliate link error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Verarbeiten des Affiliate-Links'
    }, 500);
  }
});

// Track click (no auth required)
affiliateRoutes.get('/click/:id', async (c) => {
  try {
    const linkId = c.req.param('id');
    const userAgent = c.req.header('User-Agent') || '';
    const clientIP = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP') || 
                     'unknown';

    // Get affiliate link
    const link = await c.env.DB.prepare(`
      SELECT * FROM affiliate_links WHERE id = ?
    `).bind(linkId).first();

    if (!link) {
      return c.json({
        error: 'link_not_found',
        message: 'Link nicht gefunden'
      }, 404);
    }

    // Track click
    await c.env.DB.prepare(`
      INSERT INTO affiliate_clicks (affiliate_link_id, ip_address, user_agent)
      VALUES (?, ?, ?)
    `).bind(linkId, clientIP, userAgent).run();

    // Update click count
    await c.env.DB.prepare(`
      UPDATE affiliate_links SET click_count = click_count + 1 WHERE id = ?
    `).bind(linkId).run();

    // Redirect to target URL
    return c.redirect(link.affiliate_url || link.original_url);

  } catch (error) {
    console.error('Track click error:', error);
    return c.redirect('https://supplementstack.de');
  }
});

// Get affiliate stats (auth required)
affiliateRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_links,
        SUM(click_count) as total_clicks,
        COUNT(CASE WHEN needs_processing = TRUE THEN 1 END) as pending_processing
      FROM affiliate_links
    `).first();

    return c.json({
      stats
    }, 200);

  } catch (error) {
    console.error('Get affiliate stats error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Affiliate-Statistiken'
    }, 500);
  }
});

export { affiliateRoutes };