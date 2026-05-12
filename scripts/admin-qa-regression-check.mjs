import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assertFile(path) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`)
  return read(path)
}

const dosingPage = read('frontend/src/pages/administrator/AdministratorDosingPage.tsx')
const dashboardPage = read('frontend/src/pages/administrator/AdministratorDashboardPage.tsx')
const ingredientsPage = read('frontend/src/pages/administrator/AdministratorIngredientsPage.tsx')
const adminCss = read('frontend/src/pages/administrator/admin.css')
const adminApi = read('frontend/src/api/admin.ts')
const apiEntry = read('functions/api/[[path]].ts')
const adminModule = read('functions/api/modules/admin.ts')
const stacksModule = read('functions/api/modules/stacks.ts')
const authModule = read('functions/api/modules/auth.ts')
const analyticsModule = assertFile('functions/api/modules/analytics.ts')
const frontendAnalytics = read('frontend/src/lib/analytics.ts')
const frontendAuthApi = read('frontend/src/api/auth.ts')
const typesFile = read('frontend/src/types/index.ts')
const migration76 = assertFile('d1-migrations/0076_admin_dashboard_tracking.sql')
const migration77 = assertFile('d1-migrations/0077_signup_referral_attribution.sql')
const hiddenDoseMatch = dosingPage.match(/function isHiddenAdminDose[\s\S]*?^}/m)
assert.ok(hiddenDoseMatch, 'AdministratorDosingPage must define isHiddenAdminDose')
assert.equal(
  hiddenDoseMatch[0].includes('is_public'),
  false,
  'Admin dosing list must not hide unpublished dose recommendations',
)

assert.match(
  dosingPage,
  /useSearchParams/,
  'AdministratorDosingPage must initialize filters from URL search params',
)
assert.match(
  dosingPage,
  /searchParams\.get\('ingredient_id'\)/,
  'AdministratorDosingPage must read ingredient_id from URL search params',
)
assert.match(
  dosingPage,
  /searchParams\.get\('q'\)/,
  'AdministratorDosingPage must read q from URL search params',
)

assert.match(apiEntry, /app\.route\('\/api\/analytics', analytics\)/, 'API entry must mount /api/analytics')

for (const newLabel of [
  'Neue Stacks',
  'Neuanmeldungen',
  'Abmeldungen',
  'Backlinks',
  'Aufrufe über Google',
  'Wirkstoffe ohne Artikel',
  'Deadlinks wurden geklickt',
  'Stacks wurden verschickt',
]) {
  assert.match(
    dashboardPage,
    new RegExp(newLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `AdministratorDashboardPage must show dashboard label/copy: ${newLabel}`,
  )
}

for (const backendSignal of [
  'stack_email_events',
  'account_deletion_events',
  'page_view_events',
  'signup_attribution',
  'visitor_id',
  'last_seen_at',
  'stack_email_sends',
  'account_deletions',
  'inactive_users',
  'backlinks',
  'google_pageviews',
  'deadlink_clicks',
  'user_affiliate_links_active',
  'link_report_users',
  'ingredients_without_article',
  'referral_sources',
]) {
  assert.match(adminModule, new RegExp(backendSignal), `admin stats must expose or calculate ${backendSignal}`)
}

assert.match(stacksModule, /INSERT INTO stack_email_events/, 'stacks module must record successful stack email events')
assert.match(authModule, /UPDATE users SET last_seen_at = datetime\('now'\)/, 'auth module must update users.last_seen_at on active sessions')
assert.match(authModule, /INSERT INTO account_deletion_events/, 'auth module must record account deletion events before hard delete')
assert.match(authModule, /INSERT INTO signup_attribution/, 'auth module must record signup attribution from first-party referral state')
assert.match(analyticsModule, /INSERT INTO page_view_events[\s\S]*visitor_id/, 'analytics module must store visitor_id with page view events')
assert.match(frontendAnalytics, /getSignupAttribution/, 'frontend analytics must expose signup attribution for registration')
assert.match(frontendAuthApi, /attribution:\s*getSignupAttribution\(\)/, 'register API must send signup attribution')

for (const statsField of [
  'stack_email_sends',
  'account_deletions',
  'inactive_users',
  'backlinks',
  'google_pageviews',
  'deadlink_clicks',
  'user_affiliate_links_active',
  'link_report_users',
  'ingredients_without_article',
  'user_products_pending',
  'user_products_pending_in_range',
]) {
  assert.match(typesFile, new RegExp(`${statsField}\\?: number`), `AdminStats must type ${statsField}`)
}

assert.match(typesFile, /referral_sources\?: AdminStatsReferralSource\[\]/, 'AdminStats must type referral_sources as source rows')
assert.match(migration76, /CREATE TABLE IF NOT EXISTS stack_email_events/, 'migration 0076 must create stack email tracking')
assert.match(migration76, /CREATE TABLE IF NOT EXISTS account_deletion_events/, 'migration 0076 must create account deletion tracking')
assert.match(migration76, /CREATE TABLE IF NOT EXISTS page_view_events/, 'migration 0076 must create page view tracking')
assert.match(migration77, /ALTER TABLE page_view_events ADD COLUMN visitor_id/, 'migration 0077 must add visitor IDs to page views')
assert.match(migration77, /CREATE TABLE IF NOT EXISTS signup_attribution/, 'migration 0077 must create signup attribution tracking')

assert.match(
  ingredientsPage,
  /if \(count > 0\) return String\(count\)/,
  'Ingredient progress badges must show numeric counts without repeating object labels',
)
assert.doesNotMatch(
  ingredientsPage,
  /countLabel\(count,\s*'Synonym'/,
  'Ingredient synonym badge must not render "1 Synonym" after the Synonyme label',
)
assert.match(
  ingredientsPage,
  /function RecommendationModal\(\{\s*ingredient,\s*onClose,\s*onChanged,/,
  'Ingredient recommendations must open one modal for all three slots, not one modal per slot',
)
assert.doesNotMatch(
  ingredientsPage,
  /slot:\s*AdminIngredientProductRecommendationSlot;/,
  'Ingredient recommendation modal state must not store a single active slot',
)
assert.match(
  ingredientsPage,
  /getAdminProducts\(\{\s*q:[\s\S]*ingredient_id:\s*ingredient\.id/,
  'Recommendation product search must be constrained to the current ingredient context',
)
assert.doesNotMatch(
  ingredientsPage,
  /<th>Aktionen<\/th>/,
  'Ingredient table must not show a separate Aktionen column',
)
assert.match(
  ingredientsPage,
  /to=\{`\/administrator\/ingredients\/\$\{ingredient\.id\}`\}/,
  'Ingredient name must be a keyboard-accessible link to details',
)
assert.match(
  ingredientsPage,
  /ingredientGroupFilter/,
  'Ingredient page must expose an ingredient group dropdown filter',
)
assert.match(
  ingredientsPage,
  /Alle Gruppen/,
  'Ingredient group dropdown must include Alle Gruppen',
)
for (const label of ['Vitamine', 'Mineralstoffe', 'Spurenelemente', 'Enzyme']) {
  assert.match(ingredientsPage, new RegExp(label), `Ingredient group dropdown must include ${label}`)
}
assert.match(
  adminCss,
  /\.admin-filter-search-with-icon[\s\S]*padding-left:\s*34px\s*!important/,
  'Admin search field must reserve icon space with scoped CSS, not only Tailwind utilities',
)
assert.match(
  adminApi,
  /ingredient_group/,
  'Frontend admin API must pass ingredient_group to /api/admin/ingredients',
)
assert.match(
  adminApi,
  /ingredient_id\?: number/,
  'Frontend admin product search must support ingredient_id context filtering',
)
assert.match(
  adminModule,
  /adminHiddenIngredientCondition/,
  'Admin ingredients API must hide non-top-level ingredient names safely',
)
assert.match(
  adminModule,
  /B-Vitamin-Komplex/,
  'Admin ingredients API must hide B-Vitamin-Komplex from the top-level list',
)
assert.match(
  adminModule,
  /DPA/,
  'Admin ingredients API must hide DPA from the top-level list while keeping Omega-3 sub-ingredient data',
)
assert.match(
  adminModule,
  /ingredient_group/,
  'Admin ingredients API must implement an ingredient_group filter',
)
assert.match(
  adminModule,
  /product_ingredients pi[\s\S]*pi\.ingredient_id = \?/,
  'Admin products API must support ingredient_id filtering for recommendation search',
)
assert.match(
  adminModule,
  /FROM product_ingredients\s+WHERE product_id = \?[\s\S]*ingredient_id = \?[\s\S]*COALESCE\(search_relevant,\s*1\) = 1/,
  'Ingredient product recommendation upsert must require the selected product to be linked to the current ingredient as search-relevant',
)
