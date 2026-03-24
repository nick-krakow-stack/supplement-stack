import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import type { Context } from 'hono'

type Env = {
  DB: D1Database
  JWT_SECRET: string
  DEMO_SESSION_TTL_MINUTES: string
}
type Variables = { user: { userId: number; email: string; role: string } }
type AppContext = { Bindings: Env; Variables: Variables }

const app = new Hono<AppContext>()

app.use('*', cors())

// ---------------------------------------------------------------------------
// Password helpers (Web Crypto PBKDF2)
// ---------------------------------------------------------------------------

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored?.startsWith('pbkdf2:')) return false
  const [, saltHex, hashHex] = stored.split(':')
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16)))
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  const newHash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('')
  return newHash === hashHex
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function ensureAuth(c: Context<AppContext>): Promise<Response | null> {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized' }, 401) as never
  try {
    const payload = await verify(header.slice(7), c.env.JWT_SECRET) as Variables['user']
    c.set('user', payload)
    return null
  } catch {
    return c.json({ error: 'Unauthorized' }, 401) as never
  }
}

function requireAdmin(c: Context<AppContext>): Response | null {
  const user = c.get('user')
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403) as never
  return null
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

type UserRow = {
  id: number
  email: string
  password_hash: string
  age: number | null
  gender: string | null
  weight: number | null
  diet: string | null
  goals: string | null
  guideline_source: string | null
  role: string
  created_at: string
}

type IngredientRow = {
  id: number
  name: string
  unit: string | null
  description: string | null
  hypo_symptoms: string | null
  hyper_symptoms: string | null
  external_url: string | null
  created_at: string
}

type ProductRow = {
  id: number
  name: string
  brand: string | null
  form: string | null
  price: number
  shop_link: string | null
  image_url: string | null
  moderation_status: string
  visibility: string
  created_at: string
}

type StackRow = {
  id: number
  user_id: number
  name: string
  created_at: string
}

type StackItemRow = {
  id: number
  stack_id: number
  product_id: number
  quantity: number
  product_name: string
  product_price: number
}

type InteractionRow = {
  id: number
  ingredient_a_id: number
  ingredient_b_id: number
  type: string | null
  comment: string | null
}

type DemoSessionRow = {
  id: number
  key: string
  stack_json: string | null
  expires_at: string | null
  created_at: string
}

type CountRow = { count: number }


// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (c) => {
  const body = await c.req.json()
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@'))
    return c.json({ error: 'Valid email required' }, 400)
  if (!body.password || typeof body.password !== 'string' || body.password.length < 8)
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  const data = body as { email: string; password: string; age?: number; gender?: string; weight?: number; diet?: string; goals?: string; guideline_source?: string }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(data.email).first<{ id: number }>()
  if (existing) return c.json({ error: 'E-Mail already exists' }, 409)

  const password_hash = await hashPassword(data.password)
  const result = await c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, age, gender, weight, diet, goals, guideline_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.email,
    password_hash,
    data.age ?? null,
    data.gender ?? null,
    data.weight ?? null,
    data.diet ?? null,
    data.goals ?? null,
    data.guideline_source ?? null,
  ).run()

  const userId = result.meta.last_row_id
  const token = await sign(
    { userId, email: data.email, role: 'user', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    c.env.JWT_SECRET,
  )
  return c.json({ token })
})

// POST /api/auth/login
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json()
  if (!body.email || typeof body.email !== 'string') return c.json({ error: 'Email required' }, 400)
  if (!body.password || typeof body.password !== 'string') return c.json({ error: 'Password required' }, 400)
  const data = body as { email: string; password: string }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(data.email).first<UserRow>()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(data.password, user.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const token = await sign(
    { userId: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 },
    c.env.JWT_SECRET,
  )
  return c.json({
    token,
    profile: {
      id: user.id,
      email: user.email,
      age: user.age,
      gender: user.gender,
      weight: user.weight,
      diet: user.diet,
      goals: user.goals,
      guideline_source: user.guideline_source,
      role: user.role,
    },
  })
})

// GET /api/me
app.get('/api/me', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const profile = await c.env.DB.prepare(
    'SELECT id, email, age, gender, weight, diet, goals, guideline_source, role FROM users WHERE id = ?'
  ).bind(user.userId).first()
  return c.json({ profile })
})

// PUT /api/me
app.put('/api/me', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const body = await c.req.json()
  const data = body as { age?: number; gender?: string; weight?: number; diet?: string; goals?: string; guideline_source?: string }
  await c.env.DB.prepare(`
    UPDATE users SET
      age = COALESCE(?, age),
      gender = COALESCE(?, gender),
      weight = COALESCE(?, weight),
      diet = COALESCE(?, diet),
      goals = COALESCE(?, goals),
      guideline_source = COALESCE(?, guideline_source)
    WHERE id = ?
  `).bind(
    data.age ?? null,
    data.gender ?? null,
    data.weight ?? null,
    data.diet ?? null,
    data.goals ?? null,
    data.guideline_source ?? null,
    user.userId,
  ).run()
  const updated = await c.env.DB.prepare(
    'SELECT id, email, age, gender, weight, diet, goals, guideline_source, role FROM users WHERE id = ?'
  ).bind(user.userId).first()
  return c.json({ profile: updated })
})

// GET /api/ingredients
app.get('/api/ingredients', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM ingredients').all<IngredientRow>()
  return c.json({ ingredients: results })
})

// GET /api/ingredients/search
app.get('/api/ingredients/search', async (c) => {
  const q = (c.req.query('q') || '').trim()
  if (!q) return c.json({ ingredients: [] })
  const { results: byName } = await c.env.DB.prepare(
    'SELECT * FROM ingredients WHERE name LIKE ?'
  ).bind(`%${q}%`).all<IngredientRow>()
  const { results: bySynonym } = await c.env.DB.prepare(
    'SELECT i.* FROM ingredients i JOIN ingredient_synonyms s ON s.ingredient_id = i.id WHERE s.synonym LIKE ?'
  ).bind(`%${q}%`).all<IngredientRow>()
  const merged = [...byName, ...bySynonym]
  const unique = Array.from(new Map(merged.map(i => [i.id, i])).values()).slice(0, 10)
  if (unique.length === 0) return c.json({ ingredients: [] })
  // Fetch synonyms for all matched ingredients in a single query
  const ids = unique.map(i => i.id)
  const placeholders = ids.map(() => '?').join(',')
  const { results: allSynonyms } = await c.env.DB.prepare(
    `SELECT ingredient_id, synonym FROM ingredient_synonyms WHERE ingredient_id IN (${placeholders})`
  ).bind(...ids).all<{ ingredient_id: number; synonym: string }>()
  const synMap: Record<number, Array<{ synonym: string }>> = {}
  for (const s of allSynonyms) {
    if (!synMap[s.ingredient_id]) synMap[s.ingredient_id] = []
    synMap[s.ingredient_id].push({ synonym: s.synonym })
  }
  const ingredients = unique.map(i => ({ ...i, synonyms: synMap[i.id] ?? [] }))
  return c.json({ ingredients })
})

// GET /api/ingredients/:id
app.get('/api/ingredients/:id', async (c) => {
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first<IngredientRow>()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const { results: synonyms } = await c.env.DB.prepare(
    'SELECT * FROM ingredient_synonyms WHERE ingredient_id = ?'
  ).bind(id).all()
  const { results: forms } = await c.env.DB.prepare(
    'SELECT * FROM ingredient_forms WHERE ingredient_id = ?'
  ).bind(id).all()
  return c.json({ ingredient, synonyms, forms })
})

// GET /api/ingredients/:id/products
app.get('/api/ingredients/:id/products', async (c) => {
  const id = c.req.param('id')
  const { results: products } = await c.env.DB.prepare(`
    SELECT p.*, pi.quantity, pi.unit
    FROM products p
    JOIN product_ingredients pi ON pi.product_id = p.id
    WHERE pi.ingredient_id = ? AND p.visibility = 'public'
    ORDER BY pi.is_main DESC, p.name ASC
  `).bind(id).all()
  return c.json({ products })
})

// POST /api/ingredients (admin only)
app.post('/api/ingredients', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch (e) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  const result = await c.env.DB.prepare(
    'INSERT INTO ingredients (name, unit, description, hypo_symptoms, hyper_symptoms, external_url) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    body.name,
    (body.unit as string) || null,
    (body.description as string) || null,
    (body.hypo_symptoms as string) || null,
    (body.hyper_symptoms as string) || null,
    (body.external_url as string) || null,
  ).run()
  return c.json({ id: result.meta.last_row_id })
})

// PUT /api/ingredients/:id (admin only)
app.put('/api/ingredients/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(id).first()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  const data = body as { name?: string; unit?: string; description?: string; hypo_symptoms?: string; hyper_symptoms?: string; external_url?: string }
  await c.env.DB.prepare(`
    UPDATE ingredients SET
      name = COALESCE(?, name),
      unit = COALESCE(?, unit),
      description = COALESCE(?, description),
      hypo_symptoms = COALESCE(?, hypo_symptoms),
      hyper_symptoms = COALESCE(?, hyper_symptoms),
      external_url = COALESCE(?, external_url)
    WHERE id = ?
  `).bind(
    data.name ?? null,
    data.unit ?? null,
    data.description ?? null,
    data.hypo_symptoms ?? null,
    data.hyper_symptoms ?? null,
    data.external_url ?? null,
    id,
  ).run()
  const updated = await c.env.DB.prepare('SELECT * FROM ingredients WHERE id = ?').bind(id).first()
  return c.json({ ingredient: updated })
})

// POST /api/ingredients/:id/synonyms (admin only)
app.post('/api/ingredients/:id/synonyms', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(id).first()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (!body.synonym || typeof body.synonym !== 'string' || body.synonym.trim().length === 0)
    return c.json({ error: 'synonym is required' }, 400)
  const result = await c.env.DB.prepare(
    'INSERT INTO ingredient_synonyms (ingredient_id, synonym) VALUES (?, ?)'
  ).bind(id, body.synonym).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/ingredients/:id/synonyms/:synId (admin only)
app.delete('/api/ingredients/:id/synonyms/:synId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const synId = c.req.param('synId')
  const syn = await c.env.DB.prepare(
    'SELECT id FROM ingredient_synonyms WHERE id = ? AND ingredient_id = ?'
  ).bind(synId, id).first()
  if (!syn) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM ingredient_synonyms WHERE id = ?').bind(synId).run()
  return c.json({ ok: true })
})

// POST /api/ingredients/:id/forms (admin only)
app.post('/api/ingredients/:id/forms', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(id).first()
  if (!ingredient) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0)
    return c.json({ error: 'name is required' }, 400)
  const data = body as { name: string; comment?: string; tags?: string; score?: number }
  const result = await c.env.DB.prepare(
    'INSERT INTO ingredient_forms (ingredient_id, name, comment, tags, score) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, data.name, data.comment ?? null, data.tags ?? null, data.score ?? 0).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/ingredients/:id/forms/:formId (admin only)
app.delete('/api/ingredients/:id/forms/:formId', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const formId = c.req.param('formId')
  const form = await c.env.DB.prepare(
    'SELECT id FROM ingredient_forms WHERE id = ? AND ingredient_id = ?'
  ).bind(formId, id).first()
  if (!form) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM ingredient_forms WHERE id = ?').bind(formId).run()
  return c.json({ ok: true })
})

// GET /api/recommendations?ingredient_id=x
app.get('/api/recommendations', async (c) => {
  const ingredientId = c.req.query('ingredient_id')
  if (!ingredientId) return c.json({ error: 'ingredient_id query param required' }, 400)
  const { results: recommendations } = await c.env.DB.prepare(`
    SELECT r.*, p.name as product_name, p.brand as product_brand, p.price as product_price,
           p.shop_link as product_shop_link, p.image_url as product_image_url,
           p.moderation_status, p.visibility
    FROM recommendations r
    JOIN products p ON p.id = r.product_id
    WHERE r.ingredient_id = ?
  `).bind(ingredientId).all()
  return c.json({ recommendations })
})

// POST /api/recommendations (admin only)
app.post('/api/recommendations', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const body = await c.req.json()
  if (!body.ingredient_id || !body.product_id) return c.json({ error: 'ingredient_id and product_id are required' }, 400)
  if (!['recommended', 'alternative'].includes(body.type as string)) return c.json({ error: 'type must be recommended or alternative' }, 400)
  const data = body as { ingredient_id: number; product_id: number; type: string }
  const ingredient = await c.env.DB.prepare('SELECT id FROM ingredients WHERE id = ?').bind(data.ingredient_id).first()
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404)
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(data.product_id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  const result = await c.env.DB.prepare(
    'INSERT INTO recommendations (ingredient_id, product_id, type) VALUES (?, ?, ?)'
  ).bind(data.ingredient_id, data.product_id, data.type).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// DELETE /api/recommendations/:id (admin only)
app.delete('/api/recommendations/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const rec = await c.env.DB.prepare('SELECT id FROM recommendations WHERE id = ?').bind(id).first()
  if (!rec) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM recommendations WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// GET /api/products
app.get('/api/products', async (c) => {
  const { results: products } = await c.env.DB.prepare(
    `SELECT * FROM products WHERE visibility = 'public' OR visibility = 'hidden'`
  ).all<ProductRow>()
  return c.json({ products })
})

// GET /api/products/:id
app.get('/api/products/:id', async (c) => {
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const { results: ingredients } = await c.env.DB.prepare(`
    SELECT pi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           i.description as ingredient_description
    FROM product_ingredients pi
    JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = ?
  `).bind(id).all()
  const { results: recommendations } = await c.env.DB.prepare(
    'SELECT r.* FROM recommendations r WHERE r.product_id = ?'
  ).bind(id).all()
  return c.json({ product, ingredients, recommendations })
})

// POST /api/products
app.post('/api/products', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const body = await c.req.json()
  if (!body.name || !body.price) return c.json({ error: 'Required fields missing' }, 400)
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return c.json({ error: 'At least one main ingredient required' }, 400)
  }
  const mainIngredient = (body.ingredients as Array<Record<string, unknown>>).find(i => i.is_main)
  if (!mainIngredient) return c.json({ error: 'Main ingredient required' }, 400)

  const dup = await c.env.DB.prepare(
    'SELECT id FROM products WHERE name = ? AND brand = ?'
  ).bind(body.name, body.brand || null).first()
  if (dup) return c.json({ error: 'Duplicate product detected' }, 409)

  const result = await c.env.DB.prepare(
    'INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    body.name,
    body.brand || null,
    body.form || null,
    body.price,
    body.shop_link || null,
    body.image_url || null,
    'pending',
    'hidden',
  ).run()
  const productId = result.meta.last_row_id

  for (const ing of body.ingredients as Array<Record<string, unknown>>) {
    await c.env.DB.prepare(
      'INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit, form_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      productId,
      ing.ingredient_id,
      ing.is_main ? 1 : 0,
      ing.quantity || null,
      ing.unit || null,
      ing.form_id || null,
    ).run()
  }

  return c.json({ productId })
})

// PUT /api/products/:id (admin only)
app.put('/api/products/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const data = body as { name?: string; brand?: string; form?: string; price?: number; shop_link?: string; image_url?: string }
  await c.env.DB.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = COALESCE(?, shop_link),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).bind(
    data.name ?? null,
    data.brand ?? null,
    data.form ?? null,
    data.price ?? null,
    data.shop_link ?? null,
    data.image_url ?? null,
    id,
  ).run()
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  return c.json({ product: updated })
})

// PUT /api/products/:id/status (admin only)
app.put('/api/products/:id/status', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json()
  if (body.moderation_status && !['pending', 'approved', 'rejected'].includes(body.moderation_status as string))
    return c.json({ error: 'Invalid moderation_status' }, 400)
  if (body.visibility && !['public', 'hidden'].includes(body.visibility as string))
    return c.json({ error: 'Invalid visibility' }, 400)
  const data = body as { moderation_status?: string; visibility?: string }
  await c.env.DB.prepare(`
    UPDATE products SET
      moderation_status = COALESCE(?, moderation_status),
      visibility = COALESCE(?, visibility)
    WHERE id = ?
  `).bind(data.moderation_status ?? null, data.visibility ?? null, id).run()
  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  return c.json({ product: updated })
})

// GET /api/admin/products (admin only)
app.get('/api/admin/products', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const { results: products } = await c.env.DB.prepare(
    'SELECT * FROM products ORDER BY created_at DESC'
  ).all<ProductRow>()
  return c.json({ products })
})

// GET /api/stacks
app.get('/api/stacks', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results: stacks } = await c.env.DB.prepare(`
    SELECT s.*, COUNT(si.id) as items_count
    FROM stacks s
    LEFT JOIN stack_items si ON si.stack_id = s.id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).bind(user.userId).all()
  return c.json({ stacks })
})

// POST /api/stacks
app.post('/api/stacks', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!data.name) return c.json({ error: 'Stack-Name ist erforderlich' }, 400)
  const stackResult = await c.env.DB.prepare(
    'INSERT INTO stacks (user_id, name) VALUES (?, ?)'
  ).bind(user.userId, data.name).run()
  const stackId = stackResult.meta.last_row_id

  const items: Array<Record<string, unknown>> = Array.isArray(data.product_ids)
    ? (data.product_ids as Array<Record<string, unknown>>)
    : Array.isArray(data.products)
      ? (data.products as number[]).map(id => ({ id, quantity: 1 }))
      : []

  for (const item of items) {
    await c.env.DB.prepare(
      'INSERT INTO stack_items (stack_id, product_id, quantity) VALUES (?, ?, ?)'
    ).bind(stackId, item.id, item.quantity || 1).run()
  }
  return c.json({ id: stackId, name: data.name })
})

// GET /api/stacks/:id
app.get('/api/stacks/:id', async (c) => {
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(c.req.param('id')).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  const { results: items } = await c.env.DB.prepare(
    'SELECT si.*, p.name as product_name, p.price as product_price FROM stack_items si JOIN products p ON p.id = si.product_id WHERE si.stack_id = ?'
  ).bind(stack.id).all<StackItemRow>()
  const total = items.reduce((sum, i) => sum + (i.product_price * i.quantity), 0)
  return c.json({ stack, items, total })
})

// DELETE /api/stacks/:id
app.delete('/api/stacks/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM stacks WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// PUT /api/stacks/:id
app.put('/api/stacks/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = c.req.param('id')
  const stack = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first<StackRow>()
  if (!stack) return c.json({ error: 'Not found' }, 404)
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  const data = body as { name?: string; product_ids?: Array<{ id: number; quantity?: number }> }
  if (data.name) {
    await c.env.DB.prepare('UPDATE stacks SET name = ? WHERE id = ?').bind(data.name, id).run()
  }
  if (data.product_ids !== undefined) {
    await c.env.DB.prepare('DELETE FROM stack_items WHERE stack_id = ?').bind(id).run()
    for (const item of data.product_ids) {
      await c.env.DB.prepare(
        'INSERT INTO stack_items (stack_id, product_id, quantity) VALUES (?, ?, ?)'
      ).bind(id, item.id, item.quantity || 1).run()
    }
  }
  const updated = await c.env.DB.prepare('SELECT * FROM stacks WHERE id = ?').bind(id).first()
  const { results: items } = await c.env.DB.prepare(
    'SELECT si.*, p.name as product_name, p.price as product_price FROM stack_items si JOIN products p ON p.id = si.product_id WHERE si.stack_id = ?'
  ).bind(id).all()
  return c.json({ stack: updated, items })
})

// GET /api/stack-warnings/:id
app.get('/api/stack-warnings/:id', async (c) => {
  const id = c.req.param('id')
  const { results: items } = await c.env.DB.prepare(
    'SELECT pi.ingredient_id FROM stack_items si JOIN product_ingredients pi ON pi.product_id = si.product_id WHERE si.stack_id = ?'
  ).bind(id).all<{ ingredient_id: number }>()
  const ingredientIds = [...new Set(items.map(i => i.ingredient_id))]
  const warnings = []
  for (let a = 0; a < ingredientIds.length; a++) {
    for (let b = a + 1; b < ingredientIds.length; b++) {
      const inter = await c.env.DB.prepare(
        'SELECT * FROM interactions WHERE (ingredient_a_id = ? AND ingredient_b_id = ?) OR (ingredient_a_id = ? AND ingredient_b_id = ?)'
      ).bind(ingredientIds[a], ingredientIds[b], ingredientIds[b], ingredientIds[a]).first<InteractionRow>()
      if (inter) warnings.push(inter)
    }
  }
  return c.json({ warnings })
})

// GET /api/wishlist
app.get('/api/wishlist', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results: wishlist } = await c.env.DB.prepare(`
    SELECT w.id, w.created_at, p.*
    FROM wishlist w
    JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).bind(user.userId).all()
  return c.json({ wishlist })
})

// POST /api/wishlist
app.post('/api/wishlist', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const body = await c.req.json()
  if (!body.product_id || typeof body.product_id !== 'number') return c.json({ error: 'product_id is required' }, 400)
  const { product_id } = body as { product_id: number }
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(product_id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)'
    ).bind(user.userId, product_id).run()
    return c.json({ id: result.meta.last_row_id }, 201)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('UNIQUE')) return c.json({ error: 'Already in wishlist' }, 409)
    return c.json({ error: msg }, 400)
  }
})

// DELETE /api/wishlist/:product_id
app.delete('/api/wishlist/:product_id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const product_id = c.req.param('product_id')
  const entry = await c.env.DB.prepare(
    'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?'
  ).bind(user.userId, product_id).first()
  if (!entry) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').bind(user.userId, product_id).run()
  return c.json({ ok: true })
})

// GET /api/interactions
app.get('/api/interactions', async (c) => {
  const { results: interactions } = await c.env.DB.prepare(`
    SELECT ix.*,
           ia.name as ingredient_a_name,
           ib.name as ingredient_b_name
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_a_id
    JOIN ingredients ib ON ib.id = ix.ingredient_b_id
    ORDER BY ix.id DESC
  `).all()
  return c.json({ interactions })
})

// POST /api/interactions (admin only)
app.post('/api/interactions', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  if (!data.ingredient_a_id || !data.ingredient_b_id) return c.json({ error: 'Missing fields' }, 400)
  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES (?, ?, ?, ?)'
  ).bind(
    data.ingredient_a_id,
    data.ingredient_b_id,
    (data.type as string) || 'avoid',
    (data.comment as string) || null,
  ).run()
  return c.json({ ok: true })
})

// DELETE /api/interactions/:id (admin only)
app.delete('/api/interactions/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const id = c.req.param('id')
  const interaction = await c.env.DB.prepare('SELECT id FROM interactions WHERE id = ?').bind(id).first()
  if (!interaction) return c.json({ error: 'Not found' }, 404)
  await c.env.DB.prepare('DELETE FROM interactions WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// GET /api/admin/stats (admin only)
app.get('/api/admin/stats', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const admErr = requireAdmin(c)
  if (admErr) return admErr
  const usersRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<CountRow>()
  const ingredientsRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM ingredients').first<CountRow>()
  const productsRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products').first<CountRow>()
  const stacksRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM stacks').first<CountRow>()
  const pendingRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM products WHERE moderation_status = 'pending'`
  ).first<CountRow>()
  return c.json({
    users: usersRow?.count ?? 0,
    ingredients: ingredientsRow?.count ?? 0,
    products: productsRow?.count ?? 0,
    stacks: stacksRow?.count ?? 0,
    pending_products: pendingRow?.count ?? 0,
  })
})

// POST /api/demo/sessions
app.post('/api/demo/sessions', async (c) => {
  let data: Record<string, unknown>
  try {
    data = await c.req.json()
  } catch {
    data = {}
  }
  const DEMO_TTL = Number(c.env.DEMO_SESSION_TTL_MINUTES || '1440')
  const key = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + DEMO_TTL * 60 * 1000).toISOString()
  await c.env.DB.prepare(
    'INSERT INTO demo_sessions (key, stack_json, expires_at) VALUES (?, ?, ?)'
  ).bind(key, JSON.stringify(data.stack || []), expiresAt).run()
  return c.json({ key, expiresAt })
})

// GET /api/demo/sessions/:key
app.get('/api/demo/sessions/:key', async (c) => {
  const session = await c.env.DB.prepare(
    'SELECT * FROM demo_sessions WHERE key = ? AND expires_at > ?'
  ).bind(c.req.param('key'), new Date().toISOString()).first<DemoSessionRow>()
  if (!session) return c.json({ error: 'Not found or expired' }, 404)
  return c.json({ stack: JSON.parse(session.stack_json || '[]'), expires_at: session.expires_at })
})

// GET /api/demo/reset
app.get('/api/demo/reset', async (c) => {
  await c.env.DB.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
  return c.json({ ok: true })
})

export const onRequest = handle(app)
