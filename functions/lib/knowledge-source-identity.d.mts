export function knowledgeSourceIdentity(source: {
  source_id?: string;
  label: string;
  url: string;
  name?: string;
  link?: string;
  internal_articles?: Array<{ slug: string; title: string; url: string }>;
}): string;
