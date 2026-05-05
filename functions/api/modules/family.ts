import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AppContext } from '../lib/types'
import { checkRateLimit, ensureAuth } from '../lib/helpers'

const family = new Hono<AppContext>()

type FamilyProfileRow = {
  id: number
  user_id: number
  first_name: string
  age: number | null
  weight: number | null
  created_at: string
  updated_at: string
}

type FamilyProfileInput = {
  firstName: string
  age: number | null
  weight: number | null
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeOptionalInteger(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return undefined
  return parsed
}

function normalizeOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function normalizeFamilyInput(data: Record<string, unknown>): { input?: FamilyProfileInput; error?: string } {
  const firstName = normalizeText(data.first_name ?? data.firstName)
  const age = normalizeOptionalInteger(data.age)
  const weight = normalizeOptionalNumber(data.weight)

  if (!firstName || firstName.length > 80) {
    return { error: 'Bitte gib einen Vornamen mit maximal 80 Zeichen an.' }
  }
  if (age === undefined || (age !== null && (age < 0 || age > 120))) {
    return { error: 'Alter muss zwischen 0 und 120 liegen.' }
  }
  if (weight === undefined || (weight !== null && (weight <= 0 || weight > 300))) {
    return { error: 'Gewicht muss zwischen 1 und 300 kg liegen.' }
  }

  return { input: { firstName, age, weight } }
}

async function readJson(c: Context<AppContext>): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await c.req.json()
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

family.get('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(`
    SELECT id, user_id, first_name, age, weight, created_at, updated_at
    FROM family_profiles
    WHERE user_id = ?
    ORDER BY created_at ASC, id ASC
  `).bind(user.userId).all<FamilyProfileRow>()

  return c.json({ members: results })
})

family.post('/', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const allowed = await checkRateLimit(c.env.RATE_LIMITER, `family-create:${user.userId}`, 20, 3600)
  if (!allowed) return c.json({ error: 'Bitte warte kurz, bevor du weitere Profile anlegst.' }, 429)

  const data = await readJson(c)
  if (!data) return c.json({ error: 'Invalid JSON' }, 400)
  const normalized = normalizeFamilyInput(data)
  if (normalized.error || !normalized.input) return c.json({ error: normalized.error ?? 'Invalid input' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO family_profiles (user_id, first_name, age, weight)
    VALUES (?, ?, ?, ?)
  `).bind(user.userId, normalized.input.firstName, normalized.input.age, normalized.input.weight).run()

  const member = await c.env.DB.prepare(`
    SELECT id, user_id, first_name, age, weight, created_at, updated_at
    FROM family_profiles
    WHERE id = ? AND user_id = ?
  `).bind(result.meta.last_row_id, user.userId).first<FamilyProfileRow>()

  return c.json({ member }, 201)
})

family.put('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid family member id' }, 400)

  const data = await readJson(c)
  if (!data) return c.json({ error: 'Invalid JSON' }, 400)
  const normalized = normalizeFamilyInput(data)
  if (normalized.error || !normalized.input) return c.json({ error: normalized.error ?? 'Invalid input' }, 400)

  const existing = await c.env.DB.prepare(
    'SELECT id FROM family_profiles WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first<{ id: number }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.prepare(`
    UPDATE family_profiles
    SET first_name = ?, age = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).bind(normalized.input.firstName, normalized.input.age, normalized.input.weight, id, user.userId).run()

  const member = await c.env.DB.prepare(`
    SELECT id, user_id, first_name, age, weight, created_at, updated_at
    FROM family_profiles
    WHERE id = ? AND user_id = ?
  `).bind(id, user.userId).first<FamilyProfileRow>()

  return c.json({ member })
})

family.delete('/:id', async (c) => {
  const authErr = await ensureAuth(c)
  if (authErr) return authErr
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Invalid family member id' }, 400)

  const existing = await c.env.DB.prepare(
    'SELECT id FROM family_profiles WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first<{ id: number }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE stacks SET family_member_id = NULL WHERE user_id = ? AND family_member_id = ?').bind(user.userId, id),
    c.env.DB.prepare('DELETE FROM family_profiles WHERE id = ? AND user_id = ?').bind(id, user.userId),
  ])

  return c.json({ ok: true })
})

export default family
