import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function assertFile(path) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} must exist`)
  return read(path)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractRequiredBlock(source, pattern, description) {
  const match = source.match(pattern)
  assert.ok(match, description)
  return match[0]
}

const dosingPage = read('frontend/src/pages/administrator/AdministratorDosingPage.tsx')
const dashboardPage = read('frontend/src/pages/administrator/AdministratorDashboardPage.tsx')
const ingredientsPage = read('frontend/src/pages/administrator/AdministratorIngredientsPage.tsx')
const productsPage = read('frontend/src/pages/administrator/AdministratorProductsPage.tsx')
const productDetailPage = read('frontend/src/pages/administrator/AdministratorProductDetailPage.tsx')
const productQaPage = read('frontend/src/pages/administrator/AdministratorProductQAPage.tsx')
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

assert.match(
  productsPage,
  /admin-filter-search-with-icon/,
  'Admin products search field must reserve icon space via the shared icon-search class',
)
assert.match(
  productsPage,
  /subtitle="Produkte anlegen, verwalten und freigeben"/,
  'Admin products page subtitle must use the follow-up owner wording',
)
assert.match(
  productsPage,
  /admin-filter-label">\s*Suche\s*<\/span>/,
  'Admin products search field must have a visible Suche label',
)
assert.doesNotMatch(
  productsPage,
  />\s*Suchen\s*</,
  'Admin products toolbar must not keep a separate Suchen button',
)
assert.match(
  productsPage,
  /useRef/,
  'Admin products page must use a React-safe latest-request guard for overlapping product loads',
)
assert.match(
  productsPage,
  /loadProductsRequestIdRef/,
  'Admin products loadProducts must track the latest request before updating product state',
)
const loadProductsBlock = extractRequiredBlock(
  productsPage,
  /const loadProducts = useCallback\(async \(\) => \{[\s\S]*?\}, \[affiliate, image, limit, linkStatus, moderation, page, query\]\);/,
  'Admin products must keep product loading in a memoized loadProducts callback',
)
assert.match(
  loadProductsBlock,
  /const requestId = loadProductsRequestIdRef\.current \+ 1;[\s\S]*loadProductsRequestIdRef\.current = requestId;/,
  'Admin products loadProducts must assign a new latest request id for each request',
)
assert.match(
  loadProductsBlock,
  /const isLatestRequest = \(\) => loadProductsRequestIdRef\.current === requestId;/,
  'Admin products loadProducts must compare responses against the latest request id',
)
assert.match(
  loadProductsBlock,
  /if \(!isLatestRequest\(\)\) return;[\s\S]*setProducts\(response\.products\);[\s\S]*setTotal\(response\.total\);/,
  'Admin products loadProducts must guard product and total success updates against stale requests',
)
assert.match(
  loadProductsBlock,
  /catch \(err\) \{[\s\S]*if \(!isLatestRequest\(\)\) return;[\s\S]*setProducts\(\[\]\);[\s\S]*setTotal\(0\);[\s\S]*setError\(/,
  'Admin products loadProducts must guard error updates against stale requests',
)
assert.match(
  loadProductsBlock,
  /finally \{[\s\S]*if \(isLatestRequest\(\)\) \{[\s\S]*setLoading\(false\);[\s\S]*\}/,
  'Admin products loadProducts must guard loading=false against stale requests',
)
const queryInputEffect = extractRequiredBlock(
  productsPage,
  /useEffect\(\(\) => \{[\s\S]*?window\.setTimeout[\s\S]*?\}, \[queryInput\]\);/,
  'Admin products search input must update the product query automatically from the queryInput effect',
)
for (const effectRequirement of [
  ['window.setTimeout', /window\.setTimeout/],
  ['window.clearTimeout', /window\.clearTimeout\(timeoutId\)/],
  ['setPage(1)', /setPage\(1\)/],
  ['setQuery(nextQuery)', /setQuery\(nextQuery\)/],
]) {
  const [label, pattern] = effectRequirement
  assert.match(queryInputEffect, pattern, `Admin products queryInput effect must include ${label}`)
}
const refreshButtonMatch = productsPage.match(
  /<button\b[\s\S]*?className="[^"]*\badmin-filter-refresh\b[^"]*"[\s\S]*?aria-label="Aktualisieren"[\s\S]*?>\s*([\s\S]*?)\s*<\/button>/,
)
assert.ok(refreshButtonMatch, 'Admin products refresh action must remain a dedicated icon-only button')
const refreshButtonBlock = refreshButtonMatch[0]
const refreshButtonInner = refreshButtonMatch[1]
assert.match(
  refreshButtonBlock,
  /aria-label="Aktualisieren"/,
  'Admin products refresh action must remain available to screen readers',
)
assert.match(
  refreshButtonBlock,
  /title="Aktualisieren"/,
  'Admin products refresh action may keep a hover title for the icon-only button',
)
assert.match(
  refreshButtonInner,
  /<RefreshCw\b/,
  'Admin products refresh action must render the refresh icon',
)
assert.doesNotMatch(
  refreshButtonInner,
  new RegExp(`\\b${escapeRegExp('Aktualisieren')}\\b`),
  'Admin products refresh action must not render visible Aktualisieren text',
)
assert.doesNotMatch(productsPage, /Zurueck/, 'Admin products pagination must use the German umlaut spelling for Zurueck')
assert.doesNotMatch(productsPage, /Loeschen/, 'Admin products delete buttons must use the German umlaut spelling for Loeschen')
assert.doesNotMatch(productsPage, />\s*Recheck\s*</, 'Admin products shop-link action must be renamed from Recheck to Neu pruefen')
assert.doesNotMatch(productsPage, /Schliessen/, 'Admin products modal close button must use the German sharp-s spelling')
assert.doesNotMatch(
  productsPage,
  /onImageDelete/,
  'Admin product rows must not expose inline image delete; image actions belong in the image modal',
)
for (const label of ['Link: Defekt', 'Link: OK', 'Link: Noch nicht']) {
  assert.match(productsPage, new RegExp(label), `Admin products must use normalized link-status wording: ${label}`)
}
for (const label of ['Freigabe', 'Partner-Status', 'Linkstatus', 'Produktbild']) {
  assert.match(productsPage, new RegExp(`admin-filter-label[\\s\\S]*${label}`), `Admin products filters must label ${label}`)
}
assert.match(
  productsPage,
  /<option value="all">Alle<\/option>/,
  'Admin products filter default options must read Alle after adding visible labels',
)
assert.match(productsPage, /Link-Klicks:\s*\{product\.link_click_count\}/, 'Admin products list must show Link-Klicks badge per product')
assert.match(productsPage, /admin-badge-warn[^>]*>\s*Link-Klicks:/, 'Admin products Link-Klicks badge must use yellow warning styling')
assert.match(productsPage, /Weiteren Link/, 'Admin products shop-link create form must allow adding another link row')
assert.match(productsPage, /type ShopLinkRole = 'primary' \| 'alternative' \| 'standard'/, 'Admin products shop-link editor must model Hauptlink/Alternative/Standard roles')
for (const roleLabel of ['Hauptlink', 'Alternative', 'Standard']) {
  assert.match(productsPage, new RegExp(`<option value="[^"]+">${roleLabel}<\\/option>`), `Admin products link role dropdown must include ${roleLabel}`)
}
assert.match(productsPage, /admin-url-input/, 'Admin products editable URL fields must use explicit white edit styling')
assert.match(productsPage, /admin-toggle-card/, 'Admin products affiliate/active controls must use the compact toggle-card styling')
assert.match(productsPage, /Affiliate-Link:\s*\{form\.is_affiliate \? 'Ja' : 'Nein'\}/, 'Admin products affiliate toggle must show Affiliate-Link: Ja/Nein')
assert.match(productsPage, /form\.is_affiliate \? 'admin-toggle-card-ok' : 'admin-toggle-card-danger'/, 'Admin products affiliate toggle must use green/red state styling')
assert.match(productsPage, /admin-btn-success/, 'Admin products shop-link save action must use the green success button styling')
assert.match(productsPage, /admin-icon-btn-warn/, 'Admin products external-link icon beside URL fields must use yellow styling')
assert.doesNotMatch(
  productsPage,
  /Hauptlinks direkt bearbeiten, weitere Links/,
  'Admin products list subtitle must not use the old technical copy',
)
assert.doesNotMatch(
  productsPage,
  /Links, Freigabe und Bilder an einem Ort pflegen\./,
  'Admin products list card subtitle must be removed',
)
assert.match(adminCss, /\.admin-filter-label/, 'Admin CSS must define compact filter labels')
assert.match(adminCss, /\.admin-url-input/, 'Admin CSS must define editable white URL field styling')
assert.match(adminCss, /\.admin-toggle-card/, 'Admin CSS must define modern toggle-card controls')
assert.match(adminCss, /\.admin-toggle-card-ok/, 'Admin CSS must define green affiliate toggle-card state')
assert.match(adminCss, /\.admin-toggle-card-danger/, 'Admin CSS must define red affiliate toggle-card state')
assert.match(adminCss, /\.admin-btn-success/, 'Admin CSS must define green save buttons')
assert.match(adminCss, /\.admin-icon-btn-warn/, 'Admin CSS must define yellow external-link icon buttons')
assert.match(adminApi, /link_click_count: number/, 'AdminCatalogProduct must type link_click_count')
assert.match(adminApi, /link_click_count: toIntOrNull\(raw\.link_click_count\) \?\? 0/, 'Admin catalog parser must normalize link_click_count')
assert.match(
  adminModule,
  /product_link_clicks[\s\S]*WHERE product_type = 'catalog'[\s\S]*GROUP BY product_id[\s\S]*link_click_count/,
  'Admin products API must aggregate only catalog product_link_clicks by product_id',
)
assert.match(
  adminModule,
  /product_shop_links psl_effective[\s\S]*product_shop_link_health pslh/,
  'Admin products API must join active primary/fallback shop-link health for product rows',
)
assert.match(
  adminModule,
  /formatProductShopLinkHealth\(row\) \?\? formatAffiliateLinkHealth\(row\)/,
  'Admin products API must prefer active primary/fallback shop-link health before legacy affiliate_link_health',
)
assert.match(
  adminModule,
  /withProductListLinkHealth\(product\)[\s\S]*link_click_count/,
  'Admin products API response must include link_click_count with each product',
)
const shopLinkPayloadFunction = productsPage.match(/function payloadFromShopLinkForm[\s\S]*?\n}\r?\n\r?\nfunction buildPatch/)?.[0] ?? ''
assert.doesNotMatch(
  shopLinkPayloadFunction,
  /source_type: 'admin'/,
  'Admin products shop-link edit payload must not overwrite source_type on PATCH',
)
assert.match(
  productsPage,
  /createAdminProductShopLink\(product\.id,\s*\{ \.\.\.payload,\s*source_type: 'admin' \}\)/,
  'Admin products shop-link create path may set source_type=admin explicitly',
)
for (const page of [
  ['Product Detail', productDetailPage],
  ['Product QA', productQaPage],
]) {
  const [label, source] = page
  const linkHealthLabelFunction = source.match(/function linkHealthLabel[\s\S]*?\n}\r?\n/)?.[0] ?? ''
  for (const statusLabel of ['Link: Defekt', 'Link: OK', 'Link: Noch nicht']) {
    assert.match(linkHealthLabelFunction, new RegExp(statusLabel), `${label} must use normalized link-status wording: ${statusLabel}`)
  }
  assert.doesNotMatch(linkHealthLabelFunction, /Link ok|Link fehlgeschlagen|Timeout|Ung(?:ü|\\u00fc)ltiger Link/, `${label} must not use old verbose link-status labels`)
}
