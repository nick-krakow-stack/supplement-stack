import { Hono, type Context } from 'hono'
import type { AppContext } from '../lib/types'
import { ensureAdmin, ensureAuth, logAdminAction } from '../lib/helpers'
import { creatorSharingEnabled } from '../lib/creator-sharing'
import {
  ACTIVE_PROFILE_OWNER_SQL, PROFILE_IDENTITY_SQL, PUBLIC_PROFILE_CONSENT_VERSION,
  loadProfileParty, loadProfileRow, loadPublicCreatorProfile, privateProfilePayload,
  profileBeforeGuard, profileHash, profileIdentity, profileReviewFingerprint, publicProfileDescription,
  type ProfileParty, type ProfileRow,
} from '../lib/creator-public-profile'
import { publicProfileImageUrl } from '../lib/creator-sharing-service'

const positiveId = (value: unknown) => (typeof value === 'number' || typeof value === 'string') && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
const changed = (c: Context<AppContext>) => c.json({ error: 'Der Profilstand hat sich geändert. Bitte lade ihn neu und prüfe deine Auswahl.', code: 'PROFILE_CHANGED' }, 409)
const ACTIVE_ADMIN_SQL = "EXISTS (SELECT 1 FROM users a WHERE a.id = ? AND a.role = 'admin' AND a.deleted_at IS NULL)"
const OWNER_TARGET_SQL = `EXISTS (SELECT 1 FROM parties p WHERE p.id = ? AND p.status = 'active'
  AND p.type IN ('creator','brand') AND ${PROFILE_IDENTITY_SQL} = ? AND ${ACTIVE_PROFILE_OWNER_SQL})`
const CONSENT_OWNER_SQL = `EXISTS (SELECT 1 FROM party_memberships m JOIN users u ON u.id = m.user_id
  WHERE m.party_id = creator_public_profiles.party_id AND m.user_id = creator_public_profiles.consent_user_id
    AND m.role = 'owner' AND m.status = 'active' AND u.deleted_at IS NULL)`

const OWNER_PATHS = ['/public-profiles/:slug', '/parties/:id/public-profile', '/parties/:id/public-profile/submit', '/parties/:id/public-profile/withdraw']
const ADMIN_PATHS = ['/public-profiles', '/parties/:id/public-profile/review']
function router(paths: string[]) {
  const app = new Hono<AppContext>()
  for (const path of paths) app.use(path, async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    c.header('X-Robots-Tag', 'noindex, nofollow')
    c.header('Referrer-Policy', 'no-referrer')
    if (!creatorSharingEnabled(c.env)) return c.json({ error: 'Diese Seite ist nicht verfügbar.' }, 404)
    return next()
  })
  app.onError((_error, c) => c.json({ error: 'Das Profil kann gerade nicht geladen oder gespeichert werden. Bitte versuche es später noch einmal.' }, 503))
  return app
}
async function jsonBody(c: Context<AppContext>): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await c.req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
  } catch { return null }
}
async function isOwner(c: Context<AppContext>, party: ProfileParty): Promise<boolean> {
  const row = await c.env.DB.prepare(`SELECT p.id FROM parties p WHERE p.id = ? AND p.status = 'active'
    AND p.type IN ('creator','brand') AND ${ACTIVE_PROFILE_OWNER_SQL}`).bind(party.id, c.get('user').userId).first()
  return Boolean(row)
}
async function ownerTarget(c: Context<AppContext>): Promise<ProfileParty | Response> {
  const auth = await ensureAuth(c)
  if (auth) return auth
  const id = positiveId(c.req.param('id'))
  if (!id) return c.json({ error: 'Dieses Creator-Profil wurde nicht gefunden.' }, 404)
  const party = await loadProfileParty(c.env.DB, id)
  if (!party || !await isOwner(c, party)) return c.json({ error: 'Nur der aktive Kontoinhaber kann die öffentliche Profilseite verwalten.' }, 403)
  return party
}
async function fresh(c: Context<AppContext>, id: number) {
  const party = await loadProfileParty(c.env.DB, id)
  if (!party) return changed(c)
  return c.json(await privateProfilePayload(party, await loadProfileRow(c.env.DB, id)))
}
async function isCurrentAdmin(c: Context<AppContext>): Promise<boolean> {
  return Boolean(await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND role = 'admin' AND deleted_at IS NULL").bind(c.get('user').userId).first())
}

export const creatorPublicProfiles = router(OWNER_PATHS)
creatorPublicProfiles.get('/public-profiles/:slug', async (c) => {
  const profile = await loadPublicCreatorProfile(c.env.DB, c.req.param('slug'))
  return profile ? c.json({ profile }) : c.json({ error: 'Dieses öffentliche Profil wurde nicht gefunden.' }, 404)
})
creatorPublicProfiles.get('/parties/:id/public-profile', async (c) => {
  const party = await ownerTarget(c)
  if (party instanceof Response) return party
  return fresh(c, party.id)
})
creatorPublicProfiles.post('/parties/:id/public-profile/submit', async (c) => {
  const party = await ownerTarget(c)
  if (party instanceof Response) return party
  const body = await jsonBody(c)
  const description = publicProfileDescription(body?.description)
  const expectedVersion = body?.expected_version === null ? null : positiveId(body?.expected_version)
  if (!body || !description || body.consent !== true || body.consent_version !== PUBLIC_PROFILE_CONSENT_VERSION
    || (body.expected_version !== null && expectedVersion === null)) {
    return c.json({ error: 'Bitte schreibe einen Vorstellungstext mit 40 bis 180 Zeichen ohne Formatierung und stimme der öffentlichen Profilseite ausdrücklich zu.' }, 400)
  }
  const identity = profileIdentity(party)
  if (!publicProfileImageUrl(party.public_profile_image_url).ok || body.expected_identity_hash !== await profileHash(identity)) return changed(c)
  const before = await loadProfileRow(c.env.DB, party.id)
  if ((before?.version ?? null) !== expectedVersion) return changed(c)
  const now = new Date().toISOString()
  const userId = c.get('user').userId
  let result: D1Result
  if (!before) {
    result = await c.env.DB.prepare(`INSERT INTO creator_public_profiles
      (party_id, description, status, identity_json, consent_user_id, consent_at, consent_version, version, submitted_at, updated_at)
      SELECT ?, ?, 'pending', ?, ?, ?, ?, 1, ?, ? WHERE ${OWNER_TARGET_SQL}
      AND NOT EXISTS (SELECT 1 FROM creator_public_profiles WHERE party_id = ?)`)
      .bind(party.id, description, identity, userId, now, PUBLIC_PROFILE_CONSENT_VERSION, now, now, party.id, identity, userId, party.id).run()
  } else {
    const guard = profileBeforeGuard(before)
    result = await c.env.DB.prepare(`UPDATE creator_public_profiles SET description = ?, status = 'pending', identity_json = ?, identity_invalidated_at = NULL,
      consent_user_id = ?, consent_at = ?, consent_version = ?, version = version + 1, submitted_at = ?,
      moderated_by = NULL, moderated_at = NULL, moderation_reason = NULL, published_at = NULL, withdrawn_at = NULL, updated_at = ?
      WHERE ${guard.sql} AND ${OWNER_TARGET_SQL}`)
      .bind(description, identity, userId, now, PUBLIC_PROFILE_CONSENT_VERSION, now, now, ...guard.values, party.id, identity, userId).run()
  }
  if (Number(result.meta.changes) !== 1) return changed(c)
  return fresh(c, party.id)
})
creatorPublicProfiles.post('/parties/:id/public-profile/withdraw', async (c) => {
  const party = await ownerTarget(c)
  if (party instanceof Response) return party
  const body = await jsonBody(c)
  const before = await loadProfileRow(c.env.DB, party.id)
  if (!body || !before || positiveId(body.expected_version) !== before.version) return changed(c)
  if (before.status === 'withdrawn') return fresh(c, party.id)
  const guard = profileBeforeGuard(before)
  const now = new Date().toISOString()
  const result = await c.env.DB.prepare(`UPDATE creator_public_profiles SET status = 'withdrawn', withdrawn_at = ?,
    published_at = NULL, version = version + 1, updated_at = ? WHERE ${guard.sql} AND ${OWNER_TARGET_SQL}`)
    .bind(now, now, ...guard.values, party.id, profileIdentity(party), c.get('user').userId).run()
  if (Number(result.meta.changes) !== 1) return changed(c)
  return fresh(c, party.id)
})

export const creatorPublicProfileAdmin = router(ADMIN_PATHS)
for (const path of ADMIN_PATHS) creatorPublicProfileAdmin.use(path, async (c, next) => {
  const auth = await ensureAdmin(c)
  if (auth) return auth
  if (!await isCurrentAdmin(c)) return c.json({ error: 'Für diese Freigabe fehlen die Administratorrechte.' }, 403)
  return next()
})
creatorPublicProfileAdmin.get('/public-profiles', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM creator_public_profiles ORDER BY submitted_at DESC, party_id').all<ProfileRow>()
  const profiles = []
  for (const row of results) {
    const party = await loadProfileParty(c.env.DB, row.party_id)
    if (party) profiles.push(await privateProfilePayload(party, row))
  }
  return c.json({ profiles })
})
creatorPublicProfileAdmin.post('/parties/:id/public-profile/review', async (c) => {
  const id = positiveId(c.req.param('id'))
  const body = await jsonBody(c)
  const reason = typeof body?.reason === 'string' ? body.reason.normalize('NFC').trim() : ''
  if (!id || !body || !['approve', 'reject'].includes(String(body.decision))
    || (body.decision === 'reject' && ([...reason].length < 5 || [...reason].length > 500 || /[\p{C}<>]/u.test(reason)))) {
    return c.json({ error: 'Bitte wähle Freigeben oder Ablehnen. Nenne bei einer Ablehnung einen verständlichen Grund mit 5 bis 500 Zeichen.' }, 400)
  }
  const party = await loadProfileParty(c.env.DB, id)
  const before = await loadProfileRow(c.env.DB, id)
  if (!party || !before || before.status !== 'pending' || before.version !== positiveId(body.expected_version)
    || before.identity_invalidated_at !== null || before.identity_json !== profileIdentity(party) || body.expected_review_fingerprint !== await profileReviewFingerprint(before)
    || !publicProfileImageUrl(party.public_profile_image_url).ok) return changed(c)
  const guard = profileBeforeGuard(before)
  const now = new Date().toISOString()
  const approved = body.decision === 'approve'
  const result = await c.env.DB.prepare(`UPDATE creator_public_profiles SET status = ?, moderated_by = ?, moderated_at = ?,
    moderation_reason = ?, published_at = ?, version = version + 1, updated_at = ?
    WHERE ${guard.sql} AND ${ACTIVE_ADMIN_SQL} AND ${CONSENT_OWNER_SQL}
    AND EXISTS (SELECT 1 FROM parties p WHERE p.id = creator_public_profiles.party_id AND p.status = 'active'
      AND p.type IN ('creator','brand') AND ${PROFILE_IDENTITY_SQL} = creator_public_profiles.identity_json)`)
    .bind(approved ? 'approved' : 'rejected', c.get('user').userId, now, approved ? null : reason, approved ? now : null, now,
      ...guard.values, c.get('user').userId).run()
  if (Number(result.meta.changes) !== 1) return changed(c)
  await logAdminAction(c, { action: approved ? 'approve_creator_public_profile' : 'reject_creator_public_profile', entity_type: 'party', entity_id: id, changes: { profile_version: before.version, decision: body.decision } })
  return fresh(c, id)
})
