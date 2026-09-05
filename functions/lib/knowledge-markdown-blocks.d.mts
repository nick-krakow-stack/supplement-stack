export type KnowledgeMarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; src: string; caption: string | null };

export function parseKnowledgeMarkdown(markdown: string): KnowledgeMarkdownBlock[];
export function isKnowledgeSourceHeading(header: string): boolean;
