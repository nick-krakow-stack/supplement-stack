// Stack management routes
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
}

const stackRoutes = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all stack routes
stackRoutes.use('*', authMiddleware);

// Get user stacks
stackRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    
    const stacks = await c.env.DB.prepare(`
      SELECT * FROM stacks 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();

    return c.json({
      stacks: stacks.results
    }, 200);

  } catch (error) {
    console.error('Get stacks error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Stacks'
    }, 500);
  }
});

// Create stack
stackRoutes.post('/', async (c) => {
  try {
    const user = c.get('user');
    const { name, description } = await c.req.json();

    const result = await c.env.DB.prepare(`
      INSERT INTO stacks (user_id, name, description)
      VALUES (?, ?, ?)
    `).bind(user.id, name, description || null).run();

    return c.json({
      message: 'Stack erfolgreich erstellt',
      stackId: result.meta.last_row_id
    }, 201);

  } catch (error) {
    console.error('Create stack error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Erstellen des Stacks'
    }, 500);
  }
});

// Get stack details with products
stackRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const stackId = c.req.param('id');

    // Get stack info
    const stack = await c.env.DB.prepare(`
      SELECT * FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, user.id).first();

    if (!stack) {
      return c.json({
        error: 'stack_not_found',
        message: 'Stack nicht gefunden'
      }, 404);
    }

    // Get stack products
    const stackProducts = await c.env.DB.prepare(`
      SELECT sp.*, p.name, p.brand, p.form
      FROM stack_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.stack_id = ?
    `).bind(stackId).all();

    return c.json({
      stack,
      products: stackProducts.results
    }, 200);

  } catch (error) {
    console.error('Get stack details error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Stack-Details'
    }, 500);
  }
});

// Add product to stack
stackRoutes.post('/:id/products', async (c) => {
  try {
    const user = c.get('user');
    const stackId = c.req.param('id');
    const { product_id, dosage_per_day, dosage_source = 'custom' } = await c.req.json();

    // Verify stack belongs to user
    const stack = await c.env.DB.prepare(`
      SELECT id FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, user.id).first();

    if (!stack) {
      return c.json({
        error: 'stack_not_found',
        message: 'Stack nicht gefunden'
      }, 404);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO stack_products (stack_id, product_id, dosage_per_day, dosage_source)
      VALUES (?, ?, ?, ?)
    `).bind(stackId, product_id, dosage_per_day, dosage_source).run();

    return c.json({
      message: 'Produkt erfolgreich zum Stack hinzugefügt'
    }, 201);

  } catch (error) {
    console.error('Add product to stack error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Hinzufügen des Produkts zum Stack'
    }, 500);
  }
});

// Remove product from stack
stackRoutes.delete('/:id/products/:productId', async (c) => {
  try {
    const user = c.get('user');
    const stackId = c.req.param('id');
    const productId = c.req.param('productId');

    // Verify stack belongs to user
    const stack = await c.env.DB.prepare(`
      SELECT id FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, user.id).first();

    if (!stack) {
      return c.json({
        error: 'stack_not_found',
        message: 'Stack nicht gefunden'
      }, 404);
    }

    const result = await c.env.DB.prepare(`
      DELETE FROM stack_products 
      WHERE stack_id = ? AND product_id = ?
    `).bind(stackId, productId).run();

    return c.json({
      message: 'Produkt erfolgreich vom Stack entfernt'
    }, 200);

  } catch (error) {
    console.error('Remove product from stack error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Entfernen des Produkts vom Stack'
    }, 500);
  }
});

// Delete stack
stackRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const stackId = c.req.param('id');

    const result = await c.env.DB.prepare(`
      DELETE FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, user.id).run();

    if (result.changes === 0) {
      return c.json({
        error: 'stack_not_found',
        message: 'Stack nicht gefunden'
      }, 404);
    }

    return c.json({
      message: 'Stack erfolgreich gelöscht'
    }, 200);

  } catch (error) {
    console.error('Delete stack error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Löschen des Stacks'
    }, 500);
  }
});

export { stackRoutes };