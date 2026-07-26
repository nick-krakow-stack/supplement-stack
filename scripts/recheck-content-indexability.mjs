#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { loadNutrientContentRunManifest } from './lib/nutrient-content-runner.mjs'
import { runRendererPublicReadbackV2 } from './lib/nutrient-content-machine-dispatcher.mjs'
import { buildIndexabilityReleaseReceiptV1 } from './lib/indexability-release-v1.mjs'
import { writeJsonAtomic } from './lib/article-runtime-v2.mjs'

function fail(message) { throw new Error(message) }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')) }

const args = process.argv.slice(2)
const manifestIndex = args.indexOf('--manifest')
if (manifestIndex < 0 || !args[manifestIndex + 1]) fail('usage: node scripts/recheck-content-indexability.mjs --manifest <nutrient-content-run.v2.json>')
const context = loadNutrientContentRunManifest(resolve(args[manifestIndex + 1]))
if (!existsSync(context.releasePath) || !existsSync(context.publishReceiptPath)) fail('release and original publish receipt are required before an indexability recheck')

const release = readJson(context.releasePath)
const publishReceipt = readJson(context.publishReceiptPath)
const publishDir = dirname(context.publishReceiptPath)
const rendererRequestPath = resolve(publishDir, 'indexability-renderer-public-readback-request.v2.json')
const rendererReceiptPath = resolve(publishDir, 'indexability-renderer-public-readback-receipt.v2.json')
const receiptPath = resolve(publishDir, 'indexability-release-receipt.v1.json')
const renderer = runRendererPublicReadbackV2({
  release,
  adapter: { kind: 'cloudflare-d1' },
  requestPath: rendererRequestPath,
  receiptPath: rendererReceiptPath,
})
const receipt = buildIndexabilityReleaseReceiptV1({ release, publishReceipt, rendererRequest: renderer.request, rendererReceipt: renderer.receipt })
writeJsonAtomic(receiptPath, receipt)
process.stdout.write(`${JSON.stringify({ result: receipt.result, release_hash: receipt.release_hash, receipt_hash: receipt.content_hash, receipt_path: receiptPath, renderer_receipt_hash: receipt.renderer_receipt_hash }, null, 2)}\n`)
