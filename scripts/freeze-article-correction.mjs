#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildArticleCorrectionInputReceiptV1 } from './lib/article-correction-v1.mjs'
import { decodeUtf8Strict } from './lib/content-validation.mjs'
import { writeJsonAtomic } from './lib/article-runtime-v2.mjs'

function fail(message) { throw new Error(message) }
function parse(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1]
    if (!['--request', '--out', '--root'].includes(key) || !value) fail('Usage: node scripts/freeze-article-correction.mjs --request <request.json> --out <receipt.json> [--root <run-root>]')
    result[key.slice(2)] = value
  }
  return result
}
function json(path) {
  const decoded = decodeUtf8Strict(readFileSync(path), path)
  if (decoded.errors.length) fail(decoded.errors.join('; '))
  try { return JSON.parse(decoded.text) } catch (error) { fail(`${path} is invalid JSON: ${error.message}`) }
}

try {
  const options = parse(process.argv.slice(2))
  if (!options.request || !options.out) fail('Usage: node scripts/freeze-article-correction.mjs --request <request.json> --out <receipt.json> [--root <run-root>]')
  const requestPath = resolve(options.request)
  const root = options.root ? resolve(options.root) : dirname(requestPath)
  const receipt = buildArticleCorrectionInputReceiptV1({ root, request: json(requestPath) })
  writeJsonAtomic(resolve(options.out), receipt)
  process.stdout.write(`${JSON.stringify({ schema: receipt.schema, content_hash: receipt.content_hash, change_class: receipt.change_class, affected_article_ids: receipt.affected_article_ids })}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
