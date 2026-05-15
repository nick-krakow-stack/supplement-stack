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
const adminShell = read('frontend/src/pages/administrator/AdministratorShell.tsx')
const dashboardPage = read('frontend/src/pages/administrator/AdministratorDashboardPage.tsx')
const ingredientsPage = read('frontend/src/pages/administrator/AdministratorIngredientsPage.tsx')
const productsPage = read('frontend/src/pages/administrator/AdministratorProductsPage.tsx')
const productCreatePage = assertFile('frontend/src/pages/administrator/AdministratorProductCreatePage.tsx')
const productDetailPage = read('frontend/src/pages/administrator/AdministratorProductDetailPage.tsx')
const productQaPage = read('frontend/src/pages/administrator/AdministratorProductQAPage.tsx')
const adminCss = read('frontend/src/pages/administrator/admin.css')
const appSource = read('frontend/src/App.tsx')
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
const adminNavGroupsBlock = extractRequiredBlock(
  adminShell,
  /const NAV_GROUPS:[\s\S]*?\n\];/,
  'AdministratorShell must define visible admin navigation groups',
)
assert.doesNotMatch(
  adminNavGroupsBlock,
  /Wechselwirkungs-Matrix|\/administrator\/interactions/,
  'Visible admin sidebar navigation must not include Wechselwirkungs-Matrix',
)
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
assert.match(
  dosingPage,
  /admin-filter-search-with-icon[\s\S]*className="admin-input admin-filter-search pl-9"/,
  'Admin dosing search field must use the shared single-frame icon-search input pattern',
)
assert.doesNotMatch(
  dosingPage,
  /admin-filter-search flex min-h-\[34px\][^"]*border/,
  'Admin dosing search must not keep the old outer framed label wrapper',
)
assert.match(
  dosingPage,
  /title=\{`Richtwert bearbeiten: \$\{ingredientName\}`\}[\s\S]*aria-label=\{`Richtwert bearbeiten: \$\{ingredientName\}`\}/,
  'Admin dosing rows must expose an accessible edit label per ingredient',
)
assert.match(
  dosingPage,
  /handleSelectRecommendation[\s\S]*focusEditPanel/,
  'Admin dosing row clicks must bring the edit panel into focus',
)
const dosingControlsBlock = extractRequiredBlock(
  dosingPage,
  /<div className="admin-filter-controls">[\s\S]*?<\/div>\s*<\/div>\s*\{error/,
  'Admin dosing toolbar controls must include filters and icon actions together',
)
assert.match(
  dosingControlsBlock,
  /title="Neu"[\s\S]*aria-label="Neu"[\s\S]*<Plus\b/,
  'Admin dosing Neu action must be an accessible icon-only plus button',
)
assert.doesNotMatch(
  dosingControlsBlock,
  />\s*Neu\s*</,
  'Admin dosing Neu action must not render visible Neu text',
)
assert.match(
  dosingControlsBlock,
  /className="admin-icon-btn admin-btn-success admin-filter-add"/,
  'Admin dosing Neu action must use icon-only green plus styling',
)
assert.match(
  dosingControlsBlock,
  /className="admin-icon-btn admin-icon-btn-warn admin-filter-refresh"/,
  'Admin dosing Aktualisieren action must use icon-only yellow refresh styling',
)
assert.match(
  dosingControlsBlock,
  /title="Aktualisieren"[\s\S]*aria-label="Aktualisieren"[\s\S]*<RefreshCw\b/,
  'Admin dosing Aktualisieren action must remain accessible with the refresh icon',
)
assert.doesNotMatch(
  dosingControlsBlock,
  />\s*Aktualisieren\s*</,
  'Admin dosing Aktualisieren action must not render visible text',
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
assert.match(
  productsPage,
  /const SHOP_DOMAINS_PATH = '\/admin\/shop-domains';/,
  'Admin products shop-domain dropdown should call /admin/shop-domains',
)
assert.doesNotMatch(
  productsPage,
  /apiClient\.get<[^>]*>\(\s*'\/api\/admin\/shop-domains'\)/,
  'Admin products shop-domain dropdown should not call /api/admin/shop-domains via apiClient',
)
const productRowBlock = extractRequiredBlock(
  productsPage,
  /function ProductRow\([\s\S]*?\r?\n}\r?\n\r?\n(?=function ShopLinksModal)/,
  'Admin products page must keep a ProductRow component before the shop-link modal',
)
assert.doesNotMatch(
  productRowBlock,
  /admin-toggle-card/,
  'Admin product rows must not keep the large affiliate admin-toggle-card in the row edit controls',
)
assert.match(
  productRowBlock,
  /onAffiliateEdit\(product\)/,
  'Admin product affiliate status badge must open the affiliate status modal',
)
assert.match(
  productRowBlock,
  /Affiliate-Link:\s*\{productIsAffiliate\(product\) \? 'Ja' : 'Nein'\}/,
  'Admin products affiliate badge must show Affiliate-Link: Ja/Nein in the product badge row',
)
assert.match(
  productRowBlock,
  /tone=\{productIsAffiliate\(product\) \? 'ok' : 'danger'\}/,
  'Admin products affiliate badge must use green/red status tone',
)
const affiliateStatusModalBlock = extractRequiredBlock(
  productsPage,
  /function AffiliateStatusModal\([\s\S]*?\r?\n}\r?\n\r?\n(?=function ProductImageModal)/,
  'Admin products page must include an AffiliateStatusModal component before the image modal',
)
assert.match(
  affiliateStatusModalBlock,
  /Hauptlink[\s\S]*shopLinkDraft[\s\S]*admin-url-input/,
  'Admin products affiliate status modal must make Hauptlink editable',
)
assert.match(
  affiliateStatusModalBlock,
  /<AdminButton[\s\S]*admin-icon-btn admin-btn-success[\s\S]*<Save size=\{14\}/,
  'Admin products affiliate status modal must expose a green save icon button next to Hauptlink',
)
assert.match(
  affiliateStatusModalBlock,
  /Affiliate-Link:\s*\{productIsAffiliate\(product\) \? 'Ja' : 'Nein'\}/,
  'Admin products affiliate status modal must show Affiliate-Link: Ja/Nein status',
)
assert.match(
  affiliateStatusModalBlock,
  /hasUnsavedShopLinkChange/,
  'Admin products affiliate status modal must track unsaved Hauptlink edits',
)
assert.match(
  affiliateStatusModalBlock,
  /attemptClose\(\)/,
  'Admin products affiliate status modal must use a guarded close handler',
)
assert.match(
  affiliateStatusModalBlock,
  /if\s*\(\s*saving\s*\)/,
  'Admin products affiliate status modal close handler must check saving state before closing',
)
assert.match(
  affiliateStatusModalBlock,
  /setMessage\('Speichervorgang läuft noch\.'\)/,
  'Admin products affiliate status modal should inform when close is blocked while saving',
)
assert.match(
  affiliateStatusModalBlock,
  /onMouseDown=\{\(event\) => \{[\s\S]*if \(event\.target === event\.currentTarget\)[\s\S]*attemptClose\(\);[\s\S]*\}/,
  'Admin products affiliate status modal should only close via attemptClose when clicking backdrop',
)
assert.match(
  affiliateStatusModalBlock,
  /setMessage\('Ungespeicherte Hauptlink[^']*'\)/,
  'Admin products affiliate status modal should warn when trying to close with unsaved Hauptlink changes',
)
assert.match(
  affiliateStatusModalBlock,
  /onChange=\{\(event\) => void handleAffiliateToggle\(event\.target\.checked\)\}/,
  'Admin products affiliate status modal must auto-save Affiliate toggle changes',
)
assert.match(
  affiliateStatusModalBlock,
  /buildPatch\([\s\S]*shop_link: product\.shop_link[\s\S]*is_affiliate: nextValue/,
  'Admin products affiliate status modal must save affiliate state without writing unsaved Hauptlink edits',
)
assert.match(
  affiliateStatusModalBlock,
  /const productIdRef = useRef\(product\.id\);/,
  'Admin products affiliate status modal should track current product id for draft synchronization',
)
assert.match(
  affiliateStatusModalBlock,
  /if \(\s*productIdRef\.current === product\.id\)\s*return;/,
  'Admin products affiliate status modal should ignore same-product prop refreshes for draft initialization',
)
assert.match(
  affiliateStatusModalBlock,
  /}, \[product\.id\]\);/,
  'Admin products affiliate status modal draft-sync effect should be keyed by product id',
)
assert.doesNotMatch(
  affiliateStatusModalBlock,
  /\}, \[product\]\);/,
  'Admin products affiliate status modal draft-sync effect should not depend on the whole product object',
)
assert.match(
  affiliateStatusModalBlock,
  /updateProductQA\(\s*product\.id,\s*[\s\S]*buildPatch\(/,
  'Admin products affiliate status modal must save through the existing product QA update path',
)
assert.doesNotMatch(
  affiliateStatusModalBlock,
  /Abbrechen/,
  'Admin products affiliate status modal must not include a generic Abbrechen button',
)
assert.doesNotMatch(
  affiliateStatusModalBlock,
  /<AdminButton variant="primary"/,
  'Admin products affiliate status modal must not keep a generic bottom primary Speichern button',
)
assert.match(productsPage, /Weiteren Link/, 'Admin products shop-link create form must allow adding another link row')
assert.match(productsPage, /type ShopLinkRole = 'primary' \| 'alternative' \| 'standard'/, 'Admin products shop-link editor must model Hauptlink/Alternative/Standard roles')
for (const roleLabel of ['Hauptlink', 'Alternative', 'Standard']) {
  assert.match(productsPage, new RegExp(`<option value="[^"]+">${roleLabel}<\\/option>`), `Admin products link role dropdown must include ${roleLabel}`)
}
assert.match(productsPage, /admin-url-input/, 'Admin products editable URL fields must use explicit white edit styling')
assert.match(productsPage, /admin-toggle-card/, 'Admin products affiliate/active controls must use the compact toggle-card styling')
assert.match(productsPage, /admin-btn-success/, 'Admin products shop-link save action must use the green success button styling')
assert.match(productsPage, /admin-icon-btn-warn/, 'Admin products external-link icon beside URL fields must use yellow styling')
assert.match(productsPage, /to="\/administrator\/products\/new"/, 'Admin products Neu action must link to the product create route')
assert.doesNotMatch(productsPage, /window\.location\.assign\('\/administrator\/products\/new'\)/, 'Admin products Neu action must not use a hard browser navigation')
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
assert.match(adminApi, /export interface AdminProductCreatePayload/, 'Frontend admin API must type product-create payloads')
assert.match(adminApi, /export async function createAdminProduct/, 'Frontend admin API must expose product creation')
assert.match(adminApi, /apiClient\.post[\s\S]*?\('\/admin\/products'/, 'Frontend admin API must post new products to /api/admin/products')
assert.match(appSource, /AdministratorProductCreatePage/, 'App routes must lazy-load the admin product create page')
assert.match(appSource, /AdministratorInteractionsPage/, 'App routes must lazy-load the admin interactions page')
assert.match(appSource, /<Route path="products\/new" element=\{<AdministratorProductCreatePage \/>\} \/>/, 'App routes must include /administrator/products/new')
assert.match(appSource, /<Route path="interactions" element=\{<AdministratorInteractionsPage \/>\} \/>/, 'App routes must include /administrator/interactions')
assert.match(productCreatePage, /createAdminProduct/, 'Admin product create page must call the create API')
assert.match(productCreatePage, /navigate\(`\/administrator\/products\/\$\{product\.id\}`\)/, 'Admin product create page must navigate to the created product detail')
assert.match(
  productCreatePage,
  /getAdminManagedListItems\('serving_unit'\)/,
  'Admin product create page must load centrally managed serving_unit values',
)
const productCreateServingUnitBlock = extractRequiredBlock(
  productCreatePage,
  /Einheit[\s\S]*?<\/label>/,
  'Admin product create page must render an Einheit form control',
)
assert.match(
  productCreateServingUnitBlock,
  /<select[\s\S]*value=\{form\.serving_unit\}/,
  'Admin product create Einheit must be a dropdown bound to form.serving_unit',
)
assert.doesNotMatch(
  productCreateServingUnitBlock,
  /<input\b/,
  'Admin product create Einheit must not regress to a normal text input',
)
assert.doesNotMatch(
  productsPage,
  /<option value="">Freitext-Shop<\/option>/,
  'Admin products shop-domain dropdown must not show Freitext-Shop as a normal loaded-domain option',
)
assert.match(
  productsPage,
  /Freitext-Fallback/,
  'Admin products shop-link form must clearly label the manual shop entry as Freitext-Fallback when fallback is needed',
)
assert.match(
  productDetailPage,
  /const SHOP_DOMAINS_PATH = '\/admin\/shop-domains';/,
  'Admin product detail shop-domain dropdown should call /admin/shop-domains',
)
assert.match(
  productDetailPage,
  /apiClient\.get<unknown>\(SHOP_DOMAINS_PATH\)/,
  'Admin product detail must load managed shop domains for the overview shop-link editor',
)
assert.match(
  productDetailPage,
  /shopDomainOptionsAvailable[\s\S]*<select[\s\S]*value=\{shopLinkForm\.shop_domain_id \?\? ''\}/,
  'Admin product detail shop-link editor must render a shop-domain dropdown when managed domains are available',
)
assert.doesNotMatch(
  productDetailPage,
  /<option value="">Freitext-Shop<\/option>/,
  'Admin product detail shop-domain dropdown must not show Freitext-Shop as a normal loaded-domain option',
)
assert.match(
  productDetailPage,
  /Freitext-Fallback:[\s\S]*Shop-Liste nicht verfuegbar/,
  'Admin product detail shop-link editor must expose manual shop text only as a clear fallback',
)
assert.match(
  productDetailPage,
  /shop_domain_id:\s*form\.shop_domain_id/,
  'Admin product detail shop-link payload must preserve the selected shop_domain_id',
)
assert.match(
  productsPage,
  /aria-expanded=\{showHttp503Info\}[\s\S]*onClick=\{\(\) => setShowHttp503Info/,
  'Admin products HTTP 503 explanation must be click/tap-visible, not only a hover title',
)
assert.match(
  productsPage,
  /showHttp503Info \? \([\s\S]*HTTP 503 bedeutet:/,
  'Admin products must render visible explanatory copy for HTTP 503 after toggling the info control',
)
assert.match(
  productCreatePage,
  /function normalizePriceDraft\(value: string\): string/,
  'Admin product create page must define price draft normalization',
)
assert.match(
  productCreatePage,
  /onBlur=\{\(\) => updateField\('price', normalizePriceDraft\(form\.price\)\)\}/,
  'Admin product create price field must normalize 19,9 to 19,90 on blur',
)
assert.match(
  adminModule,
  /admin\.post\('\/products'[\s\S]*INSERT INTO products[\s\S]*logAdminAction/,
  'Admin backend must implement POST /api/admin/products with audit logging',
)
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
