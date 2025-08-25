import { Hono } from 'hono'
import type { Bindings, SessionUser } from '../types'

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>()

// Get duplicates for admin review
adminRoutes.get('/duplicates', async (c) => {
  try {
    const user = c.get('user')
    
    // Find potential duplicates based on name similarity
    const duplicates = await c.env.DB.prepare(`
      SELECT 
        p1.id as original_id, p1.name as original_name, p1.brand as original_brand,
        p2.id as potential_id, p2.name as potential_name, p2.brand as potential_brand,
        p1.user_id
      FROM products p1
      JOIN products p2 ON (
        p1.user_id = p2.user_id AND 
        p1.id < p2.id AND
        p2.is_duplicate = FALSE AND
        (
          LOWER(p1.name) = LOWER(p2.name) OR
          (LOWER(p1.brand) = LOWER(p2.brand) AND 
           INSTR(LOWER(p1.name), LOWER(SUBSTR(p2.name, 1, 10))) > 0)
        )
      )
      WHERE p1.user_id = ? AND p1.is_duplicate = FALSE
      ORDER BY p1.name ASC
    `).bind(user.id).all()

    const duplicateGroups = (duplicates.results || []).map(dup => ({
      original: {
        id: dup.original_id,
        name: dup.original_name,
        brand: dup.original_brand
      },
      potential: {
        id: dup.potential_id,
        name: dup.potential_name,
        brand: dup.potential_brand
      }
    }))

    return c.json(duplicateGroups)

  } catch (error) {
    console.error('Error fetching duplicates:', error)
    return c.json({ error: 'Fehler beim Laden der Dubletten' }, 500)
  }
})

// Merge duplicate products
adminRoutes.post('/duplicates/merge', async (c) => {
  try {
    const user = c.get('user')
    const { original_id, duplicate_id } = await c.req.json()

    // Verify both products belong to user
    const products = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id IN (?, ?) AND user_id = ?
    `).bind(original_id, duplicate_id, user.id).all()

    if (!products.results || products.results.length !== 2) {
      return c.json({ error: 'Ungültige Produkt-IDs' }, 400)
    }

    // Update stack references to point to original product
    await c.env.DB.prepare(`
      UPDATE stack_products SET product_id = ? WHERE product_id = ?
    `).bind(original_id, duplicate_id).run()

    // Update wishlist references
    await c.env.DB.prepare(`
      UPDATE wishlist SET product_id = ? WHERE product_id = ?
    `).bind(original_id, duplicate_id).run()

    // Mark duplicate as duplicate and set reference
    await c.env.DB.prepare(`
      UPDATE products SET is_duplicate = TRUE, duplicate_of = ? WHERE id = ?
    `).bind(original_id, duplicate_id).run()

    return c.json({ message: 'Dubletten erfolgreich zusammengeführt' })

  } catch (error) {
    console.error('Error merging duplicates:', error)
    return c.json({ error: 'Fehler beim Zusammenführen' }, 500)
  }
})

// Ignore duplicate suggestion
adminRoutes.post('/duplicates/ignore', async (c) => {
  try {
    const user = c.get('user')
    const { product_id } = await c.req.json()

    // Mark product as not a duplicate (this could be tracked in a separate table)
    // For now, we'll add a flag to indicate it's been reviewed
    await c.env.DB.prepare(`
      UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
    `).bind(product_id, user.id).run()

    return c.json({ message: 'Dubletten-Vorschlag ignoriert' })

  } catch (error) {
    console.error('Error ignoring duplicate:', error)
    return c.json({ error: 'Fehler beim Ignorieren' }, 500)
  }
})

// Get affiliate links needing processing
adminRoutes.get('/affiliates', async (c) => {
  try {
    const linksNeedingProcessing = await c.env.DB.prepare(`
      SELECT al.*, COUNT(ac.id) as click_count
      FROM affiliate_links al
      LEFT JOIN affiliate_clicks ac ON al.id = ac.affiliate_link_id
      WHERE al.needs_processing = TRUE
      GROUP BY al.id
      ORDER BY al.created_at DESC
      LIMIT 50
    `).all()

    return c.json(linksNeedingProcessing.results || [])

  } catch (error) {
    console.error('Error fetching affiliate links:', error)
    return c.json({ error: 'Fehler beim Laden der Affiliate-Links' }, 500)
  }
})

// Update affiliate link
adminRoutes.put('/affiliates/:id', async (c) => {
  try {
    const linkId = c.req.param('id')
    const { affiliate_url } = await c.req.json()

    if (!affiliate_url || affiliate_url.trim().length === 0) {
      return c.json({ error: 'Affiliate-URL ist erforderlich' }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE affiliate_links 
      SET affiliate_url = ?, needs_processing = FALSE, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(affiliate_url.trim(), linkId).run()

    return c.json({ message: 'Affiliate-Link erfolgreich aktualisiert' })

  } catch (error) {
    console.error('Error updating affiliate link:', error)
    return c.json({ error: 'Fehler beim Aktualisieren des Links' }, 500)
  }
})

// Get/manage nutrients
adminRoutes.get('/nutrients', async (c) => {
  try {
    const nutrients = await c.env.DB.prepare(`
      SELECT * FROM nutrients ORDER BY name ASC
    `).all()

    return c.json(nutrients.results || [])

  } catch (error) {
    console.error('Error fetching nutrients:', error)
    return c.json({ error: 'Fehler beim Laden der Nährstoffe' }, 500)
  }
})

// Add new nutrient
adminRoutes.post('/nutrients', async (c) => {
  try {
    const { 
      name, 
      synonyms, 
      standard_unit, 
      external_article_url, 
      link_label,
      dge_recommended,
      study_recommended,
      max_safe_dose,
      warning_threshold
    } = await c.req.json()

    if (!name || !standard_unit || !external_article_url) {
      return c.json({ error: 'Name, Einheit und Artikel-URL sind erforderlich' }, 400)
    }

    // Check if nutrient already exists
    const existing = await c.env.DB.prepare(`
      SELECT id FROM nutrients WHERE LOWER(name) = LOWER(?)
    `).bind(name).first()

    if (existing) {
      return c.json({ error: 'Nährstoff existiert bereits' }, 409)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO nutrients (
        name, synonyms, standard_unit, external_article_url, link_label,
        dge_recommended, study_recommended, max_safe_dose, warning_threshold
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      name,
      JSON.stringify(synonyms || []),
      standard_unit,
      external_article_url,
      link_label || null,
      dge_recommended || null,
      study_recommended || null,
      max_safe_dose || null,
      warning_threshold || null
    ).run()

    return c.json({
      message: 'Nährstoff erfolgreich hinzugefügt',
      nutrient_id: result.meta.last_row_id
    }, 201)

  } catch (error) {
    console.error('Error creating nutrient:', error)
    return c.json({ error: 'Fehler beim Erstellen des Nährstoffs' }, 500)
  }
})

// Update nutrient
adminRoutes.put('/nutrients/:id', async (c) => {
  try {
    const nutrientId = c.req.param('id')
    const updateData = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE nutrients SET
        name = ?, synonyms = ?, standard_unit = ?, external_article_url = ?,
        link_label = ?, dge_recommended = ?, study_recommended = ?,
        max_safe_dose = ?, warning_threshold = ?
      WHERE id = ?
    `).bind(
      updateData.name,
      JSON.stringify(updateData.synonyms || []),
      updateData.standard_unit,
      updateData.external_article_url,
      updateData.link_label || null,
      updateData.dge_recommended || null,
      updateData.study_recommended || null,
      updateData.max_safe_dose || null,
      updateData.warning_threshold || null,
      nutrientId
    ).run()

    return c.json({ message: 'Nährstoff erfolgreich aktualisiert' })

  } catch (error) {
    console.error('Error updating nutrient:', error)
    return c.json({ error: 'Fehler beim Aktualisieren des Nährstoffs' }, 500)
  }
})

// Get statistics
adminRoutes.get('/statistics', async (c) => {
  try {
    const user = c.get('user')

    // Get various statistics
    const [
      productStats,
      stackStats,
      affiliateStats,
      topNutrients
    ] = await Promise.all([
      // Product statistics
      c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(DISTINCT brand) as unique_brands,
          COUNT(CASE WHEN is_duplicate = TRUE THEN 1 END) as duplicates
        FROM products WHERE user_id = ?
      `).bind(user.id).first(),

      // Stack statistics
      c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_stacks,
          AVG(product_count) as avg_products_per_stack
        FROM (
          SELECT s.id, COUNT(sp.product_id) as product_count
          FROM stacks s
          LEFT JOIN stack_products sp ON s.id = sp.stack_id
          WHERE s.user_id = ?
          GROUP BY s.id
        )
      `).bind(user.id).first(),

      // Affiliate statistics
      c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_links,
          SUM(click_count) as total_clicks,
          COUNT(CASE WHEN needs_processing = TRUE THEN 1 END) as pending_processing
        FROM affiliate_links
      `).first(),

      // Top nutrients by usage
      c.env.DB.prepare(`
        SELECT n.name, COUNT(pn.product_id) as usage_count
        FROM nutrients n
        JOIN product_nutrients pn ON n.id = pn.nutrient_id
        JOIN products p ON pn.product_id = p.id
        WHERE p.user_id = ?
        GROUP BY n.id, n.name
        ORDER BY usage_count DESC
        LIMIT 10
      `).bind(user.id).all()
    ])

    return c.json({
      products: productStats,
      stacks: stackStats,
      affiliates: affiliateStats,
      top_nutrients: topNutrients.results || []
    })

  } catch (error) {
    console.error('Error fetching statistics:', error)
    return c.json({ error: 'Fehler beim Laden der Statistiken' }, 500)
  }
})