// Supplement Stack - Stack Routes
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/authMiddleware'
import { apiSuccess, apiError } from '../utils/helpers'

const stacks = new Hono<AppEnv>()

// ========================
// GET all user stacks
// ========================
stacks.get('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')

    const result = await c.env.DB.prepare(`
      SELECT s.id, s.name, s.description, s.created_at,
             GROUP_CONCAT(sp.product_id) as product_ids
      FROM stacks s
      LEFT JOIN stack_products sp ON s.id = sp.stack_id
      WHERE s.user_id = ?
      GROUP BY s.id, s.name, s.description, s.created_at
      ORDER BY s.created_at DESC
    `).bind(userId).all()

    const formatted = (result.results || []).map((stack: any) => ({
      id: stack.id,
      name: stack.name,
      description: stack.description || '',
      products: stack.product_ids
        ? stack.product_ids.split(',').map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id))
        : [],
      created_at: stack.created_at
    }))

    return c.json(apiSuccess(formatted))
  } catch (error: any) {
    console.error('Stacks GET error:', error)
    return c.json(apiError('load_failed', 'Stacks konnten nicht geladen werden'), 500)
  }
})

// ========================
// GET single stack with full product + nutrient details
// ========================
stacks.get('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const stackId = c.req.param('id')

    const stack = await c.env.DB.prepare(`
      SELECT s.id, s.name, s.description, s.created_at
      FROM stacks s
      WHERE s.id = ? AND s.user_id = ?
    `).bind(stackId, userId).first()

    if (!stack) {
      return c.json(apiError('not_found', 'Stack nicht gefunden'), 404)
    }

    // Get stack products with full details
    const spRows = await c.env.DB.prepare(`
      SELECT sp.product_id, sp.dosage_per_day, sp.dosage_source,
             p.name, p.brand, p.form, p.price_per_package, p.servings_per_package, p.shop_url
      FROM stack_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.stack_id = ?
    `).bind(stackId).all()

    const products = []
    for (const sp of (spRows.results || []) as any[]) {
      // Get nutrients for this product
      let nutrients: any = { results: [] }
      try {
        nutrients = await c.env.DB.prepare(`
          SELECT pn.amount, pn.unit, pn.amount_standardized,
                 n.id as nutrient_id, n.name as nutrient_name, n.standard_unit,
                 n.dge_recommended, n.max_safe_dose, n.warning_threshold
          FROM product_nutrients pn
          JOIN nutrients n ON pn.nutrient_id = n.id
          WHERE pn.product_id = ?
        `).bind(sp.product_id).all()
      } catch { /* fallback if columns missing */ }

      const servings = sp.servings_per_package || 1
      const price = sp.price_per_package || 0
      const dosage = sp.dosage_per_day || 1

      products.push({
        id: sp.product_id,
        name: sp.name,
        brand: sp.brand,
        form: sp.form,
        purchase_price: price,
        quantity: servings,
        price_per_piece: servings > 0 ? price / servings : 0,
        dosage_per_day: dosage,
        days_supply: dosage > 0 ? Math.floor(servings / dosage) : servings,
        monthly_cost: servings > 0 ? (price / servings) * dosage * 30 : 0,
        shop_url: sp.shop_url,
        main_nutrients: (nutrients.results || []).map((n: any) => ({
          nutrient_id: n.nutrient_id,
          name: n.nutrient_name,
          amount_per_unit: n.amount_standardized || n.amount,
          unit: n.standard_unit || n.unit,
          dge_recommended: n.dge_recommended,
          max_safe_dose: n.max_safe_dose,
          warning_threshold: n.warning_threshold
        }))
      })
    }

    return c.json(apiSuccess({
      id: stack.id,
      name: stack.name,
      description: stack.description || '',
      products,
      created_at: stack.created_at
    }))
  } catch (error: any) {
    return c.json(apiError('load_failed', 'Stack konnte nicht geladen werden'), 500)
  }
})

// ========================
// UPDATE product dosage in stack
// ========================
stacks.put('/:stackId/products/:productId', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const stackId = c.req.param('stackId')
    const productId = c.req.param('productId')
    const { dosagePerDay } = await c.req.json()

    // Verify ownership
    const stack = await c.env.DB.prepare(
      'SELECT id FROM stacks WHERE id = ? AND user_id = ?'
    ).bind(stackId, userId).first()

    if (!stack) {
      return c.json(apiError('not_found', 'Stack nicht gefunden'), 404)
    }

    await c.env.DB.prepare(
      'UPDATE stack_products SET dosage_per_day = ? WHERE stack_id = ? AND product_id = ?'
    ).bind(dosagePerDay, stackId, productId).run()

    return c.json(apiSuccess({ stackId, productId, dosagePerDay }, 'Dosierung aktualisiert'))
  } catch (error: any) {
    return c.json(apiError('update_failed', 'Dosierung konnte nicht aktualisiert werden'), 500)
  }
})

// ========================
// CREATE stack
// ========================
stacks.post('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const data = await c.req.json()

    const result = await c.env.DB.prepare(
      'INSERT INTO stacks (user_id, name, description) VALUES (?, ?, ?)'
    ).bind(userId, data.name || 'Neuer Stack', data.description || '').run()

    if (!result.success) {
      throw new Error('Insert failed')
    }

    const stackId = result.meta.last_row_id

    // Add products if provided
    if (data.products && Array.isArray(data.products)) {
      for (const productId of data.products) {
        try {
          await c.env.DB.prepare(
            'INSERT INTO stack_products (stack_id, product_id, dosage_per_day) VALUES (?, ?, ?)'
          ).bind(stackId, productId, 1).run()
        } catch (err) {
          console.warn('Failed to add product to stack:', productId, err)
        }
      }
    }

    // Fetch created stack
    const newStack = await c.env.DB.prepare(`
      SELECT s.id, s.name, s.description, s.created_at,
             GROUP_CONCAT(sp.product_id) as product_ids
      FROM stacks s
      LEFT JOIN stack_products sp ON s.id = sp.stack_id
      WHERE s.id = ? AND s.user_id = ?
      GROUP BY s.id
    `).bind(stackId, userId).first()

    return c.json(apiSuccess({
      id: newStack!.id,
      name: newStack!.name,
      description: newStack!.description || '',
      products: newStack!.product_ids
        ? (newStack!.product_ids as string).split(',').map((id: string) => parseInt(id)).filter((id: number) => !isNaN(id))
        : [],
      created_at: newStack!.created_at
    }, 'Stack erstellt'), 201)
  } catch (error: any) {
    console.error('Stack create error:', error)
    return c.json(apiError('create_failed', 'Stack konnte nicht erstellt werden'), 500)
  }
})

// ========================
// ADD product to stack
// ========================
stacks.post('/:stackId/products', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    let stackId: any = c.req.param('stackId')
    const { productId, dosagePerDay = 1 } = await c.req.json()

    // Handle 'user-default' stack
    if (stackId === 'user-default') {
      let defaultStack = await c.env.DB.prepare(
        "SELECT id FROM stacks WHERE user_id = ? AND name = 'Mein Stack' ORDER BY created_at ASC LIMIT 1"
      ).bind(userId).first()

      if (!defaultStack) {
        const createResult = await c.env.DB.prepare(
          "INSERT INTO stacks (user_id, name, description) VALUES (?, 'Mein Stack', 'Ihr persönlicher Stack')"
        ).bind(userId).run()
        stackId = createResult.meta.last_row_id
      } else {
        stackId = defaultStack.id
      }
    } else {
      // Verify ownership
      const stack = await c.env.DB.prepare(
        'SELECT id FROM stacks WHERE id = ? AND user_id = ?'
      ).bind(stackId, userId).first()

      if (!stack) {
        return c.json(apiError('not_found', 'Stack nicht gefunden'), 404)
      }
    }

    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO stack_products (stack_id, product_id, dosage_per_day) VALUES (?, ?, ?)'
    ).bind(stackId, productId, dosagePerDay).run()

    return c.json(apiSuccess({ stackId, productId }, 'Produkt zum Stack hinzugefügt'))
  } catch (error: any) {
    console.error('Add to stack error:', error)
    return c.json(apiError('add_failed', 'Produkt konnte nicht hinzugefügt werden'), 500)
  }
})

// ========================
// REMOVE product from stack
// ========================
stacks.delete('/:stackId/products/:productId', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const stackId = c.req.param('stackId')
    const productId = c.req.param('productId')

    // Verify ownership
    const stack = await c.env.DB.prepare(
      'SELECT id FROM stacks WHERE id = ? AND user_id = ?'
    ).bind(stackId, userId).first()

    if (!stack) {
      return c.json(apiError('not_found', 'Stack nicht gefunden'), 404)
    }

    await c.env.DB.prepare(
      'DELETE FROM stack_products WHERE stack_id = ? AND product_id = ?'
    ).bind(stackId, productId).run()

    return c.json(apiSuccess(null, 'Produkt aus Stack entfernt'))
  } catch (error: any) {
    return c.json(apiError('remove_failed', 'Produkt konnte nicht entfernt werden'), 500)
  }
})

// ========================
// DELETE stack
// ========================
stacks.delete('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const stackId = c.req.param('id')

    // Verify ownership
    const stack = await c.env.DB.prepare(
      'SELECT id FROM stacks WHERE id = ? AND user_id = ?'
    ).bind(stackId, userId).first()

    if (!stack) {
      return c.json(apiError('not_found', 'Stack nicht gefunden'), 404)
    }

    // Delete products first, then stack
    await c.env.DB.prepare('DELETE FROM stack_products WHERE stack_id = ?').bind(stackId).run()
    await c.env.DB.prepare('DELETE FROM stacks WHERE id = ? AND user_id = ?').bind(stackId, userId).run()

    return c.json(apiSuccess({ stackId }, 'Stack gelöscht'))
  } catch (error: any) {
    console.error('Stack delete error:', error)
    return c.json(apiError('delete_failed', 'Stack konnte nicht gelöscht werden'), 500)
  }
})

export default stacks
