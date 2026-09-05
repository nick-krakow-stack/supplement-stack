import { isKnowledgeControlMarkerLine, knowledgeInlineMarkdownToText } from './knowledge-inline-markdown.mjs'

function headingForLine(line) {
  const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
  return match ? { level: match[1].length, text: match[2].trim() } : null
}

function unorderedListItem(line) {
  const match = /^[-*]\s+(.+)$/.exec(line.trim())
  return match ? match[1].trim() : null
}

function orderedListItem(line) {
  const match = /^\d+\.\s+(.+)$/.exec(line.trim())
  return match ? match[1].trim() : null
}

function parseTableRow(line) {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return null
  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
  return cells.length > 1 ? cells : null
}

function isTableSeparator(line) {
  const cells = parseTableRow(line)
  return Boolean(cells?.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
}

function parseImageLine(line) {
  const match = /^!\[([^\]\n]*)\]\(([^)]*)\)\s*$/.exec(line.trim())
  return match ? { alt: match[1].trim(), src: match[2].trim() } : null
}

function parseItalicCaption(line) {
  const match = line.trim().match(/^(?:\*([^*\n]+)\*|_([^_\n]+)_)$/)
  return (match?.[1] ?? match?.[2] ?? '').trim() || null
}

function isAllowedImageSrc(src) {
  return /^(https?:\/\/|\/\/|\/|data:image\/)/i.test(src)
}

export function isKnowledgeSourceHeading(header) {
  return /^(quellen?|sources?)$/i.test(knowledgeInlineMarkdownToText(header).trim())
}

function startsTable(lines, index) {
  return Boolean(parseTableRow(lines[index]) && lines[index + 1] && isTableSeparator(lines[index + 1]))
}

function startsNewBlock(lines, index) {
  const line = lines[index]
  return Boolean(!line.trim() || isKnowledgeControlMarkerLine(line) || headingForLine(line)
    || parseImageLine(line) || unorderedListItem(line) || orderedListItem(line) || startsTable(lines, index))
}

/** The supported article block syntax is shared by browser rendering and raw HTML. */
export function parseKnowledgeMarkdown(markdown) {
  const lines = markdown.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim() || isKnowledgeControlMarkerLine(line)) { index += 1; continue }
    const heading = headingForLine(line)
    if (heading) { blocks.push({ type: 'heading', ...heading }); index += 1; continue }
    if (startsTable(lines, index)) {
      const headers = parseTableRow(lines[index]) ?? []
      const rows = []
      index += 2
      while (index < lines.length) {
        const cells = parseTableRow(lines[index])
        if (!cells || isTableSeparator(lines[index])) break
        rows.push(cells)
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }
    const unorderedItem = unorderedListItem(line)
    const orderedItem = orderedListItem(line)
    if (unorderedItem || orderedItem) {
      const items = []
      const readItem = unorderedItem ? unorderedListItem : orderedListItem
      while (index < lines.length) {
        const item = readItem(lines[index])
        if (!item) break
        items.push(item)
        index += 1
      }
      blocks.push({ type: 'list', ordered: !unorderedItem, items })
      continue
    }
    const image = parseImageLine(line)
    if (image) {
      if (!isAllowedImageSrc(image.src)) {
        blocks.push({ type: 'paragraph', text: line.trim() })
        index += 1
        continue
      }
      let nextNonEmptyIndex = index + 1
      while (nextNonEmptyIndex < lines.length && !lines[nextNonEmptyIndex].trim()) nextNonEmptyIndex += 1
      const caption = nextNonEmptyIndex < lines.length ? parseItalicCaption(lines[nextNonEmptyIndex]) : null
      blocks.push({ type: 'image', ...image, caption })
      index = caption ? nextNonEmptyIndex + 1 : index + 1
      continue
    }
    const paragraphLines = []
    while (index < lines.length && !startsNewBlock(lines, index)) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') })
  }
  return blocks
}
