import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../types'

export const wishlistRoutes = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

// Get user's wishlist
wishlistRoutes.get('/', async (c) => {
  try {
    const user = c.get('user')
    
    const wishlistItems = await c.env.DB.prepare(`
      SELECT w.*, p.name, p.brand, p.form, p.price_per_package, p.shop_url, p.image_url
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `).bind(user.id).all()

    return c.json(wishlistItems.results || [])
  } catch (error) {
    console.error('Error fetching wishlist:', error)
    return c.json({ error: 'Fehler beim Laden der Wunschliste' }, 500)
  }
})

// Add product to wishlist
wishlistRoutes.post('/', async (c) => {
  try {
    const user = c.get('user')
    const { product_id } = await c.req.json()

    if (!product_id) {
      return c.json({ error: 'Produkt-ID ist erforderlich' }, 400)
    }

    // Verify product exists and belongs to user
    const product = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id = ? AND user_id = ?
    `).bind(product_id, user.id).first()

    if (!product) {
      return c.json({ error: 'Produkt nicht gefunden' }, 404)
    }

    // Check if already in wishlist
    const existing = await c.env.DB.prepare(`
      SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?
    `).bind(user.id, product_id).first()

    if (existing) {
      return c.json({ error: 'Produkt ist bereits in der Wunschliste' }, 409)
    }

    // Add to wishlist
    await c.env.DB.prepare(`
      INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)
    `).bind(user.id, product_id).run()

    return c.json({ message: 'Produkt zur Wunschliste hinzugefügt' }, 201)

  } catch (error) {
    console.error('Error adding to wishlist:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Remove product from wishlist
wishlistRoutes.delete('/:productId', async (c) => {
  try {
    const user = c.get('user')
    const productId = c.req.param('productId')

    const result = await c.env.DB.prepare(`
      DELETE FROM wishlist WHERE user_id = ? AND product_id = ?
    `).bind(user.id, productId).run()

    if (result.changes === 0) {
      return c.json({ error: 'Produkt nicht in Wunschliste gefunden' }, 404)
    }

    return c.json({ message: 'Produkt aus Wunschliste entfernt' })

  } catch (error) {
    console.error('Error removing from wishlist:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})