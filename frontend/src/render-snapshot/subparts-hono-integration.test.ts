import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));

import { fetchSubpartsHono } from './subparts-hono-handlers.mjs';
import {
  createProductionKnowledgeHonoHarness,
  type ProductionKnowledgeHonoHarness,
} from './productionKnowledgeHonoTestHarness';

type JsonRecord = Record<string, unknown>;

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
  ingredients: ProductIngredientRow[];
};

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const migrationsDirectory = `${repositoryRoot}d1-migrations`;
const apiOrigin = 'https://supplementstack.test';
const jwtSecret = 'subparts-integration-secret';
const testUserId = 910001;
const adminUserId = 910002;
const catalogOmegaProductId = 920001;
const hiddenOmegaProductId = 920002;
const catalogCarnitineProductId = 920003;

let harness: ProductionKnowledgeHonoHarness;
let userToken: string;
let adminToken: string;
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
    method?: string;
    role?: 'admin' | 'user';
  } = {},
): Promise<Response> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.role) headers.set('Authorization', `Bearer ${options.role === 'admin' ? adminToken : userToken}`);
  return fetchSubpartsHono(
    new Request(`${apiOrigin}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers,
      method: options.method ?? 'GET',
    }),
    {
      DB: harness.db,
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
    `INSERT INTO products (
       id, name, brand, form, price, moderation_status, visibility,
       serving_size, serving_unit, servings_per_container, container_count
     ) VALUES (?, 'Omega Parts Public', 'Integrationstest', 'Kapseln', 20, 'approved', 'public', 1, 'Portion', 30, 1)`,
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
       serving_size, serving_unit, servings_per_container, container_count
     ) VALUES (?, 'Omega Parts Hidden', 'Integrationstest', 'Kapseln', 20, 'pending', 'hidden', 1, 'Portion', 30, 1)`,
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
       serving_size, serving_unit, servings_per_container, container_count
     ) VALUES (?, 'Acetyl Parts Public', 'Integrationstest', 'Kapseln', 20, 'approved', 'public', 1, 'Portion', 30, 1)`,
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

describe.sequential('Sub-Wirkstoffe: echte Hono-Routen auf D1-Schema bis 0098', () => {
  beforeAll(async () => {
    harness = createProductionKnowledgeHonoHarness();
    applyAllMigrations(harness);
    userToken = await signTestToken({ email: 'subparts-user@example.test', role: 'user', userId: testUserId });
    adminToken = await signTestToken({ email: 'subparts-admin@example.test', role: 'admin', userId: adminUserId });

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

  it('liest ein Katalogprodukt verschachtelt und blendet nicht freigegebene Produkte aus', async () => {
    const response = await api(`/api/products/${catalogOmegaProductId}`);
    expect(response.status).toBe(200);
    const body = await json(response);
    const ingredients = body.ingredients as ProductIngredientRow[];
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]).toMatchObject({ ingredient_id: omegaId, quantity: 1000, unit: 'mg' });
    expect(ingredients[0].parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ part_id: epaId, part_name: 'EPA', quantity: 300, unit: 'mg' }),
      expect.objectContaining({ part_id: dhaId, part_name: 'DHA', quantity: 200, unit: 'mg' }),
    ]));

    const listBody = await json(await api('/api/products'));
    const listedIds = (listBody.products as ProductRow[]).map((product) => product.id);
    expect(listedIds).toContain(catalogOmegaProductId);
    expect(listedIds).not.toContain(hiddenOmegaProductId);
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
      body: userProductPayload('Parts Roundtrip aktualisiert', [ingredientPayload(omegaId, 1000, 'mg', [
        { part_id: epaId, quantity: 250, unit: 'mg' },
        { part_id: dhaId, quantity: 150, unit: 'mg' },
      ])]),
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
    const createdId = (await json(createResponse)).id as number;
    harness.exec(`
      CREATE TRIGGER subparts_test_reject_user_part
      BEFORE INSERT ON user_product_ingredient_parts
      WHEN NEW.part_id = ${dhaId}
      BEGIN
        SELECT RAISE(ABORT, 'forced user part failure');
      END;
    `);
    const userFailure = await api(`/api/user-products/${createdId}`, {
      body: userProductPayload('Darf nicht gespeichert werden', [ingredientPayload(omegaId, 800, 'mg', [
        { part_id: epaId, quantity: 200, unit: 'mg' },
        { part_id: dhaId, quantity: 100, unit: 'mg' },
      ])]),
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
      expect(product.matched_part_quantity).toBeTypeOf('number');
    }
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
});
