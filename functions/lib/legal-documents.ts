export type PublicLegalDocument = {
  slug: string
  title: string
  body_md: string
  status: 'published'
  published_at: string | null
  updated_at: string | null
  version: number | null
}

export const PUBLIC_LEGAL_SLUGS = new Set(['impressum', 'datenschutz', 'nutzungsbedingungen', 'cookie-consent', 'affiliate-disclosure'])
export const LEGAL_PAGE_SLUGS = new Set(['impressum', 'datenschutz', 'nutzungsbedingungen'])

/** API and initial HTML use exactly this canonical, publication-scoped projection. */
export async function loadPublishedLegalDocument(db: D1Database, slug: string): Promise<PublicLegalDocument | null> {
  if (!PUBLIC_LEGAL_SLUGS.has(slug)) return null
  const document = await db.prepare(`
    SELECT slug, title, body_md, status, published_at, updated_at, version
    FROM legal_documents
    WHERE slug = ? AND status = 'published'
      AND TRIM(COALESCE(body_md, '')) <> ''
    LIMIT 1
  `).bind(slug).first<PublicLegalDocument>()
  if (!document || document.slug !== slug || document.status !== 'published' || !document.body_md?.trim() || !document.title?.trim()) return null
  return document
}
