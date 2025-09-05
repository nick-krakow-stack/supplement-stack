import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Simple API endpoints
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    message: 'Minimal API is working',
    timestamp: new Date().toISOString(),
    version: 'minimal-1.0'
  });
});

app.get('/api/nutrients', (c) => {
  return c.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Vitamin D3',
        synonyms: ["D3", "Cholecalciferol", "Vitamin D", "Sonnenvitamin"],
        standard_unit: 'IE',
        dge_recommended: 800,
        study_recommended: 2000,
        max_safe_dose: 4000,
        warning_threshold: 4000
      },
      {
        id: 2,
        name: 'Vitamin B12',
        synonyms: ["B12", "Cobalamin", "Methylcobalamin", "Cyanocobalamin"],
        standard_unit: 'µg',
        dge_recommended: 4,
        study_recommended: 250,
        max_safe_dose: 1000,
        warning_threshold: 1000
      },
      {
        id: 3,
        name: 'Magnesium',
        synonyms: ["Mg", "Magnium"],
        standard_unit: 'mg',
        dge_recommended: 300,
        study_recommended: 400,
        max_safe_dose: 350,
        warning_threshold: 350
      },
      {
        id: 4,
        name: 'Omega-3',
        synonyms: ["Omega 3", "Fischöl", "Algenöl", "Marine Omega"],
        standard_unit: 'mg',
        dge_recommended: 250,
        study_recommended: 1000,
        max_safe_dose: 5000,
        warning_threshold: 5000
      },
      {
        id: 5,
        name: 'Zink',
        synonyms: ["Zn", "Zinc", "Bisglycinat", "Citrat"],
        standard_unit: 'mg',
        dge_recommended: 10,
        study_recommended: 15,
        max_safe_dose: 25,
        warning_threshold: 25
      },
      {
        id: 6,
        name: 'Vitamin C',
        synonyms: ["C", "Ascorbinsäure", "Ester-C"],
        standard_unit: 'mg',
        dge_recommended: 110,
        study_recommended: 1000,
        max_safe_dose: 1000,
        warning_threshold: 1000
      }
    ]
  });
});

app.get('/api/categories', (c) => {
  return c.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'Vitamine',
        description: 'Fettlösliche und wasserlösliche Vitamine',
        sort_order: 1
      },
      {
        id: 2,
        name: 'Mineralstoffe',
        description: 'Mengen- und Spurenelemente',
        sort_order: 2
      },
      {
        id: 3,
        name: 'Aminosäuren',
        description: 'Essentielle und nicht-essentielle Aminosäuren',
        sort_order: 3
      },
      {
        id: 4,
        name: 'Fettsäuren',
        description: 'Omega-3/6/9 Fettsäuren',
        sort_order: 4
      }
    ]
  });
});

// Auth endpoints
app.post('/api/auth/register', async (c) => {
  try {
    console.log('[REGISTER] Starting registration');
    const body = await c.req.json();
    console.log('[REGISTER] Body received:', Object.keys(body));
    
    const { email, password, age, gender, weight, diet_type } = body;
    
    if (!email || !password) {
      console.log('[REGISTER] Missing email or password');
      return c.json({ success: false, error: 'Email und Passwort sind erforderlich' }, 400);
    }

    // Check if user exists
    const existingUser = await c.env.DB.prepare(`
      SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
      return c.json({ success: false, error: 'Benutzer existiert bereits' }, 409);
    }

    // Hash password (simplified - in production use proper bcrypt)
    const passwordBytes = new TextEncoder().encode(password + 'supplement-salt');
    const hashedPassword = await crypto.subtle.digest('SHA-256', passwordBytes);
    const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Create user
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, age, gender, weight, diet_type, guideline_source, email_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'DGE', true, datetime('now'), datetime('now'))
    `).bind(email, passwordHash, age || null, gender || null, weight || null, diet_type || null).run();

    if (!result.success) {
      return c.json({ success: false, error: 'Fehler beim Erstellen des Benutzers' }, 500);
    }

    return c.json({
      success: true,
      message: 'Benutzer erfolgreich registriert',
      user: { id: result.meta.last_row_id, email }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ 
      success: false, 
      error: 'Registrierungsfehler',
      debug: error.message,
      stack: error.stack
    }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ success: false, error: 'Email und Passwort sind erforderlich' }, 400);
    }

    // Hash provided password  
    const passwordBytes = new TextEncoder().encode(password + 'supplement-salt');
    const hashedPassword = await crypto.subtle.digest('SHA-256', passwordBytes);
    const passwordHash = Array.from(new Uint8Array(hashedPassword)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Find user
    const user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE email = ? AND password_hash = ?
    `).bind(email, passwordHash).first();

    if (!user) {
      return c.json({ success: false, error: 'Ungültige Anmeldedaten' }, 401);
    }

    // Create simple token (in production, use proper JWT)
    const token = btoa(`${user.id}:${Date.now()}`);

    return c.json({
      success: true,
      message: 'Erfolgreich angemeldet',
      token,
      user: {
        id: user.id,
        email: user.email,
        age: user.age,
        gender: user.gender,
        weight: user.weight,
        diet_type: user.diet_type
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, error: 'Anmeldefehler' }, 500);
  }
});

// Protected Products API  
app.get('/api/protected/products', async (c) => {
  try {
    // Simple auth check (in production, use proper JWT middleware)
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');

    console.log('[PRODUCTS] Getting products for user:', userId);

    // First get products
    const products = await c.env.DB.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).bind(userId).all();

    console.log('[PRODUCTS] Found products:', products.results?.length || 0);

    // Then get nutrients for each product
    const productsWithNutrients = [];
    for (const product of products.results || []) {
      const nutrients = await c.env.DB.prepare(`
        SELECT pn.*, n.name, n.dge_recommended, n.study_recommended
        FROM product_nutrients pn
        JOIN nutrients n ON pn.nutrient_id = n.id
        WHERE pn.product_id = ?
      `).bind(product.id).all();

      productsWithNutrients.push({
        ...product,
        nutrients: nutrients.results || []
      });
    }

    return c.json({ success: true, data: productsWithNutrients });
  } catch (error) {
    console.error('[PRODUCTS] Get products error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Laden der Produkte',
      debug: error.message
    }, 500);
  }
});

app.post('/api/protected/products', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');
    
    const body = await c.req.json();

    if (!body.name || !body.brand || !body.form || !body.price_per_package || !body.servings_per_package || !body.shop_url) {
      return c.json({ error: 'Alle Pflichtfelder müssen ausgefüllt werden' }, 400);
    }

    // Create product
    const productResult = await c.env.DB.prepare(`
      INSERT INTO products (user_id, name, brand, form, price_per_package, servings_per_package, 
                          shop_url, affiliate_url, image_url, description, benefits, warnings, 
                          dosage_recommendation, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      userId,
      body.name,
      body.brand,
      body.form,
      body.price_per_package,
      body.servings_per_package,
      body.shop_url,
      body.shop_url, // affiliate_url same as shop_url for now
      body.image_url || null,
      body.description || null,
      JSON.stringify(body.benefits || []),
      body.warnings || null,
      body.dosage_recommendation || null,
      body.category_id || 1
    ).run();

    if (!productResult.success) {
      return c.json({ error: 'Fehler beim Erstellen des Produkts' }, 500);
    }

    const productId = productResult.meta.last_row_id;

    // Add nutrients
    if (body.nutrients && body.nutrients.length > 0) {
      for (const nutrient of body.nutrients) {
        await c.env.DB.prepare(`
          INSERT INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          productId,
          nutrient.nutrient_id,
          nutrient.amount,
          nutrient.unit,
          nutrient.amount // simplified standardization
        ).run();
      }
    }

    return c.json({
      success: true,
      message: 'Produkt erfolgreich erstellt',
      product_id: productId
    });

  } catch (error) {
    console.error('Create product error:', error);
    return c.json({ success: false, error: 'Fehler beim Erstellen des Produkts' }, 500);
  }
});

// Get Single Product endpoint
app.get('/api/protected/products/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');
    const productId = c.req.param('id');

    console.log('[PRODUCT] Getting product:', productId, 'for user:', userId);

    // Get product
    const product = await c.env.DB.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.user_id = ?
    `).bind(productId, userId).first();

    if (!product) {
      return c.json({ success: false, error: 'Produkt nicht gefunden' }, 404);
    }

    // Get nutrients for this product
    const nutrients = await c.env.DB.prepare(`
      SELECT pn.*, n.name, n.dge_recommended, n.study_recommended, n.standard_unit
      FROM product_nutrients pn
      JOIN nutrients n ON pn.nutrient_id = n.id
      WHERE pn.product_id = ?
    `).bind(productId).all();

    const productWithNutrients = {
      ...product,
      nutrients: nutrients.results || []
    };

    return c.json({ success: true, data: productWithNutrients });

  } catch (error) {
    console.error('[PRODUCT] Get single product error:', error);
    return c.json({ 
      success: false, 
      error: 'Fehler beim Laden des Produkts',
      debug: error.message
    }, 500);
  }
});

// Update Product endpoint
app.put('/api/protected/products/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');
    const productId = c.req.param('id');
    
    const body = await c.req.json();

    if (!body.name || !body.brand || !body.form || !body.price_per_package || !body.servings_per_package || !body.shop_url) {
      return c.json({ error: 'Alle Pflichtfelder müssen ausgefüllt werden' }, 400);
    }

    // Check if product belongs to user
    const existingProduct = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, userId).first();

    if (!existingProduct) {
      return c.json({ success: false, error: 'Produkt nicht gefunden oder keine Berechtigung' }, 404);
    }

    // Update product
    const updateResult = await c.env.DB.prepare(`
      UPDATE products SET 
        name = ?, brand = ?, form = ?, price_per_package = ?, servings_per_package = ?,
        shop_url = ?, affiliate_url = ?, image_url = ?, description = ?, benefits = ?,
        warnings = ?, dosage_recommendation = ?, category_id = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(
      body.name,
      body.brand,
      body.form,
      body.price_per_package,
      body.servings_per_package,
      body.shop_url,
      body.shop_url, // affiliate_url same as shop_url for now
      body.image_url || null,
      body.description || null,
      JSON.stringify(body.benefits || []),
      body.warnings || null,
      body.dosage_recommendation || null,
      body.category_id || 1,
      productId,
      userId
    ).run();

    if (!updateResult.success || updateResult.changes === 0) {
      return c.json({ success: false, error: 'Fehler beim Aktualisieren des Produkts' }, 500);
    }

    // Delete existing nutrients
    await c.env.DB.prepare(`
      DELETE FROM product_nutrients WHERE product_id = ?
    `).bind(productId).run();

    // Add new nutrients
    if (body.nutrients && body.nutrients.length > 0) {
      for (const nutrient of body.nutrients) {
        await c.env.DB.prepare(`
          INSERT INTO product_nutrients (product_id, nutrient_id, amount, unit, amount_standardized)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          productId,
          nutrient.nutrient_id,
          nutrient.amount,
          nutrient.unit,
          nutrient.amount // simplified standardization
        ).run();
      }
    }

    return c.json({
      success: true,
      message: 'Produkt erfolgreich aktualisiert'
    });

  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ success: false, error: 'Fehler beim Aktualisieren des Produkts' }, 500);
  }
});

// Delete Product endpoint
app.delete('/api/protected/products/:id', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');
    const productId = c.req.param('id');

    // Check if product belongs to user
    const existingProduct = await c.env.DB.prepare(`
      SELECT id FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, userId).first();

    if (!existingProduct) {
      return c.json({ success: false, error: 'Produkt nicht gefunden oder keine Berechtigung' }, 404);
    }

    // Delete product nutrients first (foreign key constraint)
    await c.env.DB.prepare(`
      DELETE FROM product_nutrients WHERE product_id = ?
    `).bind(productId).run();

    // Delete product
    const deleteResult = await c.env.DB.prepare(`
      DELETE FROM products WHERE id = ? AND user_id = ?
    `).bind(productId, userId).run();

    if (!deleteResult.success || deleteResult.changes === 0) {
      return c.json({ success: false, error: 'Fehler beim Löschen des Produkts' }, 500);
    }

    return c.json({
      success: true,
      message: 'Produkt erfolgreich gelöscht'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({ success: false, error: 'Fehler beim Löschen des Produkts' }, 500);
  }
});

// Dashboard endpoint
app.get('/api/protected/dashboard', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');

    // Get user stats
    const productCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM products WHERE user_id = ?
    `).bind(userId).first();

    const stackCount = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM stacks WHERE user_id = ?
    `).bind(userId).first();

    // Get recent products
    const recentProducts = await c.env.DB.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 5
    `).bind(userId).all();

    return c.json({
      success: true,
      data: {
        stats: {
          products: productCount?.count || 0,
          stacks: stackCount?.count || 0
        },
        recentProducts: recentProducts.results || []
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ success: false, error: 'Fehler beim Laden des Dashboards' }, 500);
  }
});

// Stacks API
app.get('/api/protected/stacks', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');

    const stacks = await c.env.DB.prepare(`
      SELECT * FROM stacks WHERE user_id = ? ORDER BY created_at DESC
    `).bind(userId).all();

    return c.json({ success: true, data: stacks.results || [] });
  } catch (error) {
    console.error('Get stacks error:', error);
    return c.json({ success: false, error: 'Fehler beim Laden der Stacks' }, 500);
  }
});

app.post('/api/protected/stacks', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentifizierung erforderlich' }, 401);
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');
    
    const { name, description } = await c.req.json();

    if (!name) {
      return c.json({ error: 'Stack-Name ist erforderlich' }, 400);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO stacks (user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).bind(userId, name, description || null).run();

    if (!result.success) {
      return c.json({ error: 'Fehler beim Erstellen des Stacks' }, 500);
    }

    return c.json({
      success: true,
      message: 'Stack erfolgreich erstellt',
      stack_id: result.meta.last_row_id
    });

  } catch (error) {
    console.error('Create stack error:', error);
    return c.json({ success: false, error: 'Fehler beim Erstellen des Stacks' }, 500);
  }
});

// Dashboard page
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
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                    </div>
                    <div class="hidden md:flex items-center space-x-4">
                        <a href="/dashboard" class="text-primary font-semibold">Dashboard</a>
                        <a href="/products" class="text-gray-600 hover:text-primary">Produkte</a>
                        <a href="/demo" class="text-gray-600 hover:text-primary">Demo</a>
                        <button id="logoutBtn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Abmelden</button>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>
            
            <!-- Stats Cards -->
            <div id="statsGrid" class="grid md:grid-cols-2 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-4"></i>
                        <div>
                            <p class="text-gray-600">Produkte</p>
                            <p id="productCount" class="text-2xl font-bold text-gray-800">-</p>
                        </div>
                    </div>
                </div>
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <div class="flex items-center">
                        <i class="fas fa-layer-group text-primary text-2xl mr-4"></i>
                        <div>
                            <p class="text-gray-600">Stacks</p>
                            <p id="stackCount" class="text-2xl font-bold text-gray-800">-</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Products -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">Neueste Produkte</h2>
                <div id="recentProducts" class="space-y-3">
                    <div class="text-gray-500">Lade Daten...</div>
                </div>
            </div>
        </div>

        <div id="message" class="hidden fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50"></div>

        <script>
        // Check authentication
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/auth';
        }

        function showMessage(text, type = 'info') {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = text;
            messageDiv.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ' + 
                (type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700');
            messageDiv.classList.remove('hidden');
            setTimeout(() => messageDiv.classList.add('hidden'), 3000);
        }

        async function loadDashboard() {
            try {
                const response = await fetch('/api/protected/dashboard', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                const data = await response.json();

                if (data.success) {
                    document.getElementById('productCount').textContent = data.data.stats.products;
                    document.getElementById('stackCount').textContent = data.data.stats.stacks;
                    
                    const recentProducts = data.data.recentProducts;
                    const container = document.getElementById('recentProducts');
                    
                    if (recentProducts.length === 0) {
                        container.innerHTML = '<div class="text-gray-500">Noch keine Produkte vorhanden. <a href="/products" class="text-primary hover:underline">Produkt hinzufügen</a></div>';
                    } else {
                        container.innerHTML = recentProducts.map(product => `
                            <div class="flex items-center justify-between p-3 border border-gray-200 rounded">
                                <div>
                                    <div class="font-medium">${product.name}</div>
                                    <div class="text-sm text-gray-500">${product.brand} - ${product.category_name || 'Keine Kategorie'}</div>
                                </div>
                                <div class="text-sm text-gray-400">
                                    ${new Date(product.created_at).toLocaleDateString('de-DE')}
                                </div>
                            </div>
                        `).join('');
                    }
                } else {
                    showMessage(data.error || 'Fehler beim Laden des Dashboards', 'error');
                }
            } catch (error) {
                showMessage('Fehler beim Laden des Dashboards', 'error');
            }
        }

        document.getElementById('logoutBtn').addEventListener('click', function() {
            localStorage.removeItem('authToken');
            window.location.href = '/';
        });

        // Load dashboard on page load
        loadDashboard();
        </script>
    </body>
    </html>
  `);
});

// Auth page
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
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <div>
                    <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary">
                        <i class="fas fa-pills text-white text-xl"></i>
                    </div>
                    <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Supplement Stack
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        Verwalte deine Supplements intelligent
                    </p>
                </div>

                <!-- Login Form -->
                <div id="loginForm" class="mt-8 space-y-6">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900 mb-4">Anmelden</h3>
                        <div class="space-y-4">
                            <div>
                                <input id="loginEmail" type="email" required
                                    class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary"
                                    placeholder="E-Mail-Adresse">
                            </div>
                            <div>
                                <input id="loginPassword" type="password" required
                                    class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary"
                                    placeholder="Passwort">
                            </div>
                        </div>
                    </div>

                    <div>
                        <button id="loginBtn" type="button"
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            Anmelden
                        </button>
                    </div>

                    <div class="text-center">
                        <button id="showRegister" class="text-primary hover:text-secondary">
                            Noch kein Konto? Hier registrieren
                        </button>
                    </div>
                </div>

                <!-- Register Form -->
                <div id="registerForm" class="mt-8 space-y-6 hidden">
                    <div>
                        <h3 class="text-lg font-medium text-gray-900 mb-4">Registrieren</h3>
                        <div class="space-y-4">
                            <div>
                                <input id="registerEmail" type="email" required
                                    class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary"
                                    placeholder="E-Mail-Adresse">
                            </div>
                            <div>
                                <input id="registerPassword" type="password" required
                                    class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary"
                                    placeholder="Passwort">
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <input id="age" type="number" placeholder="Alter"
                                    class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary">
                                <select id="gender"
                                    class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary">
                                    <option value="">Geschlecht</option>
                                    <option value="männlich">Männlich</option>
                                    <option value="weiblich">Weiblich</option>
                                    <option value="divers">Divers</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <button id="registerBtn" type="button"
                            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                            Registrieren
                        </button>
                    </div>

                    <div class="text-center">
                        <button id="showLogin" class="text-primary hover:text-secondary">
                            Bereits registriert? Hier anmelden
                        </button>
                    </div>
                </div>

                <div id="message" class="hidden mt-4 p-4 rounded-md"></div>
            </div>
        </div>

        <script>
        document.getElementById('showRegister').addEventListener('click', function() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        });

        document.getElementById('showLogin').addEventListener('click', function() {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        });

        function showMessage(text, type = 'info') {
            const messageDiv = document.getElementById('message');
            messageDiv.textContent = text;
            messageDiv.className = 'mt-4 p-4 rounded-md ' + (type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700');
            messageDiv.classList.remove('hidden');
        }

        document.getElementById('loginBtn').addEventListener('click', async function() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('authToken', data.token);
                    showMessage('Erfolgreich angemeldet! Weiterleitung...');
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);
                } else {
                    showMessage(data.error || 'Anmeldung fehlgeschlagen', 'error');
                }
            } catch (error) {
                showMessage('Fehler bei der Anmeldung', 'error');
            }
        });

        document.getElementById('registerBtn').addEventListener('click', async function() {
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const age = document.getElementById('age').value;
            const gender = document.getElementById('gender').value;

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, age, gender })
                });

                const data = await response.json();

                if (data.success) {
                    showMessage('Erfolgreich registriert! Sie können sich nun anmelden.');
                    document.getElementById('registerForm').classList.add('hidden');
                    document.getElementById('loginForm').classList.remove('hidden');
                } else {
                    showMessage(data.error || 'Registrierung fehlgeschlagen', 'error');
                }
            } catch (error) {
                showMessage('Fehler bei der Registrierung', 'error');
            }
        });
        </script>
    </body>
    </html>
  `);
});

// Demo page
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
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8">
            <h1 class="text-3xl font-bold text-center mb-8">Supplement Stack - Demo</h1>
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-xl font-semibold mb-4">Nährstoffbasiertes System</h2>
                <p class="text-gray-600 mb-4">Diese Demo zeigt das nährstoffbasierte Verwaltungssystem für Supplements.</p>
                
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="border rounded-lg p-4">
                        <h3 class="font-semibold text-lg mb-2">API-Endpunkte</h3>
                        <ul class="space-y-2">
                            <li><a href="/api/nutrients" class="text-blue-600 hover:underline">/api/nutrients</a> - Alle Nährstoffe</li>
                            <li><a href="/api/categories" class="text-blue-600 hover:underline">/api/categories</a> - Kategorien</li>
                            <li><a href="/api/health" class="text-blue-600 hover:underline">/api/health</a> - Status</li>
                        </ul>
                    </div>
                    
                    <div class="border rounded-lg p-4">
                        <h3 class="font-semibold text-lg mb-2">Features</h3>
                        <ul class="space-y-1 text-sm text-gray-600">
                            <li>✅ Nährstoff-Datenbank</li>
                            <li>✅ DGE & Studien-Empfehlungen</li>
                            <li>✅ Automatische Dosierungsberechnung</li>
                            <li>✅ Kategorie-Verwaltung</li>
                            <li>✅ Mobile-First Design</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="/static/demo-modal.js"></script>
    </body>
    </html>
  `);
});

// Main application page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Supplement Stack - Dein Supplement-Manager</title>
        <meta name="description" content="Verwalte deine Supplements intelligent. Erstelle Stacks, vermeide Überdosierungen und finde die besten Angebote.">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  primary: '#16a34a',
                  secondary: '#059669'
                }
              }
            }
          }
        </script>
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex justify-between items-center h-16">
                    <div class="flex items-center">
                        <i class="fas fa-pills text-primary text-2xl mr-2"></i>
                        <span class="text-xl font-bold text-gray-800">Supplement Stack</span>
                    </div>
                    <div class="hidden md:flex items-center space-x-4">
                        <a href="/demo" class="text-gray-600 hover:text-primary">Demo</a>
                        <a href="#products" class="text-gray-600 hover:text-primary">Produkte</a>
                        <a href="#stacks" class="text-gray-600 hover:text-primary">Stacks</a>
                        <a href="#dashboard" class="text-gray-600 hover:text-primary">Dashboard</a>
                        <button id="loginBtn" class="bg-primary text-white px-4 py-2 rounded hover:bg-secondary">Anmelden</button>
                        <button id="registerBtn" class="border border-primary text-primary px-4 py-2 rounded hover:bg-primary hover:text-white">Registrieren</button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <section class="bg-gradient-to-r from-primary to-secondary text-white py-20">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <h1 class="text-5xl font-bold mb-6">Verwalte deine Supplements intelligent</h1>
                <p class="text-xl mb-8">Erstelle personalisierte Supplement-Stacks, vermeide Überdosierungen und finde die besten Angebote.</p>
                <div class="space-x-4">
                    <a href="/demo" class="bg-white text-primary px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 inline-block">Demo testen</a>
                    <button id="getStartedBtn" class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-white hover:text-primary">Jetzt starten</button>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section class="py-20">
            <div class="max-w-7xl mx-auto px-4">
                <div class="text-center mb-16">
                    <h2 class="text-3xl font-bold text-gray-800 mb-4">Nährstoffbasierte Features</h2>
                    <p class="text-gray-600">Alles was du für dein intelligentes Supplement-Management brauchst</p>
                </div>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="text-center p-6">
                        <i class="fas fa-atom text-primary text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Nährstoffbasiert</h3>
                        <p class="text-gray-600">Produkte werden Wirkstoffen zugeordnet mit automatischer Dosierungsberechnung.</p>
                    </div>
                    <div class="text-center p-6">
                        <i class="fas fa-calculator text-primary text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">DGE-Integration</h3>
                        <p class="text-gray-600">Deutsche Gesellschaft für Ernährung Empfehlungen plus aktuelle Studiendaten.</p>
                    </div>
                    <div class="text-center p-6">
                        <i class="fas fa-mobile-alt text-primary text-4xl mb-4"></i>
                        <h3 class="text-xl font-semibold mb-2">Mobile-First</h3>
                        <p class="text-gray-600">Vollständig optimiert für Smartphones mit Touch-freundlichen Bedienelementen.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="bg-gray-100 py-20">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">Bereit für intelligentes Supplement-Management?</h2>
                <p class="text-xl text-gray-600 mb-8">Teste jetzt die nährstoffbasierte Demo oder starte direkt durch!</p>
                <div class="space-x-4">
                    <a href="/demo" class="bg-primary text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-secondary inline-block">Demo starten</a>
                    <button id="signupBtn" class="border-2 border-primary text-primary px-8 py-3 rounded-lg font-semibold text-lg hover:bg-primary hover:text-white">Kostenlos registrieren</button>
                </div>
            </div>
        </section>

        <script>
        // Simple navigation handlers
        document.getElementById('loginBtn')?.addEventListener('click', () => {
            window.location.href = '/auth';
        });
        
        document.getElementById('registerBtn')?.addEventListener('click', () => {
            window.location.href = '/auth';
        });
        
        document.getElementById('getStartedBtn')?.addEventListener('click', () => {
            window.location.href = '/demo';
        });
        
        document.getElementById('signupBtn')?.addEventListener('click', () => {
            window.location.href = '/auth';
        });
        </script>
    </body>
    </html>
  `);
});

export default app