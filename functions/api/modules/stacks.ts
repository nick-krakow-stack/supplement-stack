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

async function validatePublicCatalogProductIds(
  db: D1Database,
  productIds: number[],
): Promise<boolean> {
  const uniqueIds = [...new Set(productIds)]
  if (uniqueIds.length === 0) return true
  const placeholders = uniqueIds.map(() => '?').join(',')
  const row = await db.prepare(`
    SELECT COUNT(*) as count
    FROM products
    WHERE id IN (${placeholders})
      AND moderation_status = 'approved'
      AND visibility = 'public'
  `).bind(...uniqueIds).first<{ count: number }>()
  return (row?.count ?? 0) === uniqueIds.length
}

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
  const items: Array<Record<string, unknown>> = Array.isArray(data.product_ids)
    ? (data.product_ids as Array<Record<string, unknown>>)
    : Array.isArray(data.products)
      ? (data.products as number[]).map(id => ({ id, quantity: 1 }))
      : []
  const productIds = items.map((item) => Number(item.id))
  if (productIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return c.json({ error: 'product_ids must reference catalog products' }, 400)
  }
  if (!(await validatePublicCatalogProductIds(c.env.DB, productIds))) {
    return c.json({ error: 'Only approved public catalog products can be used in stacks' }, 400)
  }

  const stackResult = await c.env.DB.prepare(
    'INSERT INTO stacks (user_id, name) VALUES (?, ?)'
  ).bind(user.userId, data.name).run()
  const stackId = stackResult.meta.last_row_id

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
    const productIds = data.product_ids.map((item) => Number(item.id))
    if (productIds.some((productId) => !Number.isInteger(productId) || productId <= 0)) {
      return c.json({ error: 'product_ids must reference catalog products' }, 400)
    }
    if (!(await validatePublicCatalogProductIds(c.env.DB, productIds))) {
      return c.json({ error: 'Only approved public catalog products can be used in stacks' }, 400)
    }
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
    `SELECT si.product_id, pi.ingredient_id, pi.parent_ingredient_id
     FROM stack_items si
     JOIN product_ingredients pi ON pi.product_id = si.product_id
     WHERE si.stack_id = ?
       AND pi.search_relevant = 1`
  ).bind(id).all<{ product_id: number; ingredient_id: number; parent_ingredient_id: number | null }>()

  const rowsByProduct = new Map<number, typeof items>()
  for (const item of items) {
    const rows = rowsByProduct.get(item.product_id) ?? []
    rows.push(item)
    rowsByProduct.set(item.product_id, rows)
  }

  const effectiveIngredientIds = new Set<number>()
  for (const rows of rowsByProduct.values()) {
    const parentIdsWithChildRows = new Set(
      rows
        .map((row) => row.parent_ingredient_id)
        .filter((parentId): parentId is number => parentId !== null),
    )

    for (const row of rows) {
      if (row.parent_ingredient_id !== null) {
        effectiveIngredientIds.add(row.ingredient_id)
        continue
      }
      if (!parentIdsWithChildRows.has(row.ingredient_id)) {
        effectiveIngredientIds.add(row.ingredient_id)
      }
    }
  }

  const ingredientIds = [...effectiveIngredientIds]
  if (ingredientIds.length < 2) return c.json({ warnings: [] })

  const placeholders = ingredientIds.map(() => '?').join(',')
  const { results: warnings } = await c.env.DB.prepare(`
    SELECT *
    FROM interactions
    WHERE ingredient_a_id IN (${placeholders})
      AND ingredient_b_id IN (${placeholders})
      AND ingredient_a_id <> ingredient_b_id
    ORDER BY id
  `).bind(...ingredientIds, ...ingredientIds).all<InteractionRow>()
  return c.json({ warnings })
})
