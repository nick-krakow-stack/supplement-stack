import { Hono } from 'hono'
import type { AppContext } from '../lib/types'

type LegalDocumentRow = {
  slug: string
  title: string
  body_md: string
  status: string
  published_at: string | null
  updated_at: string | null
  version: number | null
}

const legal = new Hono<AppContext>()

const ALLOWED_LEGAL_SLUGS = new Set([
  'impressum',
  'datenschutz',
  'nutzungsbedingungen',
  'cookie-consent',
  'affiliate-disclosure',
])

async function hasTable(db: D1Database, tableName: string): Promise<boolean> {
  try {
    const row = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .bind(tableName)
      .first<{ name: string }>()
    return Boolean(row?.name)
  } catch {
    return false
  }
}

legal.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!ALLOWED_LEGAL_SLUGS.has(slug)) {
    return c.json({ error: 'Legal document not found' }, 404)
  }

  if (!(await hasTable(c.env.DB, 'legal_documents'))) {
    return c.json({ error: 'Legal document not found' }, 404)
  }

  const document = await c.env.DB
    .prepare(`
      SELECT slug, title, body_md, status, published_at, updated_at, version
      FROM legal_documents
      WHERE slug = ?
        AND status = 'published'
        AND TRIM(COALESCE(body_md, '')) <> ''
      LIMIT 1
    `)
    .bind(slug)
    .first<LegalDocumentRow>()

  if (!document) {
    return c.json({ error: 'Legal document not found' }, 404)
  }

  return c.json({ document })
})

export default legal
