import { Hono } from 'hono'
import type { Bindings, SessionUser, CreateProductRequest, Product, ProductWithNutrients } from '../types'

export const productRoutes = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

// Get all products for current user
productRoutes.get('/', async (c) => {
  try {
    const user = c.get('user')
    
    const products = await c.env.DB.prepare(`
      SELECT p.*, 
             GROUP_CONCAT(
               json_object(
                 'nutrient_id', pn.nutrient_id,
                 'name', n.name,
                 'amount', pn.amount,
                 'unit', pn.unit,
                 'amount_standardized', pn.amount_standardized
               )
             ) as nutrients_json
      FROM products p
      LEFT JOIN product_nutrients pn ON p.id = pn.product_id
      LEFT JOIN nutrients n ON pn.nutrient_id = n.id
      WHERE p.user_id = ? AND p.is_duplicate = FALSE
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).bind(user.id).all()

    const productsWithNutrients = products.results?.map(product => ({
      ...product,
      nutrients: product.nutrients_json ? 
        product.nutrients_json.split(',').map(n => JSON.parse(n)) : []
    })) || []

    return c.json(productsWithNutrients)
  } catch (error) {
    console.error('Error fetching products:', error)
    return c.json({ error: 'Fehler beim Laden der Produkte' }, 500)
  }
})

// Get single product by ID
productRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user')
    const productId = c.req.param('id')

    const product = await c.env.DB.prepare(`
      SELECT p.*, 
             GROUP_CONCAT(
               json_object(
                 'nutrient_id', pn.nutrient_id,
                 'name', n.name,
                 'amount', pn.amount,
                 'unit', pn.unit,
                 'amount_standardized', pn.amount_standardized
               )
             ) as nutrients_json
      FROM products p
      LEFT JOIN product_nutrients pn ON p.id = pn.product_id
      LEFT JOIN nutrients n ON pn.nutrient_id = n.id
      WHERE p.id = ? AND p.user_id = ?
      GROUP BY p.id
    `).bind(productId, user.id).first()

    if (!product) {
      return c.json({ error: 'Produkt nicht gefunden' }, 404)
    }

    const productWithNutrients = {
      ...product,
      nutrients: product.nutrients_json ? 
        product.nutrients_json.split(',').map(n => JSON.parse(n)) : []
    }

    return c.json(productWithNutrients)
  } catch (error) {
    console.error('Error fetching product:', error)
    return c.json({ error: 'Fehler beim Laden des Produkts' }, 500)
  }
})

// Create new product
productRoutes.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<CreateProductRequest>()

    // Validate required fields
    if (!body.name || !body.brand || !body.form || !body.price_per_package || !body.servings_per_package || !body.shop_url) {
      return c.json({ error: 'Alle Pflichtfelder müssen ausgefüllt werden' }, 400)
    }

    // Check for potential duplicates
    const existingProducts = await c.env.DB.prepare(`
      SELECT id, name, brand FROM products 
      WHERE user_id = ? AND LOWER(name) = LOWER(?) AND LOWER(brand) = LOWER(?)
    `).bind(user.id, body.name, body.brand).all()

    if (existingProducts.results && existingProducts.results.length > 0) {
      return c.json({ 
        error: 'Ein ähnliches Produkt existiert bereits',
        suggestion: 'Möchten Sie das bestehende Produkt bearbeiten?',
        existing_products: existingProducts.results
      }, 409)
    }

    // Process affiliate URL if needed
    let affiliateUrl = body.shop_url
    if (!body.shop_url.includes('affiliate') && !body.shop_url.includes('partner')) {
      // Add to affiliate processing queue
      const affiliateResult = await c.env.DB.prepare(`
        INSERT INTO affiliate_links (original_url, needs_processing) VALUES (?, TRUE)
      `).bind(body.shop_url).run()
      
      affiliateUrl = body.shop_url // Keep original until processed
    }

    // Create product
    const productResult = await c.env.DB.prepare(`
      INSERT INTO products (user_id, name, brand, form, price_per_package, servings_per_package, shop_url, affiliate_url, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      body.name,
      body.brand,
      body.form,
      body.price_per_package,
      body.servings_per_package,
      body.shop_url,
      affiliateUrl,
      body.image_url || null
    ).run()

    if (!productResult.success) {
      return c.json({ error: 'Fehler beim Erstellen des Produkts' }, 500)
    }

    const productId = productResult.meta.last_row_id

    // Add nutrients
    if (body.nutrients && body.nutrients.length > 0) {
      for (const nutrient of body.nutrients) {
        // Convert to standard unit (simplified - real implementation would have conversion logic)
        const standardizedAmount = nutrient.amount // TODO: Implement unit conversion

        await c.env.DB.prepare(`
          INSERT INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          productId,
          nutrient.nutrient_id,
          nutrient.amount,
          nutrient.unit,
          standardizedAmount
        ).run()
      }
    }

    return c.json({
      message: 'Produkt erfolgreich erstellt',
      product_id: productId
    }, 201)

  } catch (error) {
    console.error('Error creating product:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Update product
productRoutes.put('/:id', async (c) => {
  try {
    const user = c.get('user')
    const productId = c.req.param('id')
    const body = await c.req.json<CreateProductRequest>()

    // Check if product exists and belongs to user
    const existingProduct = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, user.id).first()

    if (!existingProduct) {
      return c.json({ error: 'Produkt nicht gefunden' }, 404)
    }

    // Update product
    await c.env.DB.prepare(`
      UPDATE products 
      SET name = ?, brand = ?, form = ?, price_per_package = ?, 
          servings_per_package = ?, shop_url = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      body.name,
      body.brand,
      body.form,
      body.price_per_package,
      body.servings_per_package,
      body.shop_url,
      body.image_url || null,
      productId,
      user.id
    ).run()

    // Update nutrients - delete existing and insert new
    await c.env.DB.prepare(`DELETE FROM product_nutrients WHERE product_id = ?`).bind(productId).run()

    if (body.nutrients && body.nutrients.length > 0) {
      for (const nutrient of body.nutrients) {
        const standardizedAmount = nutrient.amount // TODO: Implement unit conversion

        await c.env.DB.prepare(`
          INSERT INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          productId,
          nutrient.nutrient_id,
          nutrient.amount,
          nutrient.unit,
          standardizedAmount
        ).run()
      }
    }

    return c.json({ message: 'Produkt erfolgreich aktualisiert' })

  } catch (error) {
    console.error('Error updating product:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Delete product
productRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user')
    const productId = c.req.param('id')

    // Check if product exists and belongs to user
    const existingProduct = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, user.id).first()

    if (!existingProduct) {
      return c.json({ error: 'Produkt nicht gefunden' }, 404)
    }

    // Check if product is used in any stacks
    const stackUsage = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM stack_products WHERE product_id = ?
    `).bind(productId).first()

    if (stackUsage && stackUsage.count > 0) {
      return c.json({ 
        error: 'Produkt kann nicht gelöscht werden, da es in Stacks verwendet wird',
        suggestion: 'Entfernen Sie das Produkt zuerst aus allen Stacks'
      }, 400)
    }

    // Delete product (cascading deletes will handle nutrients, notes, etc.)
    await c.env.DB.prepare(`DELETE FROM products WHERE id = ? AND user_id = ?`)
      .bind(productId, user.id).run()

    return c.json({ message: 'Produkt erfolgreich gelöscht' })

  } catch (error) {
    console.error('Error deleting product:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Get available nutrients for product creation
productRoutes.get('/nutrients/available', async (c) => {
  try {
    const nutrients = await c.env.DB.prepare(`
      SELECT id, name, standard_unit, external_article_url, link_label
      FROM nutrients
      ORDER BY name ASC
    `).all()

    return c.json(nutrients.results || [])
  } catch (error) {
    console.error('Error fetching nutrients:', error)
    return c.json({ error: 'Fehler beim Laden der Nährstoffe' }, 500)
  }
})

// Add note to product
productRoutes.post('/:id/notes', async (c) => {
  try {
    const user = c.get('user')
    const productId = c.req.param('id')
    const { note } = await c.req.json()

    if (!note || note.trim().length === 0) {
      return c.json({ error: 'Notiz darf nicht leer sein' }, 400)
    }

    // Check if product exists and belongs to user
    const product = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, user.id).first()

    if (!product) {
      return c.json({ error: 'Produkt nicht gefunden' }, 404)
    }

    // Insert or update note
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO user_notes (user_id, product_id, note, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(user.id, productId, note.trim()).run()

    return c.json({ message: 'Notiz erfolgreich gespeichert' })

  } catch (error) {
    console.error('Error saving note:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})

// Get product note
productRoutes.get('/:id/notes', async (c) => {
  try {
    const user = c.get('user')
    const productId = c.req.param('id')

    const note = await c.env.DB.prepare(`
      SELECT note FROM user_notes WHERE user_id = ? AND product_id = ?
    `).bind(user.id, productId).first()

    return c.json({ note: note?.note || '' })

  } catch (error) {
    console.error('Error fetching note:', error)
    return c.json({ error: 'Interner Server-Fehler' }, 500)
  }
})