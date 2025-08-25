import { Hono } from 'hono'
import type { Bindings } from '../types'

export const affiliateRoutes = new Hono<{ Bindings: Bindings }>()

// Redirect handler for affiliate links
affiliateRoutes.get('/redirect/:id', async (c) => {
  try {
    const linkId = c.req.param('id')
    
    // Get affiliate link
    const affiliateLink = await c.env.DB.prepare(`
      SELECT original_url, affiliate_url FROM affiliate_links WHERE id = ?
    `).bind(linkId).first()
    
    if (!affiliateLink) {
      return c.json({ error: 'Link nicht gefunden' }, 404)
    }
    
    // Track the click
    const userAgent = c.req.header('user-agent') || ''
    const forwarded = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || ''
    
    // Hash IP for privacy (simplified - real implementation would use crypto)
    const hashedIp = btoa(forwarded).substring(0, 8)
    
    await c.env.DB.prepare(`
      INSERT INTO affiliate_clicks (affiliate_link_id, ip_address, user_agent)
      VALUES (?, ?, ?)
    `).bind(linkId, hashedIp, userAgent).run()
    
    // Update click count
    await c.env.DB.prepare(`
      UPDATE affiliate_links SET click_count = click_count + 1 WHERE id = ?
    `).bind(linkId).run()
    
    // Redirect to affiliate URL (or original if no affiliate URL)
    const redirectUrl = affiliateLink.affiliate_url || affiliateLink.original_url
    
    return c.redirect(redirectUrl, 302)
    
  } catch (error) {
    console.error('Error handling affiliate redirect:', error)
    // Fallback to a default URL or error page
    return c.json({ error: 'Redirect-Fehler' }, 500)
  }
})

// Get click statistics (public endpoint for transparency)
affiliateRoutes.get('/stats/:id', async (c) => {
  try {
    const linkId = c.req.param('id')
    
    const stats = await c.env.DB.prepare(`
      SELECT 
        al.click_count,
        COUNT(ac.id) as total_clicks,
        COUNT(DISTINCT ac.ip_address) as unique_clicks
      FROM affiliate_links al
      LEFT JOIN affiliate_clicks ac ON al.id = ac.affiliate_link_id
      WHERE al.id = ?
      GROUP BY al.id
    `).bind(linkId).first()
    
    if (!stats) {
      return c.json({ error: 'Link nicht gefunden' }, 404)
    }
    
    return c.json({
      total_clicks: stats.click_count || 0,
      unique_clicks: stats.unique_clicks || 0
    })
    
  } catch (error) {
    console.error('Error fetching affiliate stats:', error)
    return c.json({ error: 'Statistik-Fehler' }, 500)
  }
})