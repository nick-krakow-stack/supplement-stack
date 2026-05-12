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
