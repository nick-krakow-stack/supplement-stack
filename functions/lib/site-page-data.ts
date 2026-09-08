import { Hono } from 'hono'
import type { AppContext, Env } from '../api/lib/types'
import { ensureAdmin, ensureAuth } from '../api/lib/helpers'
import creatorSharing from '../api/modules/creator-sharing'
import { publicShareFailure } from './share-head-projection.mjs'

export type PublicSharePage = {
  status: 200 | 404 | 409 | 410 | 503
  title?: string
  creatorName?: string
  productNames?: string[]
  message?: string
  retryAfter?: string
}

function publicText(value: unknown, token: string): string {
  return typeof value === 'string' ? value.split(token).join('').trim() : ''
}

/** Reuses the public API's snapshot hash, relationship, moderation and expiry guards.
 * This exact GET is read-only: unlike view/import/report endpoints it records nothing.
 * The HTML projection deliberately excludes tokens, IDs, doses, statements and images.
 */
export async function loadPublicSharePage(env: Env, token: string): Promise<PublicSharePage> {
  const response = await creatorSharing.fetch(new Request(`https://internal.invalid/shares/${encodeURIComponent(token)}`), env)
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const code = body && typeof body === 'object' && 'code' in body ? body.code : null
    return { ...publicShareFailure(response.status, code), retryAfter: response.headers.get('Retry-After') ?? undefined }
  }
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('title' in body) || !('creator' in body) || !('items' in body)
    || !body.creator || typeof body.creator !== 'object' || !('name' in body.creator) || !Array.isArray(body.items)) {
    return { status: 503, message: 'Diese Empfehlung kann gerade nicht geladen werden. Bitte versuche es später noch einmal.' }
  }
  return {
    status: 200,
    title: publicText(body.title, token),
    creatorName: publicText(body.creator.name, token),
    productNames: body.items.map((item: unknown) => item && typeof item === 'object' && 'product_name' in item ? publicText(item.product_name, token) : '').filter(Boolean),
  }
}

const privateAccess = new Hono<AppContext>()
privateAccess.get('/user', async (c) => await ensureAuth(c) ?? c.body(null, 204))
privateAccess.get('/admin', async (c) => await ensureAdmin(c) ?? c.body(null, 204))

/** The same signed-cookie/Bearer and admin-role checks as the API, with no /me side effects. */
export async function checkPrivatePageAccess(request: Request, env: Env, admin: boolean): Promise<204 | 401 | 403 | 503> {
  const response = await privateAccess.fetch(new Request(`https://internal.invalid/${admin ? 'admin' : 'user'}`, { headers: request.headers }), env)
  return response.status === 204 || response.status === 401 || response.status === 403 ? response.status : 503
}
