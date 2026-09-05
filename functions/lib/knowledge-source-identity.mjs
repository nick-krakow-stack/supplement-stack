/** The complete presentation identity; a shared locator alone is not a duplicate. */
export function knowledgeSourceIdentity(source) {
  return JSON.stringify([
    source.source_id ?? null, source.label, source.url, source.name ?? null, source.link ?? null,
    (source.internal_articles ?? []).map(({ slug, title, url }) => [slug, title, url]),
  ]);
}
