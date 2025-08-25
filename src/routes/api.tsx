import { Hono } from 'hono'

type Bindings = {
  DB: D1Database;
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

// Products API
apiRoutes.get('/products', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, brand, serving_size, cost_per_serving, 
             servings_per_container, total_cost, category, notes,
             created_at, updated_at
      FROM products 
      ORDER BY created_at DESC
    `).all()

    return c.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch products'
    }, 500)
  }
})

apiRoutes.post('/products', async (c) => {
  try {
    const data = await c.req.json()
    
    const { name, brand, serving_size, cost_per_serving, servings_per_container, category, notes } = data
    
    // Validate required fields
    if (!name || !brand || !serving_size || !cost_per_serving || !servings_per_container) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400)
    }
    
    const total_cost = cost_per_serving * servings_per_container
    
    const result = await c.env.DB.prepare(`
      INSERT INTO products (name, brand, serving_size, cost_per_serving, 
                           servings_per_container, total_cost, category, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      name, brand, serving_size, cost_per_serving,
      servings_per_container, total_cost, category || null, notes || null
    ).run()

    if (!result.success) {
      throw new Error('Failed to insert product')
    }

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, ...data, total_cost }
    })
  } catch (error) {
    console.error('Error creating product:', error)
    return c.json({
      success: false,
      error: 'Failed to create product'
    }, 500)
  }
})

apiRoutes.put('/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const data = await c.req.json()
    
    const { name, brand, serving_size, cost_per_serving, servings_per_container, category, notes } = data
    const total_cost = cost_per_serving * servings_per_container
    
    const result = await c.env.DB.prepare(`
      UPDATE products 
      SET name = ?, brand = ?, serving_size = ?, cost_per_serving = ?,
          servings_per_container = ?, total_cost = ?, category = ?, notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      name, brand, serving_size, cost_per_serving,
      servings_per_container, total_cost, category || null, notes || null, id
    ).run()

    if (!result.success) {
      throw new Error('Failed to update product')
    }

    return c.json({
      success: true,
      data: { id: parseInt(id), ...data, total_cost }
    })
  } catch (error) {
    console.error('Error updating product:', error)
    return c.json({
      success: false,
      error: 'Failed to update product'
    }, 500)
  }
})

apiRoutes.delete('/products/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const result = await c.env.DB.prepare(`
      DELETE FROM products WHERE id = ?
    `).bind(id).run()

    if (!result.success) {
      throw new Error('Failed to delete product')
    }

    return c.json({
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return c.json({
      success: false,
      error: 'Failed to delete product'
    }, 500)
  }
})

// Stacks API
apiRoutes.get('/stacks', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT s.*, 
             COUNT(si.id) as supplement_count,
             SUM(CASE WHEN si.is_active = 1 THEN (p.cost_per_serving * si.daily_servings) ELSE 0 END) as daily_cost
      FROM stacks s
      LEFT JOIN stack_items si ON s.id = si.stack_id
      LEFT JOIN products p ON si.product_id = p.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all()

    return c.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('Error fetching stacks:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch stacks'
    }, 500)
  }
})

apiRoutes.post('/stacks', async (c) => {
  try {
    const data = await c.req.json()
    const { name, description, goal } = data
    
    if (!name) {
      return c.json({
        success: false,
        error: 'Stack name is required'
      }, 400)
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO stacks (name, description, goal)
      VALUES (?, ?, ?)
    `).bind(name, description || null, goal || null).run()

    if (!result.success) {
      throw new Error('Failed to create stack')
    }

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, ...data }
    })
  } catch (error) {
    console.error('Error creating stack:', error)
    return c.json({
      success: false,
      error: 'Failed to create stack'
    }, 500)
  }
})

// Stack Items API
apiRoutes.get('/stacks/:stackId/items', async (c) => {
  try {
    const stackId = c.req.param('stackId')
    
    const { results } = await c.env.DB.prepare(`
      SELECT si.*, p.name, p.brand, p.cost_per_serving,
             (si.daily_servings * p.cost_per_serving) as daily_cost
      FROM stack_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.stack_id = ?
      ORDER BY si.created_at ASC
    `).bind(stackId).all()

    return c.json({
      success: true,
      data: results
    })
  } catch (error) {
    console.error('Error fetching stack items:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch stack items'
    }, 500)
  }
})

apiRoutes.post('/stacks/:stackId/items', async (c) => {
  try {
    const stackId = c.req.param('stackId')
    const data = await c.req.json()
    
    const { product_id, daily_servings, timing, notes } = data
    
    if (!product_id || !daily_servings) {
      return c.json({
        success: false,
        error: 'Product ID and daily servings are required'
      }, 400)
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO stack_items (stack_id, product_id, daily_servings, timing, notes, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(stackId, product_id, daily_servings, timing || null, notes || null).run()

    if (!result.success) {
      throw new Error('Failed to add item to stack')
    }

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id, stack_id: parseInt(stackId), ...data }
    })
  } catch (error) {
    console.error('Error adding stack item:', error)
    return c.json({
      success: false,
      error: 'Failed to add item to stack'
    }, 500)
  }
})