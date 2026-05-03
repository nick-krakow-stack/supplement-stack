// ---------------------------------------------------------------------------
// Stacks module
// Routes (mounted at /api/stacks):
//   GET /       — list user stacks (auth)
//   POST /      — create stack (auth)
//   GET /:id    — single stack + items (auth)
//   DELETE /:id — delete stack (auth, own or admin)
//   PUT /:id    — update stack + items (auth, own or admin)
// Route (mounted at /api/stack-warnings):
//   GET /:id    — interaction warnings for a stack (public)
// ---------------------------------------------------------------------------

import { Hono } from 'hono'
import type { AppContext, StackRow, StackItemRow, InteractionRow } from '../lib/types'
import { ensureAuth } from '../lib/helpers'

const stacks = new Hono<AppContext>()

// GET /api/stacks
stacks.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT s.*, COUNT(si.id) as items_count
    FROM stacks s
    LEFT JOIN stack_items si ON si.stack_id = s.id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).bind(user.userId).all()
  return c.json({ stacks: results })
})

// POST /api/stacks
stacks.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!data.name) return c.json({ error: 'Stack-Name ist erforderlich' }, 400)
  const stackResult = await c.env.DB.prepare(
    'INSERT INTO stacks (user_id, name) VALUES (?, ?)'
  ).bind(user.userId, data.name).run()
  const stackId = stackResult.meta.last_row_id

  const items: Array<Record<string, unknown>> = Array.isArray(data.product_ids)
    ? (data.product_ids as Array<Record<string, unknown>>)
    : Array.isArray(data.products)
      ? (data.products as number[]).map(id => ({ id, quantity: 1 }))
      : []

  for (const item of items) {
    await c.env.DB.prepare(
      'INSERT INTO stack_items (stack_id, product_id, quantity, dosage_text, timing) VALUES (?, ?, ?, ?, ?)'
    ).bind(stackId, item.id, item.quantity || 1, item.dosage_text ?? null, item.timing ?? null).run()
  }
  return c.json({ id: stackId, name: data.name })
})

// GET /api/stacks/:id
stacks.get('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(c.req.param('id')).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const { results: items } = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.brand, p.price, p.price as product_price, p.image_url, p.shop_link, p.is_affiliate,
           p.discontinued_at, p.serving_size, p.serving_unit, p.servings_per_container,
           p.container_count, COALESCE(si.timing, p.timing) AS timing, COALESCE(si.dosage_text, p.dosage_text) AS dosage_text,
           p.effect_summary, p.warning_title,
           p.warning_message, p.warning_type, p.alternative_note, si.quantity
    FROM stack_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.stack_id = ?
  `).bind(stack.id).all<StackItemRow>()
  const total = items.reduce((sum, i) => sum + (i.product_price * i.quantity), 0)
  return c.json({ stack, items, total })
})

// DELETE /api/stacks/:id
stacks.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM stacks WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// PUT /api/stacks/:id
stacks.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const data = body as { name?: string; product_ids?: Array<{ id: number; quantity?: number; dosage_text?: string; timing?: string }> }
  if (data.name) {
    await c.env.DB.prepare('UPDATE stacks SET name = ? WHERE id = ?').bind(data.name, id).run()
  }
  if (data.product_ids !== undefined) {
    await c.env.DB.prepare('DELETE FROM stack_items WHERE stack_id = ?').bind(id).run()
    for (const item of data.product_ids) {
      await c.env.DB.prepare(
        'INSERT INTO stack_items (stack_id, product_id, quantity, dosage_text, timing) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, item.id, item.quantity || 1, item.dosage_text ?? null, item.timing ?? null).run()
    }
  }
  const updated = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first()
  const { results: items } = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.brand, p.price, p.price as product_price, p.image_url, p.shop_link, p.is_affiliate,
           p.discontinued_at, p.serving_size, p.serving_unit, p.servings_per_container,
           p.container_count, COALESCE(si.timing, p.timing) AS timing, COALESCE(si.dosage_text, p.dosage_text) AS dosage_text,
           p.effect_summary, p.warning_title,
           p.warning_message, p.warning_type, p.alternative_note, si.quantity
    FROM stack_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.stack_id = ?
  `).bind(id).all()
  return c.json({ stack: updated, items })
})

export default stacks

// ---------------------------------------------------------------------------
// Stack warnings sub-app (mounted at /api/stack-warnings)
// ---------------------------------------------------------------------------

export const stackWarningsApp = new Hono<AppContext>()

// GET /api/stack-warnings/:id
stackWarningsApp.get('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const { results: items } = await c.env.DB.prepare(
    'SELECT pi.ingredient_id FROM stack_items si JOIN product_ingredients pi ON pi.product_id = si.product_id WHERE si.stack_id = ?'
  ).bind(id).all<{ ingredient_id: number }>()
  const ingredientIds = [...new Set(items.map(i => i.ingredient_id))]
  const warnings = []
  for (let a = 0; a < ingredientIds.length; a++) {
    for (let b = a + 1; b < ingredientIds.length; b++) {
      const inter = await c.env.DB.prepare(
        'SELECT * FROM interactions WHERE (ingredient_a_id = ? AND ingredient_b_id = ?) OR (ingredient_a_id = ? AND ingredient_b_id = ?)'
      ).bind(ingredientIds[a], ingredientIds[b], ingredientIds[b], ingredientIds[a]).first<InteractionRow>()
      if (inter) warnings.push(inter)
    }
  }
  return c.json({ warnings })
})
