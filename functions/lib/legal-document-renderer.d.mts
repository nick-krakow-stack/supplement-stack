export function escapeLegalHtml(value: unknown): string;
export function serializeLegalBootstrap(value: unknown): string;
export function normalizeLegalLink(value: string): { kind: 'contact' | 'internal' | 'external' | 'hash'; href: string } | null;
export function renderLegalMarkdown(markdown: string, title?: string): string;
export function formatLegalDocumentDate(value: string | null): { dateTime: string; label: string } | null;
export function legalDocumentVersionText(document: { updated_at: string | null; published_at: string | null; version: number | null }): string;
