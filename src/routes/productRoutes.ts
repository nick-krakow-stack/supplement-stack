// Supplement Stack - Product Routes
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { authMiddleware } from '../middleware/authMiddleware'
import { apiSuccess, apiError } from '../utils/helpers'

const products = new Hono<AppEnv>()

// ========================
// GET user's products (with nutrients)
// ========================
products.get('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')

    const result = await c.env.DB.prepare(`
      SELECT
        p.id, p.name, p.brand, p.form,
        p.price_per_package, p.servings_per_package, p.shop_url,
        p.created_at
      FROM products p
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).bind(userId).all()

    const productsWithNutrients = []
    for (const product of result.results || []) {
      // Get nutrients
      let nutrients: any = { results: [] }
      try {
        nutrients = await c.env.DB.prepare(`
          SELECT pn.amount, pn.unit, pn.amount_standardized,
                 n.id as nutrient_id, n.name as nutrient_name, n.standard_unit,
                 n.effects, n.deficiency_symptoms, n.excess_symptoms, n.external_article_url
          FROM product_nutrients pn
          JOIN nutrients n ON pn.nutrient_id = n.id
          WHERE pn.product_id = ?
          ORDER BY n.name
        `).bind(product.id).all()
      } catch {
        // Fallback if columns don't exist yet
        nutrients = await c.env.DB.prepare(`
          SELECT pn.amount, pn.unit, pn.amount_standardized,
                 n.id as nutrient_id, n.name as nutrient_name, n.standard_unit
          FROM product_nutrients pn
          JOIN nutrients n ON pn.nutrient_id = n.id
          WHERE pn.product_id = ?
        `).bind(product.id).all()
      }

      const mainNutrients = (nutrients.results || []).map((n: any) => ({
        nutrient_id: n.nutrient_id,
        amount_per_unit: n.amount_standardized || n.amount,
        unit: n.standard_unit || n.unit,
        name: n.nutrient_name
      }))

      const pricePerPackage = product.price_per_package as number || 0
      const servingsPerPackage = product.servings_per_package as number || 1

      productsWithNutrients.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        form: product.form,
        purchase_price: pricePerPackage,
        quantity: servingsPerPackage,
        price_per_piece: servingsPerPackage > 0 ? pricePerPackage / servingsPerPackage : 0,
        dosage_per_day: 1,
        days_supply: servingsPerPackage,
        monthly_cost: servingsPerPackage > 0 ? (pricePerPackage / servingsPerPackage) * 30 : 0,
        shop_url: product.shop_url,
        main_nutrients: mainNutrients,
        secondary_nutrients: [],
        created_at: product.created_at
      })
    }

    return c.json(apiSuccess(productsWithNutrients))
  } catch (error: any) {
    console.error('Products GET error:', error)
    return c.json(apiError('load_failed', 'Produkte konnten nicht geladen werden'), 500)
  }
})

// ========================
// GET single product
// ========================
products.get('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const productId = c.req.param('id')

    const product = await c.env.DB.prepare(`
      SELECT * FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, userId).first()

    if (!product) {
      return c.json(apiError('not_found', 'Produkt nicht gefunden'), 404)
    }

    return c.json(apiSuccess(product))
  } catch (error: any) {
    return c.json(apiError('load_failed', 'Produkt konnte nicht geladen werden'), 500)
  }
})

// ========================
// CREATE product
// ========================
products.post('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const data = await c.req.json()

    const result = await c.env.DB.prepare(`
      INSERT INTO products (user_id, name, brand, form, price_per_package, servings_per_package, shop_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      data.name || 'Unbekanntes Produkt',
      data.brand || 'Unbekannt',
      data.form || 'Kapsel',
      parseFloat(data.purchase_price || data.price_per_package) || 0,
      parseInt(data.quantity || data.servings_per_package) || 30,
      data.shop_url || ''
    ).run()

    if (!result.success) {
      throw new Error('Insert failed')
    }

    const newProductId = result.meta.last_row_id

    // If nutrients are provided, insert them
    if (data.nutrients && Array.isArray(data.nutrients)) {
      for (const n of data.nutrients) {
        await c.env.DB.prepare(`
          INSERT INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized)
          VALUES (?, ?, ?, ?, ?)
        `).bind(newProductId, n.nutrient_id, n.amount, n.unit || 'mg', n.amount).run()
      }
    }

    // Fetch the created product
    const newProduct = await c.env.DB.prepare(`
      SELECT id, name, brand, form, price_per_package, servings_per_package, shop_url, created_at
      FROM products WHERE id = ?
    `).bind(newProductId).first()

    const pricePerPackage = newProduct?.price_per_package as number || 0
    const servingsPerPackage = newProduct?.servings_per_package as number || 1

    return c.json(apiSuccess({
      ...newProduct,
      purchase_price: pricePerPackage,
      quantity: servingsPerPackage,
      monthly_cost: servingsPerPackage > 0 ? (pricePerPackage / servingsPerPackage) * 30 : 0,
      dosage_per_day: 1,
      days_supply: servingsPerPackage,
      main_nutrients: [],
      secondary_nutrients: []
    }, 'Produkt erfolgreich hinzugefügt'), 201)
  } catch (error: any) {
    console.error('Product create error:', error)
    return c.json(apiError('create_failed', 'Produkt konnte nicht erstellt werden'), 500)
  }
})

// ========================
// UPDATE product
// ========================
products.put('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const productId = c.req.param('id')
    const data = await c.req.json()

    // Verify ownership
    const existing = await c.env.DB.prepare(
      'SELECT id FROM products WHERE id = ? AND user_id = ?'
    ).bind(productId, userId).first()

    if (!existing) {
      return c.json(apiError('not_found', 'Produkt nicht gefunden'), 404)
    }

    await c.env.DB.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        brand = COALESCE(?, brand),
        form = COALESCE(?, form),
        price_per_package = COALESCE(?, price_per_package),
        servings_per_package = COALESCE(?, servings_per_package),
        shop_url = COALESCE(?, shop_url),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      data.name || null,
      data.brand || null,
      data.form || null,
      data.purchase_price ?? data.price_per_package ?? null,
      data.quantity ?? data.servings_per_package ?? null,
      data.shop_url || null,
      productId, userId
    ).run()

    const updated = await c.env.DB.prepare(
      'SELECT * FROM products WHERE id = ?'
    ).bind(productId).first()

    return c.json(apiSuccess(updated, 'Produkt aktualisiert'))
  } catch (error: any) {
    console.error('Product update error:', error)
    return c.json(apiError('update_failed', 'Produkt konnte nicht aktualisiert werden'), 500)
  }
})

// ========================
// DELETE product
// ========================
products.delete('/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId')
    const productId = c.req.param('id')

    // Remove from stacks first
    await c.env.DB.prepare(`
      DELETE FROM stack_products
      WHERE product_id = ? AND stack_id IN (SELECT id FROM stacks WHERE user_id = ?)
    `).bind(productId, userId).run()

    // Delete product
    const result = await c.env.DB.prepare(
      'DELETE FROM products WHERE id = ? AND user_id = ?'
    ).bind(productId, userId).run()

    if (result.meta.changes === 0) {
      return c.json(apiError('not_found', 'Produkt nicht gefunden'), 404)
    }

    return c.json(apiSuccess({ productId }, 'Produkt gelöscht'))
  } catch (error: any) {
    console.error('Product delete error:', error)
    return c.json(apiError('delete_failed', 'Produkt konnte nicht gelöscht werden'), 500)
  }
})

export default products
