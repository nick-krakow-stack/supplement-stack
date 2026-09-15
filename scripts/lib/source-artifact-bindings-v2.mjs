import { readFileSync } from 'node:fs'
import { canonicalJsonHash, sha256Bytes } from './content-validation.mjs'
import { assertContained, assertSafeId, resolveManifestPath } from './safe-paths.mjs'

const HASH = /^sha256:[a-f0-9]{64}$/
const RELATIONSHIPS = new Set(['supplementary_material', 'alternate_manifestation', 'alternate_indexed_abstract_representation_same_bibliographic_source', 'alternate_full_text_representation_same_bibliographic_source'])
const fail = message => { throw new Error(`source artifact binding: ${message}`) }
export const hasSourceArtifactBindingsV2 = plan => plan.sources.some(source => source.artifact_id != null || source.attachments?.length)

// Receipt source_id is the immutable acquisition-artifact identity. Only the plan
// assigns that artifact to a bibliographic source; no receipt row is relabelled.
export function resolveSourceArtifactBindingsV2(plan, receipt, root = null) {
  if (!Array.isArray(receipt.sources) || !Array.isArray(plan.sources)) fail('sources must be arrays')
  const frozen = new Map(), used = new Set(), paths = new Set(), locators = new Set()
  const artifactRoot = root == null ? null : resolveManifestPath(root, receipt.artifact_root, 'artifact_root')
  for (const row of receipt.sources) {
    assertSafeId(row.source_id, 'frozen artifact_id')
    if (frozen.has(row.source_id) || !HASH.test(row.byte_hash ?? '') || typeof row.path !== 'string' || !/^https?:\/\//.test(row.locator ?? '') || typeof row.content_type !== 'string' || !row.content_type) fail('invalid or duplicate receipt artifact')
    const path = root == null ? row.path : assertContained(artifactRoot, resolveManifestPath(root, row.path), 'frozen artifact')
    if (paths.has(path.toLowerCase()) || locators.has(new URL(row.locator).href)) fail('duplicate artifact path or locator')
    if (root != null && sha256Bytes(readFileSync(path)) !== row.byte_hash) fail(`changed bytes for ${row.source_id}`)
    paths.add(path.toLowerCase()); locators.add(new URL(row.locator).href); frozen.set(row.source_id, row)
  }
  const bindings = [], sourceIds = new Set(plan.sources.map(source => source.source_id))
  if (sourceIds.size !== plan.sources.length) fail('duplicate bibliographic source')
  for (const source of plan.sources) {
    assertSafeId(source.source_id, 'bibliographic source_id')
    if (source.attachments != null && !Array.isArray(source.attachments)) fail('attachments must be an array')
    const primaryId = source.artifact_id ?? source.source_id
    const claims = [{ artifact_id: primaryId, primary: true }, ...(source.attachments ?? []).map(attachment => ({ ...attachment, primary: false }))]
    for (const claim of claims) {
      const id = assertSafeId(claim.artifact_id, 'artifact_id'), row = frozen.get(id)
      if (!row || used.has(id)) fail(`unavailable or multiply owned artifact ${id}`)
      if (claim.primary) {
        if (source.url !== row.locator || source.source_content_hash !== row.byte_hash) fail(`primary hash/locator differs for ${source.source_id}`)
      } else {
        if (claim.parent_source_id !== source.source_id || claim.is_independent_source !== false || !RELATIONSHIPS.has(claim.relationship) || (claim.source_id != null && claim.source_id !== id)) fail(`invalid parent/relationship for ${id}`)
        if (claim.path !== row.path || claim.byte_hash !== row.byte_hash || claim.locator !== row.locator || claim.content_type !== row.content_type) fail(`attachment differs from frozen receipt: ${id}`)
      }
      used.add(id)
      bindings.push({ source_id: source.source_id, artifact_id: id, relationship: claim.primary ? 'primary' : claim.relationship, path: row.path, byte_hash: row.byte_hash, locator: row.locator, content_type: row.content_type })
    }
  }
  if (used.size !== frozen.size) fail('plan does not partition every frozen artifact exactly once')
  return bindings.sort((a, b) => `${a.source_id}:${a.artifact_id}`.localeCompare(`${b.source_id}:${b.artifact_id}`))
}

export function sourceArtifactBindingsForV2(bindings, sourceIds) {
  return bindings.filter(binding => sourceIds.includes(binding.source_id))
}

export function validateSourceArtifactBindingsHashV2(shard, bindings) {
  const expected = sourceArtifactBindingsForV2(bindings, shard.source_ids)
  if (canonicalJsonHash(shard.source_artifact_bindings ?? null) !== canonicalJsonHash(expected)) fail('shard must bind every assigned primary and attachment')
}
