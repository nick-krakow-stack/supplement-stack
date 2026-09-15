import { describe, expect, it } from 'vitest';
import { assessRawHtmlReadback, normalizePublicArticle } from '../../validate-knowledge-magazine-style.mjs';
import { canonicalJsonHash, sha256Bytes } from '../../knowledge-magazine-contract-hash.mjs';
import { knowledgeArticleJsonLd } from '../../../functions/lib/knowledge-seo.mjs';

const core = { '@context': 'https://schema.org', '@type': 'Article', headline: 'Der technische Meta-Titel', description: 'Eine vorhandene Einordnung.', mainEntityOfPage: 'https://supplementstack.de/wissen/teststoff', inLanguage: 'de' };
const expected = { expected_projection: { h1: 'Der wissenschaftliche Originaltitel', dek: 'Eine vorhandene Einordnung.', sections: [{ normalized_text: 'Der vorhandene Artikeltext.' }] }, expected_seo: { meta_title: core.headline, json_ld: core } };
const graph = knowledgeArticleJsonLd({ slug: 'teststoff', title: expected.expected_projection.h1, summary: expected.expected_projection.dek, body: 'Der vorhandene Artikeltext.', sources: [], seo: { meta_title: core.headline, meta_description: core.description, json_ld: core } });

function readback(data: unknown, additionalScript = '') {
  const body = `<html><head><title>${core.headline}</title><script type="application/ld+json">${JSON.stringify(data)}</script>${additionalScript}</head><body><h1>${expected.expected_projection.h1}</h1><p>${expected.expected_projection.dek}</p><p>Der vorhandene Artikeltext.</p></body></html>`;
  return assessRawHtmlReadback({ url: core.mainEntityOfPage, fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html', body_hash: sha256Bytes(Buffer.from(body)), body }, expected);
}

describe('publication readback with additive delivery graph', () => {
  const tableText = 'Die Gruppen: Gruppe Beispiele Fettlösliche Vitamine Vitamin A, D, E und K Weitere Angaben folgen.';
  const tableHtml = '<p>Die Gruppen:</p><table><thead><tr><th>Gruppe</th><th>Beispiele</th></tr></thead><tbody><tr><td>Fettlösliche Vitamine</td><td>Vitamin A, D, E und K</td></tr></tbody></table><p>Weitere Angaben folgen.</p>';
  function textReadback(markup: string, sectionText: string) {
    const target = { ...expected, expected_projection: { ...expected.expected_projection, sections: [{ normalized_text: sectionText }] } };
    const body = `<html><head><title>${core.headline}</title><script type="application/ld+json">${JSON.stringify(core)}</script></head><body><h1>${target.expected_projection.h1}</h1><p>${target.expected_projection.dek}</p>${markup}</body></html>`;
    return assessRawHtmlReadback({ url: core.mainEntityOfPage, fetch_status: 'FETCHED', http_status: 200, content_type: 'text/html', body_hash: sha256Bytes(Buffer.from(body)), body }, target);
  }
  it('matches adjacent table cells using the browser projection structural word boundaries', () => {
    expect(textReadback(tableHtml, tableText)).toMatchObject({ article_text_match: true, seo_delivery_state: 'RAW_HTML_MATCH' });
  });
  it.each([
    tableHtml.replace('<td>Vitamin A, D, E und K</td>', ''),
    tableHtml.replace('Vitamin A, D, E und K', 'Vitamin A und D'),
    tableHtml.replace('<p>Weitere Angaben folgen.</p>', ''),
  ])('does not let structural whitespace hide missing or changed text', (markup) => {
    expect(textReadback(markup, tableText)).toMatchObject({ article_text_match: false, seo_delivery_state: 'CLIENT_RENDERED_ONLY' });
  });
  it('preserves inline word boundaries and rejects a newly split word', () => {
    expect(textReadback('<p>Wasser<strong>lösliche</strong> Vitamine</p>', 'Wasserlösliche Vitamine')).toMatchObject({ article_text_match: true });
    expect(textReadback('<p>Wasser <strong>lösliche</strong> Vitamine</p>', 'Wasserlösliche Vitamine')).toMatchObject({ article_text_match: false });
  });
  it('permits the one production canonical on preview transports but rejects another origin or slug', () => {
    const projection = { schema: 'article_render_projection.v2', article_id: 'test', route: '/wissen/teststoff', template: 'study_article_v2' };
    const seo = { meta_title: core.headline, meta_description: core.description, canonical_url: core.mainEntityOfPage, canonical_path: '/wissen/teststoff', robots: 'index,follow', indexable: true, json_ld: core };
    const input = { article_id: 'test', stage: 'stage2', slug: 'teststoff', public_url: 'http://127.0.0.1:5184/wissen/teststoff', desired_status: 'published', compiled_payload_hash: canonicalJsonHash({}), visible_payload_hash: canonicalJsonHash({}), relation_hash: canonicalJsonHash({}), asset_hashes: [], projection_hash: canonicalJsonHash(projection), expected_projection: projection, seo_hash: canonicalJsonHash(seo), expected_seo: seo, required_checks: ['assets', 'canonical', 'fazit', 'h1_dek', 'indexability', 'internal_links', 'json_ld', 'projection', 'robots', 'sources'] };
    expect(normalizePublicArticle(input, 0).expected_seo.canonical_url).toBe(core.mainEntityOfPage);
    for (const canonical_url of ['https://foreign.example/wissen/teststoff', 'https://supplementstack.de/wissen/anderer-stoff', `${core.mainEntityOfPage}?token=secret`]) {
      const invalidSeo = { ...seo, canonical_url };
      expect(() => normalizePublicArticle({ ...input, expected_seo: invalidSeo, seo_hash: canonicalJsonHash(invalidSeo) }, 0)).toThrow(/INPUT_SEO_BINDING_INVALID|Canonical\/Indexierbarkeit/);
    }
  });
  it('matches the exact frozen Article core inside the single public graph', () => {
    expect(readback(graph)).toMatchObject({ article_json_ld_match: true, seo_delivery_state: 'RAW_HTML_MATCH' });
  });
  it('does not let delivery relationships hide a modified release-bound claim', () => {
    expect(readback({ ...graph, '@graph': [{ ...core, description: 'Eine nicht freigegebene Aussage.' }, ...graph['@graph'].slice(1)] })).toMatchObject({ article_json_ld_match: false });
  });
  it('rejects a duplicate Article or a second JSON-LD script rather than accepting any matching node', () => {
    expect(readback({ ...graph, '@graph': [...graph['@graph'], core] })).toMatchObject({ article_json_ld_match: false });
    expect(readback(graph, `<script type="application/ld+json">${JSON.stringify(core)}</script>`)).toMatchObject({ article_json_ld_match: false });
  });
  it('still accepts a single exact historical Article object without additional relationships', () => {
    expect(readback(core)).toMatchObject({ article_json_ld_match: true });
  });
});
