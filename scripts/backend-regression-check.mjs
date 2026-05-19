import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function routeBlock(source, route) {
  const marker = `auth.post('/${route}'`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `Missing auth route ${route}`)
  const nextRoute = source.indexOf('\nauth.', start + marker.length)
  return source.slice(start, nextRoute === -1 ? source.length : nextRoute)
}

const auth = read('functions/api/modules/auth.ts')
for (const route of ['register', 'forgot-password', 'reset-password', 'login']) {
  const block = routeBlock(auth, route)
  assert.match(block, /try\s*{[\s\S]*await c\.req\.json\(\)[\s\S]*}\s*catch\s*{[\s\S]*Invalid JSON/, `${route} must return 400 for invalid JSON`)
}

for (const path of ['functions/api/modules/auth.ts', 'functions/api/modules/stacks.ts']) {
  assert.equal(read(path).includes('debug:'), false, `${path} must not expose debug fields in API responses`)
}

const csvPath = new URL('../functions/api/lib/csv.ts', import.meta.url)
assert.equal(existsSync(csvPath), true, 'functions/api/lib/csv.ts must exist')
const csv = read('functions/api/lib/csv.ts')
assert.match(csv, /export function csvEscape/, 'csvEscape must be exported for regression coverage')
assert.match(csv, /[=+@]/, 'csvEscape must neutralize spreadsheet formula prefixes')
assert.match(csv, /charAt\(0\)|startsWith|\[0\]/, 'csvEscape must inspect the first character')

const migrationPath = new URL('../d1-migrations/0082_stack_custom_layout.sql', import.meta.url)
assert.equal(existsSync(migrationPath), true, '0082_stack_custom_layout.sql must exist')
const migration = read('d1-migrations/0082_stack_custom_layout.sql')
assert.match(migration, /CREATE TABLE IF NOT EXISTS stack_categories/i, 'migration must create stack_categories')
assert.match(migration, /name_normalized TEXT NOT NULL/i, 'migration must include normalized category names')
assert.match(migration, /ALTER TABLE stack_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0/i, 'migration must add stack_items.sort_order')
assert.match(migration, /ALTER TABLE stack_items ADD COLUMN category_id INTEGER REFERENCES stack_categories\(id\) ON DELETE SET NULL/i, 'migration must add stack_items.category_id FK')
assert.match(migration, /WHERE is_default = 1/i, 'migration must enforce one default category per stack')
assert.match(migration, /INSERT INTO stack_categories[\s\S]*'Unkategorisiert'/i, 'migration must backfill default category')
assert.match(migration, /UPDATE stack_items[\s\S]*SET category_id/i, 'migration must backfill stack item category_id')

const stacks = read('functions/api/modules/stacks.ts')
assert.match(stacks, /ORDER BY base\.sort_order ASC, base\.stack_item_id ASC/, 'stack item loading must sort by sort_order then stack_item_id')
assert.match(stacks, /stacks\.post\('\/:id\/categories'/, 'stacks module must expose create category route')
assert.match(stacks, /stacks\.patch\('\/:id\/categories\/:categoryId'/, 'stacks module must expose update category route')
assert.match(stacks, /stacks\.delete\('\/:id\/categories\/:categoryId'/, 'stacks module must expose delete category route')
assert.match(stacks, /stacks\.put\('\/:id\/items\/layout'/, 'stacks module must expose layout route')
assert.match(stacks, /name must be a string between 1 and 80 characters/, 'category name length validation must exist')
assert.match(stacks, /Category name already exists in this stack/, 'duplicate category name validation must exist')
assert.match(stacks, /category_id must belong to this stack/, 'category ownership validation must exist')
assert.match(stacks, /items must include all stack items exactly once/, 'layout route must validate full stack coverage')
assert.match(stacks, /INSERT INTO stack_items[\s\S]*sort_order, category_id/, 'stack item writes must persist sort/category fields')
assert.match(stacks, /let existingLayoutByProductKey = new Map/, 'PUT stack update must load existing layout metadata by product key')
assert.match(stacks, /SELECT[\s\S]*id AS stack_item_id[\s\S]*sort_order[\s\S]*category_id[\s\S]*COALESCE\(catalog_product_id, user_product_id\) AS product_id[\s\S]*FROM stack_items[\s\S]*WHERE stack_id = \?/, 'PUT stack update must read existing stack item layout before delete')
assert.match(stacks, /item\.sort_order \?\? existingLayout\?\.sort_order \?\? nextFallbackSortOrder\+\+/, 'PUT stack update must preserve existing sort_order when sort is omitted')
assert.match(stacks, /item\.category_id === undefined[\s\S]*existingLayout\?\.category_id[\s\S]*defaultCategory\.id/, 'PUT stack update must preserve existing category_id when category is omitted')
assert.match(stacks, /return c\.json\(\{ stack, items, categories, total \}\)/, 'GET /api/stacks/:id must return categories')
