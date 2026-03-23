import { Hono } from 'hono';
import { serveStatic } from 'hono/serve-static.module';
import { db, runMigrations } from './db.js';
import { z } from 'zod';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = new Hono();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEMO_TTL = Number(process.env.DEMO_SESSION_TTL_MINUTES || '1440');

runMigrations();

function ensureAuth(c) {
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

function requireAdmin(c) {
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

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email);
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const valid = await argon2.verify(user.password_hash, data.password);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return c.json({ token, profile: { id: user.id, email: user.email, age: user.age, gender: user.gender, weight: user.weight, diet: user.diet, goals: user.goals, guideline_source: user.guideline_source }});
});

app.get('/api/me', (c) => {
  const auth = ensureAuth(c);
  if (auth instanceof Response) return auth;
  const user = c.get('user');
  const value = db.prepare('SELECT id, email, age, gender, weight, diet, goals, guideline_source, role FROM users WHERE id = ?').get(user.userId);
  return c.json({ profile: value });
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
  const unique = Array.from(new Map(merged.map((i) => [i.id, i])).values());
  return c.json({ ingredients: unique });
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
  }).catch((e) => c.json({ error: e.message }, 400));
});

app.post('/api/products', async (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const body = await c.req.json();
  if (!body.name || !body.price) return c.json({ error: 'Required fields missing' }, 400);
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) return c.json({ error: 'At least one main ingredient required' }, 400);
  const mainIngredient = body.ingredients.find((i) => i.is_main);
  if (!mainIngredient) return c.json({ error: 'Main ingredient required' }, 400);

  const dup = db.prepare('SELECT id FROM products WHERE name = ? AND brand = ?').get(body.name, body.brand || null);
  if (dup) return c.json({ error: 'Duplicate product detected' }, 409);

  const product = db.prepare('INSERT INTO products (name, brand, form, price, shop_link, image_url, moderation_status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const info = product.run(body.name, body.brand || null, body.form || null, body.price, body.shop_link || null, body.image_url || null, 'pending', 'hidden');
  const productId = info.lastInsertRowid;

  const piStmt = db.prepare('INSERT INTO product_ingredients (product_id, ingredient_id, is_main, quantity, unit, form_id) VALUES (?, ?, ?, ?, ?, ?)');
  for (const ing of body.ingredients) {
    piStmt.run(productId, ing.ingredient_id, ing.is_main ? 1 : 0, ing.quantity || null, ing.unit || null, ing.form_id || null);
  }

  return c.json({ productId });
});

app.get('/api/products', (c) => {
  const products = db.prepare('SELECT * FROM products WHERE visibility = "public" OR visibility = "hidden"').all();
  return c.json({ products });
});

app.post('/api/stacks', (c) => {
  const auth = ensureAuth(c); if (auth instanceof Response) return auth;
  const user = c.get('user');
  const body = c.req.json();
  return body.then((data) => {
    if (!data.name || !Array.isArray(data.product_ids)) return c.json({ error: 'Invalid payload' }, 400);
    const stackInfo = db.prepare('INSERT INTO stacks (user_id, name) VALUES (?, ?)').run(user.userId, data.name);
    const stackId = stackInfo.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO stack_items (stack_id, product_id, quantity) VALUES (?, ?, ?)');
    for (const item of data.product_ids) {
      insertItem.run(stackId, item.id, item.quantity || 1);
    }
    return c.json({ stackId });
  });
});

app.get('/api/stacks/:id', (c) => {
  const stack = db.prepare('SELECT * FROM stacks WHERE id = ?').get(c.req.param('id'));
  if (!stack) return c.json({ error: 'Not found' }, 404);
  const items = db.prepare('SELECT si.*, p.name as product_name, p.price as product_price FROM stack_items si JOIN products p ON p.id = si.product_id WHERE si.stack_id = ?').all(stack.id);
  const total = items.reduce((sum, i) => sum + (i.product_price * i.quantity), 0);
  return c.json({ stack, items, total });
});

app.get('/api/stack-warnings/:id', (c) => {
  const id = c.req.param('id');
  const items = db.prepare('SELECT pi.ingredient_id FROM stack_items si JOIN product_ingredients pi ON pi.product_id=si.product_id WHERE si.stack_id = ?').all(id);
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
  const session = db.prepare('SELECT * FROM demo_sessions WHERE key = ? AND expires_at > ?').get(c.req.param('key'), new Date().toISOString());
  if (!session) return c.json({ error: 'Not found or expired' }, 404);
  return c.json({ stack: JSON.parse(session.stack_json || '[]'), expires_at: session.expires_at });
});

app.get('/api/demo/reset', (c) => {
  db.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').run(new Date().toISOString());
  return c.json({ ok: true });
});

app.all('/static/*', serveStatic({ root: './public' }));

export default app;
