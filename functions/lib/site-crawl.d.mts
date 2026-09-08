export function buildRobotsTxt(publishedSlugs?: readonly string[]): string;
export function buildSitemapXml(lastModifiedBySlug: ReadonlyMap<string, string | null>, publishedCreators?: readonly { slug: string; published_at: string }[]): string;
