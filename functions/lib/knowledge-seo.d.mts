import { resolveRouteHead } from './route-head-contract.mjs'

export type KnowledgeSeoArticle = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  article_layer?: string | null;
  published_at?: string | null;
  modified_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reviewed_at?: string | null;
  seo?: { meta_title: string; meta_description: string; json_ld: Record<string, unknown> } | null;
  ingredients?: Array<{ name: string | null }>;
  sources?: Array<{ label: string; url: string }>;
  related_articles?: Array<{ slug: string; title: string; article_layer: string }>;
}
export function knowledgeMetadataText(value: unknown): string;
export function knowledgeSeoTimestamps(article: KnowledgeSeoArticle): { publishedAt: string | null; modifiedAt: string | null };
export function knowledgeArticleImage(article: KnowledgeSeoArticle): string | null;
export function knowledgeArticleJsonLd(article: KnowledgeSeoArticle): { '@context': string; '@graph': Record<string, unknown>[] };
export function knowledgeArticleHead(article: KnowledgeSeoArticle): ReturnType<typeof resolveRouteHead>;
