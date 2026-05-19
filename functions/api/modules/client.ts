import { Hono } from 'hono'
import type { AppContext } from '../lib/types'

const client = new Hono<AppContext>()

async function hasManagedListItemsTable(db: D1Database): Promise<boolean> {
  const row = await db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name = 'managed_list_items'
    LIMIT 1
  `).first<{ name: string }>()
  return Boolean(row)
}

// GET /api/client/managed-lists/intake-timing (public)
client.get('/managed-lists/intake-timing', async (c) => {
  if (!(await hasManagedListItemsTable(c.env.DB))) {
    return c.json({ items: [] })
  }

  const { results: items } = await c.env.DB.prepare(`
    SELECT value, label, description, sort_order
    FROM managed_list_items
    WHERE list_key = 'intake_timing'
      AND active = 1
    ORDER BY sort_order ASC, label ASC
  `).all<{
    value: string
    label: string
    description: string | null
    sort_order: number
  }>()

  return c.json({ items })
})

export default client
