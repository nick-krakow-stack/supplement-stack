import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const dosingPage = read('frontend/src/pages/administrator/AdministratorDosingPage.tsx')
const dashboardPage = read('frontend/src/pages/administrator/AdministratorDashboardPage.tsx')
const adminModule = read('functions/api/modules/admin.ts')
const stacksModule = read('functions/api/modules/stacks.ts')
const authModule = read('functions/api/modules/auth.ts')
const analyticsModule = read('functions/api/modules/analytics.ts')
const frontendAnalytics = read('frontend/src/lib/analytics.ts')
const typesFile = read('frontend/src/types/index.ts')
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

for (const oldLabel of [
  'Stacks im Zeitraum',
  'Benutzer',
  'Katalog-Risiko',
  'Deadlinks als Potenzial',
  'Ohne aktiven Link',
  'Warnungen ohne Artikel',
  'Keine Produktklicks im Zeitraum.',
  'Keine Shop-Signale im Zeitraum.',
]) {
  assert.equal(
    dashboardPage.includes(oldLabel),
    false,
    `AdministratorDashboardPage must not show old dashboard label: ${oldLabel}`,
  )
}

assert.doesNotMatch(
  dashboardPage,
  /label:\s*['"]Anmeldungen['"]/,
  'AdministratorDashboardPage must not show old dashboard KPI label: Anmeldungen',
)

for (const newLabel of [
  'Neue Stacks',
  'Neuanmeldungen',
  'Abmeldungen',
  'Backlinks',
  'Deadlinks',
  'Ohne Affiliate-Link',
  'Wirkstoffe ohne Artikel',
  'Stacks wurden verschickt',
  'User haben Scam-Links eingereicht',
  'fremde Affiliate-Links aktiv',
  'Aufrufe über Google',
]) {
  assert.match(
    dashboardPage,
    new RegExp(newLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `AdministratorDashboardPage must show new dashboard label/copy: ${newLabel}`,
  )
}

for (const backendSignal of [
  'stack_email_events',
  'account_deletion_events',
  'signup_attribution',
  'page_view_events',
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
  assert.match(
    adminModule,
    new RegExp(backendSignal),
    `admin stats must expose or calculate ${backendSignal}`,
  )
}

assert.match(
  stacksModule,
  /INSERT INTO stack_email_events/,
  'stacks module must record successful stack email events',
)

assert.match(
  authModule,
  /UPDATE users SET last_seen_at = datetime\('now'\)/,
  'auth module must update users.last_seen_at on active sessions',
)

assert.match(
  authModule,
  /INSERT INTO account_deletion_events/,
  'auth module must record account deletion events before hard delete',
)

assert.match(
  authModule,
  /INSERT INTO signup_attribution/,
  'auth module must record signup attribution from first-party referral state',
)

assert.match(
  analyticsModule,
  /visitor_id/,
  'analytics module must store visitor_id with page view events',
)

assert.match(
  frontendAnalytics,
  /getSignupAttribution/,
  'frontend analytics must expose signup attribution for registration',
)

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
]) {
  assert.match(
    typesFile,
    new RegExp(`${statsField}\\?: number`),
    `AdminStats must type ${statsField}`,
  )
}

assert.match(
  typesFile,
  /referral_sources\?: AdminStatsReferralSource\[\]/,
  'AdminStats must type referral_sources as source rows',
)
