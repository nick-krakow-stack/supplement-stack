import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

import { fetchSubpartsHono, subpartsKnowledgeOverviewCacheKey } from './subparts-hono-handlers.mjs';
import {
  createProductionKnowledgeHonoHarness,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';

type JsonRecord = Record<string, unknown>;

type TestStatement = {
  bind: (...values: unknown[]) => TestStatement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ meta: { changes: number } }>;
};

type TestDatabase = {
  prepare: (sql: string) => TestStatement;
  batch: (statements: TestStatement[]) => Promise<Array<{ meta: { changes: number } }>>;
};

type TestExecutionContext = {
  passThroughOnException: () => void;
  props: Record<string, unknown>;
  waitUntil: (promise: Promise<unknown>) => void;
};

type IngredientSearchRow = {
  id: number;
  matched_part_id: number | null;
  matched_part_name: string | null;
  name: string;
};

type PartRow = {
  part_id: number;
  part_name: string;
  part_status: string;
  quantity: number | null;
  unit: string | null;
};

type ProductIngredientRow = {
  ingredient_id: number;
  ingredient_name?: string;
  parts: PartRow[];
  quantity: number | null;
  unit: string | null;
};

type ProductRow = {
  id: number;
  name: string;
  version: number;
  ingredients: ProductIngredientRow[];
  notes?: string | null;
  review_note?: string | null;
  shop_link?: string | null;
  visibility?: 'private' | 'public';
  status_history?: Array<{
    moderation_status: string;
    visibility: 'private' | 'public';
    note: string | null;
  }>;
  stack_usage?: Array<{
    stack_item_id: number;
    stack_id: number;
    stack_name: string;
    quantity: number;
    dosage_text: string | null;
    intake_interval_days: number | null;
  }>;
};

type UserProductMutationSnapshot = {
  product: JsonRecord | null;
  ingredients: JsonRecord[];
  parts: JsonRecord[];
  history: JsonRecord[];
};

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const migrationsDirectory = `${repositoryRoot}d1-migrations`;
const apiOrigin = 'https://supplementstack.test';
const jwtSecret = 'subparts-integration-secret';
const testUserId = 910001;
const adminUserId = 910002;
const otherUserId = 910003;
const catalogOmegaProductId = 920001;
const hiddenOmegaProductId = 920002;
const catalogCarnitineProductId = 920003;

let harness: ProductionKnowledgeHonoHarness;
let userToken: string;
let adminToken: string;
let otherUserToken: string;
let omegaId: number;
let carnitineId: number;
let epaId: number;
let dhaId: number;
let acetylId: number;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signTestToken(payload: JsonRecord): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(jwtSecret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput)));
  return `${signingInput}.${base64Url(signature)}`;
}

function applyAllMigrations(target: ProductionKnowledgeHonoHarness): void {
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));

  expect(migrationFiles).toContain('0098_normalize_subpart_id_sequences.sql');
  expect(migrationFiles).toContain('0099_creator_stack_sharing.sql');
  expect(migrationFiles).toContain('0102_user_product_visibility_history.sql');
  for (const migrationFile of migrationFiles) {
    target.exec(readFileSync(`${migrationsDirectory}/${migrationFile}`, 'utf8'));
  }
}

function executionContext(): TestExecutionContext {
  return {
    passThroughOnException(): void {},
    props: {},
    waitUntil(): void {},
  };
}

async function api(
  path: string,
  options: {
    body?: unknown;
    db?: unknown;
    method?: string;
    role?: 'admin' | 'other' | 'user';
  } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.role) {
    const token = options.role === 'admin' ? adminToken : options.role === 'other' ? otherUserToken : userToken;
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetchSubpartsHono(
    new Request(`${apiOrigin}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      method: options.method ?? 'GET',
    }),
    {
      DB: options.db ?? harness.db,
      FRONTEND_URL: apiOrigin,
      JWT_SECRET: jwtSecret,
    },
    executionContext(),
  );
}

async function json(response: Response): Promise<JsonRecord> {
  const result = await response.json();
  expect(result).toBeTypeOf('object');
  return result as JsonRecord;
}

function ingredientPayload(
  ingredientId: number,
  quantity: number | null,
  unit: string | null,
  parts: Array<{
    part_id: number;
    quantity: number | null;
    unit: string | null;
    basis_quantity?: number | null;
    basis_unit?: string | null;
    search_relevant?: number;
  }>,
): JsonRecord {
  return {
    ingredient_id: ingredientId,
    form_id: null,
    is_main: true,
    quantity,
    unit,
    basis_quantity: 1,
    basis_unit: 'Portion',
    search_relevant: 1,
    parts: parts.map((part) => ({
      basis_quantity: 1,
      basis_unit: 'Portion',
      search_relevant: 1,
      ...part,
    })),
  };
}

function userProductPayload(name: string, ingredients: JsonRecord[]): JsonRecord {
  return {
    brand: 'Integrationstest',
    container_count: 1,
    form: 'Kapseln',
    ingredients,
    name,
    price: 19.99,
    serving_size: 1,
    serving_unit: 'Portion',
    servings_per_container: 30,
  };
}

async function userProductMutationSnapshot(
  db: TestDatabase,
  productId: number,
): Promise<UserProductMutationSnapshot> {
  const product = await db.prepare(`
    SELECT * FROM user_products WHERE id = ?
  `).bind(productId).first<JsonRecord>();
  const ingredients = (await db.prepare(`
    SELECT * FROM user_product_ingredients
    WHERE user_product_id = ?
    ORDER BY id ASC
  `).bind(productId).all<JsonRecord>()).results;
  const parts = (await db.prepare(`
    SELECT part.*
    FROM user_product_ingredient_parts part
    JOIN user_product_ingredients ingredient
      ON ingredient.id = part.user_product_ingredient_id
    WHERE ingredient.user_product_id = ?
    ORDER BY part.id ASC
  `).bind(productId).all<JsonRecord>()).results;
  const history = (await db.prepare(`
    SELECT * FROM user_product_status_history
    WHERE user_product_id = ?
    ORDER BY id ASC
  `).bind(productId).all<JsonRecord>()).results;
  return { product, ingredients, parts, history };
}

async function findIngredientByPart(query: string): Promise<IngredientSearchRow> {
  const response = await api(`/api/ingredients/search?q=${encodeURIComponent(query)}`);
  expect(response.status).toBe(200);
  const body = await json(response);
  const rows = body.ingredients as IngredientSearchRow[];
  const match = rows.find((row) => row.matched_part_name?.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')));
  expect(match, `Kein Part-Treffer für ${query}`).toBeDefined();
  return match!;
}

function seedUsersAndCatalog(): void {
  harness.run(
    `INSERT INTO users (id, email, password_hash, role, is_trusted_product_submitter, is_blocked_product_submitter)
     VALUES (?, ?, 'not-used', 'user', 0, 0)`,
    testUserId,
    'subparts-user@example.test',
  );
  harness.run(
    `INSERT INTO users (id, email, password_hash, role, is_trusted_product_submitter, is_blocked_product_submitter)
     VALUES (?, ?, 'not-used', 'admin', 0, 0)`,
    adminUserId,
    'subparts-admin@example.test',
  );
  harness.run(
    `INSERT INTO users (id, email, password_hash, role, is_trusted_product_submitter, is_blocked_product_submitter)
     VALUES (?, ?, 'not-used', 'user', 0, 0)`,
    otherUserId,
    'subparts-other@example.test',
  );

  harness.run(
    `INSERT INTO products (
       id, name, brand, form, price, moderation_status, visibility,
       serving_size, serving_unit, servings_per_container, container_count, owner_party_id
     ) VALUES (?, 'Omega Parts Public', 'Integrationstest', 'Kapseln', 20, 'approved', 'public', 1, 'Portion', 30, 1, (SELECT id FROM parties WHERE slug = 'platform'))`,
    catalogOmegaProductId,
  );
  harness.run(
    `INSERT INTO product_ingredients (
       id, product_id, ingredient_id, is_main, quantity, unit,
       basis_quantity, basis_unit, search_relevant
     ) VALUES (930001, ?, ?, 1, 1000, 'mg', 1, 'Portion', 1)`,
    catalogOmegaProductId,
    omegaId,
  );
  harness.run(
    `INSERT INTO product_ingredient_parts (
       product_ingredient_id, part_id, quantity, unit, basis_quantity, basis_unit, search_relevant
     ) VALUES (930001, ?, 300, 'mg', 1, 'Portion', 1)`,
    epaId,
  );
  harness.run(
    `INSERT INTO product_ingredient_parts (
       product_ingredient_id, part_id, quantity, unit, basis_quantity, basis_unit, search_relevant
     ) VALUES (930001, ?, 200, 'mg', 1, 'Portion', 1)`,
    dhaId,
  );

  harness.run(
    `INSERT INTO products (
       id, name, brand, form, price, moderation_status, visibility,
       serving_size, serving_unit, servings_per_container, container_count, owner_party_id
     ) VALUES (?, 'Omega Parts Hidden', 'Integrationstest', 'Kapseln', 20, 'pending', 'hidden', 1, 'Portion', 30, 1, (SELECT id FROM parties WHERE slug = 'platform'))`,
    hiddenOmegaProductId,
  );
  harness.run(
    `INSERT INTO product_ingredients (
       id, product_id, ingredient_id, is_main, quantity, unit,
       basis_quantity, basis_unit, search_relevant
     ) VALUES (930002, ?, ?, 1, 1000, 'mg', 1, 'Portion', 1)`,
    hiddenOmegaProductId,
    omegaId,
  );
  harness.run(
    `INSERT INTO product_ingredient_parts (
       product_ingredient_id, part_id, quantity, unit, basis_quantity, basis_unit, search_relevant
     ) VALUES (930002, ?, 900, 'mg', 1, 'Portion', 1)`,
    epaId,
  );

  harness.run(
    `INSERT INTO products (
       id, name, brand, form, price, moderation_status, visibility,
       serving_size, serving_unit, servings_per_container, container_count, owner_party_id
     ) VALUES (?, 'Acetyl Parts Public', 'Integrationstest', 'Kapseln', 20, 'approved', 'public', 1, 'Portion', 30, 1, (SELECT id FROM parties WHERE slug = 'platform'))`,
    catalogCarnitineProductId,
  );
  harness.run(
    `INSERT INTO product_ingredients (
       id, product_id, ingredient_id, is_main, quantity, unit,
       basis_quantity, basis_unit, search_relevant
     ) VALUES (930003, ?, ?, 1, 500, 'mg', 1, 'Portion', 1)`,
    catalogCarnitineProductId,
    carnitineId,
  );
  harness.run(
    `INSERT INTO product_ingredient_parts (
       product_ingredient_id, part_id, quantity, unit, basis_quantity, basis_unit, search_relevant
     ) VALUES (930003, ?, 250, 'mg', 1, 'Portion', 1)`,
    acetylId,
  );
}

describe.sequential('Sub-Wirkstoffe: echte Hono-Routen auf D1-Schema bis 0099', () => {
  beforeAll(async () => {
    harness = createProductionKnowledgeHonoHarness();
    applyAllMigrations(harness);
    userToken = await signTestToken({ email: 'subparts-user@example.test', role: 'user', userId: testUserId });
    adminToken = await signTestToken({ email: 'subparts-admin@example.test', role: 'admin', userId: adminUserId });
    otherUserToken = await signTestToken({ email: 'subparts-other@example.test', role: 'user', userId: otherUserId });

    const epa = await findIngredientByPart('EPA');
    const dha = await findIngredientByPart('DHA');
    const acetyl = await findIngredientByPart('Acetyl-L-Carnitin');
    omegaId = epa.id;
    carnitineId = acetyl.id;
    epaId = epa.matched_part_id!;
    dhaId = dha.matched_part_id!;
    acetylId = acetyl.matched_part_id!;
    expect(dha.id).toBe(omegaId);
    seedUsersAndCatalog();
  });

  afterAll(() => harness.close());

  it('deletes the versioned knowledge overview cache on a guarded admin refresh', async () => {
    const auditResponse = await api('/api/admin/knowledge-overview-projection', { role: 'admin' });
    expect(auditResponse.status).toBe(200);
    const audit = (await json(auditResponse)).audit as JsonRecord;
    const cacheKey = subpartsKnowledgeOverviewCacheKey(`${apiOrigin}/api/admin/knowledge-overview-projection/refresh`);
    await harness.cache.put(cacheKey, new Response(JSON.stringify({ stale: true })));
    expect(await harness.cache.match(cacheKey)).toBeDefined();

    const refreshResponse = await api('/api/admin/knowledge-overview-projection/refresh', {
      body: {
        expected_active_generation: audit.active_generation,
        expected_source_version: audit.source_version,
        expected_live_record_count: audit.live_record_count,
        expected_live_content_hash: audit.live_content_hash,
      },
      method: 'POST',
      role: 'admin',
    });
    expect(refreshResponse.status).toBe(200);
    expect(await harness.cache.match(cacheKey)).toBeUndefined();

    await harness.cache.put(cacheKey, new Response(JSON.stringify({ stale: true })));
    const mutationResponse = await api(`/api/admin/ingredients/${omegaId}/task-status/forms`, {
      body: { status: 'open' },
      method: 'PUT',
      role: 'admin',
    });
    expect(mutationResponse.status).toBe(200);
    expect(await harness.cache.match(cacheKey)).toBeUndefined();
  });

  it('keeps the stack description exactly once in a fresh schema through migration 0103', async () => {
    const migrationHarness = createProductionKnowledgeHonoHarness();
    try {
      const migrationFiles = readdirSync(migrationsDirectory)
        .filter((name) => /^\d+.*\.sql$/.test(name) && name <= '0103_stack_trash_description.sql')
        .sort((left, right) => left.localeCompare(right));
      for (const migrationFile of migrationFiles) {
        migrationHarness.exec(readFileSync(`${migrationsDirectory}/${migrationFile}`, 'utf8'));
      }
      const db = migrationHarness.db as TestDatabase;
      const descriptionColumns = (await db.prepare('PRAGMA table_info(stacks)').all<{
        name: string;
        type: string;
      }>()).results
        .filter((column) => column.name === 'description')
        .map(({ name, type }) => ({ name, type }));

      expect(descriptionColumns).toEqual([{ name: 'description', type: 'TEXT' }]);
    } finally {
      migrationHarness.close();
    }
  });

  it('backfills version 1 and keeps the schema default for new user products', async () => {
    const migrationHarness = createProductionKnowledgeHonoHarness();
    try {
      const migrationFiles = readdirSync(migrationsDirectory)
        .filter((name) => /^\d+.*\.sql$/.test(name) && name < '0102_user_product_visibility_history.sql')
        .sort((left, right) => left.localeCompare(right));
      for (const migrationFile of migrationFiles) {
        migrationHarness.exec(readFileSync(`${migrationsDirectory}/${migrationFile}`, 'utf8'));
      }
      migrationHarness.run(
        `INSERT INTO users (id, email, password_hash, role)
         VALUES (919901, 'version-backfill@example.test', 'not-used', 'user')`,
      );
      migrationHarness.run(
        `INSERT INTO user_products (id, user_id, name, brand, form, price, status)
         VALUES (919901, 919901, 'Vor Migration', 'Test', 'Kapseln', 10, 'pending')`,
      );

      migrationHarness.exec(readFileSync(
        `${migrationsDirectory}/0102_user_product_visibility_history.sql`,
        'utf8',
      ));
      const db = migrationHarness.db as TestDatabase;
      const columns = (await db.prepare('PRAGMA table_info(user_products)').all<{
        dflt_value: string | null;
        name: string;
        notnull: number;
      }>()).results;
      expect(columns.find((column) => column.name === 'version')).toMatchObject({
        dflt_value: '1',
        notnull: 1,
      });
      expect(await db.prepare('SELECT version FROM user_products WHERE id = 919901')
        .first<{ version: number }>()).toEqual({ version: 1 });

      migrationHarness.run(
        `INSERT INTO user_products (id, user_id, name, brand, form, price, status)
         VALUES (919902, 919901, 'Nach Migration', 'Test', 'Kapseln', 10, 'pending')`,
      );
      expect(await db.prepare('SELECT version FROM user_products WHERE id = 919902')
        .first<{ version: number }>()).toEqual({ version: 1 });
    } finally {
      migrationHarness.close();
    }
  });

  it('liest ein Katalogprodukt verschachtelt und blendet nicht freigegebene Produkte aus', async () => {
    harness.run("UPDATE products SET effect_summary = 'Kommerzieller Alttext', shop_link = 'https://shop.example/omega' WHERE id = ?", catalogOmegaProductId);
    harness.run("UPDATE ingredient_display_profiles SET effect_summary = 'Zentrale Wirkungsbeschreibung'");
    const response = await api(`/api/products/${catalogOmegaProductId}`);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.product).toMatchObject({ shop_link: 'https://shop.example/omega' });
    expect(body.product).not.toHaveProperty('effect_summary');
    expect(body.product).not.toHaveProperty('ingredient_effect_summary');
    const ingredients = body.ingredients as ProductIngredientRow[];
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]).toMatchObject({ ingredient_id: omegaId, quantity: 1000, unit: 'mg' });
    expect(ingredients[0].parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ part_id: epaId, part_name: 'EPA', quantity: 300, unit: 'mg' }),
      expect.objectContaining({ part_id: dhaId, part_name: 'DHA', quantity: 200, unit: 'mg' }),
    ]));

    const listBody = await json(await api('/api/products'));
    const listedProducts = listBody.products as ProductRow[];
    const listedIds = listedProducts.map((product) => product.id);
    expect(listedIds).toContain(catalogOmegaProductId);
    expect(listedIds).not.toContain(hiddenOmegaProductId);
    expect(listedProducts.find((product) => product.id === catalogOmegaProductId)).toMatchObject({
      shop_link: 'https://shop.example/omega',
    });
    expect(listedProducts.every((product) => !('effect_summary' in product) && !('ingredient_effect_summary' in product))).toBe(true);

    const demoBody = await json(await api('/api/demo/products'));
    expect((demoBody.products as JsonRecord[]).every((product) => (
      !('effect_summary' in product) && !('ingredient_effect_summary' in product)
    ))).toBe(true);
  });

  it('liefert über die öffentliche Wirkstoff-Detailroute keine Wirkungsprofile aus', async () => {
    harness.run("UPDATE ingredient_display_profiles SET effect_summary = 'Zentrale Wirkungsbeschreibung' WHERE ingredient_id = ?", omegaId);

    const response = await api(`/api/ingredients/${omegaId}`);
    expect(response.status).toBe(200);
    const body = await json(response);

    expect(body).not.toHaveProperty('display_profiles');
    expect(JSON.stringify(body)).not.toContain('Zentrale Wirkungsbeschreibung');
  });

  it('führt Katalogprodukt Create/Read/Update/Read mit verschachtelten Parts über die API aus', async () => {
    const createResponse = await api('/api/products', {
      body: userProductPayload('Catalog Parts Roundtrip', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
        { part_id: dhaId, quantity: 200, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(200);
    const catalogProductId = (await json(createResponse)).productId as number;

    const hiddenRead = await api(`/api/products/${catalogProductId}`);
    expect(hiddenRead.status).toBe(404);

    const statusResponse = await api(`/api/products/${catalogProductId}/status`, {
      body: { moderation_status: 'approved', visibility: 'public' },
      method: 'PUT',
      role: 'admin',
    });
    expect(statusResponse.status).toBe(200);

    const firstReadResponse = await api(`/api/products/${catalogProductId}`);
    expect(firstReadResponse.status).toBe(200);
    const firstRead = await json(firstReadResponse);
    const firstIngredients = firstRead.ingredients as ProductIngredientRow[];
    expect(firstIngredients).toHaveLength(1);
    expect(firstIngredients[0]).toMatchObject({ ingredient_id: omegaId, quantity: 1000, unit: 'mg' });
    expect(firstIngredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 300],
      ['DHA', 200],
    ]);

    const updateResponse = await api(`/api/products/${catalogProductId}`, {
      body: {
        ingredients: [ingredientPayload(omegaId, 1000, 'mg', [
          { part_id: epaId, quantity: 275, unit: 'mg' },
          { part_id: dhaId, quantity: 175, unit: 'mg' },
        ])],
      },
      method: 'PUT',
      role: 'admin',
    });
    expect(updateResponse.status).toBe(200);

    const secondReadResponse = await api(`/api/products/${catalogProductId}`);
    expect(secondReadResponse.status).toBe(200);
    const secondRead = await json(secondReadResponse);
    const secondIngredients = secondRead.ingredients as ProductIngredientRow[];
    expect(secondIngredients).toHaveLength(1);
    expect(secondIngredients[0]).toMatchObject({ ingredient_id: omegaId, quantity: 1000, unit: 'mg' });
    expect(secondIngredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 275],
      ['DHA', 175],
    ]);
  });

  it('führt Nutzerprodukt Create/Read/Update/Read verlustfrei aus', async () => {
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('Parts Roundtrip', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
        { part_id: dhaId, quantity: 200, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const createdBody = await json(createResponse);
    const createdId = createdBody.id as number;
    const created = createdBody.product as ProductRow;
    expect(created.ingredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 300],
      ['DHA', 200],
    ]);

    const readBody = await json(await api('/api/user-products', { role: 'user' }));
    const readProduct = (readBody.products as ProductRow[]).find((product) => product.id === createdId);
    expect(readProduct?.ingredients[0].parts).toHaveLength(2);

    const updateResponse = await api(`/api/user-products/${createdId}`, {
      body: {
        ...userProductPayload('Parts Roundtrip aktualisiert', [ingredientPayload(omegaId, 1000, 'mg', [
          { part_id: epaId, quantity: 250, unit: 'mg' },
          { part_id: dhaId, quantity: 150, unit: 'mg' },
        ])]),
        expected_version: created.version,
      },
      method: 'PUT',
      role: 'user',
    });
    expect(updateResponse.status).toBe(200);
    const updatedBody = await json(updateResponse);
    const updated = updatedBody.product as ProductRow;
    expect(updated.name).toBe('Parts Roundtrip aktualisiert');
    expect(updated.ingredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 250],
      ['DHA', 150],
    ]);

    const rereadBody = await json(await api('/api/user-products', { role: 'user' }));
    const reread = (rereadBody.products as ProductRow[]).find((product) => product.id === createdId)!;
    expect(reread.ingredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 250],
      ['DHA', 150],
    ]);
  });

  it('löscht optionale Shop-Links und Notizen per Presence-Guard dauerhaft', async () => {
    const createResponse = await api('/api/user-products', {
      body: {
        ...userProductPayload('Optionale Felder', [ingredientPayload(omegaId, 1000, 'mg', [])]),
        notes: 'Nur morgens',
        shop_link: 'https://shop.example/product',
      },
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const createdBody = await json(createResponse);
    const productId = createdBody.id as number;
    const created = createdBody.product as ProductRow;

    const clearResponse = await api(`/api/user-products/${productId}`, {
      body: { expected_version: created.version, notes: null, shop_link: null },
      method: 'PUT',
      role: 'user',
    });
    expect(clearResponse.status).toBe(200);
    const cleared = (await json(clearResponse)).product as ProductRow;
    expect(cleared.notes).toBeNull();
    expect(cleared.shop_link).toBeNull();

    const readBody = await json(await api('/api/user-products', { role: 'user' }));
    const reread = (readBody.products as ProductRow[]).find((product) => product.id === productId)!;
    expect(reread.notes).toBeNull();
    expect(reread.shop_link).toBeNull();
  });

  it('keeps the winning PUT and every child/history row unchanged when a stale PUT loses the race', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('PUT Race Start', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const createdBody = await json(createResponse);
    const productId = createdBody.id as number;
    const created = createdBody.product as ProductRow;
    expect(created.version).toBe(1);

    const winnerBody = {
      ...userProductPayload('PUT Race Winner', [ingredientPayload(omegaId, 900, 'mg', [
        { part_id: epaId, quantity: 250, unit: 'mg' },
        { part_id: dhaId, quantity: 150, unit: 'mg' },
      ])]),
      expected_version: created.version,
    };
    let winnerSnapshot: UserProductMutationSnapshot | undefined;
    let winnerVersion: number | undefined;
    let winnerInjected = false;
    const raceDatabase: TestDatabase = {
      prepare: db.prepare.bind(db),
      async batch(statements) {
        expect(winnerInjected).toBe(false);
        winnerInjected = true;
        const winnerResponse = await api(`/api/user-products/${productId}`, {
          body: winnerBody,
          method: 'PUT',
          role: 'user',
        });
        expect(winnerResponse.status).toBe(200);
        winnerVersion = ((await json(winnerResponse)).product as ProductRow).version;
        winnerSnapshot = await userProductMutationSnapshot(db, productId);
        return db.batch(statements);
      },
    };

    const losingResponse = await api(`/api/user-products/${productId}`, {
      body: {
        ...userProductPayload('PUT Race Loser', [ingredientPayload(omegaId, 700, 'mg', [
          { part_id: epaId, quantity: 100, unit: 'mg' },
        ])]),
        expected_version: created.version,
      },
      db: raceDatabase,
      method: 'PUT',
      role: 'user',
    });
    expect(winnerInjected).toBe(true);
    expect(winnerVersion).toBe(2);
    expect(losingResponse.status).toBe(409);
    expect((await json(losingResponse)).current_version).toBe(2);

    const afterLoser = await userProductMutationSnapshot(db, productId);
    expect(afterLoser).toEqual(winnerSnapshot);
    expect(afterLoser.ingredients).toHaveLength(winnerSnapshot!.ingredients.length);
    expect(afterLoser.parts).toHaveLength(winnerSnapshot!.parts.length);
    expect(afterLoser.history).toHaveLength(winnerSnapshot!.history.length);
  });

  it('keeps the winning PUT and every child/history row unchanged when a stale DELETE loses the race', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('DELETE Race Start', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const createdBody = await json(createResponse);
    const productId = createdBody.id as number;
    const created = createdBody.product as ProductRow;
    expect(created.version).toBe(1);

    let winnerSnapshot: UserProductMutationSnapshot | undefined;
    let winnerVersion: number | undefined;
    let winnerInjected = false;
    const wrapStatement = (sql: string, statement: TestStatement): TestStatement => ({
      bind: (...values) => wrapStatement(sql, statement.bind(...values)),
      first: <T>() => statement.first<T>(),
      all: <T>() => statement.all<T>(),
      run: async () => {
        if (!winnerInjected && /DELETE\s+FROM\s+user_products/i.test(sql)) {
          winnerInjected = true;
          const winnerResponse = await api(`/api/user-products/${productId}`, {
            body: {
              ...userProductPayload('DELETE Race Winner', [ingredientPayload(omegaId, 850, 'mg', [
                { part_id: epaId, quantity: 225, unit: 'mg' },
                { part_id: dhaId, quantity: 125, unit: 'mg' },
              ])]),
              expected_version: created.version,
            },
            method: 'PUT',
            role: 'user',
          });
          expect(winnerResponse.status).toBe(200);
          winnerVersion = ((await json(winnerResponse)).product as ProductRow).version;
          winnerSnapshot = await userProductMutationSnapshot(db, productId);
        }
        return statement.run();
      },
    });
    const raceDatabase: TestDatabase = {
      prepare: (sql) => wrapStatement(sql, db.prepare(sql)),
      batch: db.batch.bind(db),
    };

    const losingResponse = await api(`/api/user-products/${productId}`, {
      body: { expected_version: created.version },
      db: raceDatabase,
      method: 'DELETE',
      role: 'user',
    });
    expect(winnerInjected).toBe(true);
    expect(winnerVersion).toBe(2);
    expect(losingResponse.status).toBe(409);
    expect((await json(losingResponse)).current_version).toBe(2);

    const afterLoser = await userProductMutationSnapshot(db, productId);
    expect(afterLoser).toEqual(winnerSnapshot);
    expect(afterLoser.ingredients).toHaveLength(winnerSnapshot!.ingredients.length);
    expect(afterLoser.parts).toHaveLength(winnerSnapshot!.parts.length);
    expect(afterLoser.history).toHaveLength(winnerSnapshot!.history.length);
  });

  it('bindet Sichtbarkeit, Verlauf und Stack-Nutzung an Produkt und Nutzer', async () => {
    const db = harness.db as TestDatabase;
    const payload = userProductPayload('Privater Kontext', [ingredientPayload(omegaId, 1000, 'mg', [
      { part_id: epaId, quantity: 300, unit: 'mg' },
    ])]);
    const createResponse = await api('/api/user-products', {
      body: payload,
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const createdBody = await json(createResponse);
    const productId = createdBody.id as number;
    const created = createdBody.product as ProductRow;
    expect(created.visibility).toBe('private');
    expect(created.status_history).toEqual([
      expect.objectContaining({ moderation_status: 'pending', visibility: 'private', note: null }),
    ]);

    const foreignUpdate = await api(`/api/user-products/${productId}`, {
      body: payload,
      method: 'PUT',
      role: 'other',
    });
    expect(foreignUpdate.status).toBe(404);

    const stackResponse = await api('/api/stacks', {
      body: {
        name: 'Monatskosten-Stack',
        products: [{
          id: productId,
          intake_interval_days: 2,
          product_type: 'user_product',
          quantity: 2,
        }],
      },
      method: 'POST',
      role: 'user',
    });
    expect(stackResponse.status).toBe(200);
    const stackId = (await json(stackResponse)).id as number;

    harness.run(`INSERT INTO stacks (id, user_id, name) VALUES (950001, ?, 'Fremder Stack')`, otherUserId);
    harness.run(
      `INSERT INTO stack_items (id, stack_id, user_product_id, quantity, intake_interval_days, sort_order)
       VALUES (950001, 950001, ?, 9, 1, 0)`,
      productId,
    );

    const withUsageBody = await json(await api('/api/user-products', { role: 'user' }));
    const withUsage = (withUsageBody.products as ProductRow[]).find((product) => product.id === productId)!;
    expect(withUsage.stack_usage).toEqual([
      expect.objectContaining({
        stack_id: stackId,
        stack_name: 'Monatskosten-Stack',
        quantity: 2,
        intake_interval_days: 2,
      }),
    ]);
    expect(withUsage.stack_usage?.[0].stack_item_id).toBeTypeOf('number');

    const trashResponse = await api(`/api/stacks/${stackId}`, { method: 'DELETE', role: 'user' });
    expect(trashResponse.status).toBe(200);
    const trashedBody = await json(await api('/api/user-products', { role: 'user' }));
    const trashed = (trashedBody.products as ProductRow[]).find((product) => product.id === productId)!;
    expect(trashed.stack_usage).toEqual([]);

    const tooLongReview = await api(`/api/admin/user-products/${productId}/reject`, {
      body: { review_note: 'x'.repeat(501) },
      method: 'PUT',
      role: 'admin',
    });
    expect(tooLongReview.status).toBe(400);
    expect(() => harness.run(
      'UPDATE user_products SET review_note = ? WHERE id = ?',
      'x'.repeat(501),
      productId,
    )).toThrow();

    const rejectResponse = await api(`/api/admin/user-products/${productId}/reject`, {
      body: { review_note: 'Bitte prüfe die Packungsangabe.' },
      method: 'PUT',
      role: 'admin',
    });
    expect(rejectResponse.status).toBe(200);
    const rejectedBody = await json(await api('/api/user-products', { role: 'user' }));
    const rejected = (rejectedBody.products as ProductRow[]).find((product) => product.id === productId)!;
    expect(rejected.review_note).toBe('Bitte prüfe die Packungsangabe.');
    expect(rejected.status_history?.[0]).toMatchObject({
      moderation_status: 'rejected',
      visibility: 'private',
      note: 'Bitte prüfe die Packungsangabe.',
    });

    const history = await db.prepare(`
      SELECT id FROM user_product_status_history
      WHERE user_product_id = ?
      ORDER BY id DESC LIMIT 1
    `).bind(productId).first<{ id: number }>();
    expect(history).not.toBeNull();
    expect(() => harness.run(
      'UPDATE user_product_status_history SET note = ? WHERE id = ?',
      'Manipuliert',
      history!.id,
    )).toThrow();
    expect(() => harness.run(
      'DELETE FROM user_product_status_history WHERE id = ?',
      history!.id,
    )).toThrow();

    const deleteResponse = await api(`/api/user-products/${productId}`, {
      body: { expected_version: rejected.version },
      method: 'DELETE',
      role: 'user',
    });
    expect(deleteResponse.status).toBe(200);
    const remainingHistory = await db.prepare(`
      SELECT COUNT(*) AS count FROM user_product_status_history WHERE user_product_id = ?
    `).bind(productId).first<{ count: number }>();
    expect(remainingHistory?.count).toBe(0);
  });

  it('invalidates a stale user PUT when an admin changes the note of an already rejected product', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('Admin Note PUT Guard', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
        { part_id: dhaId, quantity: 200, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const productId = (await json(createResponse)).id as number;

    expect((await api(`/api/admin/user-products/${productId}/reject`, {
      body: { review_note: 'Erster Hinweis' },
      method: 'PUT',
      role: 'admin',
    })).status).toBe(200);
    const firstRead = await json(await api('/api/user-products', { role: 'user' }));
    const staleProduct = (firstRead.products as ProductRow[]).find((product) => product.id === productId)!;
    expect(staleProduct.version).toBe(2);

    expect((await api(`/api/admin/user-products/${productId}/reject`, {
      body: { review_note: 'Aktualisierter Hinweis' },
      method: 'PUT',
      role: 'admin',
    })).status).toBe(200);
    const winnerSnapshot = await userProductMutationSnapshot(db, productId);
    expect(winnerSnapshot.product).toMatchObject({
      review_note: 'Aktualisierter Hinweis',
      status: 'rejected',
      version: 3,
    });

    const stalePut = await api(`/api/user-products/${productId}`, {
      body: {
        ...userProductPayload('Darf Admin-Hinweis nicht überschreiben', [ingredientPayload(omegaId, 700, 'mg', [
          { part_id: epaId, quantity: 100, unit: 'mg' },
        ])]),
        expected_version: staleProduct.version,
      },
      method: 'PUT',
      role: 'user',
    });
    expect(stalePut.status).toBe(409);
    expect((await json(stalePut)).current_version).toBe(3);

    const afterStalePut = await userProductMutationSnapshot(db, productId);
    expect(afterStalePut).toEqual(winnerSnapshot);
    expect(afterStalePut.ingredients).toHaveLength(winnerSnapshot.ingredients.length);
    expect(afterStalePut.parts).toHaveLength(winnerSnapshot.parts.length);
    expect(afterStalePut.history).toHaveLength(winnerSnapshot.history.length);
  });

  it('invalidates a stale user DELETE when an admin changes the note of an already rejected product', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('Admin Note DELETE Guard', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
        { part_id: dhaId, quantity: 200, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const productId = (await json(createResponse)).id as number;

    expect((await api(`/api/admin/user-products/${productId}/reject`, {
      body: { review_note: 'Erster Löschhinweis' },
      method: 'PUT',
      role: 'admin',
    })).status).toBe(200);
    const firstRead = await json(await api('/api/user-products', { role: 'user' }));
    const staleProduct = (firstRead.products as ProductRow[]).find((product) => product.id === productId)!;
    expect(staleProduct.version).toBe(2);

    expect((await api(`/api/admin/user-products/${productId}/reject`, {
      body: { review_note: 'Aktualisierter Löschhinweis' },
      method: 'PUT',
      role: 'admin',
    })).status).toBe(200);
    const winnerSnapshot = await userProductMutationSnapshot(db, productId);
    expect(winnerSnapshot.product).toMatchObject({
      review_note: 'Aktualisierter Löschhinweis',
      status: 'rejected',
      version: 3,
    });

    const staleDelete = await api(`/api/user-products/${productId}`, {
      body: { expected_version: staleProduct.version },
      method: 'DELETE',
      role: 'user',
    });
    expect(staleDelete.status).toBe(409);
    expect((await json(staleDelete)).current_version).toBe(3);

    const afterStaleDelete = await userProductMutationSnapshot(db, productId);
    expect(afterStaleDelete).toEqual(winnerSnapshot);
    expect(afterStaleDelete.ingredients).toHaveLength(winnerSnapshot.ingredients.length);
    expect(afterStaleDelete.parts).toHaveLength(winnerSnapshot.parts.length);
    expect(afterStaleDelete.history).toHaveLength(winnerSnapshot.history.length);
  });

  it('rollt fehlgeschlagene Katalog- und Nutzerprodukt-Replacements vollständig zurück', async () => {
    harness.exec(`
      CREATE TRIGGER subparts_test_reject_catalog_part
      BEFORE INSERT ON product_ingredient_parts
      WHEN NEW.part_id = ${dhaId}
      BEGIN
        SELECT RAISE(ABORT, 'forced catalog part failure');
      END;
    `);
    const catalogFailure = await api(`/api/products/${catalogOmegaProductId}`, {
      body: {
        ingredients: [ingredientPayload(omegaId, 900, 'mg', [
          { part_id: epaId, quantity: 250, unit: 'mg' },
          { part_id: dhaId, quantity: 150, unit: 'mg' },
        ])],
      },
      method: 'PUT',
      role: 'admin',
    });
    expect(catalogFailure.status).toBe(500);
    harness.exec('DROP TRIGGER subparts_test_reject_catalog_part;');

    const catalogRead = await json(await api(`/api/products/${catalogOmegaProductId}`));
    const catalogIngredient = (catalogRead.ingredients as ProductIngredientRow[])[0];
    expect(catalogIngredient.quantity).toBe(1000);
    expect(catalogIngredient.parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 300],
      ['DHA', 200],
    ]);

    const createResponse = await api('/api/user-products', {
      body: userProductPayload('Atomic User Product', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const createdBody = await json(createResponse);
    const createdId = createdBody.id as number;
    const created = createdBody.product as ProductRow;
    harness.exec(`
      CREATE TRIGGER subparts_test_reject_user_part
      BEFORE INSERT ON user_product_ingredient_parts
      WHEN NEW.part_id = ${dhaId}
      BEGIN
        SELECT RAISE(ABORT, 'forced user part failure');
      END;
    `);
    const userFailure = await api(`/api/user-products/${createdId}`, {
      body: {
        ...userProductPayload('Darf nicht gespeichert werden', [ingredientPayload(omegaId, 800, 'mg', [
          { part_id: epaId, quantity: 200, unit: 'mg' },
          { part_id: dhaId, quantity: 100, unit: 'mg' },
        ])]),
        expected_version: created.version,
      },
      method: 'PUT',
      role: 'user',
    });
    expect(userFailure.status).toBe(500);
    harness.exec('DROP TRIGGER subparts_test_reject_user_part;');

    const userRead = await json(await api('/api/user-products', { role: 'user' }));
    const unchanged = (userRead.products as ProductRow[]).find((product) => product.id === createdId)!;
    expect(unchanged.name).toBe('Atomic User Product');
    expect(unchanged.ingredients[0].quantity).toBe(1000);
    expect(unchanged.ingredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 300],
    ]);
  });

  it('reserviert IDs für parallele Produktanlagen ohne Kollision', async () => {
    const payloads = ['Parallel Parts A', 'Parallel Parts B'].map((name, index) => (
      userProductPayload(name, [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 300 - index * 25, unit: 'mg' },
      ])])
    ));
    const responses = await Promise.all(payloads.map((body) => api('/api/user-products', {
      body,
      method: 'POST',
      role: 'user',
    })));
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const bodies = await Promise.all(responses.map((response) => json(response)));
    expect(new Set(bodies.map((body) => body.id)).size).toBe(2);
    expect(bodies.map((body) => (body.product as ProductRow).ingredients[0].parts[0].quantity)).toEqual([300, 275]);
  });

  it('deaktiviert alte schreibende Sub-Ingredient-Routen eindeutig', async () => {
    for (const request of [
      api(`/api/admin/ingredients/${omegaId}/precursors`, {
        body: { precursor_ingredient_id: epaId }, method: 'POST', role: 'admin',
      }),
      api(`/api/admin/ingredients/${omegaId}/precursors/${epaId}`, {
        body: { sort_order: 3 }, method: 'PATCH', role: 'admin',
      }),
      api(`/api/admin/ingredients/${omegaId}/precursors/${epaId}`, {
        method: 'DELETE', role: 'admin',
      }),
      api('/api/admin/ingredient-sub-ingredients', {
        body: { child_ingredient_id: epaId, parent_ingredient_id: omegaId }, method: 'PUT', role: 'admin',
      }),
      api(`/api/admin/ingredient-sub-ingredients/${omegaId}/${epaId}`, {
        method: 'DELETE', role: 'admin',
      }),
    ]) {
      expect((await request).status).toBe(410);
    }
  });

  it('weist eine vergleichbare Partsumme über der Hauptmenge ab', async () => {
    const response = await api('/api/user-products', {
      body: userProductPayload('Parts zu hoch', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 700, unit: 'mg' },
        { part_id: dhaId, quantity: 400, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(response.status).toBe(400);
    expect((await json(response)).error).toMatch(/Hauptmenge|überschreiten/i);
  });

  it('erfindet bei fehlender Hauptmenge nichts und rechnet inkompatible Einheiten nicht um', async () => {
    const missingParent = await api('/api/user-products', {
      body: userProductPayload('Ohne Hauptmenge', [ingredientPayload(omegaId, null, null, [
        { part_id: epaId, quantity: 300, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(missingParent.status).toBe(201);
    const missingBody = await json(missingParent);
    const missingIngredient = (missingBody.product as ProductRow).ingredients[0];
    expect(missingIngredient.quantity).toBeNull();
    expect(missingIngredient.unit).toBeNull();
    expect(missingIngredient.parts[0]).toMatchObject({ quantity: 300, unit: 'mg' });

    const incompatible = await api('/api/user-products', {
      body: userProductPayload('Inkompatible Einheit', [ingredientPayload(omegaId, 1, 'IU', [
        { part_id: epaId, quantity: 900, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(incompatible.status).toBe(201);
    const incompatibleBody = await json(incompatible);
    const incompatibleIngredient = (incompatibleBody.product as ProductRow).ingredients[0];
    expect(incompatibleIngredient).toMatchObject({ quantity: 1, unit: 'IU' });
    expect(incompatibleIngredient.parts[0]).toMatchObject({ quantity: 900, unit: 'mg' });
  });

  it('weist inaktive Parts beim Write ab, hält historische Daten aber lesbar', async () => {
    const historicalResponse = await api('/api/user-products', {
      body: userProductPayload('Historischer Part', [ingredientPayload(carnitineId, 500, 'mg', [
        { part_id: acetylId, quantity: 250, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(historicalResponse.status).toBe(201);
    const historicalId = (await json(historicalResponse)).id as number;
    harness.run("UPDATE ingredient_parts SET status = 'inactive' WHERE id = ?", acetylId);

    const rejected = await api('/api/user-products', {
      body: userProductPayload('Inaktiver Part Write', [ingredientPayload(carnitineId, 500, 'mg', [
        { part_id: acetylId, quantity: 200, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(rejected.status).toBe(400);
    expect((await json(rejected)).error).toMatch(/Inaktive|veraltete/i);

    const readBody = await json(await api('/api/user-products', { role: 'user' }));
    const historical = (readBody.products as ProductRow[]).find((product) => product.id === historicalId)!;
    expect(historical.ingredients[0].parts[0]).toMatchObject({
      part_id: acetylId,
      part_status: 'inactive',
      quantity: 250,
    });
    harness.run("UPDATE ingredient_parts SET status = 'active' WHERE id = ?", acetylId);
  });

  it('findet EPA, DHA und Acetyl über den Parent und nur freigegebene öffentliche Produkte', async () => {
    const cases = [
      { partId: epaId, productId: catalogOmegaProductId, query: 'EPA' },
      { partId: dhaId, productId: catalogOmegaProductId, query: 'DHA' },
      { partId: acetylId, productId: catalogCarnitineProductId, query: 'Acetyl-L-Carnitin' },
    ];
    for (const testCase of cases) {
      const match = await findIngredientByPart(testCase.query);
      const response = await api(`/api/ingredients/${match.id}/products?part_id=${testCase.partId}`);
      expect(response.status).toBe(200);
      const body = await json(response);
      const products = body.products as Array<JsonRecord>;
      expect(products.map((product) => product.id)).toContain(testCase.productId);
      expect(products.map((product) => product.id)).not.toContain(hiddenOmegaProductId);
      const product = products.find((candidate) => candidate.id === testCase.productId)!;
      expect(product).toMatchObject({ matched_part_id: testCase.partId });
      expect(product).not.toHaveProperty('effect_summary');
      expect(product).not.toHaveProperty('ingredient_effect_summary');
      expect(product.matched_part_quantity).toBeTypeOf('number');
    }

    const aliasResponse = await api('/api/ingredients/search?q=ALCAR');
    expect(aliasResponse.status).toBe(200);
    const aliasBody = await json(aliasResponse);
    const aliasRows = aliasBody.ingredients as IngredientSearchRow[];
    expect(aliasRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: carnitineId,
        matched_part_id: acetylId,
        matched_part_name: 'Acetyl-L-Carnitin',
        name: 'L-Carnitin',
      }),
    ]));
  });

  it('aggregiert im Stack Parent und Parts separat über Produkte, Portionen und Intervalle', async () => {
    const secondIngredient = ingredientPayload(omegaId, 2000, 'mg', [{
      part_id: epaId,
      quantity: 400,
      unit: 'mg',
      basis_quantity: null,
      basis_unit: null,
    }]);
    secondIngredient.basis_quantity = 2;
    secondIngredient.basis_unit = 'Portionen';
    const userProductResponse = await api('/api/user-products', {
      body: userProductPayload('Omega Parts mit geerbter Basis', [secondIngredient]),
      method: 'POST',
      role: 'user',
    });
    const userProductBody = await json(userProductResponse);
    expect(userProductResponse.status, JSON.stringify(userProductBody)).toBe(201);
    const userProductId = userProductBody.id as number;

    const createResponse = await api('/api/stacks', {
      body: {
        name: 'Parts Stack',
        products: [
          { id: catalogOmegaProductId, intake_interval_days: 1, product_type: 'catalog', quantity: 1 },
          { id: userProductId, intake_interval_days: 2, product_type: 'user_product', quantity: 2 },
        ],
      },
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(200);
    const stackId = (await json(createResponse)).id as number;
    const response = await api(`/api/stacks/${stackId}`, { role: 'user' });
    expect(response.status).toBe(200);
    const body = await json(response);
    const items = body.items as Array<JsonRecord>;
    expect(items).toHaveLength(2);
    const catalogItem = items.find((item) => item.product_type === 'catalog')!;
    expect(catalogItem).toMatchObject({ shop_link: 'https://shop.example/omega' });
    expect(catalogItem).not.toHaveProperty('effect_summary');
    expect(catalogItem).not.toHaveProperty('ingredient_effect_summary');
    const ingredients = catalogItem.ingredients as ProductIngredientRow[];
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]).toMatchObject({ ingredient_id: omegaId, quantity: 1000, unit: 'mg' });
    expect(ingredients[0].parts.map((part) => [part.part_name, part.quantity])).toEqual([
      ['EPA', 300],
      ['DHA', 200],
    ]);
    expect(ingredients.reduce((sum, ingredient) => sum + (ingredient.quantity ?? 0), 0)).toBe(1000);

    expect(body.ingredient_totals).toEqual([{
      ingredient_id: omegaId,
      ingredient_name: 'Omega-3',
      totals: [{ quantity: 2000, unit: 'mg' }],
      parts: [
        { part_id: dhaId, part_name: 'DHA', totals: [{ quantity: 200, unit: 'mg' }] },
        { part_id: epaId, part_name: 'EPA', totals: [{ quantity: 500, unit: 'mg' }] },
      ],
    }]);
  });

  it('kopiert bei Moderation/Publish alle verschachtelten Partdaten in den öffentlichen Katalog', async () => {
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('Publish Parts Copy', [ingredientPayload(carnitineId, 500, 'mg', [
        { part_id: acetylId, quantity: 250, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const userProductId = (await json(createResponse)).id as number;
    harness.run("UPDATE user_products SET effect_summary = 'Privater kommerzieller Alttext' WHERE id = ?", userProductId);

    const publishResponse = await api(`/api/admin/user-products/${userProductId}/publish`, {
      body: {},
      method: 'PUT',
      role: 'admin',
    });
    expect(publishResponse.status).toBe(201);
    const publishedBody = await json(publishResponse);
    const publishedProduct = publishedBody.product as JsonRecord;
    const publishedIngredients = publishedBody.ingredients as ProductIngredientRow[];
    expect(publishedIngredients[0].parts[0]).toMatchObject({
      part_id: acetylId,
      quantity: 250,
      unit: 'mg',
    });

    const publicResponse = await api(`/api/products/${publishedProduct.id}`);
    expect(publicResponse.status).toBe(200);
    const publicBody = await json(publicResponse);
    const publicIngredients = publicBody.ingredients as ProductIngredientRow[];
    expect(publicIngredients[0]).toMatchObject({ ingredient_id: carnitineId, quantity: 500, unit: 'mg' });
    expect(publicIngredients[0].parts[0]).toMatchObject({
      part_id: acetylId,
      part_name: 'Acetyl-L-Carnitin',
      quantity: 250,
      unit: 'mg',
    });

    const userRead = await json(await api('/api/user-products', { role: 'user' }));
    const publishedUserProduct = (userRead.products as ProductRow[])
      .find((product) => product.id === userProductId)!;
    expect(publishedUserProduct.visibility).toBe('public');
    expect(publishedUserProduct).not.toHaveProperty('effect_summary');
    expect(publishedUserProduct.status_history?.[0]).toMatchObject({
      moderation_status: 'approved',
      visibility: 'public',
    });

    const lateReject = await api(`/api/admin/user-products/${userProductId}/reject`, {
      body: { review_note: 'Darf ein öffentliches Original nicht still zurückstufen.' },
      method: 'PUT',
      role: 'admin',
    });
    expect(lateReject.status).toBe(409);
    const afterLateReject = await json(await api('/api/user-products', { role: 'user' }));
    const stillPublic = (afterLateReject.products as ProductRow[])
      .find((product) => product.id === userProductId)!;
    expect(stillPublic.visibility).toBe('public');
    expect(stillPublic.status_history?.[0]).toMatchObject({
      moderation_status: 'approved',
      visibility: 'public',
    });
  });

  it('hinterlässt bei einem fehlgeschlagenen Publish kein Teilprodukt', async () => {
    const createResponse = await api('/api/user-products', {
      body: userProductPayload('Atomic Publish Parts', [ingredientPayload(carnitineId, 500, 'mg', [
        { part_id: acetylId, quantity: 250, unit: 'mg' },
      ])]),
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(201);
    const userProductId = (await json(createResponse)).id as number;
    harness.exec(`
      CREATE TRIGGER subparts_test_reject_publish_part
      BEFORE INSERT ON product_ingredient_parts
      WHEN NEW.part_id = ${acetylId}
      BEGIN
        SELECT RAISE(ABORT, 'forced publish part failure');
      END;
    `);
    const failed = await api(`/api/admin/user-products/${userProductId}/publish`, {
      body: {}, method: 'PUT', role: 'admin',
    });
    expect(failed.status).toBe(500);
    harness.exec('DROP TRIGGER subparts_test_reject_publish_part;');

    const retry = await api(`/api/admin/user-products/${userProductId}/publish`, {
      body: {}, method: 'PUT', role: 'admin',
    });
    expect(retry.status).toBe(201);
    expect((await json(retry)).idempotent).toBe(false);
  });

  it('bindet bei einem verlorenen Gleichversions-Rennen weder Produkt noch Shop-Link', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/stacks', {
      body: {
        name: 'Stack-Claim-Rennen',
        products: [{ id: catalogOmegaProductId, product_type: 'catalog', quantity: 1 }],
      },
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(200);
    const stackId = (await json(createResponse)).id as number;
    const item = await db.prepare(`
      SELECT id, version, sort_order, quantity
      FROM stack_items WHERE stack_id = ?
    `).bind(stackId).first<{ id: number; version: number; sort_order: number; quantity: number }>();
    expect(item).not.toBeNull();
    expect(await db.prepare(`
      SELECT COUNT(*) AS count FROM stack_item_link_bindings WHERE stack_item_id = ?
    `).bind(item!.id).first<{ count: number }>()).toEqual({ count: 0 });

    harness.run(`
      INSERT INTO product_shop_links (
        id, product_id, shop_domain_id, shop_name, url, normalized_host,
        is_affiliate, affiliate_owner_type, source_type, is_primary,
        active, sort_order, version, link_kind
      ) VALUES (
        990001, ?, (SELECT id FROM shop_domains WHERE domain = 'amazon.de'), 'Amazon',
        'https://amazon.de/dp/stack-claim-fixture', 'amazon.de',
        0, 'none', 'admin', 1, 1, 0, 1, 'base_target'
      )
    `, catalogOmegaProductId);

    let winnerInjected = false;
    const raceDatabase: TestDatabase = {
      prepare: db.prepare.bind(db),
      async batch(statements) {
        winnerInjected = true;
        await db.prepare(`
          UPDATE stacks
          SET version = version + 1, write_claim_token = 'winner-token'
          WHERE id = ? AND version = 1
        `).bind(stackId).run();
        return db.batch(statements);
      },
    };
    const losingResponse = await api(`/api/stacks/${stackId}`, {
      body: {
        expected_stack_version: 1,
        expected_items: [{ stack_item_id: item!.id, expected_version: item!.version }],
        product_ids: [{
          id: catalogOmegaProductId,
          product_type: 'catalog',
          quantity: 2,
          sort_order: item!.sort_order,
        }],
      },
      db: raceDatabase,
      method: 'PUT',
      role: 'user',
    });
    expect(winnerInjected).toBe(true);
    expect(losingResponse.status).toBe(409);

    expect(await db.prepare(`
      SELECT version, write_claim_token FROM stacks WHERE id = ?
    `).bind(stackId).first<{ version: number; write_claim_token: string }>()).toEqual({
      version: 2,
      write_claim_token: 'winner-token',
    });
    expect(await db.prepare(`
      SELECT version, sort_order, quantity FROM stack_items WHERE id = ?
    `).bind(item!.id).first<{ version: number; sort_order: number; quantity: number }>()).toEqual({
      version: item!.version,
      sort_order: item!.sort_order,
      quantity: item!.quantity,
    });
    expect(await db.prepare(`
      SELECT COUNT(*) AS count FROM stack_item_link_bindings WHERE stack_item_id = ?
    `).bind(item!.id).first<{ count: number }>()).toEqual({ count: 0 });
  });

  it('ändert bei einem Reihenfolge-Rennen keine zweite Produktposition oder Version', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/stacks', {
      body: {
        name: 'Layout-Claim-Rennen',
        products: [
          { id: catalogOmegaProductId, product_type: 'catalog', quantity: 1 },
          { id: catalogCarnitineProductId, product_type: 'catalog', quantity: 1 },
        ],
      },
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(200);
    const stackId = (await json(createResponse)).id as number;
    const before = (await db.prepare(`
      SELECT id, version, sort_order FROM stack_items WHERE stack_id = ? ORDER BY id
    `).bind(stackId).all<{ id: number; version: number; sort_order: number }>()).results;
    expect(before).toHaveLength(2);

    let winnerInjected = false;
    const wrapStatement = (sql: string, statement: TestStatement): TestStatement => ({
      bind: (...values) => wrapStatement(sql, statement.bind(...values)),
      first: <T>() => statement.first<T>(),
      all: <T>() => statement.all<T>(),
      run: async () => {
        if (!winnerInjected && /UPDATE\s+stack_items\s+SET\s+sort_order/i.test(sql)) {
          winnerInjected = true;
          await db.prepare('UPDATE stack_items SET version = version + 1 WHERE id = ?')
            .bind(before[0].id)
            .run();
        }
        return statement.run();
      },
    });
    const raceDatabase: TestDatabase = {
      prepare: (sql) => wrapStatement(sql, db.prepare(sql)),
      batch: db.batch.bind(db),
    };
    const losingResponse = await api(`/api/stacks/${stackId}/items/layout`, {
      body: {
        items: [
          { stack_item_id: before[0].id, expected_version: before[0].version, sort_order: 1 },
          { stack_item_id: before[1].id, expected_version: before[1].version, sort_order: 0 },
        ],
      },
      db: raceDatabase,
      method: 'PUT',
      role: 'user',
    });
    expect(winnerInjected).toBe(true);
    expect(losingResponse.status).toBe(409);

    const after = (await db.prepare(`
      SELECT id, version, sort_order FROM stack_items WHERE stack_id = ? ORDER BY id
    `).bind(stackId).all<{ id: number; version: number; sort_order: number }>()).results;
    expect(after).toEqual([
      { ...before[0], version: before[0].version + 1 },
      before[1],
    ]);
  });

  it('rollt eine fehlgeschlagene Stack-Erstellung einschließlich leerem Stack zurück', async () => {
    const db = harness.db as TestDatabase;
    const before = await db.prepare(`
      SELECT COUNT(*) AS count FROM stacks WHERE user_id = ?
    `).bind(testUserId).first<{ count: number }>();
    harness.exec(`
      CREATE TRIGGER stack_test_reject_link_binding
      BEFORE INSERT ON stack_item_link_bindings
      WHEN NEW.shop_link_id = 990001
      BEGIN
        SELECT RAISE(ABORT, 'forced stack binding failure');
      END;
    `);
    const failed = await api('/api/stacks', {
      body: {
        name: 'Darf nicht teilweise bleiben',
        products: [{ id: catalogOmegaProductId, product_type: 'catalog', quantity: 1 }],
      },
      method: 'POST',
      role: 'user',
    });
    harness.exec('DROP TRIGGER stack_test_reject_link_binding;');

    expect(failed.status).toBe(409);
    expect(await db.prepare(`
      SELECT COUNT(*) AS count FROM stacks WHERE user_id = ?
    `).bind(testUserId).first<{ count: number }>()).toEqual(before);
    expect(await db.prepare(`
      SELECT COUNT(*) AS count
      FROM stack_items item
      JOIN stacks stack ON stack.id = item.stack_id
      WHERE stack.user_id = ? AND stack.name = 'Darf nicht teilweise bleiben'
    `).bind(testUserId).first<{ count: number }>()).toEqual({ count: 0 });
  });

  it('führt den 7-Tage-Papierkorb vollständig, geschützt und nutzerbezogen aus', async () => {
    const db = harness.db as TestDatabase;
    const createResponse = await api('/api/stacks', {
      body: {
        name: 'Papierkorb-Matrix',
        products: [{ id: catalogCarnitineProductId, product_type: 'catalog', quantity: 1 }],
      },
      method: 'POST',
      role: 'user',
    });
    expect(createResponse.status).toBe(200);
    const stackId = (await json(createResponse)).id as number;
    const item = await db.prepare(`
      SELECT id, version FROM stack_items WHERE stack_id = ?
    `).bind(stackId).first<{ id: number; version: number }>();
    expect(item).not.toBeNull();

    const foreignDelete = await api(`/api/stacks/${stackId}`, { method: 'DELETE', role: 'other' });
    expect(foreignDelete.status).toBe(403);
    const deleteResponse = await api(`/api/stacks/${stackId}`, { method: 'DELETE', role: 'user' });
    expect(deleteResponse.status).toBe(200);
    const deleted = await db.prepare(`
      SELECT deleted_at, delete_purge_after, version,
             delete_purge_after = datetime(deleted_at, '+7 days') AS exact_window
      FROM stacks WHERE id = ?
    `).bind(stackId).first<{
      deleted_at: string;
      delete_purge_after: string;
      exact_window: number;
      version: number;
    }>();
    expect(deleted).toMatchObject({ exact_window: 1, version: 2 });
    expect(await db.prepare('SELECT COUNT(*) AS count FROM stack_items WHERE stack_id = ?')
      .bind(stackId).first<{ count: number }>()).toEqual({ count: 1 });

    const activeBody = await json(await api('/api/stacks', { role: 'user' }));
    expect((activeBody.stacks as JsonRecord[]).map((stack) => stack.id)).not.toContain(stackId);
    const trashBody = await json(await api('/api/stacks/trash', { role: 'user' }));
    expect(trashBody.stacks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: stackId, items_count: 1 }),
    ]));
    const foreignRestore = await api(`/api/stacks/${stackId}/restore`, { method: 'POST', role: 'other' });
    expect(foreignRestore.status).toBe(403);

    let restoreRaceInjected = false;
    const wrapRestoreStatement = (sql: string, statement: TestStatement): TestStatement => ({
      bind: (...values) => wrapRestoreStatement(sql, statement.bind(...values)),
      first: <T>() => statement.first<T>(),
      all: <T>() => statement.all<T>(),
      run: async () => {
        if (!restoreRaceInjected && /UPDATE\s+stacks\s+SET\s+deleted_at\s*=\s*NULL/i.test(sql)) {
          restoreRaceInjected = true;
          await db.prepare('UPDATE stacks SET version = version + 1 WHERE id = ?')
            .bind(stackId)
            .run();
        }
        return statement.run();
      },
    });
    const restoreRaceDatabase: TestDatabase = {
      prepare: (sql) => wrapRestoreStatement(sql, db.prepare(sql)),
      batch: db.batch.bind(db),
    };
    const staleRestore = await api(`/api/stacks/${stackId}/restore`, {
      db: restoreRaceDatabase,
      method: 'POST',
      role: 'user',
    });
    expect(restoreRaceInjected).toBe(true);
    expect(staleRestore.status).toBe(409);
    expect(await db.prepare(`
      SELECT deleted_at IS NOT NULL AS still_trashed, version FROM stacks WHERE id = ?
    `).bind(stackId).first<{ still_trashed: number; version: number }>()).toEqual({
      still_trashed: 1,
      version: 3,
    });

    const restoreResponse = await api(`/api/stacks/${stackId}/restore`, { method: 'POST', role: 'user' });
    expect(restoreResponse.status).toBe(200);
    expect(await db.prepare(`
      SELECT deleted_at, delete_purge_after, version FROM stacks WHERE id = ?
    `).bind(stackId).first<{ deleted_at: null; delete_purge_after: null; version: number }>()).toEqual({
      deleted_at: null,
      delete_purge_after: null,
      version: 4,
    });
    expect(await db.prepare('SELECT COUNT(*) AS count FROM stack_items WHERE stack_id = ?')
      .bind(stackId).first<{ count: number }>()).toEqual({ count: 1 });

    expect((await api(`/api/stacks/${stackId}`, { method: 'DELETE', role: 'user' })).status).toBe(200);
    harness.run(`
      UPDATE stacks SET delete_purge_after = datetime(CURRENT_TIMESTAMP, '-1 second') WHERE id = ?
    `, stackId);
    const expiredRestore = await api(`/api/stacks/${stackId}/restore`, { method: 'POST', role: 'user' });
    expect(expiredRestore.status).toBe(410);
    expect(await db.prepare('SELECT id FROM stacks WHERE id = ?').bind(stackId).first()).toBeNull();
    expect(await db.prepare('SELECT id FROM stack_items WHERE id = ?').bind(item!.id).first()).toBeNull();

    harness.run(`
      INSERT INTO stacks (id, user_id, name, deleted_at, delete_purge_after, version)
      VALUES
        (999010, ?, 'Eigener abgelaufener Papierkorb', datetime(CURRENT_TIMESTAMP, '-8 days'), datetime(CURRENT_TIMESTAMP, '-1 day'), 1),
        (999011, ?, 'Fremder abgelaufener Papierkorb', datetime(CURRENT_TIMESTAMP, '-8 days'), datetime(CURRENT_TIMESTAMP, '-1 day'), 1)
    `, testUserId, otherUserId);
    harness.run(`
      INSERT INTO stack_items (id, stack_id, catalog_product_id, quantity, intake_interval_days, sort_order, version)
      VALUES
        (999010, 999010, ?, 1, 1, 0, 1),
        (999011, 999011, ?, 1, 1, 0, 1)
    `, catalogCarnitineProductId, catalogCarnitineProductId);

    expect((await api('/api/stacks', { role: 'user' })).status).toBe(200);
    expect(await db.prepare('SELECT id FROM stacks WHERE id = 999010').first()).toBeNull();
    expect(await db.prepare('SELECT id FROM stack_items WHERE id = 999010').first()).toBeNull();
    expect(await db.prepare('SELECT id FROM stacks WHERE id = 999011').first()).toEqual({ id: 999011 });
    expect(await db.prepare('SELECT id FROM stack_items WHERE id = 999011').first()).toEqual({ id: 999011 });
  });

  // This sequential fixture's overview-refresh test requires its initial
  // projection generation. Run article mutations only after that baseline.
  it('validates and preserves the canonical optional article update reason', async () => {
    const payload = { slug: 'article-update-reason-test', title: 'Testartikel', summary: 'Ein Kurztext.', body: 'Ein Artikel.', status: 'draft', sources: [], ingredient_ids: [], update_reason: 'a'.repeat(500) };
    const tooLong = await api('/api/admin/knowledge-articles', { role: 'admin', method: 'POST', body: { ...payload, update_reason: 'a'.repeat(501) } });
    expect(tooLong.status).toBe(400);
    const created = await api('/api/admin/knowledge-articles', { role: 'admin', method: 'POST', body: payload });
    expect(created.status).toBe(201);
    const article = (await json(created)).article as JsonRecord;
    expect(article.update_reason).toBe(payload.update_reason);
    const updated = await api(`/api/admin/knowledge-articles/${payload.slug}`, { role: 'admin', method: 'PUT', body: { title: 'Testartikel überarbeitet', version: article.version } });
    expect(updated.status).toBe(200);
    expect(((await json(updated)).article as JsonRecord).update_reason).toBe(payload.update_reason);
  });
});
