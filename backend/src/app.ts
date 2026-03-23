import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static.module';
import { db, runMigrations } from './db.js';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = new Hono();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEMO_TTL = Number(process.env.DEMO_SESSION_TTL_MINUTES || '1440');

runMigrations();

type HonoContext = Parameters<Parameters<typeof app.get>[1]>[0];

function ensureAuth(c: HonoContext) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'Unauthorized'}, 401);
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return c.set('user', payload);
  } catch (e) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}

function requireAdmin(c: HonoContext) {
  const user = c.get('user');
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  return c;
}

app.get('/', (c) => c.text('Supplement Stack Backend'));

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8), age: z.number().optional(), gender: z.string().optional(), weight: z.number().optional(), diet: z.string().optional(), goals: z.string().optional(), guideline_source: z.string().optional() });

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
  if (existing) return c.json({ error: 'E-Mail already exists' }, 409);

  const password_hash = await argon2.hash(data.password);
  const stmt = db.prepare(`INSERT INTO users (email, password_hash, age, gender, weight, diet, goals, guideline_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const info = stmt.run(data.email, password_hash, data.age ?? null, data.gender ?? null, data.weight ?? null, data.diet ?? null, data.goals ?? null, data.guideline_source ?? null);

  const token = jwt.sign({ userId: info.lastInsertRowid, email: data.email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  return c.json({ token });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email) as Record<string, unknown> | undefined;
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const valid = await argon2.verify(user.password_hash as string, data.password);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return c.json({ token, profile: { id: user.id, email: user.email, age: user.age, gender: user.gender, weight: user.weight, diet: user.diet, goals: user.goals, guideline_source: user.guideline_source, role: user.role }});
});

app.get('/api/me', (c) => {
  const auth = ensureAuth(c);
  if (auth instanceof Response) return auth;
  const user = c.get('user');
  const value = db.prepare('SELECT id, email, age, gender, weight, diet, goals, guideline_source, role FROM users WHERE id = ?').get(user.userId);
  return c.json({ profile: value });
});

// PUT /api/me – update own profile
const updateProfileSchema = z.object({
  age: z.number().optional(),
  gender: z.string().optional(),
  weight: z.number().optional(),
  diet: z.string().optional(),
  goals: z.string().optional(),
  guideline_source: z.string().optional(),
});

app.put('/api/me', async (c) => {
  const auth = ensureAuth(c);
  if (auth instanceof Response) return auth;
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  db.prepare(`
    UPDATE users SET
      age = COALESCE(?, age),
      gender = COALESCE(?, gender),
      weight = COALESCE(?, weight),
      diet = COALESCE(?, diet),
      goals = COALESCE(?, goals),
      guideline_source = COALESCE(?, guideline_source)
    WHERE id = ?
  `).run(
    data.age ?? null,
    data.gender ?? null,
    data.weight ?? null,
    data.diet ?? null,
    data.goals ?? null,
    data.guideline_source ?? null,
    user.userId,
  );
  const updated = db.prepare('SELECT id, email, age, gender, weight, diet, goals, guideline_source, role FROM users WHERE id = ?').get(user.userId);
  return c.json({ profile: updated });
});

app.get('/api/ingredients', (c) => {
  const all = db.prepare('SELECT * FROM ingredients').all();
  return c.json({ ingredients: all });
});

app.get('/api/ingredients/search', (c) => {
  const q = (c.req.query('q') || '').trim();
  if (!q) return c.json({ ingredients: [] });
  const ingredients = db.prepare("SELECT * FROM ingredients WHERE name LIKE ?").all(`%${q}%`);
  const synonyms = db.prepare("SELECT i.* FROM ingredients i JOIN ingredient_synonyms s ON s.ingredient_id=i.id WHERE s.synonym LIKE ?").all(`%${q}%`);
  const merged = [...ingredients, ...synonyms];
  const unique = Array.from(new Map(merged.map((i) => [(i as Record<string, unknown>).id, i])).values());
  return c.json({ ingredients: unique });
});

// GET /api/ingredients/:id – get single ingredient with synonyms and forms
app.get('/api/ingredients/:id', (c) => {
  const id = c.req.param('id');
  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  if (!ingredient) return c.json({ error: 'Not found' }, 404);
  const synonyms = db.prepare('SELECT * FROM ingredient_synonyms WHERE ingredient_id = ?').all(id);
  const forms = db.prepare('SELECT * FROM ingredient_forms WHERE ingredient_id = ?').all(id);
  return c.json({ ingredient, synonyms, forms });
});

app.get('/api/ingredients/:id/products', (c: HonoContext) => {
  const id = c.req.param('id');
  const products = db.prepare(`
    SELECT p.*, pi.quantity, pi.unit
    FROM products p
    JOIN product_ingredients pi ON pi.product_id = p.id
    WHERE pi.ingredient_id = ? AND p.visibility = 'public'
    ORDER BY pi.is_main DESC, p.name ASC
  `).all(id);
  return c.json({ products });
});

app.post('/api/ingredients', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  const payload = c.req.json();
  return payload.then((body) => {
    const insert = db.prepare('INSERT INTO ingredients (name, unit, description, hypo_symptoms, hyper_symptoms, external_url) VALUES (?, ?, ?, ?, ?, ?)');
    const info = insert.run(body.name, body.unit || null, body.description || null, body.hypo_symptoms || null, body.hyper_symptoms || null, body.external_url || null);
    return c.json({ id: info.lastInsertRowid });
  }).catch((e: Error) => c.json({ error: e.message }, 400));
});

// PUT /api/ingredients/:id – update ingredient (admin only)
const updateIngredientSchema = z.object({
  name: z.string().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  hypo_symptoms: z.string().optional(),
  hyper_symptoms: z.string().optional(),
  external_url: z.string().optional(),
});

app.put('/api/ingredients/:id', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const id = c.req.param('id');
  const ingredient = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(id);
  if (!ingredient) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json();
  const parsed = updateIngredientSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  db.prepare(`
    UPDATE ingredients SET
      name = COALESCE(?, name),
      unit = COALESCE(?, unit),
      description = COALESCE(?, description),
      hypo_symptoms = COALESCE(?, hypo_symptoms),
      hyper_symptoms = COALESCE(?, hyper_symptoms),
      external_url = COALESCE(?, external_url)
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.unit ?? null,
    data.description ?? null,
    data.hypo_symptoms ?? null,
    data.hyper_symptoms ?? null,
    data.external_url ?? null,
    id,
  );
  const updated = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  return c.json({ ingredient: updated });
});

// POST /api/ingredients/:id/synonyms – add synonym (admin only)
const synonymSchema = z.object({ synonym: z.string().min(1) });

app.post('/api/ingredients/:id/synonyms', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const id = c.req.param('id');
  const ingredient = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(id);
  if (!ingredient) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json();
  const parsed = synonymSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const info = db.prepare('INSERT INTO ingredient_synonyms (ingredient_id, synonym) VALUES (?, ?)').run(id, parsed.data.synonym);
  return c.json({ id: info.lastInsertRowid }, 201);
});

// DELETE /api/ingredients/:id/synonyms/:synId – delete synonym (admin only)
app.delete('/api/ingredients/:id/synonyms/:synId', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const { id, synId } = c.req.param();
  const syn = db.prepare('SELECT id FROM ingredient_synonyms WHERE id = ? AND ingredient_id = ?').get(synId, id);
  if (!syn) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM ingredient_synonyms WHERE id = ?').run(synId);
  return c.json({ ok: true });
});

// POST /api/ingredients/:id/forms – add form (admin only)
const formSchema = z.object({
  name: z.string().min(1),
  comment: z.string().optional(),
  tags: z.string().optional(),
  score: z.number().optional(),
});

app.post('/api/ingredients/:id/forms', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const id = c.req.param('id');
  const ingredient = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(id);
  if (!ingredient) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json();
  const parsed = formSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  const info = db.prepare('INSERT INTO ingredient_forms (ingredient_id, name, comment, tags, score) VALUES (?, ?, ?, ?, ?)').run(
    id, data.name, data.comment ?? null, data.tags ?? null, data.score ?? 0,
  );
  return c.json({ id: info.lastInsertRowid }, 201);
});

// DELETE /api/ingredients/:id/forms/:formId – delete form (admin only)
app.delete('/api/ingredients/:id/forms/:formId', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const { id, formId } = c.req.param();
  const form = db.prepare('SELECT id FROM ingredient_forms WHERE id = ? AND ingredient_id = ?').get(formId, id);
  if (!form) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM ingredient_forms WHERE id = ?').run(formId);
  return c.json({ ok: true });
});

// GET /api/recommendations?ingredient_id=x
app.get('/api/recommendations', (c) => {
  const ingredientId = c.req.query('ingredient_id');
  if (!ingredientId) return c.json({ error: 'ingredient_id query param required' }, 400);
  const recommendations = db.prepare(`
    SELECT r.*, p.name as product_name, p.brand as product_brand, p.price as product_price,
           p.shop_link as product_shop_link, p.image_url as product_image_url,
           p.moderation_status, p.visibility
    FROM recommendations r
    JOIN products p ON p.id = r.product_id
    WHERE r.ingredient_id = ?
  `).all(ingredientId);
  return c.json({ recommendations });
});

// POST /api/recommendations – create (admin only)
const recommendationSchema = z.object({
  ingredient_id: z.number(),
  product_id: z.number(),
  type: z.enum(['recommended', 'alternative']),
});

app.post('/api/recommendations', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const body = await c.req.json();
  const parsed = recommendationSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  const ingredient = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(data.ingredient_id);
  if (!ingredient) return c.json({ error: 'Ingredient not found' }, 404);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(data.product_id);
  if (!product) return c.json({ error: 'Product not found' }, 404);
  const info = db.prepare('INSERT INTO recommendations (ingredient_id, product_id, type) VALUES (?, ?, ?)').run(data.ingredient_id, data.product_id, data.type);
  return c.json({ id: info.lastInsertRowid }, 201);
});

// DELETE /api/recommendations/:id – delete (admin only)
app.delete('/api/recommendations/:id', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const id = c.req.param('id');
  const rec = db.prepare('SELECT id FROM recommendations WHERE id = ?').get(id);
  if (!rec) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM recommendations WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// GET /api/products/:id – get product details with all ingredients and recommendations
app.get('/api/products/:id', (c) => {
  const id = c.req.param('id');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return c.json({ error: 'Not found' }, 404);
  const ingredients = db.prepare(`
    SELECT pi.*, i.name as ingredient_name, i.unit as ingredient_unit,
           i.description as ingredient_description
    FROM product_ingredients pi
    JOIN ingredients i ON i.id = pi.ingredient_id
    WHERE pi.product_id = ?
  `).all(id);
  const recommendations = db.prepare(`
    SELECT r.* FROM recommendations r WHERE r.product_id = ?
  `).all(id);
  return c.json({ product, ingredients, recommendations });
});

app.post('/api/products', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const body = await c.req.json();
  if (!body.name || !body.price) return c.json({ error: 'Required fields missing' }, 400);
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) return c.json({ error: 'At least one main ingredient required' }, 400);
  const mainIngredient = body.ingredients.find((i: Record<string, unknown>) => i.is_main);
  if (!mainIngredient) return c.json({ error: 'Main ingredient required' }, 400);

  const dup = db.prepare('SELECT id FROM products WHERE name = ? AND brand = ?').get(body.name, body.brand || null);
  if (dup) return c.json({ error: 'Duplicate product detected' }, 409);

  const product = db.prepare('INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const info = product.run(body.name, body.brand || null, body.form || null, body.price, body.shop_link || null, body.image_url || null, 'pending', 'hidden');
  const productId = info.lastInsertRowid;

  const piStmt = db.prepare('INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit, form_id) VALUES (?, ?, ?, ?, ?, ?)');
  for (const ing of body.ingredients as Array<Record<string, unknown>>) {
    piStmt.run(productId, ing.ingredient_id, ing.is_main ? 1 : 0, ing.quantity || null, ing.unit || null, ing.form_id || null);
  }

  return c.json({ productId });
});

app.get('/api/products', (c) => {
  const products = db.prepare('SELECT * FROM products WHERE visibility = "public" OR visibility = "hidden"').all();
  return c.json({ products });
});

// PUT /api/products/:id – update product (owner or admin)
const updateProductSchema = z.object({
  name: z.string().optional(),
  brand: z.string().optional(),
  form: z.string().optional(),
  price: z.number().optional(),
  shop_link: z.string().optional(),
  image_url: z.string().optional(),
});

app.put('/api/products/:id', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const id = c.req.param('id');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return c.json({ error: 'Not found' }, 404);
  // Only admin can update any product; regular users cannot update (no owner field on products table)
  if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  const body = await c.req.json();
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  db.prepare(`
    UPDATE products SET
      name = COALESCE(?, name),
      brand = COALESCE(?, brand),
      form = COALESCE(?, form),
      price = COALESCE(?, price),
      shop_link = COALESCE(?, shop_link),
      image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.brand ?? null,
    data.form ?? null,
    data.price ?? null,
    data.shop_link ?? null,
    data.image_url ?? null,
    id,
  );
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return c.json({ product: updated });
});

// PUT /api/products/:id/status – update moderation_status + visibility (admin only)
const productStatusSchema = z.object({
  moderation_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  visibility: z.enum(['public', 'hidden']).optional(),
});

app.put('/api/products/:id/status', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const id = c.req.param('id');
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!product) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json();
  const parsed = productStatusSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  db.prepare(`
    UPDATE products SET
      moderation_status = COALESCE(?, moderation_status),
      visibility = COALESCE(?, visibility)
    WHERE id = ?
  `).run(data.moderation_status ?? null, data.visibility ?? null, id);
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return c.json({ product: updated });
});

// GET /api/admin/products – get ALL products including pending/hidden (admin only)
app.get('/api/admin/products', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  return c.json({ products });
});

// GET /api/stacks – get all stacks for authenticated user (include items count)
app.get('/api/stacks', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const stacks = db.prepare(`
    SELECT s.*, COUNT(si.id) as items_count
    FROM stacks s
    LEFT JOIN stack_items si ON si.stack_id = s.id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all(user.userId);
  return c.json({ stacks });
});

app.post('/api/stacks', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const body = c.req.json();
  return body.then((data) => {
    if (!data.name) return c.json({ error: 'Stack-Name ist erforderlich' }, 400);
    const stackInfo = db.prepare('INSERT INTO stacks (user_id, name) VALUES (?, ?)').run(user.userId, data.name);
    const stackId = stackInfo.lastInsertRowid;
    // Support optional product_ids (array of { id, quantity } objects) OR products (array of ids)
    const items: Array<Record<string, unknown>> = Array.isArray(data.product_ids)
      ? data.product_ids
      : Array.isArray(data.products)
        ? (data.products as number[]).map((id) => ({ id, quantity: 1 }))
        : [];
    const insertItem = db.prepare('INSERT INTO stack_items (stack_id, product_id, quantity) VALUES (?, ?, ?)');
    for (const item of items) {
      insertItem.run(stackId, item.id, item.quantity || 1);
    }
    return c.json({ id: stackId, name: data.name });
  });
});

app.get('/api/stacks/:id', (c) => {
  const stack = db.prepare('SELECT * FROM stacks WHERE id = ?').get(c.req.param('id')) as Record<string, unknown> | undefined;
  if (!stack) return c.json({ error: 'Not found' }, 404);
  const items = db.prepare('SELECT si.*, p.name as product_name, p.price as product_price FROM stack_items si JOIN products p ON p.id = si.product_id WHERE si.stack_id = ?').all(stack.id) as Array<Record<string, number>>;
  const total = items.reduce((sum, i) => sum + (i.product_price * i.quantity), 0);
  return c.json({ stack, items, total });
});

// DELETE /api/stacks/:id – delete own stack (owner or admin)
app.delete('/api/stacks/:id', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const id = c.req.param('id');
  const stack = db.prepare('SELECT * FROM stacks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!stack) return c.json({ error: 'Not found' }, 404);
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  db.prepare('DELETE FROM stacks WHERE id = ?').run(id);
  return c.json({ ok: true });
});

// PUT /api/stacks/:id – update stack: rename, add/remove products
const updateStackSchema = z.object({
  name: z.string().optional(),
  product_ids: z.array(z.object({ id: z.number(), quantity: z.number().optional() })).optional(),
});

app.put('/api/stacks/:id', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const id = c.req.param('id');
  const stack = db.prepare('SELECT * FROM stacks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!stack) return c.json({ error: 'Not found' }, 404);
  if (stack.user_id !== user.userId && user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  const body = await c.req.json();
  const parsed = updateStackSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;
  if (data.name) {
    db.prepare('UPDATE stacks SET name = ? WHERE id = ?').run(data.name, id);
  }
  if (data.product_ids !== undefined) {
    db.prepare('DELETE FROM stack_items WHERE stack_id = ?').run(id);
    const insertItem = db.prepare('INSERT INTO stack_items (stack_id, product_id, quantity) VALUES (?, ?, ?)');
    for (const item of data.product_ids) {
      insertItem.run(id, item.id, item.quantity || 1);
    }
  }
  const updated = db.prepare('SELECT * FROM stacks WHERE id = ?').get(id);
  const items = db.prepare('SELECT si.*, p.name as product_name, p.price as product_price FROM stack_items si JOIN products p ON p.id = si.product_id WHERE si.stack_id = ?').all(id);
  return c.json({ stack: updated, items });
});

// GET /api/wishlist – get authenticated user's wishlist with product details
app.get('/api/wishlist', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const wishlist = db.prepare(`
    SELECT w.id, w.created_at, p.*
    FROM wishlist w
    JOIN products p ON p.id = w.product_id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
  `).all(user.userId);
  return c.json({ wishlist });
});

// POST /api/wishlist – add product
const wishlistSchema = z.object({ product_id: z.number() });

app.post('/api/wishlist', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = wishlistSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const { product_id } = parsed.data;
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
  if (!product) return c.json({ error: 'Product not found' }, 404);
  try {
    const info = db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(user.userId, product_id);
    return c.json({ id: info.lastInsertRowid }, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return c.json({ error: 'Already in wishlist' }, 409);
    return c.json({ error: msg }, 400);
  }
});

// DELETE /api/wishlist/:product_id – remove product from wishlist
app.delete('/api/wishlist/:product_id', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const product_id = c.req.param('product_id');
  const entry = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(user.userId, product_id);
  if (!entry) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(user.userId, product_id);
  return c.json({ ok: true });
});

// GET /api/interactions – get all interactions (with ingredient names joined)
app.get('/api/interactions', (c) => {
  const interactions = db.prepare(`
    SELECT ix.*,
           ia.name as ingredient_a_name,
           ib.name as ingredient_b_name
    FROM interactions ix
    JOIN ingredients ia ON ia.id = ix.ingredient_a_id
    JOIN ingredients ib ON ib.id = ix.ingredient_b_id
    ORDER BY ix.id DESC
  `).all();
  return c.json({ interactions });
});

// DELETE /api/interactions/:id – delete interaction (admin only)
app.delete('/api/interactions/:id', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const id = c.req.param('id');
  const interaction = db.prepare('SELECT id FROM interactions WHERE id = ?').get(id);
  if (!interaction) return c.json({ error: 'Not found' }, 404);
  db.prepare('DELETE FROM interactions WHERE id = ?').run(id);
  return c.json({ ok: true });
});

app.post('/api/interactions', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user'); if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  const body = c.req.json();
  return body.then((data) => {
    if (!data.ingredient_a_id || !data.ingredient_b_id) return c.json({ error: 'Missing fields' }, 400);
    db.prepare('INSERT OR REPLACE INTO interactions (ingredient_a_id, ingredient_b_id, type, comment) VALUES (?, ?, ?, ?)').run(data.ingredient_a_id, data.ingredient_b_id, data.type || 'avoid', data.comment || null);
    return c.json({ ok: true });
  });
});

// GET /api/admin/stats – return counts (admin only)
app.get('/api/admin/stats', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const adm = requireAdmin(c); if (adm instanceof Response) return adm;
  const users = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const ingredients = (db.prepare('SELECT COUNT(*) as count FROM ingredients').get() as { count: number }).count;
  const products = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  const stacks = (db.prepare('SELECT COUNT(*) as count FROM stacks').get() as { count: number }).count;
  const pending_products = (db.prepare("SELECT COUNT(*) as count FROM products WHERE moderation_status = 'pending'").get() as { count: number }).count;
  return c.json({ users, ingredients, products, stacks, pending_products });
});

app.get('/api/stack-warnings/:id', (c) => {
  const id = c.req.param('id');
  const items = db.prepare('SELECT pi.ingredient_id FROM stack_items si JOIN product_ingredients pi ON pi.product_id=si.product_id WHERE si.stack_id = ?').all(id) as Array<{ ingredient_id: number }>;
  const ingredientIds = [...new Set(items.map((i) => i.ingredient_id))];
  const warnings = [];
  for (let a = 0; a < ingredientIds.length; a++) {
    for (let b = a + 1; b < ingredientIds.length; b++) {
      const inter = db.prepare('SELECT * FROM interactions WHERE (ingredient_a_id = ? AND ingredient_b_id = ?) OR (ingredient_a_id = ? AND ingredient_b_id = ?)').get(ingredientIds[a], ingredientIds[b], ingredientIds[b], ingredientIds[a]);
      if (inter) warnings.push(inter);
    }
  }
  return c.json({ warnings });
});

app.post('/api/demo/sessions', (c) => {
  const body = c.req.json();
  return body.then((data) => {
    const key = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + DEMO_TTL * 60 * 1000).toISOString();
    db.prepare('INSERT INTO demo_sessions (key, stack_json, expires_at) VALUES (?, ?, ?)').run(key, JSON.stringify(data.stack || []), expiresAt);
    return c.json({ key, expiresAt });
  });
});

app.get('/api/demo/sessions/:key', (c) => {
  const session = db.prepare('SELECT * FROM demo_sessions WHERE key = ? AND expires_at > ?').get(c.req.param('key'), new Date().toISOString()) as Record<string, string> | undefined;
  if (!session) return c.json({ error: 'Not found or expired' }, 404);
  return c.json({ stack: JSON.parse(session.stack_json || '[]'), expires_at: session.expires_at });
});

app.get('/api/demo/reset', (c) => {
  db.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  return c.json({ ok: true });
});

app.all('/static/*', serveStatic({ root: './public' }));

export default app;
