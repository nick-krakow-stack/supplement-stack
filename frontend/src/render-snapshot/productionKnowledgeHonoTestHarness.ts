import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

import { fetchProductionKnowledgeHono } from './productionKnowledgeHonoHandlers.mjs';

type SqlBinding = string | number | bigint | null | Uint8Array;

type SqliteRunResult = {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
};

type InMemoryD1Result<T = Record<string, unknown>> = {
  success: true;
  meta: { changes: number; last_row_id: number };
  results: T[];
};

type SqliteStatement = {
  all: (...bindings: SqlBinding[]) => unknown[];
  get: (...bindings: SqlBinding[]) => unknown;
  run: (...bindings: SqlBinding[]) => SqliteRunResult;
};

type SqliteDatabase = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (location: string) => SqliteDatabase;
};

type CacheEntry = {
  requestUrl: string;
  response: Response;
};

function normalizeSqlBinding(value: unknown): SqlBinding {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError(`Nicht unterstützter D1-Testwert: ${String(value)}`);
}

class InMemoryD1PreparedStatement {
  readonly #database: SqliteDatabase;
  readonly #query: string;
  readonly #bindings: SqlBinding[];
  readonly #onExecute: () => void;

  constructor(database: SqliteDatabase, query: string, bindings: SqlBinding[] = [], onExecute: () => void = () => undefined) {
    this.#database = database;
    this.#query = query;
    this.#bindings = bindings;
    this.#onExecute = onExecute;
  }

  bind(...values: unknown[]): InMemoryD1PreparedStatement {
    return new InMemoryD1PreparedStatement(this.#database, this.#query, values.map(normalizeSqlBinding), this.#onExecute);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    this.#onExecute();
    const row = this.#database.prepare(this.#query).get(...this.#bindings) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (columnName === undefined ? row : row[columnName]) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: Record<string, never> }> {
    this.#onExecute();
    const rows = this.#database.prepare(this.#query).all(...this.#bindings) as T[];
    return { results: rows, success: true, meta: {} };
  }

  async run(): Promise<{
    success: true;
    meta: { changes: number; last_row_id: number };
    results: never[];
  }> {
    this.#onExecute();
    const result = this.#database.prepare(this.#query).run(...this.#bindings);
    return {
      success: true,
      meta: {
        changes: Number(result.changes),
        last_row_id: Number(result.lastInsertRowid),
      },
      results: [],
    };
  }

  async executeBatch(): Promise<InMemoryD1Result> {
    const normalizedQuery = this.#query.trimStart().toUpperCase();
    if (
      normalizedQuery.startsWith('SELECT')
      || normalizedQuery.startsWith('PRAGMA')
      || normalizedQuery.startsWith('WITH')
    ) {
      this.#onExecute();
      const results = this.#database.prepare(this.#query).all(...this.#bindings) as Record<string, unknown>[];
      return {
        success: true,
        meta: { changes: 0, last_row_id: 0 },
        results,
      };
    }
    return this.run();
  }
}

class InMemoryD1Database {
  readonly #database: SqliteDatabase;
  #operationCount = 0;
  #batchCallCount = 0;

  constructor(database: SqliteDatabase) {
    this.#database = database;
  }

  prepare(query: string): InMemoryD1PreparedStatement {
    return new InMemoryD1PreparedStatement(this.#database, query, [], () => { this.#operationCount += 1; });
  }

  get operationCount(): number { return this.#operationCount; }
  get batchCallCount(): number { return this.#batchCallCount; }
  resetOperationCount(): void { this.#operationCount = 0; }

  async batch(statements: InMemoryD1PreparedStatement[]): Promise<InMemoryD1Result[]> {
    this.#batchCallCount += 1;
    this.#database.exec('BEGIN IMMEDIATE;');
    try {
      const results: InMemoryD1Result[] = [];
      for (const statement of statements) results.push(await statement.executeBatch());
      this.#database.exec('COMMIT;');
      return results;
    } catch (error) {
      this.#database.exec('ROLLBACK;');
      throw error;
    }
  }
}

class InMemoryDefaultCache {
  readonly #entries = new Map<string, CacheEntry>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const requestUrl = request instanceof Request ? request.url : String(request);
    return this.#entries.get(requestUrl)?.response.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const requestUrl = request instanceof Request ? request.url : String(request);
    this.#entries.set(requestUrl, { requestUrl, response: response.clone() });
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const requestUrl = request instanceof Request ? request.url : String(request);
    return this.#entries.delete(requestUrl);
  }

  clear(): void {
    this.#entries.clear();
  }
}

type StoredR2Object = {
  bytes: Uint8Array;
  contentType: string;
};

class InMemoryProductImages {
  readonly #objects = new Map<string, StoredR2Object>();

  putObject(key: string, bytes: Uint8Array, contentType: string): void {
    this.#objects.set(key, { bytes: Uint8Array.from(bytes), contentType });
  }

  async get(key: string): Promise<{
    httpMetadata: { contentType: string };
    arrayBuffer: () => Promise<ArrayBuffer>;
  } | null> {
    const stored = this.#objects.get(key);
    if (!stored) return null;
    return {
      httpMetadata: { contentType: stored.contentType },
      arrayBuffer: async () => stored.bytes.slice().buffer,
    };
  }
}

export type ProductionKnowledgeHonoHarness = {
  cache: InMemoryDefaultCache;
  close: () => void;
  db: unknown;
  exec: (sql: string) => void;
  fetch: (request: Request) => Promise<Response>;
  putR2Object: (key: string, bytes: Uint8Array, contentType: string) => void;
  databaseOperationCount: () => number;
  databaseBatchCallCount: () => number;
  resetDatabaseOperationCount: () => void;
  run: (sql: string, ...bindings: unknown[]) => void;
};

export type KnowledgeArticleSeed = {
  articleLayer: 'main_article' | 'single_study';
  body: string;
  createdAt: string;
  ingredientId: number;
  interpretation?: {
    ingredientId: number;
    sourceId: number;
    status: string;
  };
  reviewedAt: string | null;
  slug: string;
  sources: Array<{ source_id: string; label: string; url: string }>;
  status: string;
  summary: string;
  title: string;
  updatedAt: string;
  seo?: Record<string, unknown> | null;
};

export function createProductionKnowledgeSchema(harness: ProductionKnowledgeHonoHarness): void {
  harness.exec(`
    CREATE TABLE ingredients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE ingredient_synonyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      synonym TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'de'
    );
    CREATE TABLE ingredient_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      name TEXT NOT NULL
    );
    CREATE TABLE ingredient_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      internal_comment TEXT,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE ingredient_part_synonyms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      synonym TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'de'
    );
    CREATE TABLE ingredient_part_links (
      ingredient_id INTEGER NOT NULL,
      part_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ingredient_id, part_id)
    );
    CREATE TABLE knowledge_articles (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      article_layer TEXT,
      reviewed_at TEXT,
      sources_json TEXT NOT NULL DEFAULT '[]',
      conclusion TEXT,
      featured_image_url TEXT,
      featured_image_r2_key TEXT,
      dose_min REAL,
      dose_max REAL,
      dose_unit TEXT,
      product_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE knowledge_article_ingredients (
      article_slug TEXT NOT NULL,
      ingredient_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT
    );
    CREATE TABLE knowledge_article_parts (
      article_slug TEXT NOT NULL,
      ingredient_id INTEGER NOT NULL,
      part_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (article_slug, ingredient_id, part_id)
    );
    CREATE TABLE knowledge_article_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_slug TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE ingredient_research_sources (
      id INTEGER PRIMARY KEY,
      ingredient_id INTEGER NOT NULL,
      source_kind TEXT NOT NULL DEFAULT 'study',
      source_title TEXT,
      source_url TEXT,
      doi TEXT,
      pubmed_id TEXT
    );
    CREATE TABLE study_interpretation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER,
      ingredient_id INTEGER NOT NULL,
      knowledge_article_slug TEXT,
      status TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE dose_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_label TEXT,
      source_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      stage4_cluster_id TEXT,
      stage4_source_kind TEXT,
      knowledge_article_slug TEXT,
      amount_type TEXT,
      reported_amount_text TEXT,
      stack_role TEXT,
      stack_visible INTEGER,
      relevance_reason TEXT,
      is_controversial INTEGER,
      valid_from TEXT,
      valid_until TEXT,
      stage4_status TEXT
    );
    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      moderation_status TEXT NOT NULL,
      visibility TEXT NOT NULL
    );
    CREATE TABLE product_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      ingredient_id INTEGER NOT NULL
    );
  `);
  harness.exec(readFileSync(
    new URL('../../../d1-migrations/0095_knowledge_overview_projection.sql', import.meta.url),
    'utf8',
  ));
  harness.exec(readFileSync(
    new URL('../../../d1-migrations/0096_knowledge_article_seo.sql', import.meta.url),
    'utf8',
  ));
}

export function seedProductionKnowledgeArticle(
  harness: ProductionKnowledgeHonoHarness,
  article: KnowledgeArticleSeed,
): void {
  const sourcesJson = JSON.stringify({
    schema: 'knowledge_article_sources_projection.v2',
    facts_package_hash: `sha256:${'a'.repeat(64)}`,
    relations: article.sources,
  });
  harness.run(`
    INSERT INTO knowledge_articles (
      slug, title, summary, body, status, article_layer, reviewed_at, sources_json, seo_json,
      conclusion, featured_image_url, featured_image_r2_key, dose_min, dose_max,
      dose_unit, product_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)
  `,
  article.slug,
  article.title,
  article.summary,
  article.body,
  article.status,
  article.articleLayer,
  article.reviewedAt,
  sourcesJson,
  article.seo == null ? null : JSON.stringify(article.seo),
  article.createdAt,
  article.updatedAt);
  harness.run(
    'INSERT INTO knowledge_article_ingredients (article_slug, ingredient_id, sort_order) VALUES (?, ?, 0)',
    article.slug,
    article.ingredientId,
  );
  article.sources.forEach((source, sortOrder) => harness.run(
    'INSERT INTO knowledge_article_sources (article_slug, label, url, sort_order) VALUES (?, ?, ?, ?)',
    article.slug,
    source.label,
    source.url,
    sortOrder,
  ));
  if (article.interpretation) {
    harness.run(`
      INSERT INTO study_interpretation_records (
        source_id, ingredient_id, knowledge_article_slug, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    article.interpretation.sourceId,
    article.interpretation.ingredientId,
    article.slug,
    article.interpretation.status,
    article.createdAt,
    article.updatedAt);
  }
}

export function createProductionKnowledgeHonoHarness(): ProductionKnowledgeHonoHarness {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const d1 = new InMemoryD1Database(sqlite);
  const productImages = new InMemoryProductImages();
  const cache = new InMemoryDefaultCache();
  const previousCachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { default: cache },
    writable: true,
  });

  let closed = false;
  return {
    cache,
    db: d1,
    databaseBatchCallCount(): number { return d1.batchCallCount; },
    databaseOperationCount(): number { return d1.operationCount; },
    exec(sql: string): void {
      if (closed) throw new Error('Hono-Testharness ist bereits geschlossen.');
      sqlite.exec(sql);
    },
    run(sql: string, ...bindings: unknown[]): void {
      if (closed) throw new Error('Hono-Testharness ist bereits geschlossen.');
      sqlite.prepare(sql).run(...bindings.map(normalizeSqlBinding));
    },
    putR2Object(key: string, bytes: Uint8Array, contentType: string): void {
      if (closed) throw new Error('Hono-Testharness ist bereits geschlossen.');
      productImages.putObject(key, bytes, contentType);
    },
    resetDatabaseOperationCount(): void { d1.resetOperationCount(); },
    async fetch(request: Request): Promise<Response> {
      if (closed) throw new Error('Hono-Testharness ist bereits geschlossen.');
      const url = new URL(request.url);
      const waitUntilPromises: Promise<unknown>[] = [];
      const executionContext = {
        passThroughOnException(): void {},
        props: {},
        waitUntil(promise: Promise<unknown>): void { waitUntilPromises.push(promise); },
      };
      const env = {
        DB: d1,
        PRODUCT_IMAGES: productImages,
      };
      let response: Response;
      if (url.pathname === '/api/knowledge'
        || url.pathname.startsWith('/api/knowledge/')
        || url.pathname === '/api/public-stats'
        || url.pathname === '/api/ingredients'
        || url.pathname.startsWith('/api/ingredients/')
        || url.pathname === '/api/r2'
        || url.pathname.startsWith('/api/r2/')) {
        response = await fetchProductionKnowledgeHono(
          request,
          env,
          executionContext,
        );
      } else {
        response = new Response(JSON.stringify({ error: 'Testharness route not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }
      await Promise.all(waitUntilPromises);
      return response;
    },
    close(): void {
      if (closed) return;
      closed = true;
      cache.clear();
      sqlite.close();
      if (previousCachesDescriptor) Object.defineProperty(globalThis, 'caches', previousCachesDescriptor);
      else Reflect.deleteProperty(globalThis, 'caches');
    },
  };
}
