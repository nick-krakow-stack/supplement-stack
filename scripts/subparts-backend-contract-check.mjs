import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const files = Object.fromEntries(await Promise.all([
  'functions/api/lib/ingredient-parts.ts',
  'functions/api/modules/products.ts',
  'functions/api/modules/user-products.ts',
  'functions/api/modules/ingredients.ts',
  'functions/api/modules/stacks.ts',
  'functions/api/modules/knowledge.ts',
  'functions/api/modules/admin.ts',
  'functions/api/modules/demo.ts',
].map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])))

function includes(path, fragments) {
  for (const fragment of fragments) {
    assert.ok(files[path].includes(fragment), `${path} is missing contract fragment: ${fragment}`)
  }
}

includes('functions/api/lib/ingredient-parts.ts', [
  'sameEffectiveBasis',
  'convertAmount(part.quantity, part.unit, parent.unit)',
  'comparableTotal > parent.quantity',
  "status !== 'active'",
  'Doppelte Sub-Wirkstoffe',
  'product_ingredient_parts',
  'user_product_ingredient_parts',
])

for (const path of [
  'functions/api/modules/products.ts',
  'functions/api/modules/user-products.ts',
]) {
  includes(path, [
    'parseIngredientParts',
    'validateIngredientPartReferences',
    'validatePartAmountSum',
    'parts:',
    'parent_ingredient_id wird nicht mehr unterstützt',
  ])
  assert.ok(!files[path].includes('SUB_INGREDIENT_PRODUCT_SCHEMA_ERROR'), `${path} still blocks canonical parts`)
}

includes('functions/api/modules/ingredients.ts', [
  'matched_part_id',
  'matched_part_name',
  "c.req.query('part_id')",
  'JOIN product_ingredient_parts pip',
  "p.visibility = 'public'",
  "p.moderation_status = 'approved'",
])

includes('functions/api/modules/stacks.ts', [
  'parts: ingredient.parts',
  'davon ${part.part_name}',
  'loadIngredientPartsByParentRows',
])
assert.ok(!files['functions/api/modules/stacks.ts'].includes('ingredients.push(...ingredient.parts)'), 'Part amounts must not be added to parent ingredient totals')

includes('functions/api/modules/knowledge.ts', [
  'knowledge_article_parts',
  'w.part_id',
  'product_ingredient_parts pip',
  'user_product_ingredient_parts upip',
  'is_parent_fallback',
].filter((fragment) => fragment !== 'is_parent_fallback'))

includes('functions/api/modules/admin.ts', [
  "admin.post('/ingredient-parts'",
  "admin.patch('/ingredient-parts/:partId'",
  "admin.post('/ingredient-parts/:partId/synonyms'",
  "admin.patch('/ingredient-part-synonyms/:synonymId'",
  "admin.delete('/ingredient-part-synonyms/:synonymId'",
  'create_ingredient_part_synonym',
  'update_ingredient_part_synonym',
  'delete_ingredient_part_synonym',
  'buildPublishedProductIngredientStatements',
  'Diese Legacy-Route ist',
])

includes('functions/api/modules/demo.ts', ['loadIngredientPartsByParentRows', 'parts:'])

console.log('subparts backend contract: PASS')
