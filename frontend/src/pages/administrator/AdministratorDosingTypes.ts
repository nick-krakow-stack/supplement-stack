import type {
  AdminDoseRecommendation,
  AdminDoseRecommendationPayload,
  AdminIngredientResearchSource,
} from '../../api/admin';

export type BooleanString = '0' | '1';
export type SelectedDoseId = number | 'new' | null;

export type DoseDraft = {
  ingredient_id: string;
  population_slug: string;
  source_type: string;
  source_label: string;
  source_url: string;
  dose_min: string;
  dose_max: string;
  unit: string;
  per_kg_body_weight: string;
  per_kg_cap: string;
  timing: string;
  context_note: string;
  sex_filter: string;
  is_athlete: BooleanString;
  purpose: string;
  is_default: BooleanString;
  is_active: BooleanString;
  is_public: BooleanString;
  relevance_score: string;
  verified_profile_id: string;
  category_name: string;
};

export type SourceLinkDraft = {
  research_source_id: string;
  relevance_weight: string;
  is_primary: boolean;
  note: string;
};

export const SOURCE_TYPES = ['official', 'study', 'profile', 'user_private', 'user_public'];
export const PURPOSES = ['maintenance', 'deficiency_correction', 'therapeutic'];

function numberText(value: number | null | undefined): string {
  return value == null ? '' : String(value).replace('.', ',');
}

export function blankDoseDraft(): DoseDraft {
  return {
    ingredient_id: '',
    population_slug: 'adult',
    source_type: 'official',
    source_label: '',
    source_url: '',
    dose_min: '',
    dose_max: '',
    unit: 'mg',
    per_kg_body_weight: '',
    per_kg_cap: '',
    timing: '',
    context_note: '',
    sex_filter: '',
    is_athlete: '0',
    purpose: 'maintenance',
    is_default: '0',
    is_active: '1',
    is_public: '0',
    relevance_score: '50',
    verified_profile_id: '',
    category_name: '',
  };
}

export function draftFromRecommendation(row: AdminDoseRecommendation): DoseDraft {
  return {
    ingredient_id: row.ingredient_id == null ? '' : String(row.ingredient_id),
    population_slug: row.population_slug ?? 'adult',
    source_type: row.source_type ?? 'official',
    source_label: row.source_label ?? '',
    source_url: row.source_url ?? '',
    dose_min: numberText(row.dose_min),
    dose_max: numberText(row.dose_max),
    unit: row.unit ?? 'mg',
    per_kg_body_weight: numberText(row.per_kg_body_weight),
    per_kg_cap: numberText(row.per_kg_cap),
    timing: row.timing ?? '',
    context_note: row.context_note ?? '',
    sex_filter: row.sex_filter ?? '',
    is_athlete: row.is_athlete ? '1' : '0',
    purpose: row.purpose ?? 'maintenance',
    is_default: row.is_default ? '1' : '0',
    is_active: row.is_active === 0 ? '0' : '1',
    is_public: row.is_public ? '1' : '0',
    relevance_score: row.relevance_score == null ? '50' : numberText(row.relevance_score),
    verified_profile_id: row.verified_profile_id == null ? '' : String(row.verified_profile_id),
    category_name: row.category_name ?? '',
  };
}

export function sourceLinksFromRecommendation(row: AdminDoseRecommendation | null): SourceLinkDraft[] {
  if (!row?.sources?.length) return [];
  return row.sources.map((source) => ({
    research_source_id: String(source.research_source_id),
    relevance_weight: String(source.relevance_weight ?? 50),
    is_primary: source.is_primary === 1,
    note: source.note ?? '',
  }));
}

export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function flag(value: BooleanString): 0 | 1 {
  return value === '1' ? 1 : 0;
}

export function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'error' in error.response.data &&
    typeof error.response.data.error === 'string'
  ) {
    return error.response.data.error;
  }
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

export function payloadFromDraft(
  draft: DoseDraft,
  sourceLinks: SourceLinkDraft[],
): AdminDoseRecommendationPayload {
  return {
    ingredient_id: parseIntOrNull(draft.ingredient_id),
    population_slug: trimmedOrNull(draft.population_slug),
    source_type: trimmedOrNull(draft.source_type),
    source_label: trimmedOrNull(draft.source_label),
    source_url: trimmedOrNull(draft.source_url),
    dose_min: parseNumber(draft.dose_min),
    dose_max: parseNumber(draft.dose_max),
    unit: trimmedOrNull(draft.unit),
    per_kg_body_weight: parseNumber(draft.per_kg_body_weight),
    per_kg_cap: parseNumber(draft.per_kg_cap),
    timing: trimmedOrNull(draft.timing),
    context_note: trimmedOrNull(draft.context_note),
    sex_filter: trimmedOrNull(draft.sex_filter),
    is_athlete: flag(draft.is_athlete),
    purpose: trimmedOrNull(draft.purpose),
    is_default: flag(draft.is_default),
    is_active: flag(draft.is_active),
    is_public: flag(draft.is_public),
    relevance_score: parseNumber(draft.relevance_score),
    verified_profile_id: parseIntOrNull(draft.verified_profile_id),
    category_name: trimmedOrNull(draft.category_name),
    sources: sourceLinks
      .map((source) => ({
        research_source_id: parseIntOrNull(source.research_source_id) ?? 0,
        relevance_weight: parseIntOrNull(source.relevance_weight) ?? 50,
        is_primary: source.is_primary,
        note: trimmedOrNull(source.note),
      }))
      .filter((source) => source.research_source_id > 0),
  };
}

export function validateDosePayload(payload: AdminDoseRecommendationPayload): string | null {
  if (!payload.ingredient_id) return 'Wirkstoff ist erforderlich.';
  if (!payload.population_slug) return 'Zielgruppe ist erforderlich.';
  if (!payload.source_type) return 'Quellentyp ist erforderlich.';
  if (!payload.source_label) return 'Quellenname ist erforderlich.';
  if (payload.dose_max == null) return 'Höchstdosis ist erforderlich.';
  if (!payload.unit) return 'Einheit ist erforderlich.';
  if (!payload.purpose) return 'Zweck ist erforderlich.';
  if (payload.relevance_score != null && (payload.relevance_score < 0 || payload.relevance_score > 100)) {
    return 'Relevanz muss zwischen 0 und 100 liegen.';
  }
  return null;
}

export function doseLabel(row: AdminDoseRecommendation): string {
  const min = row.dose_min == null ? '' : `${numberText(row.dose_min)} - `;
  const max = row.dose_max == null ? '-' : numberText(row.dose_max);
  return `${min}${max} ${row.unit ?? ''}`.trim();
}

export function sourceOptionLabel(source: AdminIngredientResearchSource): string {
  return `#${source.id} ${source.source_title || source.source_kind}`;
}
