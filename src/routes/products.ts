// Product management routes
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
}

const productRoutes = new Hono<{ Bindings: Bindings }>();

// Apply auth middleware to all product routes
productRoutes.use('*', authMiddleware);

// Get user products
productRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    
    const products = await c.env.DB.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).bind(user.id).all();

    return c.json({
      products: products.results
    }, 200);

  } catch (error) {
    console.error('Get products error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Laden der Produkte'
    }, 500);
  }
});

// Create product
productRoutes.post('/', async (c) => {
  try {
    const user = c.get('user');
    const productData = await c.req.json();

    const result = await c.env.DB.prepare(`
      INSERT INTO products (
        user_id, name, brand, form, price_per_package, 
        servings_per_package, shop_url, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.id,
      productData.name,
      productData.brand,
      productData.form,
      productData.price_per_package,
      productData.servings_per_package,
      productData.shop_url,
      productData.description || null
    ).run();

    return c.json({
      message: 'Produkt erfolgreich erstellt',
      productId: result.meta.last_row_id
    }, 201);

  } catch (error) {
    console.error('Create product error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Erstellen des Produkts'
    }, 500);
  }
});

// Update product
productRoutes.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');
    const productData = await c.req.json();

    const result = await c.env.DB.prepare(`
      UPDATE products 
      SET name = ?, brand = ?, form = ?, price_per_package = ?,
          servings_per_package = ?, shop_url = ?, description = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      productData.name,
      productData.brand,
      productData.form,
      productData.price_per_package,
      productData.servings_per_package,
      productData.shop_url,
      productData.description || null,
      productId,
      user.id
    ).run();

    if (result.changes === 0) {
      return c.json({
        error: 'product_not_found',
        message: 'Produkt nicht gefunden'
      }, 404);
    }

    return c.json({
      message: 'Produkt erfolgreich aktualisiert'
    }, 200);

  } catch (error) {
    console.error('Update product error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Aktualisieren des Produkts'
    }, 500);
  }
});

// Delete product
productRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');

    const result = await c.env.DB.prepare(`
      DELETE FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, user.id).run();

    if (result.changes === 0) {
      return c.json({
        error: 'product_not_found',
        message: 'Produkt nicht gefunden'
      }, 404);
    }

    return c.json({
      message: 'Produkt erfolgreich gelöscht'
    }, 200);

  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Fehler beim Löschen des Produkts'
    }, 500);
  }
});

export { productRoutes };