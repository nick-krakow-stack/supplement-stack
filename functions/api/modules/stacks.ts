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
import { checkRateLimit, ensureAuth } from '../lib/helpers'
import { sendMail } from '../lib/mail'

const stacks = new Hono<AppContext>()

type StackProductType = 'catalog' | 'user_product'

type StackProductInput = {
  id: number
  product_type: StackProductType
  quantity: number
  dosage_text: string | null
  timing: string | null
}

type StackProductValidation = {
  items?: StackProductInput[]
  error?: string
}

type StackMailItem = {
  name: string
  brand: string | null
  product_price: number
  quantity: number
  serving_size: number | null
  serving_unit: string | null
  timing: string | null
  dosage_text: string | null
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function buildStackEmailHtml(stack: StackRow, items: StackMailItem[], total: number): string {
  const rows = items.map((item) => {
    const serving = item.serving_size != null && item.serving_unit
      ? `${item.serving_size} ${item.serving_unit}`
      : null
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(item.name)}</strong>
          ${item.brand ? `<br><span style="color:#64748b;">${escapeHtml(item.brand)}</span>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(serving ?? '-')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.dosage_text ?? '-')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.timing ?? '-')}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatEuro(item.product_price * item.quantity)}</td>
      </tr>
    `
  }).join('')

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.5;">
      <h1 style="font-size:22px;margin:0 0 8px;">${escapeHtml(stack.name)}</h1>
      <p style="margin:0 0 18px;color:#64748b;">Dein Supplement-Stack aus Supplement Stack.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th align="left" style="padding:10px 8px;">Produkt</th>
            <th align="left" style="padding:10px 8px;">Portion</th>
            <th align="left" style="padding:10px 8px;">Dosierung</th>
            <th align="left" style="padding:10px 8px;">Timing</th>
            <th align="right" style="padding:10px 8px;">Kosten</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding:12px 8px;color:#64748b;">Dieser Stack ist leer.</td></tr>'}</tbody>
      </table>
      <p style="margin:18px 0 0;font-size:16px;"><strong>Gesamtkosten:</strong> ${formatEuro(total)}</p>
      <p style="margin:20px 0 0;color:#64748b;font-size:12px;">
        Diese E-Mail dient deiner persönlichen Übersicht und ersetzt keine medizinische Beratung.
      </p>
    </div>
  `
}

function normalizeStackProductType(value: unknown): StackProductType | null {
  if (value === undefined || value === null || value === '' || value === 'catalog') return 'catalog'
  if (value === 'user_product') return 'user_product'
  return null
}

function normalizeStackProductItems(value: unknown): StackProductValidation {
  const rawItems: Array<Record<string, unknown>> = Array.isArray(value)
    ? value.map((item) => (
        typeof item === 'number' ? { id: item } : item && typeof item === 'object' ? item as Record<string, unknown> : {}
      ))
    : []

  const items: StackProductInput[] = []
  for (const item of rawItems) {
    const id = Number(item.id)
    const productType = normalizeStackProductType(item.product_type ?? item.product_source ?? item.source)
    const quantity = item.quantity === undefined || item.quantity === null || item.quantity === ''
      ? 1
      : Number(item.quantity)
    const dosageText = typeof item.dosage_text === 'string' && item.dosage_text.trim() !== ''
      ? item.dosage_text.trim()
      : null
    const timing = typeof item.timing === 'string' && item.timing.trim() !== ''
      ? item.timing.trim()
      : null

    if (!Number.isInteger(id) || id <= 0) {
      return { error: 'product_ids must reference valid products' }
    }
    if (productType === null) {
      return { error: 'product_type must be catalog or user_product' }
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: 'quantity must be greater than 0' }
    }

    items.push({ id, product_type: productType, quantity, dosage_text: dosageText, timing })
  }

  return { items }
}

async function validateStackProductReferences(
  db: D1Database,
  userId: number,
  items: StackProductInput[],
): Promise<boolean> {
  const catalogIds = [...new Set(items.filter((item) => item.product_type === 'catalog').map((item) => item.id))]
  if (catalogIds.length > 0) {
    const placeholders = catalogIds.map(() => '?').join(',')
    const row = await db.prepare(`
    SELECT COUNT(*) as count
    FROM products
    WHERE id IN (${placeholders})
      AND moderation_status = 'approved'
      AND visibility = 'public'
  `).bind(...catalogIds).first<{ count: number }>()
    if ((row?.count ?? 0) !== catalogIds.length) return false
  }

  const userProductIds = [...new Set(items.filter((item) => item.product_type === 'user_product').map((item) => item.id))]
  if (userProductIds.length > 0) {
    const placeholders = userProductIds.map(() => '?').join(',')
    const row = await db.prepare(`
      SELECT COUNT(*) as count
      FROM user_products
      WHERE id IN (${placeholders})
        AND user_id = ?
        AND status IN ('pending', 'approved')
    `).bind(...userProductIds, userId).first<{ count: number }>()
    if ((row?.count ?? 0) !== userProductIds.length) return false
  }

  return true
}

async function loadStackItems(
  db: D1Database,
  stackId: number | string,
  ownerUserId: number,
): Promise<StackItemRow[]> {
  const { results } = await db.prepare(`
    SELECT *
    FROM (
      SELECT
        si.id AS stack_item_id,
        p.id,
        'catalog' AS product_type,
        p.name,
        p.brand,
        p.price,
        p.price as product_price,
        p.image_url,
        p.shop_link,
        p.is_affiliate,
        p.discontinued_at,
        p.serving_size,
        p.serving_unit,
        p.servings_per_container,
        p.container_count,
        COALESCE(si.timing, p.timing) AS timing,
        COALESCE(si.dosage_text, p.dosage_text) AS dosage_text,
        p.effect_summary,
        p.warning_title,
        p.warning_message,
        p.warning_type,
        p.alternative_note,
        si.quantity
      FROM stack_items si
      JOIN products p ON p.id = si.catalog_product_id
      WHERE si.stack_id = ?
        AND si.catalog_product_id IS NOT NULL

      UNION ALL

      SELECT
        si.id AS stack_item_id,
        up.id,
        'user_product' AS product_type,
        up.name,
        up.brand,
        up.price,
        up.price as product_price,
        up.image_url,
        up.shop_link,
        up.is_affiliate,
        NULL AS discontinued_at,
        up.serving_size,
        up.serving_unit,
        up.servings_per_container,
        up.container_count,
        COALESCE(si.timing, up.timing) AS timing,
        COALESCE(si.dosage_text, up.dosage_text) AS dosage_text,
        up.effect_summary,
        up.warning_title,
        up.warning_message,
        up.warning_type,
        up.alternative_note,
        si.quantity
      FROM stack_items si
      JOIN user_products up ON up.id = si.user_product_id AND up.user_id = ?
      WHERE si.stack_id = ?
        AND si.user_product_id IS NOT NULL
    )
    ORDER BY stack_item_id ASC
  `).bind(stackId, ownerUserId, stackId).all<StackItemRow>()
  return results
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
  const rawItems = Array.isArray(data.product_ids) ? data.product_ids : data.products
  const normalized = normalizeStackProductItems(rawItems)
  if (normalized.error || !normalized.items) {
    return c.json({ error: normalized.error ?? 'Invalid product_ids' }, 400)
  }
  if (!(await validateStackProductReferences(c.env.DB, user.userId, normalized.items))) {
    return c.json({ error: 'Stacks can only use public catalog products or your own pending/approved products' }, 400)
  }

  const stackResult = await c.env.DB.prepare(
    'INSERT INTO stacks (user_id, name) VALUES (?, ?)'
  ).bind(user.userId, data.name).run()
  const stackId = stackResult.meta.last_row_id

  for (const item of normalized.items) {
    await c.env.DB.prepare(
      'INSERT INTO stack_items (stack_id, catalog_product_id, user_product_id, quantity, dosage_text, timing) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      stackId,
      item.product_type === 'catalog' ? item.id : null,
      item.product_type === 'user_product' ? item.id : null,
      item.quantity,
      item.dosage_text,
      item.timing,
    ).run()
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
  const items = await loadStackItems(c.env.DB, stack.id, stack.user_id)
  const total = items.reduce((sum, i) => sum + (i.product_price * i.quantity), 0)
  return c.json({ stack, items, total })
})

// POST /api/stacks/:id/email
stacks.post('/:id/email', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `stack-email:${user.userId}`, 5, 3600)
  if (!allowed) return c.json({ error: 'Bitte warte kurz, bevor du weitere Stack-Mails versendest.' }, 429)

  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const items = await loadStackItems(c.env.DB, stack.id, stack.user_id) as unknown as StackMailItem[]
  const total = items.reduce((sum, item) => sum + (item.product_price * item.quantity), 0)
  const result = await sendMail(c.env, {
    to: user.email,
    subject: `Dein Supplement Stack: ${stack.name}`,
    html: buildStackEmailHtml(stack, items, total),
  })

  if (!result.ok) return c.json({ error: 'E-Mail konnte nicht gesendet werden.', debug: result.error }, 500)
  return c.json({ ok: true })
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
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : null
  if (data.name !== undefined && name === null) {
    return c.json({ error: 'Stack-Name darf nicht leer sein' }, 400)
  }

  let normalizedItems: StackProductInput[] | null = null
  if (data.product_ids !== undefined) {
    const normalized = normalizeStackProductItems(data.product_ids)
    if (normalized.error || !normalized.items) {
      return c.json({ error: normalized.error ?? 'Invalid product_ids' }, 400)
    }
    if (!(await validateStackProductReferences(c.env.DB, stack.user_id, normalized.items))) {
      return c.json({ error: 'Stacks can only use public catalog products or your own pending/approved products' }, 400)
    }
    normalizedItems = normalized.items
  }

  const statements: D1PreparedStatement[] = []
  if (name !== null) {
    statements.push(c.env.DB.prepare('UPDATE stacks SET name = ? WHERE id = ?').bind(name, id))
  }
  if (normalizedItems !== null) {
    statements.push(c.env.DB.prepare('DELETE FROM stack_items WHERE stack_id = ?').bind(id))
    statements.push(...normalizedItems.map((item) =>
      c.env.DB.prepare(
        'INSERT INTO stack_items (stack_id, catalog_product_id, user_product_id, quantity, dosage_text, timing) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        id,
        item.product_type === 'catalog' ? item.id : null,
        item.product_type === 'user_product' ? item.id : null,
        item.quantity,
        item.dosage_text,
        item.timing,
      )
    ))
  }
  if (statements.length > 0) {
    await c.env.DB.batch(statements)
  }
  const updated = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first()
  const items = await loadStackItems(c.env.DB, id, stack.user_id)
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
    `SELECT *
     FROM (
       SELECT
         si.id AS stack_item_id,
         si.catalog_product_id AS product_id,
         'catalog' AS product_type,
         pi.ingredient_id,
         pi.parent_ingredient_id
       FROM stack_items si
       JOIN product_ingredients pi ON pi.product_id = si.catalog_product_id
       WHERE si.stack_id = ?
         AND si.catalog_product_id IS NOT NULL
         AND pi.search_relevant = 1

       UNION ALL

       SELECT
         si.id AS stack_item_id,
         si.user_product_id AS product_id,
         'user_product' AS product_type,
         upi.ingredient_id,
         upi.parent_ingredient_id
       FROM stack_items si
       JOIN user_products up ON up.id = si.user_product_id AND up.user_id = ?
       JOIN user_product_ingredients upi ON upi.user_product_id = up.id
       WHERE si.stack_id = ?
         AND si.user_product_id IS NOT NULL
         AND upi.search_relevant = 1
     )
     ORDER BY stack_item_id ASC`
  ).bind(id, stack.user_id, id).all<{
    stack_item_id: number
    product_id: number
    product_type: StackProductType
    ingredient_id: number
    parent_ingredient_id: number | null
  }>()

  const rowsByProduct = new Map<string, typeof items>()
  for (const item of items) {
    const key = `${item.product_type}:${item.product_id}`
    const rows = rowsByProduct.get(key) ?? []
    rows.push(item)
    rowsByProduct.set(key, rows)
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
    SELECT
      id,
      ingredient_id AS ingredient_a_id,
      partner_ingredient_id AS ingredient_b_id,
      type,
      comment
    FROM interactions
    WHERE is_active = 1
      AND partner_type = 'ingredient'
      AND partner_ingredient_id IS NOT NULL
      AND ingredient_id IN (${placeholders})
      AND partner_ingredient_id IN (${placeholders})
      AND ingredient_id <> partner_ingredient_id
    ORDER BY id
  `).bind(...ingredientIds, ...ingredientIds).all<InteractionRow>()
  return c.json({ warnings })
})
