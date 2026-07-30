import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { JSDOM } from 'jsdom';
import type { KnowledgeArticle, KnowledgeArticleIngredient, KnowledgeArticleSource } from '../types';
import {
  calculateKnowledgeReadingMinutes,
  isMagazineKnowledgeArticle,
  knowledgeReadingTimeLabel,
  knowledgeSourceCountLabel,
  KnowledgeMagazineArticle,
} from '../pages/KnowledgeMagazineArticle';

export const KNOWLEDGE_MAGAZINE_RENDERER_VERSION = 'knowledge-magazine-react-ssr.v2.2.0';
export const KNOWLEDGE_MAGAZINE_CONTRACT_VERSION = 'knowledge-magazine-dom-contract.v2.2.0';
export const KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION = 'knowledge-magazine-ui.v2';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROJECTION_URL_BASE = 'https://supplementstack.invalid';

export type ProjectionLink = { label: string; url: string };
export type ProjectionTable = { presentation: 'data_table' | 'food_grid'; headers: string[]; rows: string[][] };
export type ProjectionAsset = { src: string; alt: string; caption: string };
export type ProjectionSection = {
  section_id: string;
  kind: 'overview' | 'content' | 'fazit' | 'control' | 'sources';
  control_type: 'merkkasten' | 'legal_notice' | null;
  heading: string;
  order: number;
  number: string | null;
  normalized_text: string;
  links: ProjectionLink[];
  tables: ProjectionTable[];
  assets: ProjectionAsset[];
};
export type ProjectionTocEntry = { section_id: string; label: string; href: string };
export type ProjectionSource = { source_id: string; label: string; url: string; order: number };
export type ProjectionUi = {
  contract_version: typeof KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION;
  eyebrow: string;
  toc_title: string;
  ingredient_chip: string;
  reviewed_date: string | null;
  reading_time: { minutes: number; label: string };
  sources_label: string;
  sources_count: { count: number; label: string };
};

export type ArticleRenderProjectionV2 = {
  schema: 'article_render_projection.v2';
  article_id: string;
  route: string;
  template: string;
  h1: string;
  dek: string;
  ui: ProjectionUi;
  sections: ProjectionSection[];
  toc: ProjectionTocEntry[];
  fazit: { section_id: string; normalized_text: string };
  sources: ProjectionSource[];
};

export type ArticleVisiblePayloadV2 = {
  schema: 'article_visible_payload.v2';
  slug: string;
  title: string;
  dek: string;
  body: string;
  conclusion: string | null;
  sources: Array<KnowledgeArticleSource & { source_id: string }>;
};

export type ArticleRenderRequestV2 = {
  schema: 'article_render_request.v2';
  article_id: string;
  route: string;
  article_byte_hash: string;
  visible_payload_hash: string;
  payload_hash: string;
  projection_hash: string;
  compiled_payload_hash?: string;
  publish_payload: ArticleVisiblePayloadV2;
  expected_projection: ArticleRenderProjectionV2;
  ingredients?: KnowledgeArticleIngredient[];
  reviewed_date?: string | null;
};

export type RenderSnapshotErrorCode =
  | 'MAGAZINE_MARKER_MISSING'
  | 'ROUTE_SLUG_MISMATCH'
  | 'TEMPLATE_ROOT_COUNT_INVALID'
  | 'TEMPLATE_KIND_MISMATCH'
  | 'H1_COUNT_INVALID'
  | 'H1_MISMATCH'
  | 'DEK_MISMATCH'
  | 'CONTENT_MISSING'
  | 'CONTENT_DOM_EXPOSURE_INVALID'
  | 'CONTENT_CHILD_INVALID'
  | 'SEMANTIC_LEAF_DOM_EXPOSURE_INVALID'
  | 'TOC_COUNT_INVALID'
  | 'TOC_DOM_EXPOSURE_INVALID'
  | 'TOC_EMPTY'
  | 'TOC_TARGET_MISSING'
  | 'TOC_LABEL_MISMATCH'
  | 'TOC_ORDER_MISMATCH'
  | 'DOM_ID_DUPLICATE'
  | 'SECTION_ID_MISSING'
  | 'LEAD_CONTENT_INVALID'
  | 'SECTION_NUMBER_SEQUENCE_INVALID'
  | 'FAZIT_COUNT_INVALID'
  | 'SOURCES_COUNT_INVALID'
  | 'SECTION_DOM_EXPOSURE_INVALID'
  | 'ARIA_RELATION_INVALID'
  | 'SOURCES_DISCLOSURE_INVALID'
  | 'SOURCES_DOM_EXPOSURE_INVALID'
  | 'SOURCE_COUNT_MISMATCH'
  | 'SOURCE_ID_INVALID'
  | 'SOURCE_CONTAINMENT_INVALID'
  | 'SOURCE_LINK_INVALID'
  | 'IMAGE_INVENTORY_INVALID'
  | 'UI_CONTRACT_MISMATCH'
  | 'PROJECTION_IDENTITY_MISMATCH'
  | 'PROJECTION_SECTIONS_MISMATCH'
  | 'PROJECTION_TOC_MISMATCH'
  | 'PROJECTION_FAZIT_MISMATCH'
  | 'PROJECTION_SOURCES_MISMATCH'
  | 'PROJECTION_UI_MISMATCH';

export type RenderSnapshotError = {
  code: RenderSnapshotErrorCode;
  message: string;
  expected?: unknown;
  actual?: unknown;
};

export type RenderSnapshotCheck = {
  id: string;
  result: 'PASS' | 'FAIL';
  error_codes: RenderSnapshotErrorCode[];
};

export type RenderedTocLink = {
  position: number;
  label: string;
  href: string;
  target_id: string | null;
  target_exists: boolean;
};

export type RenderedSection = {
  position: number;
  id: string | null;
  kind: 'lead' | 'overview' | 'editorial' | 'fazit' | 'control' | 'sources' | 'other';
  heading: string | null;
  number: string | null;
  dom_exposed: boolean;
};

export type ArticleRenderSnapshotV2 = {
  schema: 'article_render_snapshot.v2';
  article_id: string;
  route: string;
  article_byte_hash: string;
  visible_payload_hash: string;
  payload_hash: string;
  projection_hash: string;
  request_hash: string;
  compiled_payload_hash?: string;
  renderer: {
    component: 'KnowledgeMagazineArticle';
    version: string;
    contract_version: string;
  };
  html_hash: string;
  dom_hash: string;
  structure_hash: string;
  actual_projection_hash: string;
  actual_projection: ArticleRenderProjectionV2;
  projection_checks: RenderSnapshotCheck[];
  actual: {
    template: string | null;
    h1: string | null;
    dek: string | null;
    toc: {
      present: boolean;
      dom_exposed: boolean;
      links: RenderedTocLink[];
    };
    sections: RenderedSection[];
    source_disclosure: {
      present: boolean;
      trigger_dom_exposed: boolean;
      expanded: boolean | null;
      panel_present: boolean;
      panel_initially_hidden: boolean | null;
      entry_count: number;
      link_count: number;
      invalid_link_count: number;
    };
  };
  checks: RenderSnapshotCheck[];
  errors: RenderSnapshotError[];
  result: 'PASS' | 'FAIL';
  content_hash: string;
};

export class RenderSnapshotInputError extends Error {
  readonly code: string;
  readonly exit_code = 2;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RenderSnapshotInputError';
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function canonicalJsonHash(value: unknown): string {
  return sha256(JSON.stringify(canonicalize(value)));
}

/** Canonical text shared by compiler projections and real-DOM projections. */
export function normalizeKnowledgeProjectionText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\p{White_Space}]+/gu, ' ')
    .trim();
}

/** Canonical URL shared by compiler projections and real-DOM projections. */
export function normalizeKnowledgeProjectionUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
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
    ) return null;
  }
  try {
    if (value.startsWith('/')) {
      const parsed = new URL(value, PROJECTION_URL_BASE);
      if (parsed.origin !== PROJECTION_URL_BASE) return null;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (value.startsWith('//')) return new URL(`https:${value}`).href;
    const parsed = new URL(value);
    if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function requireRecord(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path} muss ein Objekt sein.`);
  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path} muss ein Array sein.`);
  return value;
}

function requireString(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path} muss ein${allowEmpty ? '' : ' nicht-leerer'} String sein.`);
  }
  return value;
}

function requireCanonicalText(value: unknown, path: string, allowEmpty = false): string {
  const raw = requireString(value, path, allowEmpty);
  const normalized = normalizeKnowledgeProjectionText(raw);
  if ((!allowEmpty && !normalized) || raw !== normalized) {
    throw new RenderSnapshotInputError('INPUT_PROJECTION_NON_CANONICAL', `${path} ist nicht kanonisch normalisiert.`);
  }
  return normalized;
}

function requireHash(value: unknown, path: string): string {
  const hash = requireString(value, path);
  if (!HASH_PATTERN.test(hash)) {
    throw new RenderSnapshotInputError('INPUT_HASH_INVALID', `${path} muss sha256:<64 lowercase hex> entsprechen.`);
  }
  return hash;
}

function requireInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path} muss eine nichtnegative Ganzzahl sein.`);
  }
  return value as number;
}

function requireCanonicalUrl(value: unknown, path: string): string {
  const raw = requireString(value, path);
  const normalized = normalizeKnowledgeProjectionUrl(raw);
  if (!normalized || raw !== normalized) {
    throw new RenderSnapshotInputError('INPUT_PROJECTION_NON_CANONICAL', `${path} ist keine kanonische HTTP(S)- oder root-relative URL.`);
  }
  return normalized;
}

function normalizeSource(value: unknown, index: number): ArticleVisiblePayloadV2['sources'][number] {
  const source = requireRecord(value, `publish_payload.sources[${index}]`);
  return {
    source_id: requireString(source.source_id, `publish_payload.sources[${index}].source_id`),
    label: requireString(source.label, `publish_payload.sources[${index}].label`),
    url: requireString(source.url, `publish_payload.sources[${index}].url`),
  };
}

function normalizeIngredient(value: unknown, index: number): KnowledgeArticleIngredient {
  const ingredient = requireRecord(value, `ingredients[${index}]`);
  if (!Number.isInteger(ingredient.ingredient_id)) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `ingredients[${index}].ingredient_id muss ganzzahlig sein.`);
  }
  if (ingredient.name !== null && typeof ingredient.name !== 'string') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `ingredients[${index}].name muss String oder null sein.`);
  }
  if (ingredient.sort_order !== undefined && ingredient.sort_order !== null && !Number.isInteger(ingredient.sort_order)) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `ingredients[${index}].sort_order muss ganzzahlig oder null sein.`);
  }
  return {
    ingredient_id: ingredient.ingredient_id as number,
    name: ingredient.name as string | null,
    ...(ingredient.sort_order === undefined ? {} : { sort_order: ingredient.sort_order as number | null }),
  };
}

function normalizeProjectionLink(value: unknown, path: string): ProjectionLink {
  const link = requireRecord(value, path);
  return {
    label: requireCanonicalText(link.label, `${path}.label`),
    url: requireCanonicalUrl(link.url, `${path}.url`),
  };
}

function normalizeProjectionTable(value: unknown, path: string): ProjectionTable {
  const table = requireRecord(value, path);
  if (table.presentation !== 'data_table' && table.presentation !== 'food_grid') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.presentation muss data_table oder food_grid sein.`);
  }
  const headers = requireArray(table.headers, `${path}.headers`)
    .map((header, index) => requireCanonicalText(header, `${path}.headers[${index}]`, true));
  const rows = requireArray(table.rows, `${path}.rows`).map((row, rowIndex) => {
    const cells = requireArray(row, `${path}.rows[${rowIndex}]`)
      .map((cell, cellIndex) => requireCanonicalText(cell, `${path}.rows[${rowIndex}][${cellIndex}]`, true));
    if (cells.length !== headers.length) {
      throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.rows[${rowIndex}] hat nicht dieselbe Spaltenzahl wie headers.`);
    }
    return cells;
  });
  return { presentation: table.presentation, headers, rows };
}

function normalizeProjectionAsset(value: unknown, path: string): ProjectionAsset {
  const asset = requireRecord(value, path);
  return {
    src: requireCanonicalUrl(asset.src, `${path}.src`),
    alt: requireCanonicalText(asset.alt, `${path}.alt`),
    caption: requireCanonicalText(asset.caption, `${path}.caption`),
  };
}

function normalizeProjectionSection(value: unknown, index: number): ProjectionSection {
  const path = `expected_projection.sections[${index}]`;
  const section = requireRecord(value, path);
  const order = requireInteger(section.order, `${path}.order`);
  if (order !== index) throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.order muss ${index} sein.`);
  if (section.number !== null && (typeof section.number !== 'string' || !/^\d{2}$/.test(section.number))) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.number muss null oder zweistellig sein.`);
  }
  const kind = section.kind;
  if (!['overview', 'content', 'fazit', 'control', 'sources'].includes(String(kind))) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.kind ist ungültig.`);
  }
  const controlType = section.control_type;
  if (controlType !== null && controlType !== 'merkkasten' && controlType !== 'legal_notice') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.control_type ist ungültig.`);
  }
  if ((kind === 'control') !== (controlType !== null)) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.kind und control_type widersprechen sich.`);
  }
  return {
    section_id: requireString(section.section_id, `${path}.section_id`),
    kind: kind as ProjectionSection['kind'],
    control_type: controlType as ProjectionSection['control_type'],
    heading: requireCanonicalText(section.heading, `${path}.heading`),
    order,
    number: section.number as string | null,
    normalized_text: requireCanonicalText(section.normalized_text, `${path}.normalized_text`, true),
    links: requireArray(section.links, `${path}.links`)
      .map((link, linkIndex) => normalizeProjectionLink(link, `${path}.links[${linkIndex}]`)),
    tables: requireArray(section.tables, `${path}.tables`)
      .map((table, tableIndex) => normalizeProjectionTable(table, `${path}.tables[${tableIndex}]`)),
    assets: requireArray(section.assets, `${path}.assets`)
      .map((asset, assetIndex) => normalizeProjectionAsset(asset, `${path}.assets[${assetIndex}]`)),
  };
}

function normalizeProjectionUi(value: unknown): ProjectionUi {
  const ui = requireRecord(value, 'expected_projection.ui');
  if (ui.contract_version !== KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `expected_projection.ui.contract_version muss ${KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION} sein.`);
  }
  const readingTime = requireRecord(ui.reading_time, 'expected_projection.ui.reading_time');
  const sourcesCount = requireRecord(ui.sources_count, 'expected_projection.ui.sources_count');
  if (ui.reviewed_date !== null && typeof ui.reviewed_date !== 'string') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'expected_projection.ui.reviewed_date muss String oder null sein.');
  }
  return {
    contract_version: KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION,
    eyebrow: requireCanonicalText(ui.eyebrow, 'expected_projection.ui.eyebrow'),
    toc_title: requireCanonicalText(ui.toc_title, 'expected_projection.ui.toc_title'),
    ingredient_chip: requireCanonicalText(ui.ingredient_chip, 'expected_projection.ui.ingredient_chip'),
    reviewed_date: ui.reviewed_date === null
      ? null
      : requireCanonicalText(ui.reviewed_date, 'expected_projection.ui.reviewed_date'),
    reading_time: {
      minutes: requireInteger(readingTime.minutes, 'expected_projection.ui.reading_time.minutes'),
      label: requireCanonicalText(readingTime.label, 'expected_projection.ui.reading_time.label'),
    },
    sources_label: requireCanonicalText(ui.sources_label, 'expected_projection.ui.sources_label'),
    sources_count: {
      count: requireInteger(sourcesCount.count, 'expected_projection.ui.sources_count.count'),
      label: requireCanonicalText(sourcesCount.label, 'expected_projection.ui.sources_count.label'),
    },
  };
}

function normalizeExpectedProjection(value: unknown): ArticleRenderProjectionV2 {
  const projection = requireRecord(value, 'expected_projection');
  if (projection.schema !== 'article_render_projection.v2' || projection.template !== 'magazine') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'expected_projection braucht article_render_projection.v2 und template=magazine.');
  }
  const sections = requireArray(projection.sections, 'expected_projection.sections').map(normalizeProjectionSection);
  const sectionIds = sections.map((section) => section.section_id);
  if (new Set(sectionIds).size !== sectionIds.length) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'expected_projection.section_id muss eindeutig sein.');
  }
  const toc = requireArray(projection.toc, 'expected_projection.toc').map((value, index) => {
    const path = `expected_projection.toc[${index}]`;
    const entry = requireRecord(value, path);
    const sectionId = requireString(entry.section_id, `${path}.section_id`);
    const href = requireString(entry.href, `${path}.href`);
    if (href !== `#${sectionId}`) throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.href bindet section_id nicht exakt.`);
    return { section_id: sectionId, label: requireCanonicalText(entry.label, `${path}.label`), href };
  });
  const fazit = requireRecord(projection.fazit, 'expected_projection.fazit');
  const sources = requireArray(projection.sources, 'expected_projection.sources').map((value, index) => {
    const path = `expected_projection.sources[${index}]`;
    const source = requireRecord(value, path);
    const order = requireInteger(source.order, `${path}.order`);
    if (order !== index) throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', `${path}.order muss ${index} sein.`);
    return {
      source_id: requireString(source.source_id, `${path}.source_id`),
      label: requireCanonicalText(source.label, `${path}.label`),
      url: requireCanonicalUrl(source.url, `${path}.url`),
      order,
    };
  });
  if (new Set(sources.map((source) => source.source_id)).size !== sources.length) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'expected_projection.sources.source_id muss eindeutig sein.');
  }
  return {
    schema: 'article_render_projection.v2',
    article_id: requireString(projection.article_id, 'expected_projection.article_id'),
    route: requireString(projection.route, 'expected_projection.route'),
    template: 'magazine',
    h1: requireCanonicalText(projection.h1, 'expected_projection.h1'),
    dek: requireCanonicalText(projection.dek, 'expected_projection.dek'),
    ui: normalizeProjectionUi(projection.ui),
    sections,
    toc,
    fazit: {
      section_id: requireString(fazit.section_id, 'expected_projection.fazit.section_id'),
      normalized_text: requireCanonicalText(fazit.normalized_text, 'expected_projection.fazit.normalized_text', true),
    },
    sources,
  };
}

export function normalizeArticleRenderRequest(value: unknown): ArticleRenderRequestV2 {
  const request = requireRecord(value, 'request');
  if (request.schema !== 'article_render_request.v2') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'request.schema muss article_render_request.v2 sein.');
  }
  const articleId = requireString(request.article_id, 'article_id');
  const route = requireString(request.route, 'route');
  const publishPayload = requireRecord(request.publish_payload, 'publish_payload');
  if (publishPayload.schema !== 'article_visible_payload.v2') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'publish_payload.schema muss article_visible_payload.v2 sein.');
  }
  const slug = requireString(publishPayload.slug, 'publish_payload.slug');
  if (!SLUG_PATTERN.test(slug)) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'publish_payload.slug ist kein kanonischer Wissens-Slug.');
  }
  const conclusion = publishPayload.conclusion;
  if (conclusion !== null && typeof conclusion !== 'string') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'publish_payload.conclusion muss String oder null sein.');
  }
  const normalizedPayload: ArticleVisiblePayloadV2 = {
    schema: 'article_visible_payload.v2',
    slug,
    title: requireString(publishPayload.title, 'publish_payload.title'),
    dek: requireString(publishPayload.dek, 'publish_payload.dek'),
    body: requireString(publishPayload.body, 'publish_payload.body'),
    conclusion: conclusion as string | null,
    sources: requireArray(publishPayload.sources, 'publish_payload.sources').map(normalizeSource),
  };
  const payloadHash = requireHash(request.payload_hash, 'payload_hash');
  const calculatedPayloadHash = canonicalJsonHash(normalizedPayload);
  if (payloadHash !== calculatedPayloadHash) {
    throw new RenderSnapshotInputError('INPUT_PAYLOAD_HASH_MISMATCH', `payload_hash bindet publish_payload nicht (erwartet ${calculatedPayloadHash}).`);
  }
  const ingredients = request.ingredients;
  if (ingredients !== undefined && !Array.isArray(ingredients)) {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'ingredients muss ein Array sein.');
  }
  const normalizedIngredients = Array.isArray(ingredients) ? ingredients.map(normalizeIngredient) : undefined;
  if (request.reviewed_date !== undefined && request.reviewed_date !== null && typeof request.reviewed_date !== 'string') {
    throw new RenderSnapshotInputError('INPUT_SCHEMA_INVALID', 'reviewed_date muss String oder null sein.');
  }
  const reviewedDate = request.reviewed_date as string | null | undefined;
  const expectedProjection = normalizeExpectedProjection(request.expected_projection);
  const projectionHash = requireHash(request.projection_hash, 'projection_hash');
  const calculatedProjectionHash = canonicalJsonHash(expectedProjection);
  if (projectionHash !== calculatedProjectionHash) {
    throw new RenderSnapshotInputError('INPUT_PROJECTION_HASH_MISMATCH', `projection_hash bindet expected_projection nicht (erwartet ${calculatedProjectionHash}).`);
  }
  const expectedSourceBinding: ProjectionSource[] = normalizedPayload.sources.map((source, order) => ({
    source_id: source.source_id,
    label: normalizeKnowledgeProjectionText(source.label),
    url: normalizeKnowledgeProjectionUrl(source.url) ?? '',
    order,
  }));
  const readingMinutes = calculateKnowledgeReadingMinutes(normalizedPayload.body, normalizedPayload.conclusion);
  const ingredientNames = normalizedIngredients?.map((ingredient) => ingredient.name).filter(Boolean) ?? [];
  const expectedUi: ProjectionUi = {
    contract_version: KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION,
    eyebrow: 'Wissen',
    toc_title: 'Auf dieser Seite',
    ingredient_chip: `Wirkstoff: ${ingredientNames.join(', ') || 'Wissensartikel'}`,
    reviewed_date: reviewedDate ? `Geprüft am ${reviewedDate}` : null,
    reading_time: { minutes: readingMinutes, label: knowledgeReadingTimeLabel(readingMinutes) },
    sources_label: 'Quellen',
    sources_count: {
      count: normalizedPayload.sources.length,
      label: knowledgeSourceCountLabel(normalizedPayload.sources.length),
    },
  };
  if (
    expectedProjection.article_id !== articleId
    || expectedProjection.route !== route
    || expectedProjection.h1 !== normalizeKnowledgeProjectionText(normalizedPayload.title)
    || expectedProjection.dek !== normalizeKnowledgeProjectionText(normalizedPayload.dek)
    || canonicalJsonHash(expectedProjection.sources) !== canonicalJsonHash(expectedSourceBinding)
    || canonicalJsonHash(expectedProjection.ui) !== canonicalJsonHash(expectedUi)
  ) {
    throw new RenderSnapshotInputError('INPUT_PROJECTION_BINDING_MISMATCH', 'expected_projection bindet Artikel, Route, Hero, UI oder Quellen nicht exakt.');
  }
  return {
    schema: 'article_render_request.v2',
    article_id: articleId,
    route,
    article_byte_hash: requireHash(request.article_byte_hash, 'article_byte_hash'),
    visible_payload_hash: requireHash(request.visible_payload_hash, 'visible_payload_hash'),
    payload_hash: payloadHash,
    projection_hash: projectionHash,
    ...(request.compiled_payload_hash === undefined ? {} : { compiled_payload_hash: requireHash(request.compiled_payload_hash, 'compiled_payload_hash') }),
    publish_payload: normalizedPayload,
    expected_projection: expectedProjection,
    ...(normalizedIngredients === undefined ? {} : { ingredients: normalizedIngredients }),
    ...(reviewedDate === undefined ? {} : { reviewed_date: reviewedDate }),
  };
}

function requestArticle(request: ArticleRenderRequestV2): KnowledgeArticle {
  return {
    slug: request.publish_payload.slug,
    title: request.publish_payload.title,
    summary: request.publish_payload.dek,
    body: request.publish_payload.body,
    conclusion: request.publish_payload.conclusion,
    sources: request.publish_payload.sources.map(({ source_id, label, url }) => ({ source_id, label, url })),
    ingredients: request.ingredients,
  };
}

export function renderKnowledgeMagazineMarkup(requestValue: unknown): string {
  const request = normalizeArticleRenderRequest(requestValue);
  return renderToStaticMarkup(
    <StaticRouter location={request.route}>
      <KnowledgeMagazineArticle article={requestArticle(request)} reviewedDate={request.reviewed_date ?? null} />
    </StaticRouter>,
  );
}

function elementDomExposed(element: Element | null): boolean {
  let current = element;
  while (current) {
    const style = current.getAttribute('style') ?? '';
    const computedStyle = current.ownerDocument.defaultView?.getComputedStyle(current);
    if (
      current.hasAttribute('hidden')
      || current.hasAttribute('inert')
      || current.getAttribute('aria-hidden') === 'true'
      || /(?:^|;)\s*display\s*:\s*none(?:\s*!important)?\s*(?:;|$)/i.test(style)
      || /(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)(?:\s*!important)?\s*(?:;|$)/i.test(style)
      || computedStyle?.display === 'none'
      || computedStyle?.visibility === 'hidden'
      || computedStyle?.visibility === 'collapse'
      || Number.parseFloat(computedStyle?.opacity ?? '1') <= 0
    ) return false;
    current = current.parentElement;
  }
  return element !== null;
}

function sectionKind(section: Element): RenderedSection['kind'] {
  const heading = normalizeKnowledgeProjectionText(section.querySelector('h2')?.textContent);
  if (section.classList.contains('lead')) return 'lead';
  if (section.id === 'ueberblick') return 'overview';
  if (section.id === 'quellen') return 'sources';
  if (section.classList.contains('fazit') || /^fazit(?:\b|$)/i.test(heading)) return 'fazit';
  if (section.hasAttribute('data-knowledge-control-block')) return 'control';
  if (section.hasAttribute('data-testid')) return 'editorial';
  return 'other';
}

function projectionKind(section: Element): Pick<ProjectionSection, 'kind' | 'control_type'> {
  const renderedKind = sectionKind(section);
  if (renderedKind === 'overview') return { kind: 'overview', control_type: null };
  if (renderedKind === 'fazit') return { kind: 'fazit', control_type: null };
  if (renderedKind === 'sources') return { kind: 'sources', control_type: null };
  if (renderedKind === 'control') {
    const controlType = section.getAttribute('data-knowledge-control-block');
    return {
      kind: 'control',
      control_type: controlType === 'merkkasten' || controlType === 'legal_notice' ? controlType : null,
    };
  }
  return { kind: 'content', control_type: null };
}

function sectionHeading(section: Element, kind: RenderedSection['kind']): string {
  if (kind === 'sources') return normalizeKnowledgeProjectionText(section.querySelector('.src-toggle > span')?.textContent);
  return normalizeKnowledgeProjectionText(section.querySelector('.sec-head h2, h2')?.textContent);
}

function semanticSectionText(section: Element): string {
  const clone = section.cloneNode(true) as Element;
  clone.querySelectorAll('.sec-head, .takeaways > h2, .callout-title, .src-toggle, .nice-mobile, [data-projection-duplicate="true"], [data-projection-additive-navigation="true"], .sr-only, .food-card .ic, .pm, svg, [aria-hidden="true"]')
    .forEach((element) => element.remove());
  clone.querySelectorAll('p, li, h3, h4, th, td, tr, figcaption, [role="columnheader"], [role="cell"], .src-list__in > div, .faq-q')
    .forEach((element) => element.append(clone.ownerDocument.createTextNode(' ')));
  return normalizeKnowledgeProjectionText(clone.textContent);
}

function projectedLinks(section: Element): ProjectionLink[] {
  return Array.from(section.querySelectorAll('a[href]'))
    .filter((link) => !link.closest('[data-projection-additive-navigation="true"]'))
    .map((link) => ({
    label: normalizeKnowledgeProjectionText(link.textContent),
    url: normalizeKnowledgeProjectionUrl(link.getAttribute('href')) ?? '',
    }));
}

function projectedTables(section: Element): ProjectionTable[] {
  return Array.from(section.querySelectorAll('[data-knowledge-table-presentation]')).map((container) => {
    const presentation = container.getAttribute('data-knowledge-table-presentation');
    if (presentation === 'food_grid') {
      return {
        presentation: 'food_grid' as const,
        headers: Array.from(container.querySelectorAll(':scope > [data-knowledge-table-header-row] > [role="columnheader"]'))
          .map((cell) => normalizeKnowledgeProjectionText(cell.textContent)),
        rows: Array.from(container.querySelectorAll(':scope > [data-knowledge-table-row][role="row"]'))
          .map((row) => Array.from(row.querySelectorAll(':scope > [role="cell"]'))
            .map((cell) => normalizeKnowledgeProjectionText(cell.textContent))),
      };
    }
    const table = container.querySelector('table.nice');
    return {
      presentation: 'data_table' as const,
      headers: table ? Array.from(table.querySelectorAll('thead th')).map((cell) => normalizeKnowledgeProjectionText(cell.textContent)) : [],
      rows: table ? Array.from(table.querySelectorAll('tbody tr')).map((row) => (
        Array.from(row.querySelectorAll('td')).map((cell) => normalizeKnowledgeProjectionText(cell.textContent))
      )) : [],
    };
  });
}

function projectedAssets(section: Element): ProjectionAsset[] {
  return Array.from(section.querySelectorAll('figure')).flatMap((figure) => {
    const image = figure.querySelector('img');
    if (!image) return [];
    return [{
      src: normalizeKnowledgeProjectionUrl(image.getAttribute('src')) ?? '',
      alt: normalizeKnowledgeProjectionText(image.getAttribute('alt')),
      caption: normalizeKnowledgeProjectionText(figure.querySelector('figcaption')?.textContent),
    }];
  });
}

function projectSection(section: Element, order: number): ProjectionSection {
  const kind = sectionKind(section);
  const projectedKind = projectionKind(section);
  return {
    section_id: section.id,
    ...projectedKind,
    heading: sectionHeading(section, kind),
    order,
    number: normalizeKnowledgeProjectionText(section.querySelector('.sec-head > .num')?.textContent) || null,
    normalized_text: semanticSectionText(section),
    links: projectedLinks(section),
    tables: projectedTables(section),
    assets: projectedAssets(section),
  };
}

function tocTargetId(href: string): string | null {
  if (!href.startsWith('#') || href.length === 1) return null;
  try { return decodeURIComponent(href.slice(1)); } catch { return null; }
}

function uiElements(root: Element | null, key: string): Element[] {
  return root ? Array.from(root.querySelectorAll(`[data-knowledge-ui="${key}"]`)) : [];
}

function uiText(root: Element | null, key: string): string {
  return normalizeKnowledgeProjectionText(uiElements(root, key)[0]?.textContent);
}

function integerFromUiLabel(label: string): number {
  const match = label.match(/\b(\d+)\b/);
  return match ? Number.parseInt(match[1], 10) : -1;
}

function actualProjectionUi(root: Element | null): ProjectionUi {
  const readingLabel = uiText(root, 'reading-time');
  const sourceCountLabel = uiText(root, 'sources-count');
  const reviewedDate = uiText(root, 'reviewed-date');
  return {
    contract_version: (root?.getAttribute('data-ui-contract') ?? '') as ProjectionUi['contract_version'],
    eyebrow: uiText(root, 'eyebrow'),
    toc_title: uiText(root, 'toc-title'),
    ingredient_chip: uiText(root, 'ingredient-chip'),
    reviewed_date: reviewedDate || null,
    reading_time: { minutes: integerFromUiLabel(readingLabel), label: readingLabel },
    sources_label: uiText(root, 'sources-label'),
    sources_count: { count: integerFromUiLabel(sourceCountLabel), label: sourceCountLabel },
  };
}

function isInsideInitiallyCollapsedDisclosure(element: Element): boolean {
  return element.closest('[data-knowledge-disclosure="panel"][hidden]') !== null;
}

function semanticLeafElements(root: Element | null): Element[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll([
    '[data-knowledge-leaf]',
    '[data-knowledge-disclosure]',
    '[data-knowledge-table-presentation]',
    '[data-knowledge-ui]',
  ].join(', ')));
}

function addError(errors: RenderSnapshotError[], code: RenderSnapshotErrorCode, message: string, expected?: unknown, actual?: unknown): void {
  errors.push({ code, message, ...(expected === undefined ? {} : { expected }), ...(actual === undefined ? {} : { actual }) });
}

function runCheck(checks: RenderSnapshotCheck[], errors: RenderSnapshotError[], id: string, probe: () => void): void {
  const previousErrorCount = errors.length;
  probe();
  const errorCodes = errors.slice(previousErrorCount).map((error) => error.code);
  checks.push({ id, result: errorCodes.length === 0 ? 'PASS' : 'FAIL', error_codes: errorCodes });
}

function compareProjectionPart(
  checks: RenderSnapshotCheck[],
  errors: RenderSnapshotError[],
  id: string,
  code: RenderSnapshotErrorCode,
  expected: unknown,
  actual: unknown,
): void {
  runCheck(checks, errors, id, () => {
    if (canonicalJsonHash(expected) !== canonicalJsonHash(actual)) {
      addError(errors, code, `${id} weicht von der compilererzeugten Sollprojektion ab.`, expected, actual);
    }
  });
}

function ariaTokens(element: Element, attribute: string): string[] {
  return (element.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean);
}

export function inspectKnowledgeMagazineMarkup(requestValue: unknown, html: string): ArticleRenderSnapshotV2 {
  const request = normalizeArticleRenderRequest(requestValue);
  if (typeof html !== 'string' || html.length === 0) {
    throw new RenderSnapshotInputError('INPUT_HTML_INVALID', 'html muss ein nicht-leerer String sein.');
  }
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  try {
    const { document } = dom.window;
    const rootCandidates = Array.from(document.querySelectorAll('article[data-testid="knowledge-magazine-article"]'));
    const root = rootCandidates[0] ?? null;
    const h1Candidates = root ? Array.from(root.querySelectorAll('h1')) : [];
    const h1 = h1Candidates[0] ?? null;
    const dek = root?.querySelector('.hero .dek') ?? null;
    const contentCandidates = root ? Array.from(root.querySelectorAll('.layout > .content')) : [];
    const content = contentCandidates[0] ?? null;
    const tocCandidates = root ? Array.from(root.querySelectorAll('aside[aria-label="Inhaltsverzeichnis"]')) : [];
    const toc = tocCandidates[0] ?? null;
    const directContentChildren = content ? Array.from(content.children) : [];
    const sectionElements = directContentChildren.filter((element) => element.tagName.toLowerCase() === 'section');
    const renderedSections: RenderedSection[] = sectionElements.map((section, position) => {
      const kind = sectionKind(section);
      return {
        position,
        id: section.id || null,
        kind,
        heading: sectionHeading(section, kind) || null,
        number: normalizeKnowledgeProjectionText(section.querySelector('.sec-head > .num')?.textContent) || null,
        dom_exposed: elementDomExposed(section),
      };
    });
    const projectionSections = sectionElements.map(projectSection);
    const sectionById = new Map(renderedSections.filter((section) => section.id).map((section) => [section.id as string, section]));
    const tocLinks: RenderedTocLink[] = toc
      ? Array.from(toc.querySelectorAll('a')).map((link, position) => {
        const href = link.getAttribute('href') ?? '';
        const targetId = tocTargetId(href);
        return {
          position,
          label: normalizeKnowledgeProjectionText(link.textContent),
          href,
          target_id: targetId,
          target_exists: targetId !== null && sectionById.has(targetId),
        };
      })
      : [];
    const actualToc: ProjectionTocEntry[] = tocLinks.map((link) => ({
      section_id: link.target_id ?? '',
      label: link.label,
      href: link.href,
    }));
    const sourceSections = sectionElements.filter((section) => sectionKind(section) === 'sources');
    const conclusionSections = sectionElements.filter((section) => sectionKind(section) === 'fazit');
    const sourceElement = sourceSections[0] ?? null;
    const sourceTrigger = sourceElement?.querySelector('.src-toggle') ?? null;
    const sourcePanelId = sourceTrigger?.getAttribute('aria-controls') ?? null;
    const sourcePanel = sourcePanelId ? document.getElementById(sourcePanelId) : null;
    const sourceEntries = sourcePanel ? Array.from(sourcePanel.querySelectorAll('.src-list__in > div')) : [];
    const actualSources: ProjectionSource[] = sourceEntries.map((entry, order) => {
      const link = entry.querySelector('a.source-link');
      const label = link?.querySelector('span:last-of-type') ?? entry.querySelector('.source-label');
      return {
        source_id: entry.getAttribute('data-source-id') ?? '',
        label: normalizeKnowledgeProjectionText(label?.textContent),
        url: normalizeKnowledgeProjectionUrl(link?.getAttribute('href')) ?? '',
        order,
      };
    });
    const actualFazitSection = projectionSections.find((section, index) => sectionKind(sectionElements[index]) === 'fazit');
    const actualUi = actualProjectionUi(root);
    const actualProjection: ArticleRenderProjectionV2 = {
      schema: 'article_render_projection.v2',
      article_id: request.article_id,
      route: request.route,
      template: root?.getAttribute('data-template') ?? '',
      h1: normalizeKnowledgeProjectionText(h1?.textContent),
      dek: normalizeKnowledgeProjectionText(dek?.textContent),
      ui: actualUi,
      sections: projectionSections,
      toc: actualToc,
      fazit: {
        section_id: actualFazitSection?.section_id ?? '',
        normalized_text: actualFazitSection?.normalized_text ?? '',
      },
      sources: actualSources,
    };
    const errors: RenderSnapshotError[] = [];
    const checks: RenderSnapshotCheck[] = [];
    const projectionChecks: RenderSnapshotCheck[] = [];

    runCheck(checks, errors, 'route-and-template-selection', () => {
      const expectedRoute = `/wissen/${request.publish_payload.slug}`;
      if (request.route !== expectedRoute) addError(errors, 'ROUTE_SLUG_MISMATCH', 'Route und Slug stimmen nicht exakt überein.', expectedRoute, request.route);
      if (!isMagazineKnowledgeArticle(request.publish_payload.body)) addError(errors, 'MAGAZINE_MARKER_MISSING', 'Die reale Route würde nicht den Magazin-Renderer wählen.');
      if (rootCandidates.length !== 1) addError(errors, 'TEMPLATE_ROOT_COUNT_INVALID', 'Genau ein Magazin-Root ist erforderlich.', 1, rootCandidates.length);
      if (root?.getAttribute('data-template') !== 'magazine') addError(errors, 'TEMPLATE_KIND_MISMATCH', 'Das Root trägt nicht data-template=magazine.', 'magazine', root?.getAttribute('data-template') ?? null);
    });

    runCheck(checks, errors, 'hero', () => {
      if (h1Candidates.length !== 1) addError(errors, 'H1_COUNT_INVALID', 'Genau eine H1 ist erforderlich.', 1, h1Candidates.length);
      if (actualProjection.h1 !== normalizeKnowledgeProjectionText(request.publish_payload.title)) addError(errors, 'H1_MISMATCH', 'H1 und Payload-Titel unterscheiden sich.', request.publish_payload.title, actualProjection.h1);
      if (actualProjection.dek !== normalizeKnowledgeProjectionText(request.publish_payload.dek)) addError(errors, 'DEK_MISMATCH', 'Dek und Payload unterscheiden sich.', request.publish_payload.dek, actualProjection.dek);
    });

    runCheck(checks, errors, 'dom-exposure', () => {
      if (contentCandidates.length !== 1) addError(errors, 'CONTENT_MISSING', 'Genau ein Content-Bereich ist erforderlich.', 1, contentCandidates.length);
      if (!elementDomExposed(content)) addError(errors, 'CONTENT_DOM_EXPOSURE_INVALID', 'Der Content ist durch DOM-Attribute oder Inline-Style verborgen.');
      if (tocCandidates.length !== 1) addError(errors, 'TOC_COUNT_INVALID', 'Genau ein linkes Inhaltsmenü ist erforderlich.', 1, tocCandidates.length);
      if (!elementDomExposed(toc)) addError(errors, 'TOC_DOM_EXPOSURE_INVALID', 'Das TOC ist durch DOM-Attribute oder Inline-Style verborgen.');
      const hiddenSections = renderedSections.filter((section) => !section.dom_exposed).map((section) => section.id);
      if (hiddenSections.length) addError(errors, 'SECTION_DOM_EXPOSURE_INVALID', 'Abschnitte sind durch DOM-Attribute oder Inline-Style verborgen.', [], hiddenSections);
      const invalidDirectChildren = directContentChildren
        .map((element, index) => ({ index, tag: element.tagName.toLowerCase(), id: element.id || null }))
        .filter((entry) => entry.tag !== 'section');
      if (invalidDirectChildren.length) {
        addError(errors, 'CONTENT_CHILD_INVALID', 'Der Content-Bereich darf ausschließlich die erwarteten direkten Section-Kinder enthalten.', [], invalidDirectChildren);
      }
      const hiddenLeaves = semanticLeafElements(root)
        .filter((element) => !isInsideInitiallyCollapsedDisclosure(element) && !elementDomExposed(element))
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          leaf: element.getAttribute('data-knowledge-leaf'),
          text: normalizeKnowledgeProjectionText(element.textContent).slice(0, 120),
        }));
      if (hiddenLeaves.length) {
        addError(errors, 'SEMANTIC_LEAF_DOM_EXPOSURE_INVALID', 'Ein erwartetes semantisches Blatt ist hidden, aria-hidden, inert oder per Inline-/Computed-Style verborgen.', [], hiddenLeaves);
      }
    });

    runCheck(checks, errors, 'image-inventory', () => {
      const figures = root ? Array.from(root.querySelectorAll('figure')) : [];
      const images = root ? Array.from(root.querySelectorAll('img')) : [];
      const expectedAssets = request.expected_projection.sections.flatMap((section) => section.assets);
      const actualAssets = actualProjection.sections.flatMap((section) => section.assets);
      const imagesOutsideFigures = images.filter((image) => image.closest('figure') === null);
      const invalidFigures = figures
        .map((figure, index) => ({ index, image_count: figure.querySelectorAll(':scope > img').length, caption_count: figure.querySelectorAll(':scope > figcaption').length }))
        .filter((entry) => entry.image_count !== 1 || entry.caption_count !== 1);
      if (
        imagesOutsideFigures.length
        || invalidFigures.length
        || figures.length !== expectedAssets.length
        || images.length !== expectedAssets.length
        || canonicalJsonHash(actualAssets) !== canonicalJsonHash(expectedAssets)
      ) {
        addError(errors, 'IMAGE_INVENTORY_INVALID', 'Alle Artikelbilder müssen exakt einmal in genau einer Figure mit exaktem Asset, Alt-Text und Caption gerendert werden.', {
          count: expectedAssets.length,
          assets: expectedAssets,
        }, {
          figure_count: figures.length,
          image_count: images.length,
          outside_figure_count: imagesOutsideFigures.length,
          invalid_figures: invalidFigures,
          assets: actualAssets,
        });
      }
    });

    runCheck(checks, errors, 'fixed-ui-contract', () => {
      const requiredUiKeys = ['eyebrow', 'toc-title', 'ingredient-chip', 'reading-time', 'sources-label', 'sources-count'];
      if (request.expected_projection.ui.reviewed_date !== null) requiredUiKeys.push('reviewed-date');
      const invalidCounts = requiredUiKeys
        .map((key) => ({ key, count: uiElements(root, key).length }))
        .filter((entry) => entry.count !== 1);
      const unexpectedReviewDate = request.expected_projection.ui.reviewed_date === null && uiElements(root, 'reviewed-date').length > 0;
      if (
        root?.getAttribute('data-ui-contract') !== KNOWLEDGE_MAGAZINE_UI_CONTRACT_VERSION
        || invalidCounts.length
        || unexpectedReviewDate
        || canonicalJsonHash(actualUi) !== canonicalJsonHash(request.expected_projection.ui)
      ) {
        addError(errors, 'UI_CONTRACT_MISMATCH', 'Der feste UI-Vertrag für Labels, Metadaten und Zählwerte stimmt nicht exakt.', request.expected_projection.ui, {
          ui: actualUi,
          invalid_counts: invalidCounts,
          unexpected_review_date: unexpectedReviewDate,
        });
      }
    });

    runCheck(checks, errors, 'navigation-targets', () => {
      if (!tocLinks.length) addError(errors, 'TOC_EMPTY', 'Das TOC enthält keine Links.');
      const missing = tocLinks.filter((link) => !link.target_exists).map((link) => link.href);
      if (missing.length) addError(errors, 'TOC_TARGET_MISSING', 'TOC-Ziele fehlen im realen DOM.', [], missing);
      const expectedIds = request.expected_projection.toc.map((entry) => entry.section_id);
      const actualIds = tocLinks.map((entry) => entry.target_id);
      if (canonicalJsonHash(expectedIds) !== canonicalJsonHash(actualIds)) addError(errors, 'TOC_ORDER_MISMATCH', 'TOC-Reihenfolge weicht von der Sollprojektion ab.', expectedIds, actualIds);
      const expectedLabels = request.expected_projection.toc.map((entry) => entry.label);
      const actualLabels = tocLinks.map((entry) => entry.label);
      if (canonicalJsonHash(expectedLabels) !== canonicalJsonHash(actualLabels)) addError(errors, 'TOC_LABEL_MISMATCH', 'TOC-Labels weichen von der Sollprojektion ab.', expectedLabels, actualLabels);
    });

    runCheck(checks, errors, 'ids-lead-and-numbers', () => {
      const allIds = Array.from(document.querySelectorAll('[id]')).map((element) => element.id);
      const duplicateIds = allIds.filter((id, index) => id && allIds.indexOf(id) !== index);
      if (duplicateIds.length) addError(errors, 'DOM_ID_DUPLICATE', 'Alle DOM-IDs müssen global eindeutig sein.', [], duplicateIds);
      const missingSectionIds = renderedSections.filter((section) => !section.id).map((section) => section.position);
      if (missingSectionIds.length) addError(errors, 'SECTION_ID_MISSING', 'Jeder gerenderte Content-Abschnitt braucht eine ID.', [], missingSectionIds);
      const leadSections = renderedSections.filter((section) => section.kind === 'lead').map((section) => section.position);
      if (leadSections.length) addError(errors, 'LEAD_CONTENT_INVALID', 'Zwischen Magazinmarker und Auf einen Blick darf kein Lead gerendert werden.', [], leadSections);
      const actualNumbers = renderedSections.map((section) => section.number).filter((number): number is string => number !== null);
      const expectedNumbers = actualNumbers.map((_, index) => String(index + 1).padStart(2, '0'));
      if (canonicalJsonHash(actualNumbers) !== canonicalJsonHash(expectedNumbers)) addError(errors, 'SECTION_NUMBER_SEQUENCE_INVALID', 'Abschnittsnummern sind nicht lückenlos zweistellig.', expectedNumbers, actualNumbers);
      if (conclusionSections.length !== 1) addError(errors, 'FAZIT_COUNT_INVALID', 'Genau ein Fazit ist erforderlich.', 1, conclusionSections.length);
      if (sourceSections.length !== 1) addError(errors, 'SOURCES_COUNT_INVALID', 'Genau ein Quellenabschnitt ist erforderlich.', 1, sourceSections.length);
    });

    runCheck(checks, errors, 'aria-bidirectional', () => {
      const broken: string[] = [];
      for (const controller of root ? Array.from(root.querySelectorAll('[aria-controls]')) : []) {
        if (!controller.id) { broken.push('controller-without-id'); continue; }
        for (const targetId of ariaTokens(controller, 'aria-controls')) {
          const target = document.getElementById(targetId);
          if (!target || !ariaTokens(target, 'aria-labelledby').includes(controller.id)) broken.push(`${controller.id}->${targetId}`);
        }
      }
      for (const target of root ? Array.from(root.querySelectorAll('[aria-labelledby]')) : []) {
        if (!target.id) { broken.push('labelled-target-without-id'); continue; }
        for (const controllerId of ariaTokens(target, 'aria-labelledby')) {
          const controller = document.getElementById(controllerId);
          if (!controller || !ariaTokens(controller, 'aria-controls').includes(target.id)) broken.push(`${controllerId}<-${target.id}`);
        }
      }
      if (broken.length) addError(errors, 'ARIA_RELATION_INVALID', 'aria-controls und aria-labelledby müssen bidirektional und eindeutig sein.', [], broken);
    });

    runCheck(checks, errors, 'sources-contract', () => {
      const disclosurePresent = sourceSections.length === 1 && sourceTrigger !== null && sourcePanel !== null;
      if (!disclosurePresent) addError(errors, 'SOURCES_DISCLOSURE_INVALID', 'Quellen-Trigger und Panel fehlen oder sind nicht eindeutig.');
      if (!elementDomExposed(sourceElement) || !elementDomExposed(sourceTrigger) || sourceTrigger?.getAttribute('aria-expanded') !== 'false' || sourcePanel?.hasAttribute('hidden') !== true) {
        addError(errors, 'SOURCES_DOM_EXPOSURE_INVALID', 'Quellen-Trigger muss DOM-exponiert und das Panel initial eingeklappt sein.');
      }
      if (sourceEntries.length !== request.publish_payload.sources.length) addError(errors, 'SOURCE_COUNT_MISMATCH', 'Quellenanzahl weicht vom Payload ab.', request.publish_payload.sources.length, sourceEntries.length);
      const sourceIds = actualSources.map((source) => source.source_id);
      if (sourceIds.some((id) => !id) || new Set(sourceIds).size !== sourceIds.length) addError(errors, 'SOURCE_ID_INVALID', 'source_id fehlt oder ist nicht eindeutig.', request.publish_payload.sources.map((source) => source.source_id), sourceIds);
      if (sourceEntries.some((entry) => !sourcePanel?.contains(entry) || entry.closest('section') !== sourceElement)) addError(errors, 'SOURCE_CONTAINMENT_INVALID', 'Quelleneinträge liegen nicht im gebundenen Quellenpanel.');
      const invalidLinks = sourceEntries.filter((entry) => !entry.querySelector('a.source-link') || entry.querySelector('[data-invalid-source-url="true"]')).length;
      if (invalidLinks) addError(errors, 'SOURCE_LINK_INVALID', 'Quellen wurden nicht vollständig als normalisierte Links gerendert.', 0, invalidLinks);
    });

    compareProjectionPart(projectionChecks, errors, 'projection-identity', 'PROJECTION_IDENTITY_MISMATCH', {
      schema: request.expected_projection.schema,
      article_id: request.expected_projection.article_id,
      route: request.expected_projection.route,
      template: request.expected_projection.template,
      h1: request.expected_projection.h1,
      dek: request.expected_projection.dek,
    }, {
      schema: actualProjection.schema,
      article_id: actualProjection.article_id,
      route: actualProjection.route,
      template: root?.getAttribute('data-template') ?? '',
      h1: actualProjection.h1,
      dek: actualProjection.dek,
    });
    compareProjectionPart(projectionChecks, errors, 'projection-sections', 'PROJECTION_SECTIONS_MISMATCH', request.expected_projection.sections, actualProjection.sections);
    compareProjectionPart(projectionChecks, errors, 'projection-toc', 'PROJECTION_TOC_MISMATCH', request.expected_projection.toc, actualProjection.toc);
    compareProjectionPart(projectionChecks, errors, 'projection-fazit', 'PROJECTION_FAZIT_MISMATCH', request.expected_projection.fazit, actualProjection.fazit);
    compareProjectionPart(projectionChecks, errors, 'projection-sources', 'PROJECTION_SOURCES_MISMATCH', request.expected_projection.sources, actualProjection.sources);
    compareProjectionPart(projectionChecks, errors, 'projection-ui', 'PROJECTION_UI_MISMATCH', request.expected_projection.ui, actualProjection.ui);

    const sourceLinkCount = sourcePanel?.querySelectorAll('a.source-link').length ?? 0;
    const invalidSourceCount = sourcePanel?.querySelectorAll('[data-invalid-source-url="true"]').length ?? 0;
    const actual: ArticleRenderSnapshotV2['actual'] = {
      template: root?.getAttribute('data-template') ?? null,
      h1: actualProjection.h1 || null,
      dek: actualProjection.dek || null,
      toc: { present: tocCandidates.length === 1, dom_exposed: elementDomExposed(toc), links: tocLinks },
      sections: renderedSections,
      source_disclosure: {
        present: sourceSections.length === 1 && sourceTrigger !== null && sourcePanel !== null,
        trigger_dom_exposed: elementDomExposed(sourceTrigger),
        expanded: sourceTrigger ? sourceTrigger.getAttribute('aria-expanded') === 'true' : null,
        panel_present: sourcePanel !== null,
        panel_initially_hidden: sourcePanel ? sourcePanel.hasAttribute('hidden') : null,
        entry_count: sourceEntries.length,
        link_count: sourceLinkCount,
        invalid_link_count: invalidSourceCount,
      },
    };
    const allChecks = [...checks, ...projectionChecks];
    const snapshotBase = {
      schema: 'article_render_snapshot.v2' as const,
      article_id: request.article_id,
      route: request.route,
      article_byte_hash: request.article_byte_hash,
      visible_payload_hash: request.visible_payload_hash,
      payload_hash: request.payload_hash,
      projection_hash: request.projection_hash,
      request_hash: canonicalJsonHash(request),
      ...(request.compiled_payload_hash === undefined ? {} : { compiled_payload_hash: request.compiled_payload_hash }),
      renderer: {
        component: 'KnowledgeMagazineArticle' as const,
        version: KNOWLEDGE_MAGAZINE_RENDERER_VERSION,
        contract_version: KNOWLEDGE_MAGAZINE_CONTRACT_VERSION,
      },
      html_hash: sha256(html),
      dom_hash: sha256(document.body.innerHTML),
      structure_hash: canonicalJsonHash(actual),
      actual_projection_hash: canonicalJsonHash(actualProjection),
      actual_projection: actualProjection,
      projection_checks: projectionChecks,
      actual,
      checks: allChecks,
      errors,
      result: (errors.length === 0 ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
    };
    return { ...snapshotBase, content_hash: canonicalJsonHash(snapshotBase) };
  } finally {
    dom.window.close();
  }
}

export function renderKnowledgeMagazineSnapshot(requestValue: unknown): ArticleRenderSnapshotV2 {
  const html = renderKnowledgeMagazineMarkup(requestValue);
  return inspectKnowledgeMagazineMarkup(requestValue, html);
}
