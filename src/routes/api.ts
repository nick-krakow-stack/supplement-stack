// General API routes
import { Hono } from 'hono';
import { optionalAuthMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
}

const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Apply optional auth middleware
apiRoutes.use('*', optionalAuthMiddleware);

// Get categories
apiRoutes.get('/categories', async (c) => {
  try {
    const categories = await c.env.DB.prepare(`
      SELECT * FROM categories ORDER BY sort_order ASC
    `).all();

    return c.json({
      categories: categories.results
    }, 200);

  } catch (error) {
    console.error('Get categories error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Kategorien'
    }, 500);
  }
});

// Get nutrients
apiRoutes.get('/nutrients', async (c) => {
  try {
    const nutrients = await c.env.DB.prepare(`
      SELECT n.*, c.name as category_name 
      FROM nutrients n
      LEFT JOIN categories c ON n.category_id = c.id
      ORDER BY n.name ASC
    `).all();

    return c.json({
      nutrients: nutrients.results
    }, 200);

  } catch (error) {
    console.error('Get nutrients error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Nährstoffe'
    }, 500);
  }
});

// Search nutrients
apiRoutes.get('/nutrients/search', async (c) => {
  try {
    const query = c.req.query('q');
    
    if (!query || query.length < 2) {
      return c.json({
        nutrients: []
      }, 200);
    }

    const nutrients = await c.env.DB.prepare(`
      SELECT n.*, c.name as category_name 
      FROM nutrients n
      LEFT JOIN categories c ON n.category_id = c.id
      WHERE n.name LIKE ? OR n.synonyms LIKE ?
      ORDER BY n.name ASC
      LIMIT 20
    `).bind(`%${query}%`, `%${query}%`).all();

    return c.json({
      nutrients: nutrients.results
    }, 200);

  } catch (error) {
    console.error('Search nutrients error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler bei der Nährstoff-Suche'
    }, 500);
  }
});

// Get nutrient interactions
apiRoutes.get('/nutrients/:id/interactions', async (c) => {
  try {
    const nutrientId = c.req.param('id');

    const interactions = await c.env.DB.prepare(`
      SELECT 
        ni.*,
        n1.name as nutrient_a_name,
        n2.name as nutrient_b_name
      FROM nutrient_interactions ni
      JOIN nutrients n1 ON ni.nutrient_a_id = n1.id
      JOIN nutrients n2 ON ni.nutrient_b_id = n2.id
      WHERE ni.nutrient_a_id = ? OR ni.nutrient_b_id = ?
    `).bind(nutrientId, nutrientId).all();

    return c.json({
      interactions: interactions.results
    }, 200);

  } catch (error) {
    console.error('Get nutrient interactions error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Nährstoff-Interaktionen'
    }, 500);
  }
});

// Get DGE recommendations
apiRoutes.get('/recommendations/dge', async (c) => {
  try {
    const age = c.req.query('age');
    const gender = c.req.query('gender');

    const nutrients = await c.env.DB.prepare(`
      SELECT 
        n.name,
        n.standard_unit,
        n.dge_recommended,
        c.name as category_name
      FROM nutrients n
      LEFT JOIN categories c ON n.category_id = c.id
      WHERE n.dge_recommended IS NOT NULL
      ORDER BY c.sort_order ASC, n.name ASC
    `).all();

    return c.json({
      recommendations: nutrients.results,
      filters: {
        age: age || null,
        gender: gender || null
      }
    }, 200);

  } catch (error) {
    console.error('Get DGE recommendations error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der DGE-Empfehlungen'
    }, 500);
  }
});

export { apiRoutes };