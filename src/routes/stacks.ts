import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { User } from '../types';

type Bindings = {
  DB: D1Database;
}

export const stackRoutes = new Hono<{ Bindings: Bindings }>();

// Get user's stacks
stackRoutes.get('/', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  
  try {
    const stacks = await c.env.DB.prepare(`
      SELECT s.*,
             COUNT(sp.id) as product_count,
             -- Erweiterte Kostenberechnung
             SUM(CASE WHEN p.price_per_package IS NOT NULL AND p.servings_per_package IS NOT NULL 
                      THEN (p.price_per_package / p.servings_per_package) * sp.dosage_per_day 
                      ELSE 0 END) as daily_cost,
             SUM(CASE WHEN p.price_per_package IS NOT NULL AND p.servings_per_package IS NOT NULL 
                      THEN (p.price_per_package / p.servings_per_package) * sp.dosage_per_day * 30 
                      ELSE 0 END) as monthly_cost,
             -- Kaufpreis für den gesamten Stack (alle Produkte)
             SUM(CASE WHEN p.price_per_package IS NOT NULL 
                      THEN p.price_per_package 
                      ELSE 0 END) as total_purchase_cost,
             -- Durchschnittliche Haltbarkeit in Tagen
             AVG(CASE WHEN p.servings_per_package IS NOT NULL AND sp.dosage_per_day > 0
                      THEN p.servings_per_package / sp.dosage_per_day
                      ELSE 0 END) as avg_days_supply
      FROM stacks s
      LEFT JOIN stack_products sp ON s.id = sp.stack_id
      LEFT JOIN products p ON sp.product_id = p.id
      WHERE s.user_id = ? OR s.is_public = 1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).bind(user.id).all();

    return c.json({
      success: true,
      data: stacks.results || []
    });
  } catch (error) {
    console.error('Get stacks error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Laden der Stacks'
    }, 500);
  }
});

// Get single stack with products
stackRoutes.get('/:id', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  try {
    const stack = await c.env.DB.prepare(`
      SELECT * FROM stacks 
      WHERE id = ? AND (user_id = ? OR is_public = 1)
    `).bind(id, user.id).first();

    if (!stack) {
      return c.json({
        success: false,
        error: 'Stack nicht gefunden'
      }, 404);
    }

    // Get stack products with details and cost calculations
    const products = await c.env.DB.prepare(`
      SELECT sp.*, p.name, p.brand, p.form, p.price_per_package, p.servings_per_package,
             p.shop_url, p.affiliate_url, p.image_url,
             -- Kostenberechnungen pro Produkt
             (p.price_per_package / p.servings_per_package) * sp.dosage_per_day as cost_per_day,
             (p.price_per_package / p.servings_per_package) * sp.dosage_per_day * 30 as cost_per_month,
             p.servings_per_package / sp.dosage_per_day as days_supply,
             GROUP_CONCAT(
               json_object(
                 'nutrient_id', pn.nutrient_id,
                 'name', n.name,
                 'amount', pn.amount,
                 'unit', pn.unit,
                 'daily_amount', pn.amount * sp.dosage_per_day,
                 'standard_unit', n.standard_unit
               )
             ) as nutrients
      FROM stack_products sp
      JOIN products p ON sp.product_id = p.id
      LEFT JOIN product_nutrients pn ON p.id = pn.product_id
      LEFT JOIN nutrients n ON pn.nutrient_id = n.id
      WHERE sp.stack_id = ?
      GROUP BY sp.id
      ORDER BY sp.created_at
    `).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...stack,
        products: products.results
      }
    });
  } catch (error) {
    console.error('Get stack error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Laden des Stacks'
    }, 500);
  }
});

// Create stack
stackRoutes.post('/', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  
  try {
    const { name, description, is_public } = await c.req.json();

    if (!name || name.trim() === '') {
      return c.json({
        success: false,
        error: 'Name ist erforderlich'
      }, 400);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO stacks (name, description, user_id, is_public)
      VALUES (?, ?, ?, ?)
    `).bind(
      name.trim(),
      description?.trim() || null,
      user.id,
      is_public || false
    ).run();

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Fehler beim Erstellen des Stacks'
      }, 500);
    }

    return c.json({
      success: true,
      message: 'Stack erfolgreich erstellt',
      data: { id: result.meta.last_row_id }
    });
  } catch (error) {
    console.error('Create stack error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Erstellen des Stacks'
    }, 500);
  }
});

// Add product to stack
stackRoutes.post('/:id/products', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  const stackId = c.req.param('id');
  
  try {
    const { product_id, servings_per_day, dosage_source, notes } = await c.req.json();

    // Check if user owns the stack
    const stack = await c.env.DB.prepare(`
      SELECT * FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, user.id).first();

    if (!stack) {
      return c.json({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404);
    }

    // Check if product exists and is accessible
    const product = await c.env.DB.prepare(`
      SELECT * FROM products 
      WHERE id = ? AND (user_id = ? OR is_public = 1)
    `).bind(product_id, user.id).first();

    if (!product) {
      return c.json({
        success: false,
        error: 'Produkt nicht gefunden'
      }, 404);
    }

    // Check if product is already in stack
    const existing = await c.env.DB.prepare(`
      SELECT id FROM stack_products 
      WHERE stack_id = ? AND product_id = ?
    `).bind(stackId, product_id).first();

    if (existing) {
      return c.json({
        success: false,
        error: 'Produkt bereits im Stack vorhanden'
      }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO stack_products (stack_id, product_id, servings_per_day, dosage_source, notes)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      stackId,
      product_id,
      servings_per_day || 1,
      dosage_source || 'user',
      notes?.trim() || null
    ).run();

    return c.json({
      success: true,
      message: 'Produkt erfolgreich zum Stack hinzugefügt'
    });
  } catch (error) {
    console.error('Add product to stack error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Hinzufügen des Produkts'
    }, 500);
  }
});

// Update stack
stackRoutes.put('/:id', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  try {
    const { name, description } = await c.req.json();

    if (!name || name.trim() === '') {
      return c.json({
        success: false,
        error: 'Name ist erforderlich'
      }, 400);
    }

    // Check if user owns the stack
    const stack = await c.env.DB.prepare(`
      SELECT * FROM stacks WHERE id = ? AND user_id = ?
    `).bind(id, user.id).first();

    if (!stack) {
      return c.json({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404);
    }

    const result = await c.env.DB.prepare(`
      UPDATE stacks 
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      name.trim(),
      description?.trim() || null,
      id,
      user.id
    ).run();

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Fehler beim Aktualisieren des Stacks'
      }, 500);
    }

    return c.json({
      success: true,
      message: 'Stack erfolgreich aktualisiert'
    });
  } catch (error) {
    console.error('Update stack error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Aktualisieren des Stacks'
    }, 500);
  }
});

// Delete stack
stackRoutes.delete('/:id', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  const id = c.req.param('id');
  
  try {
    const result = await c.env.DB.prepare(`
      DELETE FROM stacks 
      WHERE id = ? AND user_id = ?
    `).bind(id, user.id).run();

    if (result.changes === 0) {
      return c.json({
        success: false,
        error: 'Stack nicht gefunden oder keine Berechtigung'
      }, 404);
    }

    return c.json({
      success: true,
      message: 'Stack erfolgreich gelöscht'
    });
  } catch (error) {
    console.error('Delete stack error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Löschen des Stacks'
    }, 500);
  }
});

// Remove product from stack
stackRoutes.delete('/:id/products/:productId', authMiddleware, async (c) => {
  const user = c.get('user') as User;
  const stackId = c.req.param('id');
  const productId = c.req.param('productId');
  
  try {
    const result = await c.env.DB.prepare(`
      DELETE FROM stack_products 
      WHERE stack_id = ? AND product_id = ? 
        AND EXISTS (SELECT 1 FROM stacks WHERE id = ? AND user_id = ?)
    `).bind(stackId, productId, stackId, user.id).run();

    if (result.changes === 0) {
      return c.json({
        success: false,
        error: 'Produkt im Stack nicht gefunden oder keine Berechtigung'
      }, 404);
    }

    return c.json({
      success: true,
      message: 'Produkt erfolgreich aus Stack entfernt'
    });
  } catch (error) {
    console.error('Remove product from stack error:', error);
    return c.json({
      success: false,
      error: 'Fehler beim Entfernen des Produkts aus dem Stack'
    }, 500);
  }
});