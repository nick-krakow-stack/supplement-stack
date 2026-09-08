import type { PublicCreatorProfile } from '../../lib/creator-profile-projection.mjs'
import { publicProfileImageUrl } from './creator-sharing-service'
import { isCreatorProfileSlug } from '../../lib/site-routes.mjs'

export const PUBLIC_PROFILE_CONSENT_VERSION = 'creator-public-profile-v1'
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type ProfileParty = { id: number; name: string; slug: string; type: 'creator' | 'brand'; status: string; public_profile_image_url: string | null }
export type ProfileRow = {
  party_id: number; description: string; status: ProfileStatus; identity_json: string; identity_invalidated_at: string | null;
  consent_user_id: number; consent_at: string; consent_version: string; version: number;
  submitted_at: string; moderated_by: number | null; moderated_at: string | null;
  moderation_reason: string | null; published_at: string | null; withdrawn_at: string | null; updated_at: string;
}

// Keep SQL key order identical to profileIdentity: this is a guard snapshot, not another editor.
export const PROFILE_IDENTITY_SQL = "json_object('name', p.name, 'slug', p.slug, 'type', p.type, 'profile_image_url', p.public_profile_image_url)"
export const ACTIVE_PROFILE_OWNER_SQL = `EXISTS (
  SELECT 1 FROM party_memberships m JOIN users u ON u.id = m.user_id
  WHERE m.party_id = p.id AND m.user_id = ? AND m.role = 'owner' AND m.status = 'active' AND u.deleted_at IS NULL
)`
const PUBLIC_PROFILE_GUARD = `p.status = 'active' AND p.type IN ('creator', 'brand')
  AND cp.status = 'approved' AND cp.withdrawn_at IS NULL AND cp.published_at IS NOT NULL
  AND cp.identity_invalidated_at IS NULL
  AND cp.consent_version = 'creator-public-profile-v1' AND cp.identity_json = ${PROFILE_IDENTITY_SQL}
  AND EXISTS (SELECT 1 FROM party_memberships m JOIN users u ON u.id = m.user_id
    WHERE m.party_id = p.id AND m.user_id = cp.consent_user_id AND m.role = 'owner'
      AND m.status = 'active' AND u.deleted_at IS NULL)`

export function profileIdentity(party: ProfileParty): string {
  return JSON.stringify({ name: party.name, slug: party.slug, type: party.type, profile_image_url: party.public_profile_image_url })
}
export async function profileHash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
export function publicProfileDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.normalize('NFC').trim()
  // Plain text only; reject markup/control characters instead of silently changing the draft.
  if (/[<>\p{C}\r\n]/u.test(text) || [...text].length < 40 || [...text].length > 180) return null
  return text
}
export async function loadProfileParty(db: D1Database, id: number): Promise<ProfileParty | null> {
  return db.prepare(`SELECT id, name, slug, type, status, public_profile_image_url FROM parties WHERE id = ? AND type IN ('creator','brand')`).bind(id).first<ProfileParty>()
}
export async function loadProfileRow(db: D1Database, id: number): Promise<ProfileRow | null> {
  return db.prepare('SELECT * FROM creator_public_profiles WHERE party_id = ?').bind(id).first<ProfileRow>()
}
export async function profileReviewFingerprint(row: ProfileRow): Promise<string> {
  return profileHash(JSON.stringify(row))
}
export async function privateProfilePayload(party: ProfileParty, row: ProfileRow | null) {
  const image = publicProfileImageUrl(party.public_profile_image_url)
  return {
    party: { id: party.id, name: party.name, slug: party.slug, type: party.type, profile_image_url: image.ok ? image.value : null },
    identity_hash: await profileHash(profileIdentity(party)),
    consent_version: PUBLIC_PROFILE_CONSENT_VERSION,
    profile: row ? {
      status: row.status, version: row.version, description: row.description,
      identity_matches: row.identity_invalidated_at === null && row.identity_json === profileIdentity(party), review_fingerprint: await profileReviewFingerprint(row),
      moderation_reason: row.moderation_reason, published_at: row.published_at,
    } : null,
  }
}

/** One eligibility predicate for public API, SSR and sitemap. Errors propagate as503 at delivery. */
export async function loadPublicCreatorProfile(db: D1Database, slug: string): Promise<PublicCreatorProfile | null> {
  if (!isCreatorProfileSlug(slug)) return null
  const row = await db.prepare(`SELECT p.slug, p.name, p.type, p.public_profile_image_url AS profile_image_url,
    cp.description, cp.published_at FROM creator_public_profiles cp JOIN parties p ON p.id = cp.party_id
    WHERE p.slug = ? AND ${PUBLIC_PROFILE_GUARD}`).bind(slug).first<PublicCreatorProfile>()
  if (!row) return null
  const image = publicProfileImageUrl(row.profile_image_url)
  return image.ok ? { ...row, profile_image_url: image.value } : null
}
export async function listPublicCreatorProfiles(db: D1Database): Promise<Array<{ slug: string; published_at: string }>> {
  const { results } = await db.prepare(`SELECT p.slug, p.public_profile_image_url AS profile_image_url, cp.published_at
    FROM creator_public_profiles cp JOIN parties p ON p.id = cp.party_id WHERE ${PUBLIC_PROFILE_GUARD} ORDER BY p.slug`).all<{ slug: string; profile_image_url: string | null; published_at: string }>()
  return results.filter((row) => isCreatorProfileSlug(row.slug) && publicProfileImageUrl(row.profile_image_url).ok)
    .map(({ slug, published_at }) => ({ slug, published_at }))
}

const PROFILE_COLUMNS = ['party_id', 'description', 'status', 'identity_json', 'identity_invalidated_at', 'consent_user_id', 'consent_at', 'consent_version', 'version', 'submitted_at', 'moderated_by', 'moderated_at', 'moderation_reason', 'published_at', 'withdrawn_at', 'updated_at'] as const
export function profileBeforeGuard(row: ProfileRow) {
  return { sql: PROFILE_COLUMNS.map((key) => `creator_public_profiles.${key} IS ?`).join(' AND '), values: PROFILE_COLUMNS.map((key) => row[key]) }
}
