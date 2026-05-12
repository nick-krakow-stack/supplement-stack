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

const stacks = read('functions/api/modules/stacks.ts')
const routineRouteIndex = stacks.indexOf("stacks.post('/routine/email'")
const dynamicStackRouteIndex = stacks.indexOf("stacks.get('/:id'")
assert.notEqual(routineRouteIndex, -1, 'Routine email endpoint must exist')
assert.notEqual(dynamicStackRouteIndex, -1, 'Dynamic stack route must exist')
assert.ok(routineRouteIndex < dynamicStackRouteIndex, 'Routine email endpoint must be registered before /:id routes')
assert.match(stacks, /routine-email:\$\{user\.userId\}/, 'Routine email endpoint must use its own user-scoped rate-limit key')
assert.match(stacks, /buildRoutineEmailHtml/, 'Routine email endpoint must render dedicated routine email HTML')
assert.match(stacks, /Tagesuebersicht|Tagesübersicht/, 'Routine email HTML must include a daily timing overview')
assert.match(stacks, /Wirkstoffe/, 'Routine email HTML must include an ingredient overview')

const routinePage = read('frontend/src/pages/RoutinePage.tsx')
assert.match(routinePage, /fetch\(apiPath\('\/stacks\/routine\/email'\)/, 'Routine page must call the routine email endpoint')
assert.equal(routinePage.includes('E-Mail-Versand fuer den Einnahmeplan wird vorbereitet.'), false, 'Routine page must not keep the placeholder mail status')

const csvPath = new URL('../functions/api/lib/csv.ts', import.meta.url)
assert.equal(existsSync(csvPath), true, 'functions/api/lib/csv.ts must exist')
const csv = read('functions/api/lib/csv.ts')
assert.match(csv, /export function csvEscape/, 'csvEscape must be exported for regression coverage')
assert.match(csv, /[=+@]/, 'csvEscape must neutralize spreadsheet formula prefixes')
assert.match(csv, /charAt\(0\)|startsWith|\[0\]/, 'csvEscape must inspect the first character')
