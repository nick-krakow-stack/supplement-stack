// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { KnowledgeMagazineArticle } from '../pages/KnowledgeMagazineArticle';
import {
  canonicalJsonHash,
  inspectKnowledgeMagazineMarkup,
  renderKnowledgeMagazineMarkup,
  renderKnowledgeMagazineSnapshot,
  type ArticleRenderProjectionV2,
  type ArticleRenderRequestV2,
  type ArticleVisiblePayloadV2,
} from './knowledgeMagazineRenderSnapshot';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const GENERATED_ASSET_PATH = `/api/r2/knowledge/teststoff/${'a'.repeat(64)}.png`;

const VALID_BODY = [
  '<!-- knowledge-template:magazine -->',
  '',
  '## Auf einen Blick',
  '',
  '- Teststoff wird hier verständlich eingeordnet.',
  '- Aussagen bleiben an Quellen gebunden.',
  '',
  '## Was ist Teststoff?',
  '',
  'Dieser Abschnitt erklärt den Begriff und verweist auf [Vertiefung](/wissen/vertiefung).',
  '',
  '| Merkmal | Einordnung |',
  '| --- | --- |',
  '| Status | Beispiel |',
  '',
  `![Schema von Teststoff](${GENERATED_ASSET_PATH})`,
  '*Die Grafik erklärt Teststoff anschaulich.*',
  '',
  '## Was sagt die Forschung?',
  '',
  'Dieser Abschnitt ordnet den Forschungsstand ein.',
  '',
  '## Fazit',
  '',
  'Teststoff lässt sich knapp und verständlich einordnen.',
  '',
  '## Quellen',
  '',
  '<!-- sources:auto -->',
].join('\n');

function validPayload(overrides: Partial<ArticleVisiblePayloadV2> = {}): ArticleVisiblePayloadV2 {
  return {
    schema: 'article_visible_payload.v2',
    slug: 'teststoff',
    title: 'Teststoff verständlich erklärt',
    dek: 'Eine klare, überprüfbare Einordnung für Leserinnen und Leser.',
    body: VALID_BODY,
    conclusion: null,
    sources: [{ source_id: 'src-1', label: 'Originalquelle', url: 'https://example.com/study' }],
    ...overrides,
  };
}

function validProjection(payload = validPayload(), route = `/wissen/${payload.slug}`): ArticleRenderProjectionV2 {
  return {
    schema: 'article_render_projection.v2',
    article_id: 'stage3-teststoff',
    route,
    template: 'magazine',
    h1: payload.title,
    dek: payload.dek,
    sections: [
      {
        section_id: 'ueberblick',
        kind: 'overview',
        control_type: null,
        heading: 'Auf einen Blick',
        order: 0,
        number: null,
        normalized_text: 'Teststoff wird hier verständlich eingeordnet. Aussagen bleiben an Quellen gebunden.',
        links: [],
        tables: [],
        assets: [],
      },
      {
        section_id: 'was-ist-teststoff',
        kind: 'content',
        control_type: null,
        heading: 'Was ist Teststoff?',
        order: 1,
        number: '01',
        normalized_text: 'Dieser Abschnitt erklärt den Begriff und verweist auf Vertiefung. Merkmal Einordnung Status Beispiel Die Grafik erklärt Teststoff anschaulich.',
        links: [{ label: 'Vertiefung', url: '/wissen/vertiefung' }],
        tables: [{ presentation: 'data_table', headers: ['Merkmal', 'Einordnung'], rows: [['Status', 'Beispiel']] }],
        assets: [{
          src: GENERATED_ASSET_PATH,
          alt: 'Schema von Teststoff',
          caption: 'Die Grafik erklärt Teststoff anschaulich.',
        }],
      },
      {
        section_id: 'was-sagt-die-forschung',
        kind: 'content',
        control_type: null,
        heading: 'Was sagt die Forschung?',
        order: 2,
        number: '02',
        normalized_text: 'Dieser Abschnitt ordnet den Forschungsstand ein.',
        links: [],
        tables: [],
        assets: [],
      },
      {
        section_id: 'fazit',
        kind: 'fazit',
        control_type: null,
        heading: 'Fazit',
        order: 3,
        number: '03',
        normalized_text: 'Teststoff lässt sich knapp und verständlich einordnen.',
        links: [],
        tables: [],
        assets: [],
      },
      {
        section_id: 'quellen',
        kind: 'sources',
        control_type: null,
        heading: 'Quellen',
        order: 4,
        number: null,
        normalized_text: 'Originalquelle',
        links: [{ label: 'Originalquelle', url: 'https://example.com/study' }],
        tables: [],
        assets: [],
      },
    ],
    ui: {
      contract_version: 'knowledge-magazine-ui.v2',
      eyebrow: 'Wissen',
      toc_title: 'Auf dieser Seite',
      ingredient_chip: 'Wirkstoff: Teststoff',
      reviewed_date: 'Geprüft am 14.07.2026',
      reading_time: { minutes: 1, label: 'Lesezeit ca. 1 Minute' },
      sources_label: 'Quellen',
      sources_count: { count: payload.sources.length, label: `${payload.sources.length} ${payload.sources.length === 1 ? 'Quelle' : 'Quellen'}` },
    },
    toc: [
      { section_id: 'ueberblick', label: 'Auf einen Blick', href: '#ueberblick' },
      { section_id: 'was-ist-teststoff', label: 'Was ist Teststoff?', href: '#was-ist-teststoff' },
      { section_id: 'was-sagt-die-forschung', label: 'Was sagt die Forschung?', href: '#was-sagt-die-forschung' },
      { section_id: 'fazit', label: 'Fazit', href: '#fazit' },
      { section_id: 'quellen', label: 'Quellen', href: '#quellen' },
    ],
    fazit: {
      section_id: 'fazit',
      normalized_text: 'Teststoff lässt sich knapp und verständlich einordnen.',
    },
    sources: payload.sources.map((source, order) => ({
      source_id: source.source_id,
      label: source.label,
      url: source.url,
      order,
    })),
  };
}

type RequestOverrides = Partial<Omit<ArticleRenderRequestV2, 'publish_payload' | 'payload_hash' | 'projection_hash' | 'expected_projection'>> & {
  expected_projection?: ArticleRenderProjectionV2;
};

function validRequest(
  payloadOverrides: Partial<ArticleVisiblePayloadV2> = {},
  requestOverrides: RequestOverrides = {},
): ArticleRenderRequestV2 {
  const publishPayload = validPayload(payloadOverrides);
  const route = requestOverrides.route ?? `/wissen/${publishPayload.slug}`;
  const projection = requestOverrides.expected_projection ?? validProjection(publishPayload, route);
  return {
    schema: 'article_render_request.v2',
    article_id: 'stage3-teststoff',
    route,
    article_byte_hash: HASH_A,
    visible_payload_hash: HASH_B,
    payload_hash: canonicalJsonHash(publishPayload),
    projection_hash: canonicalJsonHash(projection),
    publish_payload: publishPayload,
    expected_projection: projection,
    ingredients: [{ ingredient_id: 42, name: 'Teststoff', sort_order: 0 }],
    reviewed_date: '14.07.2026',
    ...requestOverrides,
  };
}

function withProjection(
  request: ArticleRenderRequestV2,
  mutate: (projection: ArticleRenderProjectionV2) => void,
): ArticleRenderRequestV2 {
  const projection = structuredClone(request.expected_projection);
  mutate(projection);
  return { ...request, expected_projection: projection, projection_hash: canonicalJsonHash(projection) };
}

function errorCodes(snapshot: ReturnType<typeof renderKnowledgeMagazineSnapshot>): string[] {
  return snapshot.errors.map((error) => error.code);
}

function mutateMarkup(markup: string, mutate: (document: Document) => void): string {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`);
  try {
    mutate(dom.window.document);
    return dom.window.document.body.innerHTML;
  } finally {
    dom.window.close();
  }
}

function runCli(args: string[], timeout = 30_000) {
  return spawnSync(
    process.execPath,
    [resolve(process.cwd(), 'render-knowledge-magazine-snapshot.mjs'), ...args],
    { cwd: process.cwd(), encoding: 'utf8', timeout },
  );
}

describe('knowledge magazine real-render snapshot', () => {
  it('compares the real component deterministically with the compiler projection', () => {
    const request = validRequest();
    const first = renderKnowledgeMagazineSnapshot(request);
    const second = renderKnowledgeMagazineSnapshot(request);

    expect(first).toEqual(second);
    expect(first.result, JSON.stringify(first.errors, null, 2)).toBe('PASS');
    expect(first.errors).toEqual([]);
    expect(first.renderer).toMatchObject({
      component: 'KnowledgeMagazineArticle',
      version: 'knowledge-magazine-react-ssr.v2.2.0',
      contract_version: 'knowledge-magazine-dom-contract.v2.2.0',
    });
    expect(first.request_hash).toBe(canonicalJsonHash(request));
    expect(first.actual_projection).toEqual(request.expected_projection);
    expect(first.actual_projection_hash).toBe(request.projection_hash);
    expect(first.projection_checks.every((check) => check.result === 'PASS')).toBe(true);
    expect(first.actual.toc.dom_exposed).toBe(true);
    expect(first.actual.sections.every((section) => section.dom_exposed)).toBe(true);
    expect(first.actual.sections.map((section) => section.number)).toEqual([null, '01', '02', '03', null]);
    expect(first.actual_projection.sections[1].assets).toEqual([{
      src: GENERATED_ASSET_PATH,
      alt: 'Schema von Teststoff',
      caption: 'Die Grafik erklärt Teststoff anschaulich.',
    }]);
    expect(first.actual_projection.sources).toEqual(request.expected_projection.sources);
    expect(first.actual.source_disclosure).toMatchObject({
      present: true,
      trigger_dom_exposed: true,
      expanded: false,
      panel_present: true,
      panel_initially_hidden: true,
      entry_count: 1,
      link_count: 1,
      invalid_link_count: 0,
    });
  });

  it('keeps an enriched sources DOM byte-equal to the frozen source projection', () => {
    const request = validRequest();
    const enrichedSources = request.publish_payload.sources.map((source, index) => index === 0
      ? {
        ...source,
        internal_articles: [{
          slug: 'teststudie-eingeordnet',
          title: 'Teststudie eingeordnet',
          url: '/wissen/teststudie-eingeordnet',
        }],
      }
      : source);
    const markup = renderToStaticMarkup(
      <StaticRouter location={request.route}>
        <KnowledgeMagazineArticle
          article={{
            slug: request.publish_payload.slug,
            title: request.publish_payload.title,
            summary: request.publish_payload.dek,
            body: request.publish_payload.body,
            conclusion: request.publish_payload.conclusion,
            sources: enrichedSources,
            ingredients: request.ingredients,
          }}
          reviewedDate={request.reviewed_date ?? null}
        />
      </StaticRouter>,
    );

    const document = new JSDOM(markup).window.document;
    const additiveLink = document.querySelector('[data-projection-additive-navigation="true"] a');
    expect(additiveLink?.textContent).toContain('Studienartikel');
    expect(additiveLink?.textContent).toContain('Originalquelle');
    expect(additiveLink?.getAttribute('href')).toBe('/wissen/teststudie-eingeordnet');
    const originalLink = document.querySelector('a.source-link');
    expect(originalLink?.getAttribute('href')).toBe('https://example.com/study');
    expect(originalLink?.textContent).toContain('Originalquelle');
    expect(originalLink?.getAttribute('aria-label')).toContain('Originalquelle öffnen');

    const snapshot = inspectKnowledgeMagazineMarkup(request, markup);
    expect(snapshot.result, JSON.stringify(snapshot.errors, null, 2)).toBe('PASS');
    expect(snapshot.actual_projection.sections.find((section) => section.section_id === 'quellen'))
      .toEqual(request.expected_projection.sections.find((section) => section.section_id === 'quellen'));
    expect(snapshot.actual_projection.sources).toEqual(request.expected_projection.sources);
    expect(snapshot.actual.source_disclosure).toMatchObject({ entry_count: 1, link_count: 1, invalid_link_count: 0 });
  });

  it('fails when actual content differs from the independently supplied projection', () => {
    const request = withProjection(validRequest(), (projection) => {
      projection.sections[1].normalized_text = 'Eine absichtlich abweichende Sollprojektion.';
    });
    const snapshot = renderKnowledgeMagazineSnapshot(request);

    expect(snapshot.result).toBe('FAIL');
    expect(errorCodes(snapshot)).toContain('PROJECTION_SECTIONS_MISMATCH');
    expect(snapshot.projection_checks.find((check) => check.id === 'projection-sections')?.result).toBe('FAIL');
  });

  it('fails closed for a missing or DOM-hidden TOC', () => {
    const request = validRequest();
    const markup = renderKnowledgeMagazineMarkup(request);
    const missing = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      document.querySelector('aside[aria-label="Inhaltsverzeichnis"]')?.remove();
    }));
    expect(errorCodes(missing)).toEqual(expect.arrayContaining([
      'TOC_COUNT_INVALID',
      'TOC_EMPTY',
      'TOC_ORDER_MISMATCH',
      'PROJECTION_TOC_MISMATCH',
    ]));

    const hidden = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      document.querySelector('aside[aria-label="Inhaltsverzeichnis"]')?.setAttribute('hidden', '');
    }));
    expect(errorCodes(hidden)).toContain('TOC_DOM_EXPOSURE_INVALID');
    expect(JSON.stringify(hidden.actual)).not.toContain('"visible"');
  });

  it('fails closed for every unexpected content child and hidden semantic leaf', () => {
    const request = validRequest();
    const markup = renderKnowledgeMagazineMarkup(request);
    const unexpectedChild = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      const unexpected = document.createElement('div');
      unexpected.textContent = 'Unerwarteter sichtbarer Inhalt';
      document.querySelector('.content')?.append(unexpected);
    }));
    expect(errorCodes(unexpectedChild)).toContain('CONTENT_CHILD_INVALID');

    const attributeProbes: Array<{
      label: string;
      selector: string;
      mutate: (element: Element) => void;
    }> = [
      { label: 'dek/hidden', selector: '.hero .dek', mutate: (element) => element.setAttribute('hidden', '') },
      { label: 'paragraph/aria-hidden', selector: '#was-ist-teststoff > p', mutate: (element) => element.setAttribute('aria-hidden', 'true') },
      { label: 'link/inert', selector: '#was-ist-teststoff a', mutate: (element) => element.setAttribute('inert', '') },
      { label: 'table/display', selector: '[data-knowledge-table-presentation="data_table"]', mutate: (element) => element.setAttribute('style', 'display: none') },
      { label: 'cell/opacity', selector: '#was-ist-teststoff th', mutate: (element) => element.setAttribute('style', 'opacity: 0') },
      { label: 'figure/visibility', selector: '#was-ist-teststoff figure', mutate: (element) => element.setAttribute('style', 'visibility: hidden') },
      { label: 'image/hidden', selector: '#was-ist-teststoff img', mutate: (element) => element.setAttribute('hidden', '') },
      { label: 'caption/aria-hidden', selector: '#was-ist-teststoff figcaption', mutate: (element) => element.setAttribute('aria-hidden', 'true') },
      { label: 'toc-list/inert', selector: '.toc ol', mutate: (element) => element.setAttribute('inert', '') },
      { label: 'toc-link/display', selector: '.toc a', mutate: (element) => element.setAttribute('style', 'display:none !important') },
      { label: 'disclosure-trigger/hidden', selector: '.src-toggle', mutate: (element) => element.setAttribute('hidden', '') },
      { label: 'fixed-ui/opacity', selector: '[data-knowledge-ui="ingredient-chip"]', mutate: (element) => element.setAttribute('style', 'opacity:0') },
    ];

    for (const probe of attributeProbes) {
      const snapshot = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
        const element = document.querySelector(probe.selector);
        expect(element, probe.label).not.toBeNull();
        probe.mutate(element as Element);
      }));
      expect(errorCodes(snapshot), probe.label).toContain('SEMANTIC_LEAF_DOM_EXPOSURE_INVALID');
    }

    const computedStyleRegression = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      const style = document.createElement('style');
      style.textContent = '[data-knowledge-ui="eyebrow"] { visibility: hidden; }';
      document.body.prepend(style);
    }));
    expect(errorCodes(computedStyleRegression)).toContain('SEMANTIC_LEAF_DOM_EXPOSURE_INVALID');
  });

  it('rejects lead content, numbering changes, duplicates and globally colliding IDs', () => {
    const leadRequest = validRequest({
      body: VALID_BODY.replace('<!-- knowledge-template:magazine -->\n', '<!-- knowledge-template:magazine -->\nDieser Lead ist verboten.\n'),
    });
    expect(errorCodes(renderKnowledgeMagazineSnapshot(leadRequest))).toEqual(expect.arrayContaining([
      'LEAD_CONTENT_INVALID',
      'SECTION_ID_MISSING',
      'PROJECTION_SECTIONS_MISMATCH',
    ]));

    const request = validRequest();
    const markup = renderKnowledgeMagazineMarkup(request);
    const wrongNumber = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      const number = document.querySelector('#was-sagt-die-forschung .num');
      if (number) number.textContent = '07';
    }));
    expect(errorCodes(wrongNumber)).toEqual(expect.arrayContaining([
      'SECTION_NUMBER_SEQUENCE_INVALID',
      'PROJECTION_SECTIONS_MISMATCH',
    ]));

    const duplicates = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      const source = document.querySelector('.content > section#quellen');
      if (source) document.querySelector('.content')?.append(source.cloneNode(true));
    }));
    expect(errorCodes(duplicates)).toEqual(expect.arrayContaining([
      'SOURCES_COUNT_INVALID',
      'DOM_ID_DUPLICATE',
      'PROJECTION_SECTIONS_MISMATCH',
    ]));

    const globalCollision = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      const heading = document.querySelector('#was-ist-teststoff h2');
      if (heading) heading.id = 'ueberblick';
    }));
    expect(errorCodes(globalCollision)).toContain('DOM_ID_DUPLICATE');
  });

  it('uses reserved control IDs and verifies ARIA relations in both directions', () => {
    const faqBody = VALID_BODY.replace(
      '## Was sagt die Forschung?\n\nDieser Abschnitt ordnet den Forschungsstand ein.',
      '## Häufige Fragen\n\n### Ist Teststoff relevant?\n\nJa, im Rahmen dieses Tests.',
    );
    const request = validRequest({ body: faqBody });
    const baselineMarkup = renderKnowledgeMagazineMarkup(request);
    const dom = new JSDOM(`<!doctype html><html><body>${baselineMarkup}</body></html>`);
    const ids = Array.from(dom.window.document.querySelectorAll('[id]')).map((element) => element.id);
    expect(ids.some((id) => id.includes(':faq:'))).toBe(true);
    expect(ids.some((id) => id.includes(':sources:'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    dom.window.close();

    const broken = inspectKnowledgeMagazineMarkup(request, mutateMarkup(baselineMarkup, (document) => {
      document.querySelector('.src-list')?.removeAttribute('aria-labelledby');
    }));
    expect(errorCodes(broken)).toContain('ARIA_RELATION_INVALID');
  });

  it('binds source identity, label, normalized URL, order and containment exactly', () => {
    const payload = validPayload({
      sources: [
        { source_id: 'src-1', label: 'Quelle Eins', url: 'https://example.com/one' },
        { source_id: 'src-2', label: 'Quelle Zwei', url: 'https://example.com/two' },
      ],
    });
    const request = validRequest({ sources: payload.sources });
    const markup = renderKnowledgeMagazineMarkup(request);

    const mutateSource = (mutate: (document: Document) => void) => (
      inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, mutate))
    );
    expect(errorCodes(mutateSource((document) => {
      document.querySelector('[data-source-id="src-1"]')?.setAttribute('data-source-id', 'src-wrong');
    }))).toEqual(expect.arrayContaining(['PROJECTION_SOURCES_MISMATCH']));
    expect(errorCodes(mutateSource((document) => {
      const label = document.querySelector('[data-source-id="src-1"] a span:last-of-type');
      if (label) label.textContent = 'Falsches Label';
    }))).toEqual(expect.arrayContaining(['PROJECTION_SECTIONS_MISMATCH', 'PROJECTION_SOURCES_MISMATCH']));
    expect(errorCodes(mutateSource((document) => {
      document.querySelector('[data-source-id="src-1"] a')?.setAttribute('href', 'https://example.com/wrong');
    }))).toEqual(expect.arrayContaining(['PROJECTION_SECTIONS_MISMATCH', 'PROJECTION_SOURCES_MISMATCH']));
    expect(errorCodes(mutateSource((document) => {
      const first = document.querySelector('[data-source-id="src-1"]');
      const second = document.querySelector('[data-source-id="src-2"]');
      if (first && second) second.after(first);
    }))).toEqual(expect.arrayContaining(['PROJECTION_SECTIONS_MISMATCH', 'PROJECTION_SOURCES_MISMATCH']));
    expect(errorCodes(mutateSource((document) => {
      const entry = document.querySelector('[data-source-id="src-1"]');
      if (entry) document.querySelector('#quellen')?.after(entry);
    }))).toEqual(expect.arrayContaining(['SOURCE_COUNT_MISMATCH', 'PROJECTION_SECTIONS_MISMATCH', 'PROJECTION_SOURCES_MISMATCH']));
  });

  it('binds the complete image inventory, alt and visible caption exactly', () => {
    const request = validRequest();
    const markup = renderKnowledgeMagazineMarkup(request);
    const mutations: Array<{ label: string; mutate: (document: Document) => void }> = [
      {
        label: 'alt',
        mutate: (document) => document.querySelector('#was-ist-teststoff img')?.setAttribute('alt', 'Falscher Alt-Text'),
      },
      {
        label: 'caption',
        mutate: (document) => {
          const caption = document.querySelector('#was-ist-teststoff figcaption');
          if (caption) caption.textContent = 'Andere Bildunterschrift.';
        },
      },
      {
        label: 'missing-image',
        mutate: (document) => document.querySelector('#was-ist-teststoff img')?.remove(),
      },
      {
        label: 'duplicate-image',
        mutate: (document) => {
          const image = document.querySelector('#was-ist-teststoff img');
          if (image) image.after(image.cloneNode(true));
        },
      },
      {
        label: 'image-outside-figure',
        mutate: (document) => {
          const image = document.querySelector('#was-ist-teststoff img');
          if (image) document.querySelector('#was-ist-teststoff')?.append(image.cloneNode(true));
        },
      },
    ];

    for (const mutation of mutations) {
      const snapshot = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, mutation.mutate));
      expect(errorCodes(snapshot), mutation.label).toContain('IMAGE_INVENTORY_INVALID');
    }
  });

  it('binds every fixed UI value and count to the versioned compiler projection', () => {
    const request = validRequest();
    const markup = renderKnowledgeMagazineMarkup(request);
    const uiKeys = ['eyebrow', 'toc-title', 'ingredient-chip', 'reviewed-date', 'reading-time', 'sources-label', 'sources-count'];

    for (const key of uiKeys) {
      const snapshot = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
        const element = document.querySelector(`[data-knowledge-ui="${key}"]`);
        expect(element, key).not.toBeNull();
        if (element) element.textContent = `${element.textContent ?? ''} falsch`;
      }));
      expect(errorCodes(snapshot), key).toEqual(expect.arrayContaining([
        'UI_CONTRACT_MISMATCH',
        'PROJECTION_UI_MISMATCH',
      ]));
    }

    const duplicate = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      const eyebrow = document.querySelector('[data-knowledge-ui="eyebrow"]');
      if (eyebrow) eyebrow.after(eyebrow.cloneNode(true));
    }));
    expect(errorCodes(duplicate)).toContain('UI_CONTRACT_MISMATCH');

    const wrongVersion = inspectKnowledgeMagazineMarkup(request, mutateMarkup(markup, (document) => {
      document.querySelector('[data-ui-contract]')?.setAttribute('data-ui-contract', 'knowledge-magazine-ui.v1');
    }));
    expect(errorCodes(wrongVersion)).toEqual(expect.arrayContaining([
      'UI_CONTRACT_MISMATCH',
      'PROJECTION_UI_MISMATCH',
    ]));
  });

  it('projects food grids losslessly and keeps explicit control blocks in author order but outside the TOC', () => {
    const complexBody = [
      '<!-- knowledge-template:magazine -->',
      '',
      '## Auf einen Blick',
      '',
      '- Die Projektion bleibt vollständig.',
      '',
      '## Was ist Teststoff?',
      '',
      'Eine kurze Einordnung.',
      '',
      '## Lebensmittel im Überblick',
      '',
      '| Lebensmittelgruppe | Beispiele | Einordnung | Hinweis |',
      '| --- | --- | --- | --- |',
      '| Pflanzlich | Beispiel A | Gut einzuordnen | Vierter Wert bleibt erhalten |',
      '| Tierisch | Beispiel B | Ergänzend | Zweite Tabellenzeile |',
      '',
      '## Merkkasten',
      '',
      'Dieser Merksatz bleibt sichtbar.',
      '',
      '## Rechtlicher Hinweis',
      '',
      'Dieser Hinweis bleibt sichtbar.',
      '',
      '## Fazit',
      '',
      'Eine kurze Schlussfolgerung.',
      '',
      '## Quellen',
      '',
      '<!-- sources:auto -->',
    ].join('\n');
    const request = validRequest({ body: complexBody });
    const snapshot = renderKnowledgeMagazineSnapshot(request);
    const sections = snapshot.actual_projection.sections;
    const foodSection = sections.find((section) => section.section_id === 'lebensmittel-im-uberblick');

    expect(foodSection?.tables).toEqual([{
      presentation: 'food_grid',
      headers: ['Lebensmittelgruppe', 'Beispiele', 'Einordnung', 'Hinweis'],
      rows: [
        ['Pflanzlich', 'Beispiel A', 'Gut einzuordnen', 'Vierter Wert bleibt erhalten'],
        ['Tierisch', 'Beispiel B', 'Ergänzend', 'Zweite Tabellenzeile'],
      ],
    }]);
    expect(sections.map(({ section_id, kind, control_type, number }) => ({ section_id, kind, control_type, number }))).toEqual([
      { section_id: 'ueberblick', kind: 'overview', control_type: null, number: null },
      { section_id: 'was-ist-teststoff', kind: 'content', control_type: null, number: '01' },
      { section_id: 'lebensmittel-im-uberblick', kind: 'content', control_type: null, number: '02' },
      { section_id: 'merkkasten', kind: 'control', control_type: 'merkkasten', number: null },
      { section_id: 'rechtlicher-hinweis', kind: 'control', control_type: 'legal_notice', number: null },
      { section_id: 'fazit', kind: 'fazit', control_type: null, number: '03' },
      { section_id: 'quellen', kind: 'sources', control_type: null, number: null },
    ]);
    expect(snapshot.actual_projection.toc.map((entry) => entry.section_id)).toEqual([
      'ueberblick',
      'was-ist-teststoff',
      'lebensmittel-im-uberblick',
      'fazit',
      'quellen',
    ]);
    expect(sections.find((section) => section.section_id === 'merkkasten')?.normalized_text).toBe('Dieser Merksatz bleibt sichtbar.');
    expect(sections.find((section) => section.section_id === 'rechtlicher-hinweis')?.normalized_text).toBe('Dieser Hinweis bleibt sichtbar.');
  });

  it('rejects route mismatch and a missing magazine marker', () => {
    const routeMismatch = renderKnowledgeMagazineSnapshot(validRequest({}, { route: '/wissen/anderer-stoff' }));
    expect(errorCodes(routeMismatch)).toContain('ROUTE_SLUG_MISMATCH');

    const markerMissing = renderKnowledgeMagazineSnapshot(validRequest({
      body: VALID_BODY.replace('<!-- knowledge-template:magazine -->\n\n', ''),
    }));
    expect(errorCodes(markerMissing)).toContain('MAGAZINE_MARKER_MISSING');
  });

  it('offers a Windows-safe CLI with atomic replacement and stable PASS/FAIL/input exits', () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-render-cli-'));
    try {
      const validInput = join(directory, 'valid.json');
      const output = join(directory, 'snapshot.json');
      writeFileSync(validInput, JSON.stringify(validRequest()), 'utf8');
      writeFileSync(output, 'old-content', 'utf8');
      const pass = runCli(['--input', validInput, '--out', output]);
      expect(pass.status, pass.stderr).toBe(0);
      expect(pass.stderr).toBe('');
      expect(JSON.parse(pass.stdout)).toEqual(JSON.parse(readFileSync(output, 'utf8')));
      expect(JSON.parse(pass.stdout).result).toBe('PASS');

      const structuralInput = join(directory, 'structural.json');
      writeFileSync(structuralInput, JSON.stringify(validRequest({}, { route: '/wissen/falscher-slug' })), 'utf8');
      const structural = runCli(['--input', structuralInput]);
      expect(structural.status, structural.stderr).toBe(1);
      expect(errorCodes(JSON.parse(structural.stdout))).toContain('ROUTE_SLUG_MISMATCH');

      const invalidBinding = join(directory, 'binding.json');
      writeFileSync(invalidBinding, JSON.stringify({ ...validRequest(), payload_hash: HASH_A }), 'utf8');
      const binding = runCli(['--input', invalidBinding]);
      expect(binding.status).toBe(2);
      expect(JSON.parse(binding.stderr)).toMatchObject({ code: 'INPUT_PAYLOAD_HASH_MISMATCH' });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 70_000);

  it('fails CLI usage, UTF-8, JSON, output-write and close errors with stable codes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'knowledge-render-errors-'));
    try {
      const usage = runCli([]);
      expect(usage.status).toBe(2);
      expect(JSON.parse(usage.stderr.split('\n')[0])).toMatchObject({ code: 'USAGE_INVALID' });

      const invalidUtf8 = join(directory, 'invalid-utf8.json');
      writeFileSync(invalidUtf8, Buffer.from([0xc3, 0x28]));
      const utf8 = runCli(['--input', invalidUtf8]);
      expect(utf8.status).toBe(2);
      expect(JSON.parse(utf8.stderr)).toMatchObject({ code: 'INPUT_UTF8_INVALID' });

      const invalidJson = join(directory, 'invalid.json');
      writeFileSync(invalidJson, '{', 'utf8');
      const json = runCli(['--input', invalidJson]);
      expect(json.status).toBe(2);
      expect(JSON.parse(json.stderr)).toMatchObject({ code: 'INPUT_JSON_INVALID' });

      const validInput = join(directory, 'valid.json');
      const outputDirectory = join(directory, 'existing-directory');
      writeFileSync(validInput, JSON.stringify(validRequest()), 'utf8');
      mkdirSync(outputDirectory);
      const writeFailure = runCli(['--input', validInput, '--out', outputDirectory]);
      expect(writeFailure.status).toBe(3);
      expect(JSON.parse(writeFailure.stderr)).toMatchObject({ code: 'OUTPUT_WRITE_FAILED' });

      const { closeViteServer } = await import('../../render-knowledge-magazine-snapshot.mjs');
      await expect(closeViteServer({ close: async () => { throw new Error('close boom'); } })).rejects.toMatchObject({
        code: 'VITE_CLOSE_FAILED',
        exit_code: 3,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 70_000);

});
