// Supplement Stack - Nutrient & Available Products Routes
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { apiSuccess, apiError } from '../utils/helpers'

const catalog = new Hono<AppEnv>()

// ========================
// GET all nutrients
// ========================
catalog.get('/nutrients', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT id, name, synonyms, standard_unit, external_article_url,
             dge_recommended, study_recommended, max_safe_dose, warning_threshold
      FROM nutrients ORDER BY name
    `).all()

    return c.json(apiSuccess(result.results || []))
  } catch (error: any) {
    console.error('Nutrients GET error:', error)
    return c.json(apiError('load_failed', 'Nährstoffe konnten nicht geladen werden'), 500)
  }
})

// ========================
// GET available products (marketplace / product catalog)
// ========================
catalog.get('/available-products', async (c) => {
  try {
    const nutrientId = c.req.query('nutrient_id')

    let products: any
    if (nutrientId) {
      products = await c.env.DB.prepare(`
        SELECT * FROM available_products
        WHERE main_nutrients LIKE '%"nutrient_id":' || ? || '%'
           OR secondary_nutrients LIKE '%"nutrient_id":' || ? || '%'
        ORDER BY recommended DESC, recommendation_rank ASC
      `).bind(nutrientId, nutrientId).all()
    } else {
      products = await c.env.DB.prepare(`
        SELECT * FROM available_products
        ORDER BY recommended DESC, recommendation_rank ASC
      `).all()
    }

    return c.json(apiSuccess(products.results || []))
  } catch (error: any) {
    console.error('Available products error:', error)
    return c.json(apiError('load_failed', 'Produktkatalog konnte nicht geladen werden'), 500)
  }
})

// ========================
// GET nutrient interactions
// ========================
catalog.get('/interactions', async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT ni.*, na.name as nutrient_a_name, nb.name as nutrient_b_name
      FROM nutrient_interactions ni
      JOIN nutrients na ON ni.nutrient_a_id = na.id
      JOIN nutrients nb ON ni.nutrient_b_id = nb.id
      ORDER BY ni.interaction_type
    `).all()

    return c.json(apiSuccess(result.results || []))
  } catch (error: any) {
    return c.json(apiError('load_failed', 'Interaktionen konnten nicht geladen werden'), 500)
  }
})

export default catalog
