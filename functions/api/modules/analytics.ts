import { Hono } from 'hono'
import type { AppContext } from '../lib/types'

const analytics = new Hono<AppContext>()

function cleanPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return '/'
  return trimmed.slice(0, 240)
}

function referrerHost(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).hostname.replace(/^www\./, '').toLowerCase().slice(0, 120)
  } catch {
    return null
  }
}

function referrerSource(host: string | null): string | null {
  if (!host) return null
  if (host === 'supplementstack.de' || host.endsWith('.supplementstack.de')) return 'internal'
  if (host.includes('google.')) return 'google'
  if (host.includes('bing.')) return 'bing'
  if (host.includes('duckduckgo.')) return 'duckduckgo'
  return 'external'
}

function cleanVisitorId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, 80)
  return /^[a-zA-Z0-9._:-]+$/.test(trimmed) ? trimmed : null
}

analytics.post('/pageview', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const path = cleanPath(body.path)
  const host = referrerHost(body.referrer)
  const source = referrerSource(host)
  const visitorId = cleanVisitorId(body.visitor_id)

  try {
    await c.env.DB.prepare(`
      INSERT INTO page_view_events (path, referrer_host, referrer_source, visitor_id)
      VALUES (?, ?, ?, ?)
    `).bind(path, host, source, visitorId).run()
  } catch (error) {
    try {
      await c.env.DB.prepare(`
        INSERT INTO page_view_events (path, referrer_host, referrer_source)
        VALUES (?, ?, ?)
      `).bind(path, host, source).run()
    } catch (fallbackError) {
      console.error('[analytics] pageview event failed:', error, fallbackError)
    }
  }

  return c.json({ ok: true })
})

export default analytics
