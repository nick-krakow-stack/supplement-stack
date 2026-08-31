const ESCAPABLE_MARKDOWN_CHARACTERS = new Set(['\\', '`', '*', '_', '[', ']', '{', '}', '(', ')', '#', '+', '.', '!', '>', '|', '-'])
const INTERNAL_KNOWLEDGE_ORIGIN = 'https://supplementstack.invalid'

function appendText(tokens, value) {
  if (!value) return
  const previous = tokens.at(-1)
  if (previous?.type === 'text') {
    previous.value += value
    return
  }
  tokens.push({ type: 'text', value })
}

function isEscaped(value, index) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1
  return slashCount % 2 === 1
}

function findClosingDelimiter(value, delimiter, startIndex) {
  let cursor = startIndex
  while (cursor < value.length) {
    const matchIndex = value.indexOf(delimiter, cursor)
    if (matchIndex < 0) return -1
    if (!isEscaped(value, matchIndex) && matchIndex > startIndex && !/\s/u.test(value[matchIndex - 1] ?? '')) {
      return matchIndex
    }
    cursor = matchIndex + delimiter.length
  }
  return -1
}

function findNextUnescaped(value, delimiter, startIndex) {
  let cursor = startIndex
  while (cursor < value.length) {
    const matchIndex = value.indexOf(delimiter, cursor)
    if (matchIndex < 0) return -1
    if (!isEscaped(value, matchIndex)) return matchIndex
    cursor = matchIndex + delimiter.length
  }
  return -1
}

function containsUnescapedAsterisk(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '*' && !isEscaped(value, index)) return true
  }
  return false
}

function tokenize(value, allowLinks) {
  const tokens = []
  let index = 0

  while (index < value.length) {
    const character = value[index]

    if (character === '\\' && index + 1 < value.length && ESCAPABLE_MARKDOWN_CHARACTERS.has(value[index + 1])) {
      appendText(tokens, value[index + 1])
      index += 2
      continue
    }

    if (character === '`') {
      const closingIndex = findNextUnescaped(value, '`', index + 1)
      if (closingIndex >= 0) {
        appendText(tokens, value.slice(index, closingIndex + 1))
        index = closingIndex + 1
        continue
      }
    }

    if (value.startsWith('***', index)) {
      const closingIndex = findNextUnescaped(value, '***', index + 3)
      if (closingIndex >= 0) {
        appendText(tokens, value.slice(index, closingIndex + 3))
        index = closingIndex + 3
        continue
      }
    }

    if (allowLinks && character === '[') {
      const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)/u.exec(value.slice(index))
      if (link) {
        tokens.push({ type: 'link', href: link[2], children: tokenize(link[1], false) })
        index += link[0].length
        continue
      }
    }

    if (value.startsWith('**', index) && !/\s/u.test(value[index + 2] ?? '')) {
      const closingIndex = findClosingDelimiter(value, '**', index + 2)
      if (closingIndex >= 0) {
        const innerValue = value.slice(index + 2, closingIndex)
        if (containsUnescapedAsterisk(innerValue)) {
          appendText(tokens, value.slice(index, closingIndex + 2))
        } else {
          tokens.push({ type: 'strong', children: tokenize(innerValue, allowLinks) })
        }
        index = closingIndex + 2
        continue
      }
    }

    if (character === '*' && value[index + 1] !== '*' && !/\s/u.test(value[index + 1] ?? '')) {
      const closingIndex = findClosingDelimiter(value, '*', index + 1)
      if (closingIndex >= 0 && value[closingIndex + 1] !== '*') {
        const innerValue = value.slice(index + 1, closingIndex)
        if (containsUnescapedAsterisk(innerValue)) {
          appendText(tokens, value.slice(index, closingIndex + 1))
        } else {
          tokens.push({ type: 'emphasis', children: tokenize(innerValue, allowLinks) })
        }
        index = closingIndex + 1
        continue
      }
    }

    appendText(tokens, character)
    index += 1
  }

  return tokens
}

export function tokenizeKnowledgeInlineMarkdown(value) {
  return tokenize(String(value ?? ''), true)
}

function tokensToText(tokens) {
  return tokens.map((token) => token.type === 'text' ? token.value : tokensToText(token.children)).join('')
}

export function knowledgeInlineMarkdownToText(value) {
  return tokensToText(tokenizeKnowledgeInlineMarkdown(value))
}

export function isKnowledgeControlMarkerLine(value) {
  return /^<!--\s*(?:knowledge-template:magazine|sources:auto)\s*-->$/i.test(String(value ?? '').trim())
}

function hasUnsafeLinkCharacters(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (
      codePoint === undefined
      || codePoint <= 0x20
      || (codePoint >= 0x7f && codePoint <= 0xa0)
      || codePoint === 0x1680
      || (codePoint >= 0x2000 && codePoint <= 0x200f)
      || (codePoint >= 0x2028 && codePoint <= 0x202f)
      || codePoint === 0x205f
      || codePoint === 0x2060
      || codePoint === 0x3000
      || codePoint === 0xfeff
      || character === '\\'
    ) return true
  }
  return false
}

export function normalizeKnowledgeInlineLink(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || hasUnsafeLinkCharacters(value)) return null

  if (/^#[a-z0-9][a-z0-9_.:-]*$/i.test(value)) return { kind: 'hash', href: value }
  if (value.startsWith('//')) return null

  if (value.startsWith('/wissen/')) {
    try {
      const parsed = new URL(value, INTERNAL_KNOWLEDGE_ORIGIN)
      if (parsed.origin !== INTERNAL_KNOWLEDGE_ORIGIN || !parsed.pathname.startsWith('/wissen/')) return null
      return { kind: 'internal', href: `${parsed.pathname}${parsed.search}${parsed.hash}` }
    } catch {
      return null
    }
  }

  if (value.startsWith('/')) return null

  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null
    return { kind: 'external', href: parsed.href }
  } catch {
    return null
  }
}
