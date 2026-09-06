import { parseKnowledgeMarkdown } from './knowledge-markdown-blocks.mjs'
import { knowledgeInlineMarkdownToText, normalizeKnowledgeInlineLink, tokenizeKnowledgeInlineMarkdown } from './knowledge-inline-markdown.mjs'

export function escapeLegalHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function serializeLegalBootstrap(value) {
  const escaped = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' }
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => escaped[character])
}

/** Legal documents allow ordinary navigation and contact links, never executable URLs. */
export function normalizeLegalLink(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\s\\\u0000-\u001f\u007f-\u009f]/u.test(value) || /%0[0-9a-f]|%1[0-9a-f]|%7f|%5c/i.test(value)) return null
  if (/^mailto:[A-Z0-9._+-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(value)) return { kind: 'contact', href: value }
  if (/^tel:\+?[0-9][0-9().-]{2,30}$/i.test(value)) return { kind: 'contact', href: value }
  if (value.startsWith('/') && !value.startsWith('//')) {
    try {
      const url = new URL(value, 'https://supplementstack.de')
      if (url.origin !== 'https://supplementstack.de' || /%0[0-9a-f]|%1[0-9a-f]|%7f|%5c/i.test(value)) return null
      return { kind: 'internal', href: `${url.pathname}${url.search}${url.hash}` }
    } catch { return null }
  }
  return normalizeKnowledgeInlineLink(value)
}

function renderTokens(tokens) {
  return tokens.map((token) => {
    if (token.type === 'text') return escapeLegalHtml(token.value).replace(/\n/g, '<br />')
    const content = renderTokens(token.children)
    if (token.type === 'strong') return `<strong>${content}</strong>`
    if (token.type === 'emphasis') return `<em>${content}</em>`
    const link = normalizeLegalLink(token.href)
    return link ? `<a href="${escapeLegalHtml(link.href)}"${link.kind === 'external' ? ' rel="noopener noreferrer"' : ''}>${content}</a>` : content
  }).join('')
}

/** Shared supported block/inline grammar; raw HTML and remote image loading stay disabled. */
export function renderLegalMarkdown(markdown, title = '') {
  const blocks = parseKnowledgeMarkdown(String(markdown ?? ''))
  if (blocks[0]?.type === 'heading' && blocks[0].level === 1 && knowledgeInlineMarkdownToText(blocks[0].text).trim() === title.trim()) blocks.shift()
  const inline = (text) => renderTokens(tokenizeKnowledgeInlineMarkdown(text))
  return blocks.map((block) => {
    if (block.type === 'heading') {
      const level = Math.max(2, block.level)
      return `<h${level}>${inline(block.text)}</h${level}>`
    }
    if (block.type === 'paragraph') return `<p>${inline(block.text)}</p>`
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`
    }
    if (block.type === 'table') return `<div class="legal-table-scroll"><table><thead><tr>${block.headers.map((cell) => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${block.rows.map((row) => `<tr>${block.headers.map((_, index) => `<td>${inline(row[index] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    // Legal prose does not silently load external trackers or embed untrusted SVG/HTML.
    return `<p>${inline(block.alt)}${block.caption ? `<br />${inline(block.caption)}` : ''}</p>`
  }).join('\n')
}

export function formatLegalDocumentDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim()
  const utc = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z`
    : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw
  if (!/^\d{4}-\d{2}-\d{2}T/.test(utc)) return null
  const parsed = new Date(utc)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw.slice(0, 10)) return null
  return { dateTime: parsed.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed) }
}

export function legalDocumentVersionText(document) {
  const date = formatLegalDocumentDate(document.updated_at) ?? formatLegalDocumentDate(document.published_at)
  const version = typeof document.version === 'number' && Number.isInteger(document.version) && document.version > 0 ? `Version ${document.version}` : null
  return [version, date ? `Stand: ${date.label}` : null].filter(Boolean).join(' · ')
}
