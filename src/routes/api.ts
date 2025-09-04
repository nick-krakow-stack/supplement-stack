import { Hono } from 'hono';
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth';
import { verify } from 'hono/jwt';
import type { User } from '../types';

type Bindings = {
  DB: D1Database;
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

// Get all nutrients
apiRoutes.get('/nutrients', optionalAuthMiddleware, async (c) => {
  try {
    const nutrients = await c.env.DB.prepare(`
      SELECT * FROM nutrients ORDER BY name
    `).all();

    return c.json({ 
      success: true, 
      data: nutrients.results 
    });
  } catch (error) {
    console.error('Get nutrients error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Laden der Nährstoffe' 
    }, 500);
  }
});

// Get nutrient by ID with recommendations
apiRoutes.get('/nutrients/:id', optionalAuthMiddleware, async (c) => {
  const id = c.req.param('id');
  
  try {
    const nutrient = await c.env.DB.prepare(`
      SELECT * FROM nutrients WHERE id = ?
    `).bind(id).first();

    if (!nutrient) {
      return c.json({ 
        success: false, 
        error: 'Nährstoff nicht gefunden' 
      }, 404);
    }

    // Get dosage recommendations
    const recommendations = await c.env.DB.prepare(`
      SELECT dr.*, gs.name as source_name, gs.code as source_code
      FROM dosage_recommendations dr
      JOIN guideline_sources gs ON dr.guideline_source_id = gs.id
      WHERE dr.nutrient_id = ?
    `).bind(id).all();

    return c.json({ 
      success: true, 
      data: {
        ...nutrient,
        recommendations: recommendations.results
      }
    });
  } catch (error) {
    console.error('Get nutrient error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Laden des Nährstoffs' 
    }, 500);
  }
});

// Get guideline sources
apiRoutes.get('/guideline-sources', optionalAuthMiddleware, async (c) => {
  try {
    const sources = await c.env.DB.prepare(`
      SELECT * FROM guideline_sources ORDER BY name
    `).all();

    return c.json({ 
      success: true, 
      data: sources.results 
    });
  } catch (error) {
    console.error('Get guideline sources error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Laden der Guideline-Quellen' 
    }, 500);
  }
});

// Search public products
apiRoutes.get('/search/products', optionalAuthMiddleware, async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const products = await c.env.DB.prepare(`
      SELECT p.*, 
             GROUP_CONCAT(n.name) as nutrient_names
      FROM products p
      LEFT JOIN product_nutrients pn ON p.id = pn.product_id
      LEFT JOIN nutrients n ON pn.nutrient_id = n.id
      WHERE p.is_public = 1 
        AND (p.name LIKE ? OR p.brand LIKE ? OR n.name LIKE ?)
      GROUP BY p.id
      ORDER BY p.name
      LIMIT ? OFFSET ?
    `).bind(
      `%${query}%`, 
      `%${query}%`, 
      `%${query}%`, 
      limit, 
      offset
    ).all();

    return c.json({ 
      success: true, 
      data: products.results 
    });
  } catch (error) {
    console.error('Search products error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler bei der Produktsuche' 
    }, 500);
  }
});

// Check for nutrient interactions
apiRoutes.post('/check-interactions', optionalAuthMiddleware, async (c) => {
  try {
    const { nutrient_ids } = await c.req.json();
    
    if (!Array.isArray(nutrient_ids) || nutrient_ids.length < 2) {
      return c.json({ 
        success: false, 
        error: 'Mindestens 2 Nährstoff-IDs erforderlich' 
      }, 400);
    }

    // Get all interactions between the provided nutrients
    const interactions = await c.env.DB.prepare(`
      SELECT ni.*, 
             na.name as nutrient_a_name, 
             nb.name as nutrient_b_name
      FROM nutrient_interactions ni
      JOIN nutrients na ON ni.nutrient_a_id = na.id
      JOIN nutrients nb ON ni.nutrient_b_id = nb.id
      WHERE (ni.nutrient_a_id IN (${nutrient_ids.map(() => '?').join(',')}) 
             AND ni.nutrient_b_id IN (${nutrient_ids.map(() => '?').join(',')}))
    `).bind(...nutrient_ids, ...nutrient_ids).all();

    return c.json({ 
      success: true, 
      data: interactions.results 
    });
  } catch (error) {
    console.error('Check interactions error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Prüfen der Interaktionen' 
    }, 500);
  }
});

// Protected routes (require authentication)
apiRoutes.get('/protected/profile', async (c) => {
  console.log('[PROFILE] Profile endpoint called');
  
  try {
    // Check for Authorization header
    const authHeader = c.req.header('Authorization');
    console.log('[PROFILE] Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[PROFILE] Invalid or missing Bearer token');
      return c.json({ success: false, error: 'Keine Berechtigung' }, 401);
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    console.log('[PROFILE] Token extracted, length:', token.length);
    
    // Verify JWT token
    const jwtSecret = c.env.JWT_SECRET || 'fallback-secret-for-dev';
    console.log('[PROFILE] Using JWT secret:', jwtSecret ? 'Set' : 'Not set');
    let payload;
    
    try {
      payload = await verify(token, jwtSecret);
      console.log('[PROFILE] Token verified, userId:', payload.userId);
    } catch (error) {
      console.error('[PROFILE] Token verification failed:', error);
      return c.json({ success: false, error: 'Ungültiger Token' }, 401);
    }

    // Get user from database
    const user = await c.env.DB.prepare(`
      SELECT id, email, age, gender, weight, diet_type, personal_goals, 
             guideline_source, email_verified, created_at, updated_at
      FROM users 
      WHERE id = ?
    `).bind(payload.userId).first<User>();
    
    console.log('[PROFILE] User found:', user ? `Yes (${user.email})` : 'No');

    if (!user) {
      return c.json({ success: false, error: 'Benutzer nicht gefunden' }, 404);
    }

    return c.json({ 
      success: true, 
      data: {
        id: user.id,
        email: user.email,
        age: user.age,
        gender: user.gender,
        weight: user.weight,
        diet_type: user.diet_type,
        personal_goals: user.personal_goals,
        guideline_source: user.guideline_source,
        email_verified: user.email_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Laden des Profils' 
    }, 500);
  }
});