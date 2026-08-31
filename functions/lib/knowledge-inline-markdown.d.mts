export type KnowledgeInlineMarkdownToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: KnowledgeInlineMarkdownToken[] }
  | { type: 'emphasis'; children: KnowledgeInlineMarkdownToken[] }
  | { type: 'link'; href: string; children: KnowledgeInlineMarkdownToken[] };

export type NormalizedKnowledgeInlineLink =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'hash'; href: string };

export function tokenizeKnowledgeInlineMarkdown(value: string): KnowledgeInlineMarkdownToken[];
export function knowledgeInlineMarkdownToText(value: string): string;
export function isKnowledgeControlMarkerLine(value: string | null | undefined): boolean;
export function normalizeKnowledgeInlineLink(value: string | null | undefined): NormalizedKnowledgeInlineLink | null;
