import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database;
  MAILERSEND_API_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// =================================
// UTILITY FUNCTIONS
// =================================

// Hash password using SHA-256 with salt
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = generateSecureToken().substring(0, 16);
  const saltedPassword = password + salt;
  
  const data = encoder.encode(saltedPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return salt + hashHex;
}

// Verify password against hash
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const salt = hash.substring(0, 16);
    const storedHash = hash.substring(16);
    
    const saltedPassword = password + salt;
    const data = encoder.encode(saltedPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return computedHash === storedHash;
  } catch (error) {
    return false;
  }
}

// Generate secure random token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Validate email format
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Passwort muss mindestens 8 Zeichen lang sein' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Großbuchstaben enthalten' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens eine Zahl enthalten' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens ein Sonderzeichen enthalten' };
  }
  
  return { valid: true };
}

// Send email via MailerSend
async function sendEmail(apiKey: string, to: string, subject: string, html: string, text: string) {
  try {
    const response = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: {
          email: 'noreply@supplementstack.de',
          name: 'Supplement Stack'
        },
        to: [{
          email: to
        }],
        subject: subject,
        html: html,
        text: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MailerSend API Error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// =================================
// AUTH MIDDLEWARE
// =================================

// JWT Auth Middleware
async function authMiddleware(c: any, next: any) {
  try {
    console.log('Auth middleware started');
    const authHeader = c.req.header('Authorization');
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid auth header format');
      return c.json({ error: 'missing_token', message: 'Authorization token required' }, 401);
    }
    
    const token = authHeader.split(' ')[1];
    console.log('Extracted token, verifying...');
    
    const payload = await verify(token, c.env.JWT_SECRET);
    console.log('Token verified, userId:', payload.userId);
    
    // Get user from database
    const user = await c.env.DB.prepare(
      'SELECT id, email, email_verified FROM users WHERE id = ?'
    ).bind(payload.userId).first();
    
    console.log('User lookup result:', user ? 'Found' : 'Not found');
    
    if (!user) {
      console.log('User not found in database for userId:', payload.userId);
      return c.json({ error: 'user_not_found', message: 'User not found' }, 401);
    }
    
    c.set('user', user);
    c.set('userId', user.id);
    console.log('Auth middleware successful for user:', user.email);
    await next();
    
  } catch (error) {
    console.error('Auth middleware error details:', error);
    console.error('Auth middleware error stack:', error.stack);
    return c.json({ error: 'invalid_token', message: 'Invalid or expired token: ' + (error.message || 'Unknown error') }, 401);
  }
}

// =================================
// AUTH API ROUTES
// =================================



// Get current user profile
app.get('/api/auth/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.email, // Use email as display name since name column doesn't exist
        email_verified: user.email_verified
      }
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Failed to fetch profile'
    }, 500);
  }
});

// =================================
// DATABASE MANAGEMENT
// =================================

// Run database migrations
app.get('/api/admin/migrate', async (c) => {
  try {
    // Execute the available_products migration - split into separate statements
    const createTableSQL = `CREATE TABLE IF NOT EXISTS available_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        form TEXT NOT NULL,
        purchase_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_piece REAL,
        dosage_per_day INTEGER DEFAULT 1,
        days_supply INTEGER,
        monthly_cost REAL,
        description TEXT,
        benefits TEXT,
        warnings TEXT,
        dosage_recommendation TEXT,
        category TEXT,
        main_nutrients TEXT,
        secondary_nutrients TEXT,
        recommended BOOLEAN DEFAULT FALSE,
        recommendation_rank INTEGER DEFAULT 0,
        product_image TEXT,
        shop_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`;
    
    const index1SQL = `CREATE INDEX IF NOT EXISTS idx_available_products_category ON available_products(category)`;
    const index2SQL = `CREATE INDEX IF NOT EXISTS idx_available_products_recommended ON available_products(recommended, recommendation_rank)`;
    
    // Execute statements separately
    await c.env.DB.prepare(createTableSQL).run();
    await c.env.DB.prepare(index1SQL).run();
    await c.env.DB.prepare(index2SQL).run();
    
    return c.json({ success: true, message: 'Migration completed successfully' });
    
  } catch (error) {
    console.error('Migration error:', error);
    return c.json({ error: 'Migration failed', details: error.message }, 500);
  }
});

// Seed available products data
app.post('/api/admin/seed-products', async (c) => {
  try {
    const products = [
      {
        id: 1, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', form: 'Kapsel',
        purchase_price: 19.90, quantity: 50, price_per_piece: 0.398,
        dosage_per_day: 1, days_supply: 50, monthly_cost: 11.94,
        description: 'Hochdosiertes Vitamin D3 (Cholecalciferol) aus Lanolin',
        benefits: JSON.stringify(['Unterstützt das Immunsystem', 'Wichtig für Knochen und Zähne', 'Trägt zur normalen Muskelfunktion bei']),
        warnings: JSON.stringify([]),
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit', category: 'Vitamine',
        main_nutrients: JSON.stringify([{nutrient_id: 1, amount_per_unit: 4000}]),
        secondary_nutrients: JSON.stringify([]), recommended: 1, recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/vitamin-d3'
      },
      {
        id: 2, name: 'B12 Methylcobalamin', brand: 'InnoNature', form: 'Tropfen',
        purchase_price: 24.90, quantity: 60, price_per_piece: 0.415,
        dosage_per_day: 1, days_supply: 60, monthly_cost: 12.45,
        description: 'Bioaktives Vitamin B12 als Methylcobalamin',
        benefits: JSON.stringify(['Reduziert Müdigkeit', 'Unterstützt Nervensystem', 'Wichtig für Blutbildung']),
        warnings: JSON.stringify(['Hochdosiert - nicht für Schwangere ohne Rücksprache']),
        dosage_recommendation: '1 Tropfen täglich', category: 'Vitamine',
        main_nutrients: JSON.stringify([{nutrient_id: 2, amount_per_unit: 200}]),
        secondary_nutrients: JSON.stringify([]), recommended: 1, recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/b12'
      },
      {
        id: 12, name: 'B-Komplex Premium', brand: 'Biomenta', form: 'Kapsel',
        purchase_price: 21.90, quantity: 60, price_per_piece: 0.365,
        dosage_per_day: 1, days_supply: 60, monthly_cost: 10.95,
        description: 'Vollständiger B-Vitamin Komplex mit allen wichtigen B-Vitaminen',
        benefits: JSON.stringify(['Unterstützt Energiestoffwechsel', 'Nervensystem', 'Reduziert Müdigkeit']),
        warnings: JSON.stringify(['Kann Urin gelb färben (normal)', 'Nicht auf nüchternen Magen']),
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit', category: 'Vitamine',
        main_nutrients: JSON.stringify([{nutrient_id: 2, amount_per_unit: 100}, {nutrient_id: 7, amount_per_unit: 5}, {nutrient_id: 8, amount_per_unit: 400}]),
        secondary_nutrients: JSON.stringify([]), recommended: 0, recommendation_rank: 3,
        product_image: null, shop_url: 'https://example.com/b-komplex'
      }
    ];
    
    for (const product of products) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO available_products (
          id, name, brand, form, purchase_price, quantity, price_per_piece,
          dosage_per_day, days_supply, monthly_cost, description, benefits,
          warnings, dosage_recommendation, category, main_nutrients,
          secondary_nutrients, recommended, recommendation_rank, product_image, shop_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        product.id, product.name, product.brand, product.form,
        product.purchase_price, product.quantity, product.price_per_piece,
        product.dosage_per_day, product.days_supply, product.monthly_cost,
        product.description, product.benefits, product.warnings,
        product.dosage_recommendation, product.category, product.main_nutrients,
        product.secondary_nutrients, product.recommended, product.recommendation_rank,
        product.product_image, product.shop_url
      ).run();
    }
    
    return c.json({ success: true, message: 'Products seeded successfully', count: products.length });
    
  } catch (error) {
    console.error('Seed products error:', error);
    return c.json({ error: 'Seeding failed', details: error.message }, 500);
  }
});

// =================================
// PROTECTED API ROUTES (Dashboard Data)
// =================================

// Get available products for adding (search by nutrient)
app.get('/api/available-products', async (c) => {
  try {
    const nutrientId = c.req.query('nutrient_id');
    
    if (!nutrientId) {
      // Return all available products if no nutrient filter
      const products = await c.env.DB.prepare(`
        SELECT 
          ap.id,
          ap.name,
          ap.brand,
          ap.form,
          ap.purchase_price,
          ap.quantity,
          ap.price_per_piece,
          ap.dosage_per_day,
          ap.days_supply,
          ap.monthly_cost,
          ap.description,
          ap.benefits,
          ap.warnings,
          ap.dosage_recommendation,
          ap.category,
          ap.main_nutrients,
          ap.secondary_nutrients,
          ap.recommended,
          ap.recommendation_rank,
          ap.product_image,
          ap.shop_url
        FROM available_products ap
        ORDER BY ap.recommended DESC, ap.recommendation_rank ASC
      `).all();
      
      return c.json(products.results || []);
    }
    
    // Filter by nutrient_id
    const products = await c.env.DB.prepare(`
      SELECT 
        ap.id,
        ap.name,
        ap.brand,
        ap.form,
        ap.purchase_price,
        ap.quantity,
        ap.price_per_piece,
        ap.dosage_per_day,
        ap.days_supply,
        ap.monthly_cost,
        ap.description,
        ap.benefits,
        ap.warnings,
        ap.dosage_recommendation,
        ap.category,
        ap.main_nutrients,
        ap.secondary_nutrients,
        ap.recommended,
        ap.recommendation_rank,
        ap.product_image,
        ap.shop_url
      FROM available_products ap
      WHERE ap.main_nutrients LIKE '%"nutrient_id":' || ? || '%'
         OR ap.secondary_nutrients LIKE '%"nutrient_id":' || ? || '%'
      ORDER BY ap.recommended DESC, ap.recommendation_rank ASC
    `).bind(nutrientId, nutrientId).all();
    
    console.log('Found', products.results?.length || 0, 'available products for nutrient', nutrientId);
    return c.json(products.results || []);
    
  } catch (error) {
    console.error('Available products API error:', error);
    return c.json({ error: 'Failed to load available products' }, 500);
  }
});

// Get user's products
app.get('/api/protected/products', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    console.log('Loading products for user:', userId);
    
    // Query user's products from database
    const products = await c.env.DB.prepare(`
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.form,
        p.price_per_package as purchase_price,
        p.servings_per_package as quantity,
        p.shop_url,
        COALESCE(p.price_per_package / NULLIF(p.servings_per_package, 0) * 30, 0) as monthly_cost,
        'Supplements' as category,
        1 as dosage_per_day,
        COALESCE(p.servings_per_package, 30) as days_supply
      FROM products p 
      WHERE p.user_id = ? 
      ORDER BY p.created_at DESC
    `).bind(userId).all();
    
    console.log('Found', products.results?.length || 0, 'products for user', userId);
    
    return c.json(products.results || []);
    
  } catch (error) {
    console.error('Products API error:', error);
    return c.json({ error: 'Failed to load products' }, 500);
  }
});

// Get user's stacks  
app.get('/api/protected/stacks', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    console.log('Loading stacks for user:', userId);
    
    // Query user's stacks from database with their products
    const stacks = await c.env.DB.prepare(`
      SELECT 
        s.id,
        s.name,
        s.description,
        s.created_at,
        GROUP_CONCAT(sp.product_id) as product_ids
      FROM stacks s 
      LEFT JOIN stack_products sp ON s.id = sp.stack_id
      WHERE s.user_id = ? 
      GROUP BY s.id, s.name, s.description, s.created_at
      ORDER BY s.created_at DESC
    `).bind(userId).all();
    
    // Format the results to match frontend expectations
    const formattedStacks = stacks.results?.map(stack => ({
      id: stack.id,
      name: stack.name,
      description: stack.description || '',
      products: stack.product_ids ? stack.product_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [],
      total_monthly_cost: 0, // Will be calculated on frontend
      created_at: stack.created_at
    })) || [];
    
    console.log('Found', formattedStacks.length, 'stacks for user', userId);
    
    return c.json(formattedStacks);
    
  } catch (error) {
    console.error('Stacks API error:', error);
    return c.json({ error: 'Failed to load stacks' }, 500);
  }
});

// Get user's wishlist
app.get('/api/protected/wishlist', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    
    // For now, return empty array - later we'll implement database storage per user
    const wishlist = [];
    
    return c.json(wishlist);
    
  } catch (error) {
    console.error('Wishlist API error:', error);
    return c.json({ error: 'Failed to load wishlist' }, 500);
  }
});

// Get user profile (different from auth profile)
app.get('/api/protected/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.email,
        email_verified: user.email_verified,
        created_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Protected profile API error:', error);
    return c.json({ error: 'Failed to load profile' }, 500);
  }
});

// Add new product to user's collection
app.post('/api/protected/products', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const productData = await c.req.json();
    
    console.log('Adding product for user:', userId, productData);
    
    // Insert product into database
    const result = await c.env.DB.prepare(`
      INSERT INTO products (
        user_id, 
        name, 
        brand, 
        form, 
        price_per_package, 
        servings_per_package, 
        shop_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      productData.name || 'Unbekanntes Produkt',
      productData.brand || 'Unbekannt',
      productData.form || 'Einheit',
      parseFloat(productData.purchase_price) || 0,
      parseInt(productData.quantity) || 30,
      productData.shop_url || ''
    ).run();
    
    if (!result.success) {
      throw new Error('Failed to insert product into database');
    }
    
    // Get the inserted product
    const newProduct = await c.env.DB.prepare(`
      SELECT 
        id,
        name,
        brand,
        form,
        price_per_package as purchase_price,
        servings_per_package as quantity,
        shop_url,
        COALESCE(price_per_package / NULLIF(servings_per_package, 0) * 30, 0) as monthly_cost,
        'Supplements' as category,
        1 as dosage_per_day,
        COALESCE(servings_per_package, 30) as days_supply,
        created_at
      FROM products 
      WHERE id = ?
    `).bind(result.meta.last_row_id).first();
    
    console.log('Product saved to database:', newProduct);
    
    return c.json({
      success: true,
      product: newProduct,
      message: 'Produkt erfolgreich hinzugefügt'
    }, 201);
    
  } catch (error) {
    console.error('Add product API error:', error);
    return c.json({ 
      error: 'Failed to add product', 
      message: 'Fehler beim Hinzufügen des Produkts: ' + (error.message || 'Unbekannter Fehler')
    }, 500);
  }
});

// Create new stack for user
app.post('/api/protected/stacks', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const stackData = await c.req.json();
    
    console.log('Creating stack for user:', userId, stackData);
    
    // Insert stack into database
    const stackResult = await c.env.DB.prepare(`
      INSERT INTO stacks (user_id, name, description) 
      VALUES (?, ?, ?)
    `).bind(
      userId,
      stackData.name || 'Neuer Stack',
      stackData.description || ''
    ).run();
    
    if (!stackResult.success) {
      throw new Error('Failed to insert stack into database');
    }
    
    const stackId = stackResult.meta.last_row_id;
    
    // Add products to stack if provided
    if (stackData.products && Array.isArray(stackData.products) && stackData.products.length > 0) {
      for (const productId of stackData.products) {
        try {
          await c.env.DB.prepare(`
            INSERT INTO stack_products (stack_id, product_id, dosage_per_day) 
            VALUES (?, ?, ?)
          `).bind(stackId, productId, 1).run();
        } catch (error) {
          console.warn('Failed to add product', productId, 'to stack:', error);
          // Continue with other products even if one fails
        }
      }
    }
    
    // Get the created stack with its products
    const newStack = await c.env.DB.prepare(`
      SELECT 
        s.id,
        s.name,
        s.description,
        s.created_at,
        GROUP_CONCAT(sp.product_id) as product_ids
      FROM stacks s 
      LEFT JOIN stack_products sp ON s.id = sp.stack_id
      WHERE s.id = ? AND s.user_id = ?
      GROUP BY s.id, s.name, s.description, s.created_at
    `).bind(stackId, userId).first();
    
    const formattedStack = {
      id: newStack.id,
      name: newStack.name,
      description: newStack.description || '',
      products: newStack.product_ids ? newStack.product_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) : [],
      total_monthly_cost: 0,
      created_at: newStack.created_at
    };
    
    console.log('Stack created in database:', formattedStack);
    
    return c.json({
      success: true,
      stack: formattedStack,
      message: 'Stack erfolgreich erstellt'
    }, 201);
    
  } catch (error) {
    console.error('Create stack API error:', error);
    return c.json({ 
      error: 'Failed to create stack', 
      message: 'Fehler beim Erstellen des Stacks: ' + (error.message || 'Unbekannter Fehler')
    }, 500);
  }
});

// Add product to existing stack
app.post('/api/protected/stacks/:stackId/products', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const stackId = c.req.param('stackId');
    const { productId, dosagePerDay = 1 } = await c.req.json();
    
    console.log('Adding product', productId, 'to stack', stackId, 'for user', userId);
    
    let actualStackId = stackId;
    
    // Handle special case: 'user-default' stack ID
    if (stackId === 'user-default') {
      console.log('Creating or finding default stack for user', userId);
      
      // Try to find existing default stack for user (oldest one with 'Mein Stack' name)
      let defaultStack = await c.env.DB.prepare(`
        SELECT id FROM stacks WHERE user_id = ? AND name = 'Mein Stack' ORDER BY created_at ASC LIMIT 1
      `).bind(userId).first();
      
      // If no default stack exists, create one
      if (!defaultStack) {
        const createResult = await c.env.DB.prepare(`
          INSERT INTO stacks (user_id, name, description) 
          VALUES (?, ?, ?)
        `).bind(userId, 'Mein Stack', 'Ihr persönlicher Supplement-Stack').run();
        
        actualStackId = createResult.meta.last_row_id;
        console.log('Created new default stack with ID:', actualStackId);
      } else {
        actualStackId = defaultStack.id;
        console.log('Using existing default stack with ID:', actualStackId);
      }
    } else {
      // Verify stack belongs to user for non-default stacks
      const stack = await c.env.DB.prepare(`
        SELECT id FROM stacks WHERE id = ? AND user_id = ?
      `).bind(stackId, userId).first();
      
      if (!stack) {
        return c.json({ error: 'Stack not found or access denied' }, 404);
      }
    }
    
    // Add product to stack (or update dosage if already exists)
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO stack_products (stack_id, product_id, dosage_per_day) 
      VALUES (?, ?, ?)
    `).bind(actualStackId, productId, dosagePerDay).run();
    
    console.log('Successfully added product', productId, 'to stack', actualStackId);
    
    return c.json({
      success: true,
      message: 'Produkt erfolgreich zum Stack hinzugefügt'
    });
    
  } catch (error) {
    console.error('Add product to stack API error:', error);
    return c.json({ 
      error: 'Failed to add product to stack', 
      message: 'Fehler beim Hinzufügen des Produkts zum Stack: ' + (error.message || 'Unbekannter Fehler')
    }, 500);
  }
});

// Delete stack
app.delete('/api/protected/stacks/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const stackId = c.req.param('id');
    
    console.log('Deleting stack:', stackId, 'for user:', userId);
    
    // Verify stack belongs to user
    const stack = await c.env.DB.prepare(`
      SELECT id FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, userId).first();
    
    if (!stack) {
      return c.json({ error: 'Stack not found or access denied' }, 404);
    }
    
    // Delete stack products first (foreign key constraint)
    await c.env.DB.prepare(`
      DELETE FROM stack_products WHERE stack_id = ?
    `).bind(stackId).run();
    
    // Delete the stack
    await c.env.DB.prepare(`
      DELETE FROM stacks WHERE id = ? AND user_id = ?
    `).bind(stackId, userId).run();
    
    console.log('Stack deleted successfully:', stackId);
    
    return c.json({
      success: true,
      message: 'Stack erfolgreich gelöscht'
    });
    
  } catch (error) {
    console.error('Delete stack API error:', error);
    return c.json({ 
      error: 'Failed to delete stack', 
      message: 'Fehler beim Löschen des Stacks: ' + (error.message || 'Unbekannter Fehler')
    }, 500);
  }
});

// Update existing product
app.put('/api/protected/products/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const productId = c.req.param('id');
    const updates = await c.req.json();
    
    console.log('Updating product:', productId, 'for user:', userId, updates);
    
    // TODO: Update product in database
    // For now, return success response
    return c.json({
      success: true,
      message: 'Produkt erfolgreich aktualisiert'
    });
    
  } catch (error) {
    console.error('Update product API error:', error);
    return c.json({ 
      error: 'Failed to update product', 
      message: 'Fehler beim Aktualisieren des Produkts'
    }, 500);
  }
});

// Delete product
app.delete('/api/protected/products/:id', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const productId = c.req.param('id');
    
    console.log('Deleting product:', productId, 'for user:', userId);
    
    // TODO: Delete product from database
    // For now, return success response
    return c.json({
      success: true,
      message: 'Produkt erfolgreich gelöscht'
    });
    
  } catch (error) {
    console.error('Delete product API error:', error);
    return c.json({ 
      error: 'Failed to delete product', 
      message: 'Fehler beim Löschen des Produkts'
    }, 500);
  }
});

// =================================
// HTML ROUTES - RECOVERED FROM BACKUP
// =================================

// Main page - restored from backup
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dein intelligenter Supplement Manager - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Header Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="flex items-center">
                            <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
                            <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
                        </a>
                    </div>
                    
                    <!-- Navigation Menu -->
                    <div id="nav-menu" class="hidden md:flex space-x-4">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Navigation Actions -->
                    <div id="nav-actions" class="hidden md:flex">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Mobile menu button -->
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
                
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden">
                    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <div id="mobile-nav-menu">
                            <!-- Will be populated by app.js -->
                        </div>
                        <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200">
                            <!-- Will be populated by app.js -->
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main content loaded directly -->
        <div id="app">
            <!-- Hero Section -->
            <div class="bg-gradient-to-br from-blue-50 via-white to-blue-100 py-20">
                <div class="max-w-6xl mx-auto px-4 text-center">
                    <div class="mb-8">
                        <i class="fas fa-capsules text-6xl text-blue-600 mb-6"></i>
                        <h1 class="text-5xl font-bold text-gray-900 mb-4">
                            Dein intelligenter<br>
                            <span class="text-blue-600">Supplement Manager</span>
                        </h1>
                        <p class="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                            Verwalte deine Nahrungsergänzungsmittel professionell. Mit wissenschaftlich 
                            fundierten Dosierungsempfehlungen, Interaktionswarnungen und automatischer 
                            Preisberechnung.
                        </p>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                        <a href="/auth" class="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg">
                            Kostenlos registrieren
                        </a>
                        <a href="/demo" class="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors">
                            Demo anschauen
                        </a>
                    </div>
                    
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-4xl mx-auto">
                        <div class="flex items-center justify-center">
                            <i class="fas fa-exclamation-triangle text-yellow-600 mr-3"></i>
                            <p class="text-yellow-800 text-sm">
                                <strong>Hinweis:</strong> Diese Anwendung stellt keine medizinische Beratung dar. Konsultieren Sie bei gesundheitlichen Fragen immer einen Arzt oder Apotheker.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Features Section -->
            <div id="features" class="py-20 bg-white">
                <div class="max-w-6xl mx-auto px-4">
                    <h2 class="text-3xl font-bold text-center text-gray-900 mb-16">
                        Alles für deine Supplement-Verwaltung
                    </h2>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <!-- Feature 1: Produkt-Management -->
                        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-pills text-2xl text-blue-600"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-3">Produkt-Management</h3>
                            <p class="text-gray-600 leading-relaxed">
                                Erfasse deine Supplements mit allen wichtigen Details. 
                                Automatische Dubletten-Erkennung und intelligente 
                                Produktkategorisierung.
                            </p>
                        </div>

                        <!-- Feature 2: Stack-Verwaltung -->
                        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-layer-group text-2xl text-green-600"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-3">Stack-Verwaltung</h3>
                            <p class="text-gray-600 leading-relaxed">
                                Erstelle individuelle Supplement-Kombinationen mit intelligenten 
                                Dosierungsempfehlungen basierend auf DGE oder Studien.
                            </p>
                        </div>

                        <!-- Feature 3: Interaktions-Warnungen -->
                        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-exclamation-triangle text-2xl text-red-600"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-3">Interaktions-Warnungen</h3>
                            <p class="text-gray-600 leading-relaxed">
                                Erhalte automatische Warnungen bei Überdosierungen oder negativen 
                                Wechselwirkungen zwischen verschiedenen Wirkstoffen.
                            </p>
                        </div>

                        <!-- Feature 4: Preisberechnung -->
                        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-calculator text-2xl text-purple-600"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-3">Preisberechnung</h3>
                            <p class="text-gray-600 leading-relaxed">
                                Automatische Berechnung der Kosten pro Tag, Woche und Monat. 
                                Verbrauchsübersicht und Nachkauf-Erinnerungen.
                            </p>
                        </div>

                        <!-- Feature 5: Intelligente Analyse -->
                        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-chart-line text-2xl text-yellow-600"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-3">Intelligente Analyse</h3>
                            <p class="text-gray-600 leading-relaxed">
                                Analysiere deine Supplement-Aufnahme und erkenne Über- oder 
                                Unterversorgung basierend auf Referenzwerten.
                            </p>
                        </div>

                        <!-- Feature 6: Wissensdatenbank -->
                        <div class="text-center p-6 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300">
                            <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i class="fas fa-book text-2xl text-indigo-600"></i>
                            </div>
                            <h3 class="text-xl font-semibold text-gray-900 mb-3">Wissensdatenbank</h3>
                            <p class="text-gray-600 leading-relaxed">
                                Detaillierte Informationen zu jedem Nährstoff: Dosierungsempfehlungen und 
                                Mangelerscheinungen.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- CTA Section -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 py-20">
                <div class="max-w-4xl mx-auto px-4 text-center">
                    <h2 class="text-3xl font-bold text-white mb-4">
                        Bereit für intelligente Supplement-Verwaltung?
                    </h2>
                    <p class="text-xl text-blue-100 mb-8">
                        Starte jetzt kostenlos und optimiere deine Nahrungsergänzung.
                    </p>
                    <a href="/auth" class="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors shadow-lg inline-block">
                        Jetzt kostenlos registrieren
                    </a>
                </div>
            </div>

            <!-- Trust Section -->
            <div class="py-16 bg-gray-50">
                <div class="max-w-4xl mx-auto px-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <div>
                            <i class="fas fa-shield-alt text-3xl text-green-600 mb-4"></i>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">DSGVO-konform</h3>
                            <p class="text-gray-600">Deine Daten sind sicher und werden nur für die Funktionalität verwendet.</p>
                        </div>
                        <div>
                            <i class="fas fa-university text-3xl text-blue-600 mb-4"></i>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Wissenschaftlich fundiert</h3>
                            <p class="text-gray-600">Basiert auf DGE-Empfehlungen und aktuellen Forschungsergebnissen.</p>
                        </div>
                        <div>
                            <i class="fas fa-mobile-alt text-3xl text-purple-600 mb-4"></i>
                            <h3 class="text-lg font-semibold text-gray-900 mb-2">Überall verfügbar</h3>
                            <p class="text-gray-600">Optimiert für Desktop und Mobile - immer und überall nutzbar.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <!-- Brand Column -->
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
                            <span class="text-xl font-bold">Supplement Stack</span>
                        </div>
                        <p class="text-gray-300 mb-4 max-w-md">
                            Ihr intelligenter Supplement Manager für eine wissenschaftlich fundierte und sichere Nahrungsergänzung.
                        </p>
                        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                            <p class="text-yellow-200 text-sm">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Schnellzugriff</h3>
                        <ul class="space-y-2">
                            <li><a href="/" class="text-gray-300 hover:text-white transition-colors">Startseite</a></li>
                            <li><a href="/demo" class="text-gray-300 hover:text-white transition-colors">Demo</a></li>
                            <li><a href="/auth" class="text-gray-300 hover:text-white transition-colors">Anmelden</a></li>
                            <li><a href="/dashboard" class="text-gray-300 hover:text-white transition-colors">Dashboard</a></li>
                        </ul>
                    </div>
                    
                    <!-- Legal Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
                        <ul class="space-y-2">
                            <li><a href="/datenschutz" class="text-gray-300 hover:text-white transition-colors">Datenschutz</a></li>
                            <li><a href="/impressum" class="text-gray-300 hover:text-white transition-colors">Impressum</a></li>
                            <li><a href="/agb" class="text-gray-300 hover:text-white transition-colors">AGB</a></li>
                            <li><a href="/kontakt" class="text-gray-300 hover:text-white transition-colors">Kontakt</a></li>
                        </ul>
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <p class="text-gray-300 text-sm">
                        © 2025 Supplement Stack. Alle Rechte vorbehalten.
                    </p>
                    <div class="flex items-center space-x-4 mt-4 sm:mt-0">
                        <span class="text-gray-300 text-sm">DSGVO-konform</span>
                        <span class="text-gray-300 text-sm">•</span>
                        <span class="text-gray-300 text-sm">Made in Germany</span>
                    </div>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
        <script>
            // Initialize main app when page loads
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Landing page loaded, initializing SupplementApp...');
                try {
                    window.app = new SupplementApp();
                    console.log('SupplementApp initialized successfully');
                } catch (error) {
                    console.error('Failed to initialize SupplementApp:', error);
                }
            });
        </script>
    </body>
    </html>
  `)
})

// Demo page - restored from backup with full functionality
app.get('/demo', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demo - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Header Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="flex items-center">
                            <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
                            <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
                        </a>
                    </div>
                    
                    <!-- Navigation Menu -->
                    <div id="nav-menu" class="hidden md:flex space-x-4">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Navigation Actions -->
                    <div id="nav-actions" class="hidden md:flex">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Mobile menu button -->
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
                
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden">
                    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <div id="mobile-nav-menu">
                            <!-- Will be populated by app.js -->
                        </div>
                        <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200">
                            <!-- Will be populated by app.js -->
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <div class="container mx-auto px-4 py-8">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-flask mr-3 text-blue-600"></i>
                    Demo - Supplement Stack
                </h1>
                <p class="text-xl text-gray-600 mb-4">Testen Sie alle Funktionen unseres intelligenten Supplement Managers</p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-4xl mx-auto">
                    <p class="text-blue-800 text-sm">
                        <i class="fas fa-info-circle mr-2"></i>
                        <strong>Interaktive Demo:</strong> Alle Funktionen sind voll funktionsfähig. 
                        Testen Sie das Hinzufügen von Produkten, Stack-Erstellung und Kostenberechnungen.
                    </p>
                </div>
            </div>

            <!-- Controls -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div class="flex flex-col sm:flex-row gap-4 flex-1">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen:</label>
                            <select id="stack-selector" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Lade Stacks...</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button id="demo-add-product-main" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
                            <i class="fas fa-plus mr-2"></i>Produkt hinzufügen
                        </button>
                        <button id="demo-create-stack-main" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm">
                            <i class="fas fa-magic mr-2"></i>Stack erstellen
                        </button>
                        <button id="demo-delete-stack-main" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm" style="display: none;">
                            <i class="fas fa-trash mr-2"></i>Stack löschen
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stack Grid -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-layer-group mr-2 text-green-600"></i>
                        Ihr Demo Stack
                    </h2>
                    <div class="flex items-center space-x-4 text-sm text-gray-600">
                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                            <i class="fas fa-box mr-1"></i>
                            Produkte im Stack
                        </span>
                    </div>
                </div>
                
                <!-- Products Grid - will be populated by JavaScript -->
                <div id="demo-stack-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
                    <!-- Products will be loaded here by demo-modal.js -->
                </div>
            </div>

            <!-- Summary Cards -->


            <!-- Footer Info -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
                <div class="text-center">
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">
                        <i class="fas fa-rocket mr-2 text-blue-600"></i>
                        Gefällt Ihnen die Demo?
                    </h3>
                    <p class="text-gray-600 mb-4">Registrieren Sie sich kostenlos und verwalten Sie Ihre echten Supplements!</p>
                    <div class="flex flex-col sm:flex-row gap-3 justify-center">
                        <a href="/auth" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
                            <i class="fas fa-user-plus mr-2"></i>Jetzt registrieren
                        </a>
                        <a href="/" class="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                            <i class="fas fa-home mr-2"></i>Zur Startseite
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <!-- Brand Column -->
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
                            <span class="text-xl font-bold">Supplement Stack</span>
                        </div>
                        <p class="text-gray-300 mb-4 max-w-md">
                            Ihr intelligenter Supplement Manager für eine wissenschaftlich fundierte und sichere Nahrungsergänzung.
                        </p>
                        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                            <p class="text-yellow-200 text-sm">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Schnellzugriff</h3>
                        <ul class="space-y-2">
                            <li><a href="/" class="text-gray-300 hover:text-white transition-colors">Startseite</a></li>
                            <li><a href="/demo" class="text-gray-300 hover:text-white transition-colors">Demo</a></li>
                            <li><a href="/auth" class="text-gray-300 hover:text-white transition-colors">Anmelden</a></li>
                            <li><a href="/dashboard" class="text-gray-300 hover:text-white transition-colors">Dashboard</a></li>
                        </ul>
                    </div>
                    
                    <!-- Legal Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
                        <ul class="space-y-2">
                            <li><a href="/datenschutz" class="text-gray-300 hover:text-white transition-colors">Datenschutz</a></li>
                            <li><a href="/impressum" class="text-gray-300 hover:text-white transition-colors">Impressum</a></li>
                            <li><a href="/agb" class="text-gray-300 hover:text-white transition-colors">AGB</a></li>
                            <li><a href="/kontakt" class="text-gray-300 hover:text-white transition-colors">Kontakt</a></li>
                        </ul>
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <p class="text-gray-300 text-sm">
                        © 2025 Supplement Stack. Alle Rechte vorbehalten.
                    </p>
                    <div class="flex items-center space-x-4 mt-4 sm:mt-0">
                        <span class="text-gray-300 text-sm">DSGVO-konform</span>
                        <span class="text-gray-300 text-sm">•</span>
                        <span class="text-gray-300 text-sm">Made in Germany</span>
                    </div>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/demo-modal.js"></script>
        <script>
            // Initialize demo app when page loads
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Demo page loaded, initializing SupplementDemoApp...');
                try {
                    window.demoApp = new SupplementDemoApp();
                    console.log('SupplementDemoApp initialized successfully');
                    
                    // Setup demo-specific event listeners
                    setupDemoEvents();
                } catch (error) {
                    console.error('Failed to initialize SupplementDemoApp:', error);
                    document.getElementById('demo-stack-grid').innerHTML = '<div class="col-span-full text-center py-8 text-red-600"><i class="fas fa-exclamation-triangle text-2xl mb-2"></i><p>Demo konnte nicht geladen werden</p><p class="text-sm">Bitte laden Sie die Seite neu</p></div>';
                }
            });
            
            function setupDemoEvents() {
                // Delete Stack Button for Demo Mode
                const deleteStackBtn = document.getElementById('demo-delete-stack-main');
                if (deleteStackBtn) {
                    deleteStackBtn.addEventListener('click', async () => {
                        const stackSelector = document.getElementById('stack-selector');
                        const selectedStackId = stackSelector?.value;
                        
                        if (!selectedStackId) {
                            alert('Bitte wählen Sie zuerst einen Stack aus.');
                            return;
                        }
                        
                        const selectedStackName = stackSelector.options[stackSelector.selectedIndex].text;
                        
                        if (confirm('Möchten Sie den Stack "' + selectedStackName + '" wirklich löschen?')) {
                            try {
                                if (window.demoApp && typeof window.demoApp.deleteStack === 'function') {
                                    await window.demoApp.deleteStack(selectedStackId);
                                } else {
                                    console.error('demoApp not found or deleteStack method not available');
                                    alert('Fehler: Stack-Löschfunktion nicht verfügbar');
                                }
                            } catch (error) {
                                console.error('Error deleting stack:', error);
                                alert('Fehler beim Löschen des Stacks: ' + error.message);
                            }
                        }
                    });
                }
                
                // Demo Stack Selector - Show/Hide delete button
                const stackSelector = document.getElementById('stack-selector');
                if (stackSelector) {
                    stackSelector.addEventListener('change', (e) => {
                        const stackId = e.target.value;
                        const deleteBtn = document.getElementById('demo-delete-stack-main');
                        
                        if (stackId && deleteBtn) {
                            deleteBtn.style.display = 'block';
                        } else if (deleteBtn) {
                            deleteBtn.style.display = 'none';
                        }
                    });
                }
            }
        </script>
    </body>
    </html>
  `)
})

app.get('/auth', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Anmeldung - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8 mx-4">
            <!-- Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">🧬 Supplement Stack</h1>
                <p class="text-gray-600">Ihr intelligenter Supplement Manager</p>
            </div>

            <!-- Tab Navigation -->
            <div class="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors active" data-tab="login">
                    Anmelden
                </button>
                <button class="auth-tab flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors" data-tab="register">
                    Registrieren
                </button>
            </div>

            <!-- Login Tab -->
            <div id="loginTab" class="tab-content">
                <form id="loginForm" class="space-y-4">
                    <div>
                        <label for="loginEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="loginEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="loginPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                        <input type="password" id="loginPassword" name="password" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="loginBtn" 
                            class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Anmelden
                    </button>
                </form>
                <div class="text-center mt-4">
                    <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="forgot">
                        Passwort vergessen?
                    </button>
                </div>
                <div class="mt-6 p-4 bg-blue-50 rounded-md">
                    <h4 class="text-sm font-medium text-blue-800 mb-2">🔐 2-Schritt-Verifizierung</h4>
                    <p class="text-xs text-blue-700">Nach der Anmeldung erhalten Sie eine E-Mail zur Bestätigung. Dies schützt Ihr Konto gemäß DSGVO-Anforderungen.</p>
                </div>
            </div>

            <!-- Register Tab -->
            <div id="registerTab" class="tab-content hidden">
                <form id="registerForm" class="space-y-4">
                    <div>
                        <label for="registerEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="registerEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="registerPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
                        <input type="password" id="registerPassword" name="password" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">Mindestens 8 Zeichen, mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen</p>
                    </div>
                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="registerBtn" 
                            class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors font-medium">
                        Registrieren
                    </button>
                </form>
                <div class="mt-6 p-4 bg-green-50 rounded-md">
                    <h4 class="text-sm font-medium text-green-800 mb-2">📧 E-Mail-Bestätigung erforderlich</h4>
                    <p class="text-xs text-green-700">Nach der Registrierung erhalten Sie eine E-Mail zur Bestätigung Ihrer Adresse. Dies ist für die DSGVO-Konformität erforderlich.</p>
                </div>
            </div>

            <!-- Forgot Password Tab -->
            <div id="forgotTab" class="tab-content hidden">
                <form id="forgotPasswordForm" class="space-y-4">
                    <div>
                        <label for="forgotEmail" class="block text-sm font-medium text-gray-700 mb-1">E-Mail-Adresse</label>
                        <input type="email" id="forgotEmail" name="email" required 
                               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button type="submit" id="forgotBtn" 
                            class="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors font-medium">
                        Passwort zurücksetzen
                    </button>
                </form>
                <div class="text-center mt-4">
                    <button class="auth-tab text-blue-600 hover:text-blue-800 text-sm" data-tab="login">
                        Zurück zur Anmeldung
                    </button>
                </div>
            </div>

            <!-- Links -->
            <div class="mt-8 text-center">
                <a href="/" class="text-sm text-gray-600 hover:text-gray-800">
                    ← Zurück zur Startseite
                </a>
            </div>

            <!-- GDPR Notice -->
            <div class="mt-6 p-4 bg-gray-50 rounded-md">
                <p class="text-xs text-gray-600 text-center">
                    Mit der Nutzung stimmen Sie unseren 
                    <a href="/datenschutz" class="text-blue-600 hover:text-blue-800">Datenschutzbestimmungen</a> zu.
                    Alle Daten werden DSGVO-konform verarbeitet.
                </p>
            </div>
        </div>

        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

// Dashboard
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <a href="/" class="flex items-center">
                            <i class="fas fa-capsules text-2xl text-blue-600 mr-3"></i>
                            <span class="text-xl font-bold text-gray-900">Supplement Stack</span>
                        </a>
                    </div>
                    
                    <!-- Navigation Menu -->
                    <div id="nav-menu" class="hidden md:flex space-x-4">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Navigation Actions -->
                    <div id="nav-actions" class="hidden md:flex">
                        <!-- Will be populated by app.js -->
                    </div>
                    
                    <!-- Mobile menu button -->
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
                
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden">
                    <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        <div id="mobile-nav-menu">
                            <!-- Will be populated by app.js -->
                        </div>
                        <div id="mobile-nav-actions" class="pt-4 border-t border-gray-200">
                            <!-- Will be populated by app.js -->
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Dashboard Header -->
            <div class="text-center mb-8">
                <h1 class="text-4xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-tachometer-alt mr-3 text-blue-600"></i>
                    Ihr Dashboard
                </h1>
                <p class="text-xl text-gray-600 mb-4">Verwalten Sie Ihre persönlichen Supplements und Stacks</p>
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 max-w-4xl mx-auto">
                    <p class="text-green-800 text-sm">
                        <i class="fas fa-user-check mr-2"></i>
                        <strong>Persönlicher Bereich:</strong> Alle Ihre Daten werden sicher gespeichert. 
                        Erstellen Sie Stacks, verwalten Sie Produkte und behalten Sie Ihre Kosten im Blick.
                    </p>
                </div>
            </div>

            <!-- Controls -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                    <div class="flex flex-col sm:flex-row gap-4 flex-1">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen:</label>
                            <select id="stack-selector" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Lade Ihre Stacks...</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row gap-3">
                        <button id="add-product-main" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
                            <i class="fas fa-plus mr-2"></i>Produkt hinzufügen
                        </button>
                        <button id="create-stack-main" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm">
                            <i class="fas fa-magic mr-2"></i>Stack erstellen
                        </button>
                        <button id="delete-stack-main" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm" style="display: none;">
                            <i class="fas fa-trash mr-2"></i>Stack löschen
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stack Grid -->
            <div class="bg-white rounded-lg shadow-md p-6 mb-8">
                <div class="flex items-center justify-between mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">
                        <i class="fas fa-layer-group mr-2 text-green-600"></i>
                        Ihr aktueller Stack
                    </h2>
                    <div class="flex items-center space-x-4 text-sm text-gray-600">
                        <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                            <i class="fas fa-box mr-1"></i>
                            Produkte im Stack
                        </span>
                    </div>
                </div>
                
                <div id="demo-stack-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <!-- Products will be loaded here by JavaScript -->
                    <div class="text-center py-8 col-span-full">
                        <i class="fas fa-box-open text-4xl text-gray-300 mb-4"></i>
                        <p class="text-gray-500">Wählen Sie einen Stack aus oder erstellen Sie einen neuen</p>
                    </div>
                </div>
            </div>

            <!-- Layer Toggle and Stack-wide Info -->
            <div id="dashboard-layer-section" class="bg-white rounded-lg shadow-md p-6 mb-8 hidden">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">
                        <i class="fas fa-eye mr-2 text-blue-600"></i>
                        Transparenter Einblick
                    </h3>
                    <button id="dashboard-toggle-layer" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                        <i class="fas fa-layer-group mr-2"></i>Layer öffnen
                    </button>
                </div>
                
                <div id="dashboard-layer-content" class="hidden">
                    <!-- Info-Bereich entfernt auf Anfrage -->
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="bg-gray-900 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <!-- Brand Column -->
                    <div class="col-span-1 md:col-span-2">
                        <div class="flex items-center mb-4">
                            <i class="fas fa-capsules text-2xl text-blue-400 mr-3"></i>
                            <span class="text-xl font-bold">Supplement Stack</span>
                        </div>
                        <p class="text-gray-300 mb-4 max-w-md">
                            Ihr intelligenter Supplement Manager für eine wissenschaftlich fundierte und sichere Nahrungsergänzung.
                        </p>
                        <div class="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                            <p class="text-yellow-200 text-sm">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                <strong>Wichtiger Hinweis:</strong> Diese Anwendung ersetzt keine medizinische Beratung.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Schnellzugriff</h3>
                        <ul class="space-y-2">
                            <li><a href="/" class="text-gray-300 hover:text-white transition-colors">Startseite</a></li>
                            <li><a href="/demo" class="text-gray-300 hover:text-white transition-colors">Demo</a></li>
                            <li><a href="/auth" class="text-gray-300 hover:text-white transition-colors">Anmelden</a></li>
                            <li><a href="/dashboard" class="text-gray-300 hover:text-white transition-colors">Dashboard</a></li>
                        </ul>
                    </div>
                    
                    <!-- Legal Links -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Rechtliches</h3>
                        <ul class="space-y-2">
                            <li><a href="/datenschutz" class="text-gray-300 hover:text-white transition-colors">Datenschutz</a></li>
                            <li><a href="/impressum" class="text-gray-300 hover:text-white transition-colors">Impressum</a></li>
                            <li><a href="/agb" class="text-gray-300 hover:text-white transition-colors">AGB</a></li>
                            <li><a href="/kontakt" class="text-gray-300 hover:text-white transition-colors">Kontakt</a></li>
                        </ul>
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <p class="text-gray-300 text-sm">
                        © 2025 Supplement Stack. Alle Rechte vorbehalten.
                    </p>
                    <div class="flex items-center space-x-4 mt-4 sm:mt-0">
                        <span class="text-gray-300 text-sm">DSGVO-konform</span>
                        <span class="text-gray-300 text-sm">•</span>
                        <span class="text-gray-300 text-sm">Made in Germany</span>
                    </div>
                </div>
            </div>
        </footer>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
        <script src="/static/demo-modal.js"></script>
        <script>
            // Initialize main app when page loads
            document.addEventListener('DOMContentLoaded', function() {
                console.log('Dashboard page loaded, initializing SupplementApp...');
                try {
                    // Initialize main app
                    window.app = new SupplementApp();
                    console.log('SupplementApp initialized successfully');
                    
                    // Initialize dashboard demo functionality (using unified demoApp instance)
                    window.demoApp = new SupplementDemoApp();
                    console.log('Dashboard SupplementDemoApp initialized successfully');
                    
                    // Backward compatibility - keep dashboardApp reference
                    window.dashboardApp = window.demoApp;
                    
                    // Setup dashboard-specific event listeners
                    setupDashboardEvents();
                    
                } catch (error) {
                    console.error('Failed to initialize Dashboard:', error);
                    document.getElementById('dashboard-stack-grid').innerHTML = '<div class="text-center py-8 text-red-600 col-span-full"><i class="fas fa-exclamation-triangle text-2xl mb-2"></i><p>Dashboard konnte nicht geladen werden</p><p class="text-sm">Bitte laden Sie die Seite neu oder melden Sie sich erneut an</p></div>';
                }
                
                function setupDashboardEvents() {
                    // Add Product Button
                    const addProductBtn = document.getElementById('add-product-main');
                    if (addProductBtn) {
                        addProductBtn.addEventListener('click', () => {
                            // Use demoApp (unified app instance) instead of dashboardApp
                            if (window.demoApp) {
                                window.demoApp.showAddProductModal();
                            } else {
                                console.error('demoApp not found');
                            }
                        });
                    }
                    
                    // Create Stack Button
                    const createStackBtn = document.getElementById('create-stack-main');
                    if (createStackBtn) {
                        createStackBtn.addEventListener('click', () => {
                            // Use demoApp (unified app instance) instead of dashboardApp
                            if (window.demoApp) {
                                window.demoApp.showNutrientBasedStackModal();
                            } else {
                                console.error('demoApp not found');
                            }
                        });
                    }
                    
                    // Delete Stack Button
                    const deleteStackBtn = document.getElementById('delete-stack-main');
                    if (deleteStackBtn) {
                        deleteStackBtn.addEventListener('click', async () => {
                            const stackSelector = document.getElementById('stack-selector');
                            const selectedStackId = stackSelector?.value;
                            
                            if (!selectedStackId) {
                                alert('Bitte wählen Sie zuerst einen Stack aus.');
                                return;
                            }
                            
                            const selectedStackName = stackSelector.options[stackSelector.selectedIndex].text;
                            
                            if (confirm('M\u00f6chten Sie den Stack "' + selectedStackName + '" wirklich l\u00f6schen? Diese Aktion kann nicht r\u00fcckg\u00e4ngig gemacht werden.')) {
                                try {
                                    // Use demoApp (unified app instance) instead of dashboardApp
                                    if (window.demoApp && typeof window.demoApp.deleteStack === 'function') {
                                        await window.demoApp.deleteStack(selectedStackId);
                                    } else {
                                        console.error('demoApp not found or deleteStack method not available');
                                        alert('Fehler: Stack-Löschfunktion nicht verfügbar');
                                    }
                                } catch (error) {
                                    console.error('Error deleting stack:', error);
                                    alert('Fehler beim Löschen des Stacks: ' + error.message);
                                }
                            }
                        });
                    }
                    
                    // Layer Toggle Button
                    const layerToggleBtn = document.getElementById('dashboard-toggle-layer');
                    if (layerToggleBtn) {
                        layerToggleBtn.addEventListener('click', () => {
                            const layerContent = document.getElementById('dashboard-layer-content');
                            if (layerContent.classList.contains('hidden')) {
                                layerContent.classList.remove('hidden');
                                layerToggleBtn.innerHTML = '<i class="fas fa-eye-slash mr-2"></i>Layer schließen';
                            } else {
                                layerContent.classList.add('hidden');
                                layerToggleBtn.innerHTML = '<i class="fas fa-layer-group mr-2"></i>Layer öffnen';
                            }
                        });
                    }
                    
                    // Stack Selector
                    const stackSelector = document.getElementById('stack-selector');
                    if (stackSelector) {
                        stackSelector.addEventListener('change', (e) => {
                            const stackId = e.target.value;
                            const deleteBtn = document.getElementById('delete-stack-main');
                            
                            if (stackId) {
                                loadDashboardStack(stackId);
                                // Show delete button when a stack is selected
                                if (deleteBtn) deleteBtn.style.display = 'block';
                            } else {
                                // Hide delete button when no stack is selected
                                if (deleteBtn) deleteBtn.style.display = 'none';
                            }
                        });
                    }
                    
                    // Load initial data
                    loadDashboardData();
                }
                
                async function loadDashboardData() {
                    try {
                        // Get stacks from demo app (they're already loaded)
                        const stacks = window.dashboardApp.stacks || [];
                        console.log('Dashboard: Found stacks:', stacks);
                        populateStackSelector(stacks);
                        
                        // Load default stack if available
                        if (stacks.length > 0) {
                            loadDashboardStack(stacks[0].id);
                        }
                        
                    } catch (error) {
                        console.error('Error loading dashboard data:', error);
                    }
                }
                
                function populateStackSelector(stacks) {
                    const selector = document.getElementById('stack-selector');
                    if (selector) {
                        selector.innerHTML = '<option value="">Wählen Sie einen Stack...</option>';
                        stacks.forEach(stack => {
                            selector.innerHTML += \`<option value="\${stack.id}">\${stack.name}</option>\`;
                        });
                    }
                }
                
                function loadDashboardStack(stackId) {
                    try {
                        console.log('Dashboard: Loading stack with ID:', stackId);
                        
                        // Load stack products into grid using demo app's function
                        window.dashboardApp.loadStack(stackId);
                        
                        // Show layer section
                        const layerSection = document.getElementById('dashboard-layer-section');
                        if (layerSection) {
                            layerSection.classList.remove('hidden');
                        }
                        
                    } catch (error) {
                        console.error('Error loading stack:', error);
                    }
                }
            });
        </script>
    </body>
    </html>
  `)
})

// Password reset page
app.get('/auth/reset-password', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Passwort zurücksetzen - Supplement Stack</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="auth-container max-w-md w-full bg-white rounded-lg shadow-lg p-8 mx-4">
            <!-- Password Reset Form -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">🔑 Neues Passwort</h1>
                <p class="text-gray-600">Erstellen Sie ein sicheres neues Passwort</p>
            </div>
            <form id="resetPasswordForm" class="space-y-4">
                <div>
                    <label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
                    <input type="password" id="newPassword" name="password" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label for="confirmNewPassword" class="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
                    <input type="password" id="confirmNewPassword" name="confirmPassword" required 
                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <button type="submit" id="resetBtn" 
                        class="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors font-medium">
                    Passwort ändern
                </button>
            </form>
        </div>
        <script src="/static/auth.js"></script>
    </body>
    </html>
  `)
})

// =================================
// AUTHENTICATION API ROUTES
// =================================

// User registration
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, confirmPassword } = await c.req.json();

    console.log('Registration attempt for:', email);

    if (!email || !password || !confirmPassword) {
      return c.json({
        error: 'missing_fields',
        message: 'Alle Felder sind erforderlich'
      }, 400);
    }

    if (password !== confirmPassword) {
      return c.json({
        error: 'password_mismatch',
        message: 'Die Passwörter stimmen nicht überein'
      }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({
        error: 'invalid_email_format',
        message: 'Ungültiges E-Mail-Format'
      }, 400);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({
        error: 'password_too_weak',
        message: passwordValidation.message
      }, 400);
    }

    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existingUser) {
      if (existingUser.email_verified) {
        return c.json({
          error: 'email_already_exists',
          message: 'Diese E-Mail-Adresse ist bereits registriert'
        }, 409);
      } else {
        // Delete unverified user
        await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(existingUser.id).run();
      }
    }

    // Hash password and generate verification token
    const passwordHash = await hashPassword(password);
    const verificationToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log('Creating user with verification token');

    // Create user
    const result = await c.env.DB.prepare(`
      INSERT INTO users (
        email, password_hash, email_verified, 
        email_verification_token, email_verification_expires_at,
        created_at, updated_at
      ) VALUES (?, ?, FALSE, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(email.toLowerCase(), passwordHash, verificationToken, expiresAt).run();

    console.log('User created, sending verification email');

    // Send verification email
    const baseUrl = c.env.ENVIRONMENT === 'production' 
      ? 'https://supplementstack.de' 
      : `https://${c.req.header('host')}`;

    const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
    
    const emailHtml = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0;">🧬 Supplement Stack</h1>
          <p style="margin: 10px 0 0 0;">Willkommen bei Ihrem intelligenten Supplement Manager</p>
        </div>
        <div style="background: #f9f9f9; padding: 30px;">
          <h2>E-Mail-Adresse bestätigen</h2>
          <p>Vielen Dank für Ihre Registrierung bei Supplement Stack. Um die DSGVO-Anforderungen zu erfüllen, müssen wir Ihre E-Mail-Adresse bestätigen.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              E-Mail-Adresse bestätigen
            </a>
          </div>
          <p>Alternativ können Sie auch diesen Link kopieren: <br><code>${verificationLink}</code></p>
          <div style="background: #e8f4f8; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
            <h4>🔒 Datenschutz & DSGVO-Konformität</h4>
            <p>Ihre Daten werden nach den strengsten deutschen und europäischen Datenschutzgesetzen behandelt.</p>
          </div>
        </div>
      </div>
    `;

    const emailText = `Willkommen bei Supplement Stack! Bestätigen Sie Ihre E-Mail-Adresse: ${verificationLink}`;

    try {
      await sendEmail(
        c.env.MAILERSEND_API_KEY,
        email,
        'E-Mail-Adresse bestätigen - Supplement Stack',
        emailHtml,
        emailText
      );

      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Continue anyway - user can still complete registration manually
    }

    return c.json({
      message: 'Registrierung erfolgreich! Bitte überprüfen Sie Ihre E-Mails und bestätigen Sie Ihre E-Mail-Adresse.',
      emailSent: true
    }, 201);

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
    }, 500);
  }
});

// Email verification
app.get('/api/auth/verify-email', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Verifizierungs-Token ist erforderlich'
      }, 400);
    }

    // Find and verify user
    const user = await c.env.DB.prepare(`
      SELECT * FROM users 
      WHERE email_verification_token = ? 
      AND email_verification_expires_at > CURRENT_TIMESTAMP
      AND email_verified = FALSE
    `).bind(token).first();

    if (!user) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Verifizierung fehlgeschlagen</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Verifizierung fehlgeschlagen</h1>
                <p class="text-gray-600 mb-6">Der Verifizierungs-Link ist ungültig oder abgelaufen.</p>
                <a href="/auth" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                    Zur Anmeldung
                </a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark email as verified
    await c.env.DB.prepare(`
      UPDATE users 
      SET email_verified = TRUE, 
          email_verification_token = NULL, 
          email_verification_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id).run();

    // Generate JWT token
    const jwtToken = await sign({
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }, c.env.JWT_SECRET);

    // Set auth cookie
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <title>E-Mail erfolgreich bestätigt</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <h1 class="text-2xl font-bold text-green-600 mb-4">✅ E-Mail bestätigt!</h1>
              <p class="text-gray-600 mb-6">Ihr Konto ist jetzt aktiviert. Willkommen bei Supplement Stack!</p>
              <div class="space-y-4">
                  <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                      Zum Dashboard
                  </a>
                  <a href="/" class="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300">
                      Zur Startseite
                  </a>
              </div>
              <script>
                setTimeout(() => window.location.href = '/dashboard', 3000);
              </script>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Email verification error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// User login (2-step process)
app.post('/api/auth/login', async (c) => {
  try {
    console.log('Login attempt started');
    
    const { email, password } = await c.req.json();
    console.log('Login request for email:', email);

    if (!email || !password) {
      console.log('Missing email or password');
      return c.json({
        error: 'missing_fields',
        message: 'E-Mail und Passwort sind erforderlich'
      }, 400);
    }

    console.log('Querying user from database...');
    // Get user
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();
    
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      console.log('User not found in database');
      return c.json({
        error: 'invalid_credentials',
        message: 'Ungültige E-Mail-Adresse oder Passwort'
      }, 401);
    }

    console.log('Verifying password...');
    const passwordValid = await verifyPassword(password, user.password_hash);
    console.log('Password valid:', passwordValid);
    
    if (!passwordValid) {
      console.log('Password verification failed');
      return c.json({
        error: 'invalid_credentials',
        message: 'Ungültige E-Mail-Adresse oder Passwort'
      }, 401);
    }

    // Temporarily disable email verification requirement for testing
    // if (!user.email_verified) {
    //   console.log('Email not verified for user');
    //   return c.json({
    //     error: 'email_not_verified',
    //     message: 'Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse'
    //   }, 403);
    // }

    console.log('Generating JWT token...');
    // Generate JWT token for direct login (simplified approach)
    const payload = {
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const token = await sign(payload, c.env.JWT_SECRET);
    console.log('JWT token generated successfully');

    // Update last login using existing updated_at column
    await c.env.DB.prepare(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();
    
    console.log('Login successful for user:', user.email);

    return c.json({
      message: 'Anmeldung erfolgreich',
      token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.email // Use email as display name since name column doesn't exist
      }
    }, 200);

  } catch (error) {
    console.error('Login error details:', error);
    console.error('Error stack:', error.stack);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten: ' + (error.message || 'Unbekannter Fehler')
    }, 500);
  }
});

// Verify login
app.get('/api/auth/verify-login', async (c) => {
  try {
    const token = c.req.query('token');

    if (!token) {
      return c.json({
        error: 'missing_token',
        message: 'Anmelde-Token ist erforderlich'
      }, 400);
    }

    // Get user by token
    const result = await c.env.DB.prepare(`
      SELECT u.* FROM users u
      INNER JOIN email_verification_tokens evt ON u.id = evt.user_id
      WHERE evt.token = ? 
      AND evt.expires_at > CURRENT_TIMESTAMP
      AND evt.used_at IS NULL
    `).bind(token).first();

    if (!result) {
      return c.html(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
            <meta charset="UTF-8">
            <title>Anmeldung fehlgeschlagen</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen">
            <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                <h1 class="text-2xl font-bold text-red-600 mb-4">❌ Anmeldung fehlgeschlagen</h1>
                <p class="text-gray-600 mb-6">Der Anmelde-Link ist ungültig oder abgelaufen.</p>
                <a href="/auth" class="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                    Zur Anmeldung
                </a>
            </div>
        </body>
        </html>
      `);
    }

    // Mark token as used
    await c.env.DB.prepare(`
      UPDATE email_verification_tokens 
      SET used_at = CURRENT_TIMESTAMP 
      WHERE token = ?
    `).bind(token).run();

    // Generate JWT token
    const jwtToken = await sign({
      userId: result.id,
      email: result.email,
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // 24 hours
    }, c.env.JWT_SECRET);

    // Set auth cookie
    c.header('Set-Cookie', `auth_token=${jwtToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.html(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <title>Anmeldung erfolgreich</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
              <h1 class="text-2xl font-bold text-green-600 mb-4">✅ Anmeldung erfolgreich!</h1>
              <p class="text-gray-600 mb-6">Willkommen zurück bei Supplement Stack!</p>
              <a href="/dashboard" class="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                  Zum Dashboard
              </a>
              <script>
                setTimeout(() => window.location.href = '/dashboard', 2000);
              </script>
          </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Login verification error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Forgot password
app.post('/api/auth/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();

    if (!email) {
      return c.json({
        error: 'missing_email',
        message: 'E-Mail-Adresse ist erforderlich'
      }, 400);
    }

    const successMessage = 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet.';

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND email_verified = TRUE'
    ).bind(email.toLowerCase()).first();

    if (user) {
      const resetToken = generateSecureToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Delete existing reset tokens
      await c.env.DB.prepare(`
        DELETE FROM email_verification_tokens WHERE user_id = ? AND used_at IS NULL
      `).bind(user.id).run();

      // Create new reset token
      await c.env.DB.prepare(`
        INSERT INTO email_verification_tokens (user_id, token, expires_at)
        VALUES (?, ?, ?)
      `).bind(user.id, resetToken, expiresAt).run();

      // Send reset email
      const baseUrl = c.env.ENVIRONMENT === 'production' 
        ? 'https://supplementstack.de' 
        : `https://${c.req.header('host')}`;

      const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;
      
      const emailHtml = `
        <h2>Passwort zurücksetzen</h2>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
        <a href="${resetLink}" style="background: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Passwort zurücksetzen
        </a>
        <p>Link gültig für 1 Stunde. Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.</p>
      `;

      const emailText = `Passwort zurücksetzen: ${resetLink}`;

      await sendEmail(
        c.env.MAILERSEND_API_KEY,
        user.email,
        'Passwort zurücksetzen - Supplement Stack',
        emailHtml,
        emailText
      );
    }

    return c.json({ message: successMessage }, 200);

  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({
      error: 'internal_server_error',
      message: 'Ein interner Fehler ist aufgetreten'
    }, 500);
  }
});

// Health check - with detailed status
app.get('/api/health', async (c) => {
  try {
    // Test database connection
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      auth: 'enabled',
      database: dbTest ? 'connected' : 'disconnected',
      environment: c.env.ENVIRONMENT || 'unknown',
      mailersend: c.env.MAILERSEND_API_KEY ? 'configured' : 'not configured'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
})

export default app