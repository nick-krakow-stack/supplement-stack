import assert from 'node:assert/strict'
import test from 'node:test'
import { assembleStage2VisiblePayload, assembleStage3VisiblePayload, resolveStage3ReaderReview } from './build-publication-review-inputs.mjs'
import { assembleStage2LegacyVisiblePayload } from './lib/visible-payload-assembly.mjs'

const visibleSources = [
  { source_id: 'src-primary', label: 'Primärquelle', url: 'https://example.org/primary' },
  { source_id: 'src-supporting', label: 'Ergänzende Quelle', url: 'https://example.org/supporting' },
]

function legacyStage2Authoring(articleBody, title = 'Beispielartikel') {
  return `# Studienartikel: ${title}\n\n## Kernfelder (Metadaten)\n\n- titel_artikel: ${title}\n- coverage_article_id: beispiel\n\n## Artikel\n\n${articleBody}\n\n## Abschlussstatus\n\n- publication_status: drafted`
}

test('explicit Stage-2 legacy payload exposes summary, conclusion and sources exactly once', () => {
  const articleBody = `
Der Lead erklärt die Kernfrage in einem eigenen Absatz.

### Hintergrund

Der Hauptteil erklärt die Studie ohne Wiederholung des Leads.

### Ergebnisse

Die Ergebnisse bleiben als eigentlicher Body sichtbar.

### Was lässt sich festhalten?

Der Schluss fasst die Aussage knapp zusammen.

### Quellen

- [Primärquelle](https://example.org/primary)
- [Ergänzende Quelle](https://example.org/supporting)
`.trim()

  const payload = assembleStage2LegacyVisiblePayload({ slug: 'beispiel', markdown: legacyStage2Authoring(articleBody), visibleSources })

  assert.equal(payload.summary, 'Der Lead erklärt die Kernfrage in einem eigenen Absatz.')
  assert.equal(payload.conclusion, 'Der Schluss fasst die Aussage knapp zusammen.')
  assert.equal(payload.body, '### Hintergrund\n\nDer Hauptteil erklärt die Studie ohne Wiederholung des Leads.\n\n### Ergebnisse\n\nDie Ergebnisse bleiben als eigentlicher Body sichtbar.')
  assert.deepEqual(payload.sources, visibleSources)
  assert.doesNotMatch(payload.body, /Der Lead erklärt/)
  assert.doesNotMatch(payload.body, /Der Schluss fasst/)
  assert.doesNotMatch(payload.body, /### Quellen|example\.org/)
})

test('explicit Stage-2 legacy payload removes a singular Originalquelle section', () => {
  const articleBody = `
Eine Behörde bewertete eine klar abgegrenzte Aussage.

### Bewertungsgrundlage

Die Bewertung stützte sich auf die eingereichten Humanstudien.

### Wie weit reicht die Schlussfolgerung?

Die Unterlagen trugen die geprüfte Aussage nicht.

### Originalquelle

- [Behördenbewertung](https://example.org/authority)
`.trim()

  const payload = assembleStage2LegacyVisiblePayload({ slug: 'behoerdenquelle', markdown: legacyStage2Authoring(articleBody, 'Behördenquelle'), visibleSources: visibleSources.slice(0, 1) })

  assert.equal(payload.summary, 'Eine Behörde bewertete eine klar abgegrenzte Aussage.')
  assert.equal(payload.conclusion, 'Die Unterlagen trugen die geprüfte Aussage nicht.')
  assert.equal(payload.body, '### Bewertungsgrundlage\n\nDie Bewertung stützte sich auf die eingereichten Humanstudien.')
  assert.doesNotMatch(payload.body, /Originalquelle|example\.org/)
})

test('explicit Stage-2 legacy payload fails closed when no separate conclusion exists', () => {
  const articleBody = 'Nur ein Lead ohne gegliederten Schluss.\n\n### Quellen\n\n- [Primärquelle](https://example.org/primary)'
  assert.throws(
    () => assembleStage2LegacyVisiblePayload({ slug: 'invalid', markdown: legacyStage2Authoring(articleBody, 'Ungültig'), visibleSources: visibleSources.slice(0, 1) }),
    /distinct lead paragraph|distinct conclusion section/,
  )
})

test('Stage-2 v2 payload accepts only pure visible adaptive Markdown', () => {
  const markdown = `# Was die Beispielstudie wirklich zeigt

Die Studie beantwortet eine klar begrenzte Frage und muss entsprechend vorsichtig eingeordnet werden.

## Welche Frage wurde untersucht?

Die Forschenden verglichen zwei klar beschriebene Gruppen.

## Was bedeuten die Ergebnisse?

Der beobachtete Unterschied ist im Kontext der Studiendauer zu lesen.

## Fazit

Die Quelle liefert einen nützlichen, aber begrenzten Baustein für die Einordnung.

## Quellen

<!-- sources:auto -->`
  const payload = assembleStage2VisiblePayload({ slug: 'beispielstudie', markdown, visibleSources })

  assert.equal(payload.title, 'Was die Beispielstudie wirklich zeigt')
  assert.equal(payload.summary, 'Die Studie beantwortet eine klar begrenzte Frage und muss entsprechend vorsichtig eingeordnet werden.')
  assert.match(payload.body, /^## Welche Frage wurde untersucht\?/)
  assert.match(payload.body, /## Was bedeuten die Ergebnisse\?/)
  assert.match(payload.body, /## Fazit\n\nDie Quelle liefert einen .* begrenzten Baustein/)
  assert.doesNotMatch(payload.body, /^# |## Quellen|sources:auto/m)
  assert.equal(payload.conclusion, 'Die Quelle liefert einen nützlichen, aber begrenzten Baustein für die Einordnung.')
  assert.deepEqual(payload.sources, visibleSources)
})

test('Stage-2 v2 fails closed at byte, adaptive-section and source boundaries', () => {
  const valid = '# Titel\n\nEin einzelner Lead.\n\n## Einordnung\n\nTragender Text.\n\n## Fazit\n\nSchluss.\n\n## Quellen\n\n<!-- sources:auto -->'
  const assemble = (markdown) => assembleStage2VisiblePayload({ slug: 'invalid', markdown, visibleSources: visibleSources.slice(0, 1) })

  assert.throws(() => assemble(`\uFEFF${valid}`), /byte 1/)
  assert.throws(() => assemble(` ${valid}`), /byte 1/)
  assert.throws(() => assemble(valid.replace('## Einordnung', '# Zweiter Titel\n\n## Einordnung')), /exactly one leading H1 heading/)
  assert.throws(() => assemble(valid.replace('## Einordnung', '#\tZweiter Titel\n\n## Einordnung')), /exactly one leading H1 heading/)
  assert.throws(() => assemble(valid.replace('Ein einzelner Lead.', 'Erster Lead.\n\nZweiter Lead.')), /exactly one lead paragraph/)
  assert.throws(() => assemble(valid.replace('## Einordnung\n\nTragender Text.\n\n', '')), /one or more adaptive H2 sections/)
  assert.throws(() => assemble(valid.replace('Tragender Text.', '<!-- nur unsichtbar -->')), /empty H2 section: Einordnung/)
  assert.throws(() => assemble(valid.replace('## Fazit', '### Leerer Unterpunkt\n\n## Fazit')), /empty H3 section: Leerer Unterpunkt/)
  assert.throws(() => assemble(valid.replace('## Fazit', '###\n\n## Fazit')), /empty H3 heading/)
  for (const level of [4, 5, 6]) assert.throws(() => assemble(valid.replace('## Fazit', `${'#'.repeat(level)} Zu tief\n\nInhalt.\n\n## Fazit`)), new RegExp(`supports only H2 and H3 headings; found H${level}`))
  assert.throws(() => assemble(valid.replace('## Einordnung', '## Kernfelder (Metadaten)')), /legacy technical heading/)
  assert.throws(() => assemble(valid.replace('Tragender Text.', 'https://example.org/primary')), /duplicates generated source URL/)
  assert.throws(() => assemble(valid.replace('<!-- sources:auto -->', '<!-- sources:auto -->\n\nManuelle Quelle')), /must contain only/)
  assert.doesNotThrow(() => assemble(valid.replace('Tragender Text.', '### Vertiefung\n\nTragender Unterabschnitt.')))
})

test('Stage-3 payload exposes title, first lead, conclusion and sources exactly once', () => {
  const markdown = `
# Beispielstoff: Was die Forschung zeigt

Der erste Lead-Absatz fasst die Kernfrage zusammen.

<!-- knowledge-template:magazine -->

## Auf einen Blick

- Die Zwischenübersicht bleibt an ihrer ursprünglichen Position.
- Die Einordnung trennt Ergebnis und Schlussfolgerung.
- Die Grenzen der Quelle bleiben sichtbar.

## Was ist der Beispielstoff?

Der Hauptteil erklärt den Stoff.

## Fazit

Der Schluss ordnet die Ergebnisse ein.

Ein Hinweis gehört weiterhin zum Schluss.

## Quellen

<!-- sources:auto -->
`.trim()

  const payload = assembleStage3VisiblePayload({ slug: 'beispielstoff', markdown, visibleSources })

  assert.equal(payload.title, 'Beispielstoff: Was die Forschung zeigt')
  assert.equal(payload.summary, 'Der erste Lead-Absatz fasst die Kernfrage zusammen.')
  assert.match(payload.body, /^<!-- knowledge-template:magazine -->/)
  assert.match(payload.body, /## Fazit\n\nDer Schluss ordnet die Ergebnisse ein/)
  assert.match(payload.body, /## Quellen\n\n<!-- sources:auto -->$/)
  assert.equal(payload.conclusion, 'Der Schluss ordnet die Ergebnisse ein.\n\nEin Hinweis gehört weiterhin zum Schluss.')
  assert.deepEqual(payload.sources, visibleSources)
  assert.doesNotMatch(payload.body, /^# /m)
  assert.doesNotMatch(payload.body, /ersten Lead-Absatz|example\.org/)
  assert.equal((payload.body.match(/^## Fazit$/gm) ?? []).length, 1)
  assert.equal((payload.body.match(/^## Quellen$/gm) ?? []).length, 1)
})

test('Stage-3 payload preserves adaptive sections in exact magazine order', () => {
  const markdown = `# Titel\n\nErster Lead.\n\n<!-- knowledge-template:magazine -->\n\n## Auf einen Blick\n\n- Erste Übersicht.\n- Zweite Übersicht.\n- Dritte Übersicht.\n\n## Vertiefung\n\nDetails.\n\n## Fazit\n\nSchluss.\n\n## Quellen\n\n<!-- sources:auto -->`
  const payload = assembleStage3VisiblePayload({ slug: 'reihenfolge', markdown, visibleSources: visibleSources.slice(0, 1) })

  assert.match(payload.body, /^<!-- knowledge-template:magazine -->\n\n## Auf einen Blick/)
  assert.match(payload.body, /## Vertiefung\n\nDetails\./)
  assert.ok(payload.body.indexOf('## Auf einen Blick') < payload.body.indexOf('## Vertiefung'))
})

test('Stage-3 payload fails closed at missing or ambiguous visible-field boundaries', () => {
  const valid = '# Titel\n\nErster Lead.\n\n<!-- knowledge-template:magazine -->\n\n## Auf einen Blick\n\n- Erste Übersicht.\n- Zweite Übersicht.\n- Dritte Übersicht.\n\n## Inhalt\n\nText.\n\n## Fazit\n\nSchluss.\n\n## Quellen\n\n<!-- sources:auto -->'
  const assemble = (markdown, sources = visibleSources.slice(0, 1)) => assembleStage3VisiblePayload({ slug: 'invalid', markdown, visibleSources: sources })

  assert.throws(() => assemble(valid.replace('# Titel\n\n', '')), /byte 1/)
  assert.throws(() => assemble(valid.replace('Erster Lead.\n\n', '')), /exactly one Summary\/Dek/)
  assert.throws(() => assemble(valid.replace('<!-- knowledge-template:magazine -->', '')), /magazine template marker exactly once/)
  assert.throws(() => assemble(valid.replace('Erster Lead.\n\n<!-- knowledge-template:magazine -->', 'Erster Lead.\n\nZweiter Absatz.\n\n<!-- knowledge-template:magazine -->')), /exactly one Summary\/Dek/)
  assert.throws(() => assemble(valid.replace('## Fazit\n\nSchluss.\n\n', '')), /exactly one Stage-3 Fazit heading/)
  assert.throws(() => assemble(valid.replace('<!-- sources:auto -->', '- [Quelle](https:\/\/example.org\/other)')), /sources:auto/)
  assert.throws(() => assemble(valid.replace('## Fazit', '[Primärquelle](https:\/\/example.org\/primary)\n\n## Fazit')), /duplicates generated source URL/)
  assert.throws(() => assemble(valid.replace('## Fazit', '### Leerer Unterpunkt\n\n## Fazit')), /empty H3 section: Leerer Unterpunkt/)
  assert.throws(() => assemble(valid.replace('## Fazit', '###\n\n## Fazit')), /empty H3 heading/)
  for (const level of [4, 5, 6]) assert.throws(() => assemble(valid.replace('## Fazit', `${'#'.repeat(level)} Zu tief\n\nInhalt.\n\n## Fazit`)), new RegExp(`supports only H2 and H3 headings; found H${level}`))
  assert.throws(() => assemble(valid, []), /needs visible sources/)
  assert.throws(() => assemble(valid.replace('## Fazit', '![](./grafik.png)\n\n## Fazit')), /non-empty alt text/)
  assert.throws(() => assemble(valid.replace('## Fazit', '![Erklärung](https:\/\/example.org\/grafik.png)\n\n## Fazit')), /verifiable local asset path/)
  assert.doesNotThrow(() => assemble(valid.replace('Text.', '### Vertiefung\n\nTragender Unterabschnitt.')))
})

test('Stage-3 enforces byte-1 H1 and exactly three to six standalone overview bullets', () => {
  const valid = '# Titel\n\nLead.\n\n<!-- knowledge-template:magazine -->\n\n## Auf einen Blick\n\n- Eins.\n- Zwei.\n- Drei.\n\n## Inhalt\n\nText.\n\n## Fazit\n\nSchluss.\n\n## Quellen\n\n<!-- sources:auto -->'
  const assemble = (markdown) => assembleStage3VisiblePayload({ slug: 'struktur', markdown, visibleSources: visibleSources.slice(0, 1) })

  assert.throws(() => assemble(`\uFEFF${valid}`), /byte 1/)
  assert.throws(() => assemble(`\n${valid}`), /byte 1/)
  assert.throws(() => assemble(valid.replace('- Drei.\n', '')), /exactly 3 to 6 bullet points/)
  assert.throws(() => assemble(valid.replace('- Drei.', '- Drei.\n- Vier.\n- Fünf.\n- Sechs.\n- Sieben.')), /exactly 3 to 6 bullet points/)
  assert.throws(() => assemble(valid.replace('- Zwei.', 'Zusätzliche Prosa.\n- Zwei.')), /only standalone bullet lines/)
  assert.throws(() => assemble(valid.replace('- Zwei.', '- Zwei.\n  Fortsetzung.')), /only standalone bullet lines/)
  assert.throws(() => assemble(valid.replace('Text.', 'Text.\n\n![Alttext]()')), /verifiable local asset path/)
  assert.throws(() => assemble(valid.replace('Text.', 'Text.\n\n![Alttext][asset-1]\n\n[asset-1]: https://example.org/grafik.png')), /verifiable local asset path/)
  assert.doesNotThrow(() => assemble(valid.replace('Text.', 'Text.\n\n![Lokale Grafik](./assets/grafik.png)')))
  assert.doesNotThrow(() => assemble(valid.replace('Text.', 'Text.\n\n![Lokale Grafik][asset-1]\n\n[asset-1]: ./assets/grafik.png')))
})

test('Stage-3 payload remains pending without an explicitly hash-bound reader review', () => {
  const hash = `sha256:${'a'.repeat(64)}`
  const review = resolveStage3ReaderReview({ review: null, payloadHash: hash })

  assert.equal(review.status, 'pending')
  assert.equal(review.visible_payload_hash, hash)
  assert.equal(review.reviewer.id, null)
  assert.equal(review.questions.q1.answer, null)
  assert.equal('packaging_binding' in review, false)
})

test('Stage-3 accepts only an independent reader PASS for the exact payload hash', () => {
  const hash = `sha256:${'b'.repeat(64)}`
  const review = {
    schema: 'article_reader_review.v1', status: 'PASS', visible_payload_hash: hash,
    writer_id: 'stage3-writer-1',
    reviewer: { role: 'article-reader-acceptance-reviewer', id: 'reader-independent-1' },
    reviewed_at: '2026-07-14T12:00:00.000Z',
    questions: {
      q1: { answer: 'Ja', rationale: 'Der aktuelle Text ist flüssig lesbar.' },
      q2: { answer: 'Ja', rationale: 'Der Aufbau trägt das Thema.' },
      q3: { answer: 'Nein', rationale: 'Keine interne Systemsprache ist sichtbar.' },
    },
  }

  assert.equal(resolveStage3ReaderReview({ review, payloadHash: hash }), review)
  assert.throws(
    () => resolveStage3ReaderReview({ review, payloadHash: `sha256:${'c'.repeat(64)}` }),
    /does not match the current payload/,
  )
})

test('Stage-3 rejects legacy or provenance-free review material as acceptance evidence', () => {
  const hash = `sha256:${'d'.repeat(64)}`
  assert.throws(() => resolveStage3ReaderReview({ review: { status: 'PASS', visible_payload_hash: hash }, payloadHash: hash }), /schema article_reader_review/)
  assert.throws(() => resolveStage3ReaderReview({
    review: {
      schema: 'article_reader_review.v1', status: 'PASS', visible_payload_hash: hash,
      writer_id: 'stage3-writer-1',
      reviewer: { role: 'article-reader-acceptance-reviewer', id: '' }, reviewed_at: '2026-07-14T12:00:00.000Z', questions: {},
    },
    payloadHash: hash,
  }), /independent reviewer provenance/)
  assert.throws(() => resolveStage3ReaderReview({
    review: {
      schema: 'article_reader_review.v1', status: 'PASS', visible_payload_hash: hash,
      writer_id: 'same-agent', reviewer: { role: 'article-reader-acceptance-reviewer', id: 'same-agent' },
      reviewed_at: '2026-07-14T12:00:00.000Z', questions: {
        q1: { answer: 'Ja', rationale: 'Lesbar.' }, q2: { answer: 'Ja', rationale: 'Klar.' }, q3: { answer: 'Nein', rationale: 'Keine Systemsprache.' },
      },
    },
    payloadHash: hash,
  }), /not independent from the writer/)
})
