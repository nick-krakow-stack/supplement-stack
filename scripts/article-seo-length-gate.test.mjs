import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTechnicalSeo } from './lib/article-runtime-v2.mjs'

function compileSeo(title, description, stage = 'stage3') {
  const publishPayload = { title, dek: description }
  const seo = buildTechnicalSeo({
    context: { linkInventory: { routes: [] }, publish: { publicBaseUrl: 'https://supplementstack.de' } },
    article: { article_id: 'meta-boundary-test', slug: 'meta-boundary-test', stage },
    factsPackage: {
      language: 'de', substance: { slug: 'teststoff' }, selected_link_slice: { links: [] },
      seo_brief: { primary_intent: 'Vorhandene Artikelinformationen verständlich finden', internal_link_targets: [] },
    },
    publishPayload,
  })
  assert.deepEqual(publishPayload, { title, dek: description }, 'the metadata gate must not rewrite the visible H1 or lead')
  return seo
}

test('publication compiler accepts the documented inclusive 15/70 title and 40/180 description boundaries', () => {
  for (const titleLength of [15, 70]) {
    for (const descriptionLength of [40, 180]) {
      const seo = compileSeo('T'.repeat(titleLength), 'D'.repeat(descriptionLength))
      assert.equal(seo.meta_title.length, titleLength)
      assert.equal(seo.meta_description.length, descriptionLength)
      assert.ok(seo.validated_checks.includes('title_length'))
      assert.ok(seo.validated_checks.includes('description_length'))
    }
  }
})

test('publication compiler rejects a too-short title and out-of-contract descriptions before QA', () => {
  assert.throws(() => compileSeo('T'.repeat(14), 'D'.repeat(40)), /SEO title length must be 15\.\.70/)
  for (const descriptionLength of [0, 39, 181]) {
    assert.throws(() => compileSeo('T'.repeat(20), 'D'.repeat(descriptionLength)), /SEO description length must be 40\.\.180/)
  }
})

test('long scientific source headings remain intact while only the technical title is bounded', () => {
  const sourceHeading = 'Die langfristige Untersuchung einer wissenschaftlichen Fragestellung unter genau beschriebenen Bedingungen'
  const seo = compileSeo(sourceHeading, 'Eine verständliche Zusammenfassung des unveränderten wissenschaftlichen Artikels.', 'stage2')
  assert.notEqual(seo.meta_title, sourceHeading)
  assert.ok(seo.meta_title.endsWith('…'))
  assert.ok(seo.meta_title.length <= 70)
  assert.equal(seo.json_ld.headline, seo.meta_title)
})

test('length boundaries apply to normalized visible text rather than Markdown syntax or spacing', () => {
  const seo = compileSeo(` **${'T'.repeat(15)}** `, ` ${'D'.repeat(20)}   ${'D'.repeat(19)} `)
  assert.equal(seo.meta_title.length, 15)
  assert.equal(seo.meta_description.length, 40)
  assert.throws(() => compileSeo('T'.repeat(20), `**${'D'.repeat(39)}**`), /SEO description length/)
})
