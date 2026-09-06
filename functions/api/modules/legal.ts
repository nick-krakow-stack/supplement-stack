import { Hono } from 'hono'
import type { AppContext } from '../lib/types'
import { loadPublishedLegalDocument, PUBLIC_LEGAL_SLUGS } from '../../lib/legal-documents'

const legal = new Hono<AppContext>()

legal.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  c.header('Cache-Control', 'no-store')
  if (!PUBLIC_LEGAL_SLUGS.has(slug)) return c.json({ error: 'Dieses Dokument wurde nicht gefunden.' }, 404)
  try {
    const document = await loadPublishedLegalDocument(c.env.DB, slug)
    if (!document) return c.json({ error: 'Dieses Dokument wurde nicht gefunden.' }, 404)
    return c.json({ document })
  } catch {
    c.header('Retry-After', '60')
    return c.json({ error: 'Das Dokument kann gerade nicht geladen werden. Bitte versuche es später erneut.' }, 503)
  }
})

export default legal
