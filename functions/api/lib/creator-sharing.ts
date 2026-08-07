import type { Env } from './types'

export const CREATOR_SHARING_SNAPSHOT_VERSION = 2
export const CREATOR_SHARING_SUPPORTED_SNAPSHOT_VERSIONS = [1, 2] as const
export const CREATOR_SHARING_MAX_ITEMS = 100
export const CREATOR_STATEMENT_MAX_LENGTH = 500

export type CreatorPartyType = 'platform' | 'creator' | 'brand' | 'user'
export type CreatorResolutionKind = 'creator_version' | 'platform_version' | 'legacy_resolved' | 'bare'

export type CreatorLinkBindingSnapshot = {
  resolution_kind: CreatorResolutionKind
  affiliate_version_id: number | null
  resolved_party_id: number | null
}

export type CreatorShareSnapshotItem = {
  catalog_product_id: number
  shop_link_id: number
  link_binding: CreatorLinkBindingSnapshot
  main_ingredient_ids: number[]
  quantity: number
  unit?: string | null
  intake_interval_days: number
  dosage_text: string | null
  timing: string | null
  creator_statement: string | null
  sort_order: number
  category_name: string | null
}

export type CreatorShareSnapshot = {
  schema_version: 1 | 2
  type: 'dose_recommendation' | 'stack'
  creator_party_id: number
  published_at: string
  title: string
  items: CreatorShareSnapshotItem[]
}

export function isSupportedCreatorShareSnapshotVersion(value: unknown): value is 1 | 2 {
  return value === 1 || value === 2
}

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null
}

function optionalBoundedText(value: unknown, maximum: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length <= maximum ? trimmed : undefined
}

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot contains a non-finite number')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) throw new TypeError('Snapshot contains a non-JSON value')

  const result: { [key: string]: JsonValue } = {}
  for (const key of Object.keys(value).sort()) {
    const child = value[key]
    if (child === undefined) continue
    result[key] = canonicalize(child)
  }
  return result
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function snapshotHash(snapshot: CreatorShareSnapshot): Promise<string> {
  return sha256Hex(canonicalJson(snapshot))
}

export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function creatorSharingEnabled(env: Env): boolean {
  return env.CREATOR_STACK_SHARING_ENABLED === 'true'
}

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, '').replace(/^www\./, '')
}

export function hostMatchesDomain(host: string, configuredDomain: string): boolean {
  const normalizedHost = normalizeDomain(host)
  const normalizedDomain = normalizeDomain(configuredDomain)
  return Boolean(normalizedDomain)
    && (normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`))
}

export function validateProductTargetUrl(
  rawUrl: string,
  configuredDomain: string,
): { url?: string; error?: string } {
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed.length > 2048) return { error: 'Ungültige Produkt-URL.' }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { error: 'Ungültige Produkt-URL.' }
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { error: 'Nur HTTP(S)-Produktlinks sind erlaubt.' }
  if (parsed.username || parsed.password || parsed.port) return { error: 'Produktlinks mit Zugangsdaten oder Port sind nicht erlaubt.' }
  if (!hostMatchesDomain(parsed.hostname, configuredDomain)) return { error: 'Produktlink liegt außerhalb der hinterlegten Shop-Domain.' }
  parsed.hash = ''
  return { url: parsed.toString() }
}

function placeholderCount(template: string, placeholder: string): number {
  return template.split(placeholder).length - 1
}

export function validateAffiliateTemplate(
  template: string,
  trackingDomain: string | null,
): string | null {
  const trimmed = template.trim()
  if (!trimmed || trimmed.length > 1200) return 'Ungültiges Link-Template.'
  if (placeholderCount(trimmed, '{url}') !== 1 || placeholderCount(trimmed, '{code}') < 1) {
    return 'Das Template braucht genau einmal {url} und mindestens einmal {code}.'
  }
  const unknownPlaceholder = trimmed.match(/\{(?!url\}|code\})[^}]*\}/)
  if (unknownPlaceholder) return 'Das Template enthält einen unbekannten Platzhalter.'

  if (trimmed.startsWith('{url}')) {
    const suffix = trimmed.slice('{url}'.length)
    if (!suffix.startsWith('?') && !suffix.startsWith('&')) {
      return 'Ein Produkt-Template darf hinter {url} nur Query-Parameter ergänzen.'
    }
    if (trackingDomain) return 'Ein Produkt-Template darf keine externe Tracking-Domain setzen.'
    return null
  }

  if (!trackingDomain) return 'Externe Redirect-Templates benötigen eine Tracking-Domain.'
  const sample = trimmed
    .replace('{url}', encodeURIComponent('https://example.test/product'))
    .replaceAll('{code}', encodeURIComponent('sample'))
  let parsed: URL
  try {
    parsed = new URL(sample)
  } catch {
    return 'Das Redirect-Template erzeugt keine gültige URL.'
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
    return 'Externe Tracking-Templates müssen sichere HTTPS-URLs ohne Zugangsdaten oder Port erzeugen.'
  }
  if (normalizeDomain(parsed.hostname) !== normalizeDomain(trackingDomain)) {
    return 'Das Redirect-Template passt nicht zur hinterlegten Tracking-Domain.'
  }
  return null
}

export function buildAffiliateUrl(params: {
  code: string
  linkTemplate: string
  productUrl: string
  shopDomain: string
  trackingDomain: string | null
}): { url?: string; error?: string } {
  const target = validateProductTargetUrl(params.productUrl, params.shopDomain)
  if (!target.url) return { error: target.error }
  const templateError = validateAffiliateTemplate(params.linkTemplate, params.trackingDomain)
  if (templateError) return { error: templateError }

  const template = params.linkTemplate.trim()
  let rendered: string
  if (template.startsWith('{url}')) {
    const targetUrl = new URL(target.url)
    const suffix = template.slice('{url}'.length).replaceAll('{code}', encodeURIComponent(params.code))
    const query = suffix.replace(/^[?&]/, '')
    const additions = new URLSearchParams(query)
    for (const [key, value] of additions.entries()) targetUrl.searchParams.append(key, value)
    rendered = targetUrl.toString()
  } else {
    rendered = template
      .replace('{url}', encodeURIComponent(target.url))
      .replaceAll('{code}', encodeURIComponent(params.code))
  }

  let parsed: URL
  try {
    parsed = new URL(rendered)
  } catch {
    return { error: 'Affiliate-Link konnte nicht sicher erzeugt werden.' }
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) {
    return { error: 'Affiliate-Link ist nicht sicher.' }
  }
  if (params.trackingDomain) {
    if (parsed.protocol !== 'https:' || normalizeDomain(parsed.hostname) !== normalizeDomain(params.trackingDomain)) {
      return { error: 'Affiliate-Link verlässt die erlaubte Tracking-Domain.' }
    }
  } else if (!hostMatchesDomain(parsed.hostname, params.shopDomain)) {
    return { error: 'Affiliate-Link verlässt die erlaubte Shop-Domain.' }
  }
  parsed.hash = ''
  return { url: parsed.toString() }
}

export function dateWindowAllows(
  validFrom: string | null,
  validUntil: string | null,
  now = new Date(),
): boolean {
  const timestamp = now.getTime()
  const from = validFrom ? Date.parse(validFrom) : Number.NaN
  const until = validUntil ? Date.parse(validUntil) : Number.NaN
  if (validFrom && (!Number.isFinite(from) || from > timestamp)) return false
  if (validUntil && (!Number.isFinite(until) || until < timestamp)) return false
  return true
}

export function validateCreatorStatement(value: unknown): { value?: string | null; error?: string } {
  const statement = optionalBoundedText(value, CREATOR_STATEMENT_MAX_LENGTH)
  if (statement === undefined) return { error: `Creator-Aussagen dürfen höchstens ${CREATOR_STATEMENT_MAX_LENGTH} Zeichen lang sein.` }
  if (statement === null) return { value: null }
  if (/\b(pro|je)\s*(kg|kilogramm|kilo)\b/i.test(statement) || /\b(gewicht|körpergewicht)\b/i.test(statement)) {
    return { error: 'Individuelle oder gewichtsbezogene Dosierungsregeln sind nicht erlaubt.' }
  }
  if (/\b(heilt?|behandelt?|therapie|diagnos(?:e|tiziert)|gegen\s+[a-zäöüß])/i.test(statement)) {
    return { error: 'Krankheitsbezogene oder therapeutische Aussagen sind nicht erlaubt.' }
  }
  return { value: statement }
}

function parseBinding(value: unknown): CreatorLinkBindingSnapshot | null {
  if (!isRecord(value)) return null
  const resolutionKind = value.resolution_kind
  if (!['creator_version', 'platform_version', 'legacy_resolved', 'bare'].includes(String(resolutionKind))) return null
  const affiliateVersionId = value.affiliate_version_id === null ? null : positiveInteger(value.affiliate_version_id)
  const resolvedPartyId = value.resolved_party_id === null ? null : positiveInteger(value.resolved_party_id)
  if (resolutionKind === 'bare') {
    if (affiliateVersionId !== null || resolvedPartyId !== null) return null
  } else if (resolutionKind === 'legacy_resolved') {
    if (affiliateVersionId !== null || resolvedPartyId === null) return null
  } else if (affiliateVersionId === null || resolvedPartyId === null) {
    return null
  }
  return {
    resolution_kind: resolutionKind as CreatorResolutionKind,
    affiliate_version_id: affiliateVersionId,
    resolved_party_id: resolvedPartyId,
  }
}

export function parseCreatorShareSnapshot(value: unknown): { value?: CreatorShareSnapshot; error?: string } {
  if (!isRecord(value)) return { error: 'Ungültiger Share-Snapshot.' }
  if (!isSupportedCreatorShareSnapshotVersion(value.schema_version)) return { error: 'Nicht unterstützte Snapshot-Version.' }
  const schemaVersion = value.schema_version
  if (value.type !== 'dose_recommendation' && value.type !== 'stack') return { error: 'Ungültiger Snapshot-Typ.' }
  const creatorPartyId = positiveInteger(value.creator_party_id)
  if (creatorPartyId === null) return { error: 'Creator-Partei fehlt.' }
  if (typeof value.published_at !== 'string' || !Number.isFinite(Date.parse(value.published_at))) {
    return { error: 'Veröffentlichungszeitpunkt fehlt.' }
  }
  const title = optionalBoundedText(value.title, 120)
  if (!title) return { error: 'Share-Titel fehlt.' }
  if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > CREATOR_SHARING_MAX_ITEMS) {
    return { error: `Ein Share braucht 1 bis ${CREATOR_SHARING_MAX_ITEMS} Positionen.` }
  }
  if (value.type === 'dose_recommendation' && value.items.length !== 1) {
    return { error: 'Eine Einzel-Empfehlung muss genau eine Position enthalten.' }
  }

  const items: CreatorShareSnapshotItem[] = []
  for (const rawItem of value.items) {
    if (!isRecord(rawItem)) return { error: 'Ungültige Snapshot-Position.' }
    const catalogProductId = positiveInteger(rawItem.catalog_product_id)
    const shopLinkId = positiveInteger(rawItem.shop_link_id)
    const binding = parseBinding(rawItem.link_binding)
    const quantity = boundedInteger(rawItem.quantity, 1, 100000)
    const unit = schemaVersion === 2 ? optionalBoundedText(rawItem.unit, 40) : null
    const intakeIntervalDays = boundedInteger(rawItem.intake_interval_days, 1, 3650)
    const dosageText = optionalBoundedText(rawItem.dosage_text, 240)
    const timing = optionalBoundedText(rawItem.timing, 120)
    const statementResult = validateCreatorStatement(rawItem.creator_statement)
    const sortOrder = boundedInteger(rawItem.sort_order, 0, 1000000)
    const categoryName = optionalBoundedText(rawItem.category_name, 80)
    if (
      catalogProductId === null || shopLinkId === null || !binding
      || quantity === null || intakeIntervalDays === null
      || (schemaVersion === 2 && (unit === undefined || !Object.prototype.hasOwnProperty.call(rawItem, 'unit')))
      || dosageText === undefined || timing === undefined
      || statementResult.error || sortOrder === null || categoryName === undefined
    ) {
      return { error: statementResult.error ?? 'Ungültige Snapshot-Position.' }
    }
    if (!Array.isArray(rawItem.main_ingredient_ids) || rawItem.main_ingredient_ids.length === 0) {
      return { error: 'Hauptwirkstoff-Set fehlt.' }
    }
    const mainIngredientIds = rawItem.main_ingredient_ids.map(positiveInteger)
    if (mainIngredientIds.some((id) => id === null)) return { error: 'Ungültiges Hauptwirkstoff-Set.' }
    const normalizedIds = [...new Set(mainIngredientIds as number[])].sort((left, right) => left - right)
    if (normalizedIds.length !== mainIngredientIds.length) return { error: 'Hauptwirkstoff-Set enthält Duplikate.' }
    if (normalizedIds.some((id, index) => id !== mainIngredientIds[index])) {
      return { error: 'Hauptwirkstoff-Set ist nicht kanonisch sortiert.' }
    }
    items.push({
      catalog_product_id: catalogProductId,
      shop_link_id: shopLinkId,
      link_binding: binding,
      main_ingredient_ids: normalizedIds,
      quantity,
      ...(schemaVersion === 2 ? { unit: unit ?? null } : {}),
      intake_interval_days: intakeIntervalDays,
      dosage_text: dosageText,
      timing,
      creator_statement: statementResult.value ?? null,
      sort_order: sortOrder,
      category_name: categoryName,
    })
  }

  return {
    value: {
      schema_version: schemaVersion,
      type: value.type,
      creator_party_id: creatorPartyId,
      published_at: value.published_at,
      title,
      items,
    },
  }
}
