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

test('MED reference requires the exact indexed PMID, host, path and query without changing acquired JSON', () => {
  const input = { ...source(), pmid: '16481635', url: 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID%3A16481635%20AND%20SRC%3AMED&resultType=core&format=json', canonical_url: 'https://pubmed.ncbi.nlm.nih.gov/16481635/' }
  const before = JSON.stringify(input)
  assert.equal(projectVisibleSourceV2(input).source_url, input.canonical_url)
  assert.equal(JSON.stringify(input), before)
  const invalid = [
    { pmid: null }, { pmid: '16481636' },
    { canonical_url: input.canonical_url.replace('16481635', '16481636') },
    { canonical_url: 'https://example.org/arbitrary' },
    ...['?redirect=x', '#x', 'extra'].map(suffix => ({ canonical_url: input.canonical_url + suffix })),
    ...['&format=xml', '&format=json', '#x'].map(suffix => ({ url: input.url + suffix })),
    ...['url', 'canonical_url'].flatMap(key => [
      { [key]: input[key].replace('https:', 'http:') },
      { [key]: input[key].replace('https://', 'https://user:secret@') },
      { [key]: input[key].replace(/(\.uk|\.gov)\//, '$1:443/') },
    ]),
    { url: input.url.replace('www.ebi.ac.uk', 'www.ebi.ac.uk.evil.example') },
    { url: input.url.replace('SRC%3AMED', 'SRC%3APMC') },
    { url: input.url.replace('resultType=core', 'resultType=lite') },
    { url: input.url.replace('EXT_ID%3A16481635', 'EXT_ID%3A016481635') },
    { url: input.url.replace('%20AND%20', '%20OR%20') },
  ]
  for (const patch of invalid) assert.throws(() => projectVisibleSourceV2({ ...input, ...patch }), /invalid or mismatched MED\/PubMed/)
  const pdf = { ...input, url: 'https://eclass.uoa.gr/modules/document/file.php/MATH301/StudentsPapers/Jackson-2005.pdf' }
  assert.equal(projectVisibleSourceV2(pdf).source_url, pdf.url)
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

test('Nordic chapter reference binds the reviewed official NNR2023 calcium chapter without changing PDF evidence', () => {
  const input = { ...source(), source_id: 'nnr2023-calcium', url: 'https://pub.norden.org/nord2023-003/files/691f2f1d3e29c_calcium.pdf', canonical_url: 'https://pub.norden.org/nord2023-003/calcium.html' }
  const before = JSON.stringify(input)
  const projection = projectVisibleSourceV2(input)
  assert.equal(projection.source_url, input.canonical_url)
  assert.equal(projection.source_content_hash, input.source_content_hash)
  assert.equal(projection.label, input.label)
  assert.equal(JSON.stringify(input), before)
  assert.equal(projectVisibleSourceV2({ ...input, canonical_url: input.url }).source_url, input.url)
  const invalid = [
    { canonical_url: input.canonical_url.replace('calcium', 'potassium') },
    { url: input.url.replace('_calcium', '_potassium') },
    { canonical_url: input.canonical_url.replace('2023', '2024') },
    { url: input.url.replace('2023', '2024') },
    { canonical_url: input.canonical_url.replace('pub.norden.org', 'example.org') },
    { url: input.url.replace('pub.norden.org', 'pub.norden.org.evil.example') },
    { canonical_url: input.canonical_url + '?redirect=other' },
    { url: input.url + '?download=1' },
    { canonical_url: input.canonical_url + '#chapter' },
    { url: input.url + '#page=1' },
    { url: input.url.replace('https://', 'https://user:secret@') },
    { canonical_url: input.canonical_url.replace('https://', 'https://user:secret@') },
    { url: input.url.replace('.org/', '.org:443/') },
    { canonical_url: input.canonical_url.replace('.org/', '.org:443/') },
    { url: input.url.replace('https:', 'http:') },
    { canonical_url: input.canonical_url.replace('https:', 'http:') },
    { url: input.url.replace('_calcium.pdf', '_calcium.pdf/extra') },
    { url: input.url.replace('691f2f1d3e29c_', 'unknown_') },
  ]
  for (const patch of invalid) assert.throws(() => projectVisibleSourceV2({ ...input, ...patch }), /invalid or mismatched Nordic chapter-reference pair/)
})
