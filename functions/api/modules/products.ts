// ---------------------------------------------------------------------------
// Products module
// Routes (mounted at /api/products):
//   GET /           — public list (approved + public)
//   GET /:id        — single product + ingredients + recommendations
//   POST /          — create (authenticated)
//   PUT /:id        — update (admin)
//   POST /:id/image — upload image (admin, R2)
//   PUT /:id/status — moderation status (admin)
// Route (mounted at /api/r2):
//   GET /products/:productId/:filename — R2 image proxy (public)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, ProductRow } from '../lib/types'
import { ensureAuth, requireAdmin, logAdminAction } from '../lib/helpers'

const products = new Hono<AppContext>()

// GET /api/products
products.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM products WHERE visibility = 'public' AND moderation_status = 'approved'`
  ).all<ProductRow>()
  return c.json({ products: results })
})

// GET /api/products/:id
products.get('/:id', async (c) => {
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const { results: ingredients } = await c.env.DB.prepare(`
    SELECT pi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           i.description as ingredient_description
    FROM product_ingredients pi
    JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = ?
  `).bind(id).all()
  const { results: recommendations } = await c.env.DB.prepare(
    'SELECT r.* FROM product_recommendations r WHERE r.product_id = ?'
  ).bind(id).all()
  return c.json({ product, ingredients, recommendations })
})

// POST /api/products
products.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const body = await c.req.json()
  if (!body.name || !body.price) return c.json({ error: 'Required fields missing' }, 400)
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return c.json({ error: 'At least one main ingredient required' }, 400)
  }
  const mainIngredient = (body.ingredients as Array<Record<string, unknown>>).find(i => i.is_main)
  if (!mainIngredient) return c.json({ error: 'Main ingredient required' }, 400)

  const dup = await c.env.DB.prepare(
    'SELECT id FROM products WHERE name = ? AND brand = ?'
  ).bind(body.name, body.brand || null).first()
  if (dup) return c.json({ error: 'Duplicate product detected' }, 409)

  const result = await c.env.DB.prepare(
    'INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    body.name,
    body.brand || null,
    body.form || null,
    body.price,
    body.shop_link || null,
    body.image_url || null,
    'pending',
    'hidden',
  ).run()
  const productId = result.meta.last_row_id

  for (const ing of body.ingredients as Array<Record<string, unknown>>) {
    await c.env.DB.prepare(
      'INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit, form_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      productId,
      ing.ingredient_id,
      ing.is_main ? 1 : 0,
      ing.quantity || null,
      ing.unit || null,
      ing.form_id || null,
    ).run()
  }

  return c.json({ productId })
})

// PUT /api/products/:id (admin only)
products.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const data = body as {
    name?: string; brand?: string; form?: string; price?: number; shop_link?: string; image_url?: string;
    image_r2_key?: string; is_affiliate?: number; discontinued_at?: string; replacement_id?: number;
    serving_size?: number; serving_unit?: string; servings_per_container?: number; container_count?: number;
    timing?: string; dosage_text?: string; effect_summary?: string; warning_title?: string;
    warning_message?: string; warning_type?: string; alternative_note?: string;
  }
  await c.env.DB.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = COALESCE(?, shop_link),
      image_url = COALESCE(?, image_url),
      image_r2_key = COALESCE(?, image_r2_key),
      is_affiliate = COALESCE(?, is_affiliate),
      discontinued_at = COALESCE(?, discontinued_at),
      serving_size = COALESCE(?, serving_size),
      serving_unit = COALESCE(?, serving_unit),
      servings_per_container = COALESCE(?, servings_per_container),
      container_count = COALESCE(?, container_count),
      timing = COALESCE(?, timing),
      dosage_text = COALESCE(?, dosage_text),
      effect_summary = COALESCE(?, effect_summary),
      warning_title = COALESCE(?, warning_title),
      warning_message = COALESCE(?, warning_message),
      warning_type = COALESCE(?, warning_type),
      alternative_note = COALESCE(?, alternative_note)
    WHERE id = ?
  `).bind(
    data.name ?? null,
    data.brand ?? null,
    data.form ?? null,
    data.price ?? null,
    data.shop_link ?? null,
    data.image_url ?? null,
    data.image_r2_key ?? null,
    data.is_affiliate ?? null,
    data.discontinued_at ?? null,
    data.serving_size ?? null,
    data.serving_unit ?? null,
    data.servings_per_container ?? null,
    data.container_count ?? null,
    data.timing ?? null,
    data.dosage_text ?? null,
    data.effect_summary ?? null,
    data.warning_title ?? null,
    data.warning_message ?? null,
    data.warning_type ?? null,
    data.alternative_note ?? null,
    id,
  ).run()
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  await logAdminAction(c, {
    action: 'update_product',
    entity_type: 'product',
    entity_id: Number(id),
    changes: data,
  })
  return c.json({ product: updated })
})

// POST /api/products/:id/image (admin only)
products.post('/:id/image', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)
  if (!c.env.PRODUCT_IMAGES) return c.json({ error: 'Product image storage is not configured' }, 501)
  const formData = await c.req.formData()
  // Accept both 'image' (new) and 'file' (legacy) field names
  const file = (formData.get('image') ?? formData.get('file')) as File | null
  if (!file) return c.json({ error: 'image field required' }, 400)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) return c.json({ error: 'Only JPEG, PNG or WebP images are allowed' }, 415)
  if (file.size > 5 * 1024 * 1024) return c.json({ error: 'Max 5 MB' }, 413)
  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extMap[file.type] ?? 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const r2Key = `products/${id}/${filename}`
  const buffer = await file.arrayBuffer()
  await c.env.PRODUCT_IMAGES.put(r2Key, buffer, {
    httpMetadata: { contentType: file.type },
  })
  const imageUrl = `/api/r2/products/${id}/${filename}`
  await c.env.DB.prepare(
    'UPDATE products SET image_url = ?, image_r2_key = ? WHERE id = ?'
  ).bind(imageUrl, r2Key, id).run()
  await logAdminAction(c, {
    action: 'upload_product_image',
    entity_type: 'product',
    entity_id: Number(id),
    changes: { image_url: imageUrl, r2_key: r2Key },
  })
  return c.json({ image_url: imageUrl })
})

// PUT /api/products/:id/status (admin only)
products.put('/:id/status', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (body.moderation_status && !['pending', 'approved', 'rejected'].includes(body.moderation_status as string))
    return c.json({ error: 'Invalid moderation_status' }, 400)
  if (body.visibility && !['public', 'hidden'].includes(body.visibility as string))
    return c.json({ error: 'Invalid visibility' }, 400)
  const data = body as { moderation_status?: string; visibility?: string }
  await c.env.DB.prepare(`
    UPDATE products SET
      moderation_status = COALESCE(?, moderation_status),
      visibility = COALESCE(?, visibility)
    WHERE id = ?
  `).bind(data.moderation_status ?? null, data.visibility ?? null, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  await logAdminAction(c, {
    action: 'update_product_status',
    entity_type: 'product',
    entity_id: Number(id),
    changes: { moderation_status: data.moderation_status ?? null, visibility: data.visibility ?? null },
  })
  return c.json({ product: updated })
})

export default products

// ---------------------------------------------------------------------------
// R2 image proxy (mounted at /api/r2)
// ---------------------------------------------------------------------------

export const r2App = new Hono<AppContext>()

// GET /api/r2/products/:productId/:filename (public — R2 proxy)
r2App.get('/products/:productId/:filename', async (c) => {
  if (!c.env.PRODUCT_IMAGES) return c.json({ error: 'Image storage not configured' }, 501)
  const productId = c.req.param('productId')
  const filename = c.req.param('filename')
  const r2Key = `products/${productId}/${filename}`
  const object = await c.env.PRODUCT_IMAGES.get(r2Key)
  if (!object) return c.json({ error: 'Not found' }, 404)
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'
  const body = await object.arrayBuffer()
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
