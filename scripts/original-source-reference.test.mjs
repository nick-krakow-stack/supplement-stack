import assert from 'node:assert/strict'
import test from 'node:test'
import { projectVisibleSourceV2 } from './lib/evidence-pipeline-v2.mjs'
import { canonicalJsonHash } from './lib/content-validation.mjs'

const source = (id = '8527562') => ({
  source_id: 'original-study', source_type: 'study', label: 'Autor (2021). Originaltitel. Journal.',
  url: `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC${id}/fullTextXML`,
  canonical_url: `https://pmc.ncbi.nlm.nih.gov/articles/PMC${id}/`,
  source_content_hash: `sha256:${'a'.repeat(64)}`,
})

test('original reference projects only the exact same-PMCID XML/HTML pair without mutating acquisition bindings', () => {
  for (const id of ['8527562', '6300855']) {
    const input = source(id), before = JSON.stringify(input)
    const projection = projectVisibleSourceV2(input)
    assert.equal(projection.source_url, input.canonical_url)
    assert.equal(projection.label, input.label)
    assert.equal(projection.source_content_hash, input.source_content_hash)
    assert.equal(JSON.stringify(input), before)
    assert.notEqual(canonicalJsonHash(projection), canonicalJsonHash({ ...projection, source_url: input.url }))
  }
})

test('original reference preserves direct and unrelated locators without generic canonical fallback', () => {
  const direct = { ...source(), url: source().canonical_url }
  assert.equal(projectVisibleSourceV2(direct).source_url, direct.url)
  const pdf = { ...source(), url: 'https://example.org/original.pdf', canonical_url: 'https://example.org/landing' }
  assert.equal(projectVisibleSourceV2(pdf).source_url, pdf.url)
  const noCanonical = source(); delete noCanonical.canonical_url
  assert.equal(projectVisibleSourceV2(noCanonical).source_url, noCanonical.url)
})

test('original reference rejects mismatches and non-exact PMC transport variants', () => {
  const good = source()
  const invalid = [
    { canonical_url: source('6300855').canonical_url },
    { canonical_url: 'https://example.org/arbitrary' },
    { canonical_url: good.canonical_url + '?redirect=other' },
    { canonical_url: good.canonical_url + '#other' },
    { canonical_url: good.canonical_url.replace('https://', 'https://user:secret@') },
    { canonical_url: good.canonical_url.replace('.gov/', '.gov:443/') },
    { canonical_url: good.canonical_url.replace('pmc.', 'www.pmc.') },
    { url: good.url + '?suffix=other' },
    { url: good.url + '#fragment' },
    { url: good.url.replace('https://', 'https://user:secret@') },
    { url: good.url.replace('.uk/', '.uk:443/') },
    { url: good.url.replace('www.ebi.ac.uk', 'www.ebi.ac.uk.evil.example') },
    { url: good.url.replace('https:', 'http:') },
    { url: good.url.replace('PMC8527562', 'PMC08527562') },
  ]
  for (const patch of invalid) assert.throws(() => projectVisibleSourceV2({ ...good, ...patch }), /invalid or mismatched PMC original-reference pair/)
})
