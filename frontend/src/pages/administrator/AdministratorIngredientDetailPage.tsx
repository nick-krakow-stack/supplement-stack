import { type Dispatch, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen, ExternalLink, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import {
  createIngredientPrecursor,
  createAdminNutrientReferenceValue,
  createIngredientResearchSource,
  createIngredientResearchWarning,
  deleteIngredientPrecursor,
  deleteAdminNutrientReferenceValue,
  deleteIngredientResearchSource,
  deleteIngredientResearchWarning,
  getAdminEvidenceSummary,
  getAdminNutrientReferenceValues,
  getDoseRecommendations,
  getAllIngredients,
  getInteractions,
  getIngredientResearchDetail,
  lookupPubMedResearchSource,
  updateAdminNutrientReferenceValue,
  updateDoseRecommendation,
  updateIngredientResearchSource,
  updateIngredientResearchStatus,
  updateIngredientResearchWarning,
  upsertIngredientDisplayProfile,
  type AdminDoseRecommendation,
  type AdminDoseRecommendationPayload,
  type AdminDoseRecommendationSourcePayload,
  type AdminEvidenceSummary,
  type AdminIngredientDisplayProfile,
  type AdminIngredientResearchDetail,
  type AdminIngredientResearchSourcePayload,
  type AdminIngredientResearchStatusPayload,
  type AdminIngredientResearchWarningPayload,
  type AdminIngredientResearchWarning,
  type AdminIngredientResearchSource,
  type AdminIngredientResearchForm,
  type AdminIngredientPrecursor,
  type IngredientLookup,
  type AdminInteraction,
  type AdminInteractionPayload,
  type AdminInteractionPartnerType,
  type AdminInteractionSeverity,
  type AdminNutrientReferenceValue,
  type AdminNutrientReferenceValueKind,
  type AdminNutrientReferenceValuePayload,
  type AdminPubMedLookup,
  upsertAdminInteraction,
} from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader, type AdminTone } from './AdminUi';
import { getDosePlausibilityWarnings, type DosePlausibilityWarning } from './dosePlausibility';

type TabName =
  | 'overview'
  | 'forms'
  | 'precursors'
  | 'dosing'
  | 'research'
  | 'interactions'
  | 'warnings'
  | 'display'
  | 'i18n';

type StatusFormState = {
  research_status: string;
  calculation_status: string;
  internal_notes: string;
  blog_url: string;
  reviewed_at: string;
  review_due_at: string;
};

type ProfileFormState = {
  effect_summary: string;
  timing: string;
  timing_note: string;
  intake_hint: string;
  card_note: string;
};

type SourceFormState = {
  source_kind: string;
  source_title: string;
  source_url: string;
  organization: string;
  country: string;
  region: string;
  recommendation_type: string;
  population: string;
  no_recommendation: boolean;
  notes: string;
  dose_min: string;
  dose_max: string;
  dose_unit: string;
  per_kg_body_weight: string;
  frequency: string;
  study_type: string;
  evidence_quality: string;
  duration: string;
  outcome: string;
  finding: string;
  doi: string;
  pubmed_id: string;
  source_date: string;
  reviewed_at: string;
  evidence_grade: string;
  is_retracted: boolean;
  retraction_checked_at: string;
  retraction_notice_url: string;
};

type WarningFormState = {
  short_label: string;
  popover_text: string;
  severity: string;
  article_slug: string;
  min_amount: string;
  unit: string;
  active: boolean;
};

type InteractionFormState = {
  partner_type: AdminInteractionPartnerType;
  partner_ingredient_id: string;
  partner_label: string;
  type: string;
  severity: AdminInteractionSeverity;
  description: string;
  mechanism: string;
  source_label: string;
  source_url: string;
  active: boolean;
};

type NrvFormState = {
  population_id: string;
  organization: string;
  region: string;
  kind: AdminNutrientReferenceValueKind | string;
  value: string;
  unit: string;
  source_url: string;
  source_label: string;
  source_year: string;
  notes: string;
};

type SourceSavingKey = 'new' | number | null;
type SourceLookupKey = 'new' | number;
type WarningSavingKey = 'new' | number | null;
type DoseLinkRole = 'primary' | 'secondary';
type SourceKindFilter = 'all' | 'official' | 'study' | 'other';
type SourceRecommendationFilter = 'all' | 'no_recommendation' | 'with_recommendation';
type SourceDoseLinkFilter = 'all' | 'linked' | 'unlinked';

type SourceFilters = {
  kind: SourceKindFilter;
  evidenceQuality: string;
  recommendation: SourceRecommendationFilter;
  doseLink: SourceDoseLinkFilter;
};

type InteractionStatusFilter = 'all' | 'active' | 'inactive';
type InteractionSeverityFilter = 'all' | AdminInteractionSeverity;
type InteractionTypeFilter = 'all' | 'avoid' | 'caution' | 'danger';

const TAB_OPTIONS: { key: TabName; label: string }[] = [
  { key: 'overview', label: '\u00dcberblick' },
  { key: 'forms', label: 'Formen' },
  { key: 'precursors', label: 'Wirkstoffteile' },
  { key: 'dosing', label: 'Dosiswerte' },
  { key: 'research', label: 'Quellen' },
  { key: 'interactions', label: 'Wechselwirkungen' },
  { key: 'warnings', label: 'Warnungen' },
  { key: 'display', label: 'Anzeige' },
  { key: 'i18n', label: '\u00dcbersetzungen' },
];

function getTabFromSection(section: string | null): TabName {
  return TAB_OPTIONS.find((tab) => tab.key === section)?.key ?? 'overview';
}

const BASE_PROFILE = {
  effect_summary: '',
  timing: '',
  timing_note: '',
  intake_hint: '',
  card_note: '',
};

const EMPTY_STATUS_FORM: StatusFormState = {
  research_status: 'unreviewed',
  calculation_status: '',
  internal_notes: '',
  blog_url: '',
  reviewed_at: '',
  review_due_at: '',
};

const EMPTY_SOURCE_FORM: SourceFormState = {
  source_kind: 'study',
  source_title: '',
  source_url: '',
  organization: '',
  country: '',
  region: '',
  recommendation_type: '',
  population: '',
  no_recommendation: false,
  notes: '',
  dose_min: '',
  dose_max: '',
  dose_unit: '',
  per_kg_body_weight: '',
  frequency: '',
  study_type: '',
  evidence_quality: '',
  duration: '',
  outcome: '',
  finding: '',
  doi: '',
  pubmed_id: '',
  source_date: '',
  reviewed_at: '',
  evidence_grade: '',
  is_retracted: false,
  retraction_checked_at: '',
  retraction_notice_url: '',
};

const EMPTY_WARNING_FORM: WarningFormState = {
  short_label: '',
  popover_text: '',
  severity: 'info',
  article_slug: '',
  min_amount: '',
  unit: '',
  active: true,
};

const EMPTY_INTERACTION_FORM: InteractionFormState = {
  partner_type: 'ingredient',
  partner_ingredient_id: '',
  partner_label: '',
  type: 'caution',
  severity: 'medium',
  description: '',
  mechanism: '',
  source_label: '',
  source_url: '',
  active: true,
};

const EMPTY_NRV_FORM: NrvFormState = {
  population_id: '',
  organization: '',
  region: '',
  kind: 'nrv',
  value: '',
  unit: '',
  source_url: '',
  source_label: '',
  source_year: '',
  notes: '',
};

const SOURCE_KIND_OPTIONS = ['official', 'study', 'other'];
const WARNING_SEVERITY_OPTIONS = ['info', 'caution', 'danger'];
const INTERACTION_PARTNER_TYPE_OPTIONS: AdminInteractionPartnerType[] = ['ingredient', 'food', 'medication', 'condition'];
const INTERACTION_TYPE_OPTIONS = ['avoid', 'caution', 'danger'];
const INTERACTION_SEVERITY_OPTIONS: AdminInteractionSeverity[] = ['info', 'medium', 'high', 'danger'];
const EVIDENCE_GRADE_OPTIONS = ['', 'A', 'B', 'C', 'D', 'F'];
const NRV_KIND_OPTIONS: AdminNutrientReferenceValueKind[] = ['rda', 'ai', 'ear', 'ul', 'pri', 'ar', 'lti', 'ri', 'nrv'];
const ALL_SOURCE_FILTER = '__all__';
const EMPTY_SOURCE_FILTERS: SourceFilters = {
  kind: 'all',
  evidenceQuality: ALL_SOURCE_FILTER,
  recommendation: 'all',
  doseLink: 'all',
};

function getErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = response?.data && typeof response.data === 'object' ? response.data as Record<string, unknown> : null;
  const apiError = typeof data?.error === 'string' ? data.error : null;
  if (response?.status === 409) {
    const currentVersion = data?.current_version === null || data?.current_version === undefined
      ? null
      : String(data.current_version);
    return currentVersion
      ? `Konflikt: Der Datensatz wurde zwischenzeitlich ge\u00e4ndert. Aktuelle Version: ${currentVersion}. Bitte aktualisieren und erneut speichern.`
      : 'Konflikt: Der Datensatz wurde zwischenzeitlich ge\u00e4ndert. Bitte aktualisieren und erneut speichern.';
  }
  if (apiError) return apiError;
  if (error instanceof Error) return error.message;
  return 'Die Anfrage ist fehlgeschlagen.';
}

function normalizeLanguage(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toInputDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (next: number) => String(next).padStart(2, '0');
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
}

function toPayloadDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toInputDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (next: number) => String(next).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDecimalText(value?: number | null): string {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 }).format(value);
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sourceTitle(source: AdminIngredientResearchSource): string {
  return source.source_title || source.source_url || `Quelle #${source.id}`;
}

function normalizeSourceKind(value?: string | null): SourceKindFilter {
  if (value === 'official' || value === 'study') return value;
  return 'other';
}

function sourceKindLabel(value?: string | null): string {
  if (value === 'official') return 'Offizielle Quelle';
  if (value === 'study') return 'Studie';
  if (value === 'other') return 'Sonstige Quelle';
  return value || 'Sonstige Quelle';
}

function warningSeverityLabel(value?: string | null): string {
  if (value === 'info') return 'Hinweis';
  if (value === 'caution') return 'Mit Vorsicht';
  if (value === 'danger') return 'Kritisch';
  return 'Hinweis';
}

function nrvKindLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    rda: 'Empfohlene Tageszufuhr',
    ai: 'Schätzwert',
    ear: 'Durchschnittlicher Bedarf',
    ul: 'Obergrenze',
    pri: 'Referenzzufuhr',
    ar: 'Durchschnittsbedarf',
    lti: 'Unterer Grenzwert',
    ri: 'Richtwert',
    nrv: 'Nährstoff-Referenzwert',
  };
  return value ? labels[value] ?? value.toUpperCase() : 'Referenzwert';
}

function evidenceQualityTone(value?: string | null): AdminTone {
  return value?.trim() ? 'info' : 'neutral';
}

function evidenceGradeTone(value?: string | null): AdminTone {
  switch (value?.trim().toUpperCase()) {
    case 'A':
    case 'B':
      return 'ok';
    case 'C':
      return 'info';
    case 'D':
      return 'warn';
    case 'F':
      return 'danger';
    default:
      return 'neutral';
  }
}

function sourceDoseLinkLabel(count: number): string {
  return count === 1 ? '1 Dosis-Quelle' : `${count} Dosis-Quellen`;
}

function sourceToForm(source: AdminIngredientResearchSource): SourceFormState {
  return {
    source_kind: source.source_kind || 'other',
    source_title: source.source_title ?? '',
    source_url: source.source_url ?? '',
    organization: source.organization ?? '',
    country: source.country ?? '',
    region: source.region ?? '',
    recommendation_type: source.recommendation_type ?? '',
    population: source.population ?? '',
    no_recommendation: source.no_recommendation === true,
    notes: source.notes ?? '',
    dose_min: formatDecimalText(source.dose_min),
    dose_max: formatDecimalText(source.dose_max),
    dose_unit: source.dose_unit ?? '',
    per_kg_body_weight: formatDecimalText(source.per_kg_body_weight),
    frequency: source.frequency ?? '',
    study_type: source.study_type ?? '',
    evidence_quality: source.evidence_quality ?? '',
    duration: source.duration ?? '',
    outcome: source.outcome ?? '',
    finding: source.finding ?? '',
    doi: source.doi ?? '',
    pubmed_id: source.pubmed_id ?? '',
    source_date: toInputDate(source.source_date),
    reviewed_at: toInputDateTime(source.reviewed_at),
    evidence_grade: source.evidence_grade ?? '',
    is_retracted: source.is_retracted === true,
    retraction_checked_at: toInputDateTime(source.retraction_checked_at),
    retraction_notice_url: source.retraction_notice_url ?? '',
  };
}

function sourceFormToPayload(form: SourceFormState): AdminIngredientResearchSourcePayload {
  return {
    source_kind: textOrNull(form.source_kind) ?? 'other',
    source_title: textOrNull(form.source_title),
    source_url: textOrNull(form.source_url),
    organization: textOrNull(form.organization),
    country: textOrNull(form.country),
    region: textOrNull(form.region),
    recommendation_type: textOrNull(form.recommendation_type),
    population: textOrNull(form.population),
    no_recommendation: form.no_recommendation,
    notes: textOrNull(form.notes),
    dose_min: parseOptionalNumber(form.dose_min),
    dose_max: parseOptionalNumber(form.dose_max),
    dose_unit: textOrNull(form.dose_unit),
    per_kg_body_weight: parseOptionalNumber(form.per_kg_body_weight),
    frequency: textOrNull(form.frequency),
    study_type: textOrNull(form.study_type),
    evidence_quality: textOrNull(form.evidence_quality),
    duration: textOrNull(form.duration),
    outcome: textOrNull(form.outcome),
    finding: textOrNull(form.finding),
    doi: textOrNull(form.doi),
    pubmed_id: textOrNull(form.pubmed_id),
    source_date: toPayloadDate(form.source_date),
    reviewed_at: toPayloadDate(form.reviewed_at),
    evidence_grade: textOrNull(form.evidence_grade)?.toUpperCase() ?? null,
    is_retracted: form.is_retracted,
    retraction_checked_at: toPayloadDate(form.retraction_checked_at),
    retraction_notice_url: textOrNull(form.retraction_notice_url),
  };
}

function nrvToForm(value: AdminNutrientReferenceValue): NrvFormState {
  return {
    population_id: value.population_id == null ? '' : String(value.population_id),
    organization: value.organization,
    region: value.region ?? '',
    kind: value.kind || 'nrv',
    value: formatDecimalText(value.value),
    unit: value.unit,
    source_url: value.source_url ?? '',
    source_label: value.source_label ?? '',
    source_year: value.source_year == null ? '' : String(value.source_year),
    notes: value.notes ?? '',
  };
}

function nrvFormToPayload(form: NrvFormState): AdminNutrientReferenceValuePayload {
  return {
    population_id: parseOptionalNumber(form.population_id),
    organization: textOrNull(form.organization) ?? '',
    region: textOrNull(form.region),
    kind: form.kind || 'nrv',
    value: parseOptionalNumber(form.value),
    unit: textOrNull(form.unit) ?? '',
    source_url: textOrNull(form.source_url),
    source_label: textOrNull(form.source_label),
    source_year: parseOptionalNumber(form.source_year),
    notes: textOrNull(form.notes),
  };
}

function nrvLabel(value: AdminNutrientReferenceValue): string {
  const amount = value.value == null ? '-' : formatDecimalText(value.value);
  return `${value.kind.toUpperCase()} ${amount} ${value.unit}`.trim();
}

function buildPubMedNotes(lookup: AdminPubMedLookup): string {
  const lines: string[] = [];
  if (lookup.notes) lines.push(lookup.notes);
  if (lookup.journal) lines.push(`Journal: ${lookup.journal}`);
  if (lookup.authors.length > 0) lines.push(`Autoren: ${lookup.authors.join(', ')}`);
  return lines.join('\n');
}

function mergePubMedLookup(
  form: SourceFormState,
  lookup: AdminPubMedLookup,
  usedIdentifier: 'pubmed_id' | 'doi',
): SourceFormState {
  const notes = buildPubMedNotes(lookup);
  const sourceDate = lookup.source_date ? toInputDate(lookup.source_date) : '';
  return {
    ...form,
    source_kind: 'study',
    source_title: form.source_title.trim() ? form.source_title : lookup.title,
    source_url: form.source_url.trim() ? form.source_url : lookup.source_url,
    organization: form.organization.trim() ? form.organization : 'PubMed',
    notes: form.notes.trim() ? form.notes : notes,
    doi:
      usedIdentifier === 'doi' || !form.doi.trim()
        ? lookup.doi ?? form.doi
        : form.doi,
    pubmed_id:
      usedIdentifier === 'pubmed_id' || !form.pubmed_id.trim()
        ? lookup.pmid || form.pubmed_id
        : form.pubmed_id,
    source_date: sourceDate && !form.source_date.trim() ? sourceDate : form.source_date,
  };
}

function warningToForm(warning: AdminIngredientResearchWarning): WarningFormState {
  return {
    short_label: warning.short_label ?? '',
    popover_text: warning.popover_text ?? '',
    severity: warning.severity ?? 'info',
    article_slug: warning.article_slug ?? '',
    min_amount: formatDecimalText(warning.min_amount),
    unit: warning.unit ?? '',
    active: warning.active !== 0,
  };
}

function warningFormToPayload(form: WarningFormState): AdminIngredientResearchWarningPayload {
  return {
    short_label: textOrNull(form.short_label),
    popover_text: textOrNull(form.popover_text),
    severity: textOrNull(form.severity) ?? 'info',
    article_slug: textOrNull(form.article_slug),
    min_amount: parseOptionalNumber(form.min_amount),
    unit: textOrNull(form.unit),
    active: form.active,
  };
}

function doseLabel(row: AdminDoseRecommendation): string {
  const min = row.dose_min == null ? '' : `${formatDecimalText(row.dose_min)} - `;
  const max = row.dose_max == null ? '-' : formatDecimalText(row.dose_max);
  return `${min}${max} ${row.unit ?? ''}`.trim();
}

function interactionSeverityTone(severity?: string | null): AdminTone {
  if (severity === 'danger' || severity === 'high') return 'danger';
  if (severity === 'medium') return 'warn';
  if (severity === 'info') return 'info';
  return 'neutral';
}

function interactionPartnerName(interaction: AdminInteraction): string {
  if (interaction.partner_type === 'ingredient') {
    return interaction.ingredient_b_name || `Wirkstoff #${interaction.partner_ingredient_id ?? interaction.ingredient_b_id ?? '-'}`;
  }
  return interaction.partner_label || interaction.ingredient_b_name || interaction.partner_type || '-';
}

function interactionPrimaryName(interaction: AdminInteraction): string {
  return interaction.ingredient_a_name || `Wirkstoff #${interaction.ingredient_id || interaction.ingredient_a_id}`;
}

function interactionActiveLabel(interaction: AdminInteraction): string {
  return interaction.is_active === 0 || interaction.is_active === false ? 'inaktiv' : 'aktiv';
}

function interactionTypeLabel(value?: string | null): string {
  if (value === 'avoid') return 'Nicht kombinieren';
  if (value === 'caution') return 'Mit Vorsicht';
  if (value === 'danger') return 'Kritisch';
  if (value === 'all') return 'Alle Hinweise';
  return 'Sonstiger Hinweis';
}

function interactionSeverityLabel(value?: string | null): string {
  if (value === 'info') return 'Hinweis';
  if (value === 'medium') return 'Mittel';
  if (value === 'high') return 'Hoch';
  if (value === 'danger') return 'Kritisch';
  if (value === 'all') return 'Alle Schweregrade';
  return 'unbekannt';
}

function interactionPartnerTypeLabel(value?: string | null): string {
  if (value === 'ingredient') return 'Wirkstoff';
  if (value === 'food') return 'Lebensmittel';
  if (value === 'medication') return 'Medikament';
  if (value === 'condition') return 'Erkrankung';
  return value || '-';
}

function normalizeInteractionSeverity(value?: string | null): AdminInteractionSeverity {
  if (value === 'info' || value === 'medium' || value === 'high' || value === 'danger') return value;
  return 'medium';
}

function normalizeInteractionPartnerType(value?: string | null): AdminInteractionPartnerType {
  if (value === 'ingredient' || value === 'food' || value === 'medication' || value === 'condition') return value;
  return 'ingredient';
}

function interactionToForm(interaction: AdminInteraction): InteractionFormState {
  return {
    partner_type: normalizeInteractionPartnerType(interaction.partner_type),
    partner_ingredient_id: interaction.partner_ingredient_id == null ? '' : String(interaction.partner_ingredient_id),
    partner_label: interaction.partner_label ?? '',
    type: interaction.type || 'caution',
    severity: normalizeInteractionSeverity(interaction.severity),
    description: interaction.comment ?? '',
    mechanism: interaction.mechanism ?? '',
    source_label: interaction.source_label ?? '',
    source_url: interaction.source_url ?? '',
    active: interactionActiveLabel(interaction) === 'aktiv',
  };
}

function interactionFormToPayload(ingredientId: number, form: InteractionFormState): AdminInteractionPayload {
  return {
    ingredient_id: ingredientId,
    partner_type: form.partner_type,
    partner_ingredient_id: form.partner_type === 'ingredient' ? parseOptionalNumber(form.partner_ingredient_id) : null,
    partner_label: form.partner_type === 'ingredient' ? null : textOrNull(form.partner_label),
    type: textOrNull(form.type) ?? 'caution',
    severity: form.severity,
    comment: textOrNull(form.description),
    mechanism: textOrNull(form.mechanism),
    source_label: textOrNull(form.source_label),
    source_url: textOrNull(form.source_url),
    is_active: form.active ? 1 : 0,
  };
}

function buildGlobalInteractionsLink(ingredientId: number, ingredientName?: string | null): string {
  const params = new URLSearchParams({
    ingredient_id: String(ingredientId),
    q: ingredientName || String(ingredientId),
    partner_type: 'all',
    active: 'all',
  });
  return `/administrator/interactions?${params.toString()}`;
}

function dosePayloadWithSources(
  row: AdminDoseRecommendation,
  sources: AdminDoseRecommendationSourcePayload[],
): AdminDoseRecommendationPayload {
  return {
    ingredient_id: row.ingredient_id ?? null,
    population_id: row.population_id ?? null,
    population_slug: row.population_slug ?? null,
    source_type: row.source_type ?? null,
    source_label: row.source_label ?? null,
    source_url: row.source_url ?? null,
    dose_min: row.dose_min ?? null,
    dose_max: row.dose_max ?? null,
    unit: row.unit ?? null,
    per_kg_body_weight: row.per_kg_body_weight ?? null,
    per_kg_cap: row.per_kg_cap ?? null,
    timing: row.timing ?? null,
    context_note: row.context_note ?? null,
    sex_filter: row.sex_filter ?? null,
    is_athlete: row.is_athlete ?? 0,
    purpose: row.purpose ?? null,
    is_default: row.is_default ?? 0,
    is_active: row.is_active ?? 1,
    is_public: row.is_public ?? 0,
    relevance_score: row.relevance_score ?? null,
    verified_profile_id: row.verified_profile_id ?? null,
    category_name: row.category_name ?? null,
    version: row.version ?? null,
    sources,
  };
}

function statusTone(status?: string | null): AdminTone {
  switch (status?.toLowerCase()) {
    case 'reviewed':
      return 'ok';
    case 'researching':
    case 'needs_review':
    case 'stale':
      return 'warn';
    case 'blocked':
      return 'danger';
    default:
      return 'info';
  }
}

function statusLabel(status?: string | null): string {
  switch (status?.toLowerCase()) {
    case 'reviewed':
      return 'geprüft';
    case 'researching':
      return 'in Recherche';
    case 'needs_review':
      return 'prüfen';
    case 'stale':
      return 'veraltet';
    case 'blocked':
      return 'blockiert';
    case 'unreviewed':
      return 'ungeprüft';
    default:
      return status?.trim() || 'offen';
  }
}

function normalizeStatusForm(detail: AdminIngredientResearchDetail): StatusFormState {
  return {
    research_status: detail.status.research_status,
    calculation_status: detail.status.calculation_status ?? '',
    internal_notes: detail.status.internal_notes ?? '',
    blog_url: detail.status.blog_url ?? '',
    reviewed_at: toInputDateTime(detail.status.reviewed_at),
    review_due_at: toInputDateTime(detail.status.review_due_at),
  };
}

function baseDisplayProfile(profiles: AdminIngredientDisplayProfile[]): AdminIngredientDisplayProfile | null {
  return profiles.find((profile) => profile.form_id === null && profile.sub_ingredient_id === null) ?? null;
}

function formDisplayProfile(
  profiles: AdminIngredientDisplayProfile[],
  formId: number,
): AdminIngredientDisplayProfile | null {
  return profiles.find((profile) => profile.form_id === formId && profile.sub_ingredient_id === null) ?? null;
}

function profileToForm(profile: AdminIngredientDisplayProfile | null): ProfileFormState {
  return {
    effect_summary: profile?.effect_summary ?? '',
    timing: profile?.timing ?? '',
    timing_note: profile?.timing_note ?? '',
    intake_hint: profile?.intake_hint ?? '',
    card_note: profile?.card_note ?? '',
  };
}

function buildFormProfileForms(
  forms: AdminIngredientResearchForm[],
  profiles: AdminIngredientDisplayProfile[],
): Record<number, ProfileFormState> {
  return forms.reduce<Record<number, ProfileFormState>>((next, form) => {
    next[form.id] = profileToForm(formDisplayProfile(profiles, form.id));
    return next;
  }, {});
}

function formProfileName(
  profile: AdminIngredientDisplayProfile,
  forms: AdminIngredientResearchForm[],
): string {
  if (profile.form_id === null) return 'Basisprofil';
  return forms.find((form) => form.id === profile.form_id)?.name ?? `Unbekannte Form #${profile.form_id}`;
}

function buildIngredientTranslationsLink(ingredientId: number, ingredientName: string, language: string): string {
  const normalizedLanguage = normalizeLanguage(language || 'de') || 'de';
  const returnToParams = new URLSearchParams({
    section: 'i18n',
    language: normalizedLanguage,
  });
  const params = new URLSearchParams({
    entity: 'ingredients',
    language: normalizedLanguage,
    q: ingredientName,
    status: 'all',
    focus: `ingredients:${ingredientId}:${normalizedLanguage}`,
    returnTo: `/administrator/ingredients/${ingredientId}?${returnToParams.toString()}`,
  });
  return `/administrator/translations?${params.toString()}`;
}

function AdminField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric' | 'text' | 'url';
  type?: 'text' | 'url' | 'date' | 'datetime-local';
}) {
  return (
    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="admin-input mt-1"
      />
    </label>
  );
}

function DosePlausibilityNotice({ warnings }: { warnings: DosePlausibilityWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-warn-soft)] bg-[color:var(--admin-warn-soft)] px-3 py-2 text-[color:var(--admin-warn-ink)] text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">Plausibilitaets-Hinweis vor dem Speichern</p>
          <p className="mt-1 text-xs">
            Hinweis: Speichern bleibt möglich. Bitte den Wert vor der Freigabe fachlich prüfen.
          </p>
          <div className="mt-2 grid gap-1.5">
            {warnings.map((warning) => (
              <div key={warning.code} className="rounded-[var(--admin-r-sm)] bg-[color:var(--admin-bg-elev)] px-2 py-1.5">
                <p className="text-xs font-semibold">{warning.label}</p>
                <p className="text-xs">{warning.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdministratorIngredientDetailPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const ingredientId = id ? Number(id) : NaN;
  const isValidId = Number.isInteger(ingredientId) && ingredientId > 0;
  const activeTab = getTabFromSection(searchParams.get('section'));
  const i18nLanguage = normalizeLanguage(searchParams.get('language') || 'de') || 'de';

  const [detail, setDetail] = useState<AdminIngredientResearchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusForm, setStatusForm] = useState<StatusFormState>(EMPTY_STATUS_FORM);
  const [displayProfileSaving, setDisplayProfileSaving] = useState(false);
  const [displayProfileForm, setDisplayProfileForm] = useState<ProfileFormState>(BASE_PROFILE);
  const [formProfileForms, setFormProfileForms] = useState<Record<number, ProfileFormState>>({});
  const [formProfileSaving, setFormProfileSaving] = useState<number | null>(null);
  const [formProfileErrors, setFormProfileErrors] = useState<Record<number, string>>({});
  const [newSourceForm, setNewSourceForm] = useState<SourceFormState>(EMPTY_SOURCE_FORM);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [editingSourceForm, setEditingSourceForm] = useState<SourceFormState>(EMPTY_SOURCE_FORM);
  const [sourceSaving, setSourceSaving] = useState<SourceSavingKey>(null);
  const [sourceDeleting, setSourceDeleting] = useState<number | null>(null);
  const [sourceLookupLoading, setSourceLookupLoading] = useState<SourceLookupKey | null>(null);
  const [sourceLookupErrors, setSourceLookupErrors] = useState<Record<string, string>>({});
  const [newWarningForm, setNewWarningForm] = useState<WarningFormState>(EMPTY_WARNING_FORM);
  const [editingWarningId, setEditingWarningId] = useState<number | null>(null);
  const [editingWarningForm, setEditingWarningForm] = useState<WarningFormState>(EMPTY_WARNING_FORM);
  const [warningSaving, setWarningSaving] = useState<WarningSavingKey>(null);
  const [warningDeleting, setWarningDeleting] = useState<number | null>(null);
  const [doseRecommendations, setDoseRecommendations] = useState<AdminDoseRecommendation[]>([]);
  const [doseLoading, setDoseLoading] = useState(false);
  const [doseError, setDoseError] = useState('');
  const [doseLinkSelections, setDoseLinkSelections] = useState<Record<number, string>>({});
  const [doseLinkRoles, setDoseLinkRoles] = useState<Record<number, DoseLinkRole>>({});
  const [doseLinkSaving, setDoseLinkSaving] = useState<string | null>(null);
  const [doseEndpointSource, setDoseEndpointSource] = useState<'admin' | 'fallback-translations' | null>(null);
  const [sourceFilters, setSourceFilters] = useState<SourceFilters>(EMPTY_SOURCE_FILTERS);
  const [interactions, setInteractions] = useState<AdminInteraction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsError, setInteractionsError] = useState('');
  const [interactionIngredients, setInteractionIngredients] = useState<IngredientLookup[]>([]);
  const [interactionLookupError, setInteractionLookupError] = useState('');
  const [newInteractionForm, setNewInteractionForm] = useState<InteractionFormState>(EMPTY_INTERACTION_FORM);
  const [editingInteractionId, setEditingInteractionId] = useState<number | null>(null);
  const [editingInteractionForm, setEditingInteractionForm] = useState<InteractionFormState>(EMPTY_INTERACTION_FORM);
  const [interactionSaving, setInteractionSaving] = useState<'new' | number | null>(null);
  const [interactionQuery, setInteractionQuery] = useState('');
  const [interactionStatusFilter, setInteractionStatusFilter] = useState<InteractionStatusFilter>('all');
  const [interactionSeverityFilter, setInteractionSeverityFilter] = useState<InteractionSeverityFilter>('all');
  const [interactionTypeFilter, setInteractionTypeFilter] = useState<InteractionTypeFilter>('all');
  const [precursorIngredients, setPrecursorIngredients] = useState<IngredientLookup[]>([]);
  const [precursorLookupError, setPrecursorLookupError] = useState('');
  const [precursorIngredientId, setPrecursorIngredientId] = useState('');
  const [precursorSortOrder, setPrecursorSortOrder] = useState('0');
  const [precursorNote, setPrecursorNote] = useState('');
  const [precursorSaving, setPrecursorSaving] = useState(false);
  const [precursorDeleting, setPrecursorDeleting] = useState<number | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<AdminEvidenceSummary | null>(null);
  const [evidenceSummaryLoading, setEvidenceSummaryLoading] = useState(false);
  const [evidenceSummaryError, setEvidenceSummaryError] = useState('');
  const [nrvValues, setNrvValues] = useState<AdminNutrientReferenceValue[]>([]);
  const [nrvLoading, setNrvLoading] = useState(false);
  const [nrvError, setNrvError] = useState('');
  const [nrvSaving, setNrvSaving] = useState<'new' | number | null>(null);
  const [nrvDeleting, setNrvDeleting] = useState<number | null>(null);
  const [newNrvForm, setNewNrvForm] = useState<NrvFormState>(EMPTY_NRV_FORM);
  const [editingNrvId, setEditingNrvId] = useState<number | null>(null);
  const [editingNrvForm, setEditingNrvForm] = useState<NrvFormState>(EMPTY_NRV_FORM);

  const loadDetail = useCallback(async () => {
    if (!isValidId) {
      setError('Ungültige Wirkstoff-ID.');
      setLoading(false);
      setDetail(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await getIngredientResearchDetail(ingredientId);
      setDetail(next);
      setStatusForm(normalizeStatusForm(next));
      setDisplayProfileForm(profileToForm(baseDisplayProfile(next.display_profiles)));
      setFormProfileForms(buildFormProfileForms(next.forms, next.display_profiles));
      setFormProfileErrors({});
    } catch (err) {
      setError(getErrorMessage(err));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [ingredientId, isValidId]);

  const loadDoseRecommendations = useCallback(async () => {
    if (!isValidId) {
      setDoseRecommendations([]);
      return;
    }
    setDoseLoading(true);
    setDoseError('');
    try {
      const response = await getDoseRecommendations({
        ingredient_id: ingredientId,
        limit: 100,
      });
      setDoseRecommendations(response.recommendations);
      setDoseEndpointSource(response.source);
    } catch (err) {
      setDoseError(getErrorMessage(err));
      setDoseRecommendations([]);
      setDoseEndpointSource(null);
    } finally {
      setDoseLoading(false);
    }
  }, [ingredientId, isValidId]);

  const loadInteractions = useCallback(async () => {
    if (!isValidId) {
      setInteractions([]);
      return;
    }
    setInteractionsLoading(true);
    setInteractionsError('');
    try {
      const next = await getInteractions({ ingredient_id: ingredientId });
      setInteractions(next);
    } catch (err) {
      setInteractionsError(getErrorMessage(err));
      setInteractions([]);
    } finally {
      setInteractionsLoading(false);
    }
  }, [ingredientId, isValidId]);

  const loadInteractionIngredients = useCallback(async () => {
    setInteractionLookupError('');
    try {
      const next = await getAllIngredients();
      setInteractionIngredients(
        next
          .filter((entry) => Number.isFinite(entry.id) && typeof entry.name === 'string')
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
      );
    } catch (err) {
      setInteractionLookupError(getErrorMessage(err));
      setInteractionIngredients([]);
    }
  }, []);

  const loadPrecursorIngredients = useCallback(async () => {
    setPrecursorLookupError('');
    try {
      const next = await getAllIngredients();
      setPrecursorIngredients(
        next
          .filter((entry) => Number.isFinite(entry.id) && typeof entry.name === 'string' && entry.id !== ingredientId)
          .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
      );
    } catch (err) {
      setPrecursorLookupError(getErrorMessage(err));
      setPrecursorIngredients([]);
    }
  }, [ingredientId]);

  const loadEvidenceSummary = useCallback(async () => {
    if (!isValidId) {
      setEvidenceSummary(null);
      return;
    }
    setEvidenceSummaryLoading(true);
    setEvidenceSummaryError('');
    try {
      setEvidenceSummary(await getAdminEvidenceSummary(ingredientId));
    } catch (err) {
      setEvidenceSummary(null);
      setEvidenceSummaryError(getErrorMessage(err));
    } finally {
      setEvidenceSummaryLoading(false);
    }
  }, [ingredientId, isValidId]);

  const loadNrvValues = useCallback(async () => {
    if (!isValidId) {
      setNrvValues([]);
      return;
    }
    setNrvLoading(true);
    setNrvError('');
    try {
      setNrvValues(await getAdminNutrientReferenceValues(ingredientId));
    } catch (err) {
      setNrvValues([]);
      setNrvError(getErrorMessage(err));
    } finally {
      setNrvLoading(false);
    }
  }, [ingredientId, isValidId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    void loadDoseRecommendations();
  }, [loadDoseRecommendations]);

  useEffect(() => {
    void loadEvidenceSummary();
  }, [loadEvidenceSummary]);

  useEffect(() => {
    void loadNrvValues();
  }, [loadNrvValues]);

  useEffect(() => {
    if (activeTab === 'interactions') {
      void loadInteractions();
      void loadInteractionIngredients();
    }
  }, [activeTab, loadInteractionIngredients, loadInteractions]);

  useEffect(() => {
    if (activeTab === 'precursors') {
      void loadPrecursorIngredients();
    }
  }, [activeTab, loadPrecursorIngredients]);

  useEffect(() => {
    if (activeTab === 'display') {
      setMessage('');
      setError('');
    }
  }, [activeTab]);

  const handleTabChange = (tab: TabName) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('section', tab);
    setSearchParams(nextSearchParams);
  };

  const sourceDoseLinkCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const recommendation of doseRecommendations) {
      for (const linkedSource of recommendation.sources ?? []) {
        const current = counts.get(linkedSource.research_source_id) ?? 0;
        counts.set(linkedSource.research_source_id, current + 1);
      }
    }
    return counts;
  }, [doseRecommendations]);

  const evidenceQualityOptions = useMemo(() => {
    const qualities = new Set<string>();
    for (const source of detail?.sources ?? []) {
      const value = source.evidence_quality?.trim();
      if (value) qualities.add(value);
    }
    return Array.from(qualities).sort((left, right) => left.localeCompare(right, 'de'));
  }, [detail?.sources]);

  const sourceCount = useMemo(() => {
    const sources = detail?.sources ?? [];
    return {
      all: sources.length,
      official: sources.filter((source) => normalizeSourceKind(source.source_kind) === 'official').length,
      study: sources.filter((source) => normalizeSourceKind(source.source_kind) === 'study').length,
      other: sources.filter((source) => normalizeSourceKind(source.source_kind) === 'other').length,
      noRecommendation: sources.filter((source) => source.no_recommendation === true).length,
      retracted: sources.filter((source) => source.is_retracted === true).length,
      linked: sources.filter((source) => (sourceDoseLinkCounts.get(source.id) ?? 0) > 0).length,
      unlinked: sources.filter((source) => (sourceDoseLinkCounts.get(source.id) ?? 0) === 0).length,
    };
  }, [detail?.sources, sourceDoseLinkCounts]);

  const filteredSources = useMemo(() => {
    const sources = detail?.sources ?? [];
    return sources.filter((source) => {
      if (sourceFilters.kind !== 'all' && normalizeSourceKind(source.source_kind) !== sourceFilters.kind) return false;
      if (
        sourceFilters.evidenceQuality !== ALL_SOURCE_FILTER &&
        (source.evidence_quality?.trim() || '') !== sourceFilters.evidenceQuality
      ) {
        return false;
      }
      if (sourceFilters.recommendation === 'no_recommendation' && source.no_recommendation !== true) return false;
      if (sourceFilters.recommendation === 'with_recommendation' && source.no_recommendation === true) return false;
      const linkedCount = sourceDoseLinkCounts.get(source.id) ?? 0;
      if (sourceFilters.doseLink === 'linked' && linkedCount === 0) return false;
      if (sourceFilters.doseLink === 'unlinked' && linkedCount > 0) return false;
      return true;
    });
  }, [detail?.sources, sourceDoseLinkCounts, sourceFilters]);

  const interactionIngredientOptions = useMemo(
    () => interactionIngredients.filter((entry) => entry.id !== ingredientId),
    [ingredientId, interactionIngredients],
  );

  const interactionCount = useMemo(() => ({
    all: interactions.length,
    active: interactions.filter((interaction) => interactionActiveLabel(interaction) === 'aktiv').length,
    inactive: interactions.filter((interaction) => interactionActiveLabel(interaction) !== 'aktiv').length,
    ingredientPairs: interactions.filter((interaction) => interaction.partner_type === 'ingredient').length,
  }), [interactions]);

  const filteredInteractions = useMemo(() => {
    const query = interactionQuery.trim().toLowerCase();
    return interactions.filter((interaction) => {
      if (interactionStatusFilter === 'active' && interactionActiveLabel(interaction) !== 'aktiv') return false;
      if (interactionStatusFilter === 'inactive' && interactionActiveLabel(interaction) === 'aktiv') return false;
      if (interactionSeverityFilter !== 'all' && interaction.severity !== interactionSeverityFilter) return false;
      if (interactionTypeFilter !== 'all' && interaction.type !== interactionTypeFilter) return false;
      if (!query) return true;
      const haystack = [
        interactionPrimaryName(interaction),
        interactionPartnerName(interaction),
        interaction.partner_type,
        interaction.type,
        interaction.severity,
        interaction.source_label,
        interaction.source_url,
        interaction.mechanism,
        interaction.comment,
      ]
        .filter((entry): entry is string => typeof entry === 'string')
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [interactionQuery, interactionSeverityFilter, interactionStatusFilter, interactionTypeFilter, interactions]);

  const warningCount = useMemo(() => {
    const warnings = detail?.warnings ?? [];
    return {
      all: warnings.length,
      active: warnings.filter((warning) => warning.active === 1).length,
      caution: warnings.filter((warning) => warning.severity === 'caution').length,
      danger: warnings.filter((warning) => warning.severity === 'danger').length,
    };
  }, [detail?.warnings]);

  const resetNewInteractionForm = () => {
    setNewInteractionForm(EMPTY_INTERACTION_FORM);
  };

  const validateInteractionForm = (form: InteractionFormState, baseIngredientId: number): string | null => {
    if (form.partner_type === 'ingredient') {
      const partnerId = parseOptionalNumber(form.partner_ingredient_id);
      if (!partnerId || partnerId <= 0) return 'Partner-Wirkstoff fehlt.';
      if (partnerId === baseIngredientId) return 'Ausgangs- und Partner-Wirkstoff m\u00fcssen verschieden sein.';
    } else if (!form.partner_label.trim()) {
      return 'Partner-Text fehlt.';
    }

    if (!form.type.trim()) return 'Type fehlt.';
    if (!form.severity) return 'Schweregrad fehlt.';
    return null;
  };

  const handleCreateInteraction = async () => {
    const validationError = validateInteractionForm(newInteractionForm, ingredientId);
    if (validationError) {
      setInteractionsError(validationError);
      return;
    }

    setInteractionSaving('new');
    setInteractionsError('');
    try {
      await upsertAdminInteraction(interactionFormToPayload(ingredientId, newInteractionForm));
      resetNewInteractionForm();
      await loadInteractions();
      setMessage('Interaktion gespeichert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setInteractionsError(getErrorMessage(err));
    } finally {
      setInteractionSaving(null);
    }
  };

  const startEditingInteraction = (interaction: AdminInteraction) => {
    setEditingInteractionId(interaction.id);
    setEditingInteractionForm(interactionToForm(interaction));
    setInteractionsError('');
  };

  const handleUpdateInteraction = async () => {
    if (editingInteractionId === null) return;
    const interaction = interactions.find((entry) => entry.id === editingInteractionId);
    if (!interaction) return;

    setInteractionSaving(editingInteractionId);
    setInteractionsError('');
    try {
      await upsertAdminInteraction({
        id: interaction.id,
        ingredient_id: interaction.ingredient_id,
        partner_type: interaction.partner_type,
        partner_ingredient_id: interaction.partner_ingredient_id,
        partner_label: interaction.partner_label,
        type: textOrNull(editingInteractionForm.type) ?? interaction.type ?? 'caution',
        severity: editingInteractionForm.severity,
        comment: textOrNull(editingInteractionForm.description),
        mechanism: textOrNull(editingInteractionForm.mechanism),
        source_label: textOrNull(editingInteractionForm.source_label),
        source_url: textOrNull(editingInteractionForm.source_url),
        is_active: editingInteractionForm.active ? 1 : 0,
        version: interaction.version ?? null,
      });
      setEditingInteractionId(null);
      setEditingInteractionForm(EMPTY_INTERACTION_FORM);
      await loadInteractions();
      setMessage('Interaktion aktualisiert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setInteractionsError(getErrorMessage(err));
    } finally {
      setInteractionSaving(null);
    }
  };

  const handleSaveStatus = async () => {
    if (!detail) return;
    setStatusSaving(true);
    setError('');
    try {
      const payload: AdminIngredientResearchStatusPayload = {
        research_status: statusForm.research_status || null,
        calculation_status: statusForm.calculation_status || null,
        internal_notes: statusForm.internal_notes || null,
        blog_url: statusForm.blog_url || null,
        reviewed_at: toPayloadDate(statusForm.reviewed_at),
        review_due_at: toPayloadDate(statusForm.review_due_at),
        version: detail.status.version,
      };
      const nextStatus = await updateIngredientResearchStatus(ingredientId, payload);
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              status: {
                research_status: nextStatus.research_status,
                calculation_status: nextStatus.calculation_status,
                internal_notes: nextStatus.internal_notes,
                blog_url: nextStatus.blog_url,
                reviewed_at: nextStatus.reviewed_at,
                review_due_at: nextStatus.review_due_at,
                version: nextStatus.version,
                raw: nextStatus.raw,
              },
            }
          : previous,
      );
      setMessage('Recherche-Status gespeichert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleSaveDisplayProfile = async () => {
    if (!detail) return;
    const existingProfile = baseDisplayProfile(detail.display_profiles);
    setDisplayProfileSaving(true);
    setError('');
    try {
      const next = await upsertIngredientDisplayProfile(ingredientId, {
        form_id: null,
        sub_ingredient_id: null,
        effect_summary: displayProfileForm.effect_summary.trim() || null,
        timing: displayProfileForm.timing.trim() || null,
        timing_note: displayProfileForm.timing_note.trim() || null,
        intake_hint: displayProfileForm.intake_hint.trim() || null,
        card_note: displayProfileForm.card_note.trim() || null,
        version: existingProfile?.version ?? null,
      });
      setDetail((previous) => {
        if (!previous) return previous;
        const filtered = previous.display_profiles.filter((profile) => !(profile.form_id === null && profile.sub_ingredient_id === null));
        return { ...previous, display_profiles: [next, ...filtered] };
      });
      setMessage('Basis-Profil gespeichert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDisplayProfileSaving(false);
    }
  };

  const updateFormProfileForm = (
    formId: number,
    field: keyof ProfileFormState,
    value: string,
  ) => {
    setFormProfileForms((previous) => ({
      ...previous,
      [formId]: {
        ...(previous[formId] ?? BASE_PROFILE),
        [field]: value,
      },
    }));
  };

  const handleSaveFormDisplayProfile = async (form: AdminIngredientResearchForm) => {
    if (!detail) return;
    const formState = formProfileForms[form.id] ?? BASE_PROFILE;
    const existingProfile = formDisplayProfile(detail.display_profiles, form.id);
    setFormProfileSaving(form.id);
    setError('');
    setFormProfileErrors((previous) => {
      const next = { ...previous };
      delete next[form.id];
      return next;
    });
    try {
      const next = await upsertIngredientDisplayProfile(ingredientId, {
        form_id: form.id,
        sub_ingredient_id: null,
        effect_summary: formState.effect_summary.trim() || null,
        timing: formState.timing.trim() || null,
        timing_note: formState.timing_note.trim() || null,
        intake_hint: formState.intake_hint.trim() || null,
        card_note: formState.card_note.trim() || null,
        version: existingProfile?.version ?? null,
      });
      setDetail((previous) => {
        if (!previous) return previous;
        const filtered = previous.display_profiles.filter(
          (profile) => !(profile.form_id === form.id && profile.sub_ingredient_id === null),
        );
        return { ...previous, display_profiles: [next, ...filtered] };
      });
      setFormProfileForms((previous) => ({
        ...previous,
        [form.id]: profileToForm(next),
      }));
      setMessage(`Form-Profil "${form.name}" gespeichert.`);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setFormProfileErrors((previous) => ({
        ...previous,
        [form.id]: getErrorMessage(err),
      }));
    } finally {
      setFormProfileSaving(null);
    }
  };

  const sortPrecursors = (rows: AdminIngredientPrecursor[]): AdminIngredientPrecursor[] =>
    [...rows].sort((left, right) => {
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.precursor_name.localeCompare(right.precursor_name, 'de');
    });

  const handleCreatePrecursor = async () => {
    if (!detail) return;
    const selectedId = Number(precursorIngredientId);
    const sortOrder = Number(precursorSortOrder || 0);
    if (!Number.isInteger(selectedId) || selectedId <= 0) {
      setError('Bitte einen Wirkstoffteil auswahlen.');
      return;
    }
    if (selectedId === ingredientId) {
      setError('Ein Wirkstoff kann nicht sein eigener Wirkstoffteil sein.');
      return;
    }
    if (!Number.isInteger(sortOrder)) {
      setError('Sortierung muss eine ganze Zahl sein.');
      return;
    }

    setPrecursorSaving(true);
    setError('');
    try {
      const created = await createIngredientPrecursor(ingredientId, {
        precursor_ingredient_id: selectedId,
        sort_order: sortOrder,
        note: textOrNull(precursorNote),
      });
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              precursors: sortPrecursors([
                ...previous.precursors.filter((entry) => entry.precursor_ingredient_id !== created.precursor_ingredient_id),
                created,
              ]),
            }
          : previous,
      );
      setPrecursorIngredientId('');
      setPrecursorSortOrder('0');
      setPrecursorNote('');
      setMessage('Wirkstoffteil hinzugefuegt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPrecursorSaving(false);
    }
  };

  const handleDeletePrecursor = async (precursor: AdminIngredientPrecursor) => {
    if (!detail) return;
    setPrecursorDeleting(precursor.precursor_ingredient_id);
    setError('');
    try {
      await deleteIngredientPrecursor(ingredientId, precursor.precursor_ingredient_id);
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              precursors: previous.precursors.filter(
                (entry) => entry.precursor_ingredient_id !== precursor.precursor_ingredient_id,
              ),
            }
          : previous,
      );
      setMessage('Wirkstoffteil entfernt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPrecursorDeleting(null);
    }
  };

  const handleCreateSource = async () => {
    if (!detail) return;
    setSourceSaving('new');
    setError('');
    try {
      const created = await createIngredientResearchSource(ingredientId, sourceFormToPayload(newSourceForm));
      setDetail((previous) =>
        previous ? { ...previous, sources: [...previous.sources, created] } : previous,
      );
      setNewSourceForm(EMPTY_SOURCE_FORM);
      setMessage('Quelle hinzugefuegt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSourceSaving(null);
    }
  };

  const handleUpdateSource = async () => {
    if (editingSourceId === null) return;
    const existingSource = detail?.sources.find((source) => source.id === editingSourceId) ?? null;
    setSourceSaving(editingSourceId);
    setError('');
    try {
      const updated = await updateIngredientResearchSource(editingSourceId, {
        ...sourceFormToPayload(editingSourceForm),
        version: existingSource?.version ?? null,
      });
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              sources: previous.sources.map((source) => (source.id === editingSourceId ? updated : source)),
            }
          : previous,
      );
      setEditingSourceId(null);
      setEditingSourceForm(EMPTY_SOURCE_FORM);
      setMessage('Quelle gespeichert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSourceSaving(null);
    }
  };

  const handlePubMedLookup = async (
    form: SourceFormState,
    setForm: (updater: (previous: SourceFormState) => SourceFormState) => void,
    lookupKey: SourceLookupKey,
  ) => {
    const pubmedId = form.pubmed_id.trim();
    const doi = form.doi.trim();
    const usedIdentifier = pubmedId ? 'pubmed_id' : doi ? 'doi' : null;
    const errorKey = String(lookupKey);

    if (!usedIdentifier) {
      setSourceLookupErrors((previous) => ({
        ...previous,
        [errorKey]: 'Bitte zuerst eine PubMed ID oder DOI eintragen.',
      }));
      return;
    }

    setSourceLookupLoading(lookupKey);
    setSourceLookupErrors((previous) => {
      const next = { ...previous };
      delete next[errorKey];
      return next;
    });
    setError('');
    try {
      const lookup = await lookupPubMedResearchSource({
        pmid: usedIdentifier === 'pubmed_id' ? pubmedId : null,
        doi: usedIdentifier === 'doi' ? doi : null,
      });
      setForm((previous) => mergePubMedLookup(previous, lookup, usedIdentifier));
      setMessage('PubMed-Daten übernommen.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setSourceLookupErrors((previous) => ({
        ...previous,
        [errorKey]: getErrorMessage(err),
      }));
    } finally {
      setSourceLookupLoading(null);
    }
  };

  const handleDeleteSource = async (sourceId: number) => {
    if (!window.confirm('Quelle entfernen? Verknüpfte Dosis-Richtwerte können das Löschen verhindern.')) return;
    const existingSource = detail?.sources.find((source) => source.id === sourceId) ?? null;
    setSourceDeleting(sourceId);
    setError('');
    try {
      await deleteIngredientResearchSource(sourceId, { version: existingSource?.version ?? null });
      setDetail((previous) =>
        previous ? { ...previous, sources: previous.sources.filter((source) => source.id !== sourceId) } : previous,
      );
      setEditingSourceId((current) => (current === sourceId ? null : current));
      setMessage('Quelle entfernt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSourceDeleting(null);
    }
  };

  const startEditingSource = (source: AdminIngredientResearchSource) => {
    setEditingSourceId(source.id);
    setEditingSourceForm(sourceToForm(source));
  };

  const handleCreateWarning = async () => {
    if (!detail) return;
    setWarningSaving('new');
    setError('');
    try {
      const created = await createIngredientResearchWarning(ingredientId, warningFormToPayload(newWarningForm));
      setDetail((previous) =>
        previous ? { ...previous, warnings: [...previous.warnings, created] } : previous,
      );
      setNewWarningForm(EMPTY_WARNING_FORM);
      setMessage('Warnung hinzugefuegt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWarningSaving(null);
    }
  };

  const handleUpdateWarning = async () => {
    if (editingWarningId === null) return;
    const existingWarning = detail?.warnings.find((warning) => warning.id === editingWarningId) ?? null;
    setWarningSaving(editingWarningId);
    setError('');
    try {
      const updated = await updateIngredientResearchWarning(editingWarningId, {
        ...warningFormToPayload(editingWarningForm),
        version: existingWarning?.version ?? null,
      });
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              warnings: previous.warnings.map((warning) => (warning.id === editingWarningId ? updated : warning)),
            }
          : previous,
      );
      setEditingWarningId(null);
      setEditingWarningForm(EMPTY_WARNING_FORM);
      setMessage('Warnung gespeichert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWarningSaving(null);
    }
  };

  const handleDeleteWarning = async (warningId: number) => {
    if (!window.confirm('Warnung deaktivieren?')) return;
    const existingWarning = detail?.warnings.find((warning) => warning.id === warningId) ?? null;
    setWarningDeleting(warningId);
    setError('');
    try {
      await deleteIngredientResearchWarning(warningId, { version: existingWarning?.version ?? null });
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              warnings: previous.warnings.map((warning) =>
                warning.id === warningId ? { ...warning, active: 0 } : warning,
              ),
            }
          : previous,
      );
      setEditingWarningId((current) => (current === warningId ? null : current));
      setMessage('Warnung deaktiviert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWarningDeleting(null);
    }
  };

  const startEditingWarning = (warning: AdminIngredientResearchWarning) => {
    setEditingWarningId(warning.id);
    setEditingWarningForm(warningToForm(warning));
  };

  const handleCreateNrv = async () => {
    if (!detail) return;
    const payload = nrvFormToPayload(newNrvForm);
    if (!payload.organization || payload.value == null || !payload.unit || !payload.kind) {
      setNrvError('Organisation, Wert, Einheit und Kind sind erforderlich.');
      return;
    }
    setNrvSaving('new');
    setNrvError('');
    try {
      const created = await createAdminNutrientReferenceValue(ingredientId, payload);
      setNrvValues((previous) => [created, ...previous]);
      setNewNrvForm(EMPTY_NRV_FORM);
      setMessage('NRV angelegt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setNrvError(getErrorMessage(err));
    } finally {
      setNrvSaving(null);
    }
  };

  const handleUpdateNrv = async () => {
    if (editingNrvId === null) return;
    const existing = nrvValues.find((entry) => entry.id === editingNrvId);
    const payload = nrvFormToPayload(editingNrvForm);
    if (!payload.organization || payload.value == null || !payload.unit || !payload.kind) {
      setNrvError('Organisation, Wert, Einheit und Kind sind erforderlich.');
      return;
    }
    setNrvSaving(editingNrvId);
    setNrvError('');
    try {
      const updated = await updateAdminNutrientReferenceValue(editingNrvId, payload, { version: existing?.version ?? null });
      setNrvValues((previous) => previous.map((entry) => (entry.id === editingNrvId ? updated : entry)));
      setEditingNrvId(null);
      setEditingNrvForm(EMPTY_NRV_FORM);
      setMessage('NRV gespeichert.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setNrvError(getErrorMessage(err));
    } finally {
      setNrvSaving(null);
    }
  };

  const handleDeleteNrv = async (valueId: number) => {
    if (!window.confirm('Nutrient Reference Value entfernen?')) return;
    const existing = nrvValues.find((entry) => entry.id === valueId);
    setNrvDeleting(valueId);
    setNrvError('');
    try {
      await deleteAdminNutrientReferenceValue(valueId, { version: existing?.version ?? null });
      setNrvValues((previous) => previous.filter((entry) => entry.id !== valueId));
      if (editingNrvId === valueId) {
        setEditingNrvId(null);
        setEditingNrvForm(EMPTY_NRV_FORM);
      }
      setMessage('NRV entfernt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setNrvError(getErrorMessage(err));
    } finally {
      setNrvDeleting(null);
    }
  };

  const startEditingNrv = (value: AdminNutrientReferenceValue) => {
    setEditingNrvId(value.id);
    setEditingNrvForm(nrvToForm(value));
  };

  const handleLinkDoseSource = async (recommendation: AdminDoseRecommendation) => {
    const selectedSourceId = Number(doseLinkSelections[recommendation.id] ?? '');
    if (!Number.isInteger(selectedSourceId) || selectedSourceId <= 0) {
      setDoseError('Bitte zuerst eine Quelle für den Richtwert auswählen.');
      return;
    }
    if (doseEndpointSource !== 'admin') {
      setDoseError('Dieser Dosis-Datensatz kommt aus dem Lesemodus und kann hier nicht verkn\u00fcpft werden.');
      return;
    }

    const role = doseLinkRoles[recommendation.id] ?? 'secondary';
    const isPrimary = role === 'primary';
    const nextSources: AdminDoseRecommendationSourcePayload[] = [];
    let existingWasUpdated = false;

    (recommendation.sources ?? []).forEach((source) => {
      if (source.research_source_id === selectedSourceId) {
        existingWasUpdated = true;
        nextSources.push({
          research_source_id: source.research_source_id,
          relevance_weight: source.relevance_weight ?? 50,
          is_primary: isPrimary,
          note: source.note ?? null,
        });
        return;
      }
      nextSources.push({
        research_source_id: source.research_source_id,
        relevance_weight: source.relevance_weight ?? 50,
        is_primary: isPrimary ? false : source.is_primary === 1,
        note: source.note ?? null,
      });
    });

    if (!existingWasUpdated) {
      nextSources.push({
        research_source_id: selectedSourceId,
        relevance_weight: isPrimary ? 100 : 50,
        is_primary: isPrimary,
        note: null,
      });
    }

    setDoseLinkSaving(`${recommendation.id}:${selectedSourceId}`);
    setDoseError('');
    try {
      const updated = await updateDoseRecommendation(
        recommendation.id,
        dosePayloadWithSources(recommendation, nextSources),
      );
      setDoseRecommendations((previous) =>
        previous.map((entry) => (entry.id === recommendation.id ? { ...entry, ...updated } : entry)),
      );
      setMessage('Quelle mit Dosis-Richtwert verkn\u00fcpft.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setDoseError(getErrorMessage(err));
    } finally {
      setDoseLinkSaving(null);
    }
  };

  const handleUnlinkDoseSource = async (
    recommendation: AdminDoseRecommendation,
    researchSourceId: number,
  ) => {
    if (doseEndpointSource !== 'admin') {
      setDoseError('Dieser Dosis-Datensatz kommt aus dem Lesemodus und kann hier nicht bearbeitet werden.');
      return;
    }
    const nextSources = (recommendation.sources ?? [])
      .filter((source) => source.research_source_id !== researchSourceId)
      .map((source) => ({
        research_source_id: source.research_source_id,
        relevance_weight: source.relevance_weight ?? 50,
        is_primary: source.is_primary === 1,
        note: source.note ?? null,
      }));

    setDoseLinkSaving(`${recommendation.id}:unlink:${researchSourceId}`);
    setDoseError('');
    try {
      const updated = await updateDoseRecommendation(
        recommendation.id,
        dosePayloadWithSources(recommendation, nextSources),
      );
      setDoseRecommendations((previous) =>
        previous.map((entry) => (entry.id === recommendation.id ? { ...entry, ...updated } : entry)),
      );
      setMessage('Quellen-Link entfernt.');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setDoseError(getErrorMessage(err));
    } finally {
      setDoseLinkSaving(null);
    }
  };

  const renderSourceForm = (
    form: SourceFormState,
    setForm: (updater: (previous: SourceFormState) => SourceFormState) => void,
    lookupKey: SourceLookupKey,
    action: ReactNode,
  ) => {
    const isLookupLoading = sourceLookupLoading === lookupKey;
    const lookupError = sourceLookupErrors[String(lookupKey)];
    const plausibilityWarnings = getDosePlausibilityWarnings({
      ingredientName: detail?.ingredient.name ?? '',
      doseMin: parseOptionalNumber(form.dose_min),
      doseMax: parseOptionalNumber(form.dose_max),
      unit: form.dose_unit,
      perKgBodyWeight: parseOptionalNumber(form.per_kg_body_weight),
    });
    return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Quellenart
        <select
          value={form.source_kind}
          onChange={(event) => setForm((previous) => ({ ...previous, source_kind: event.target.value }))}
          className="admin-select mt-1"
        >
          {SOURCE_KIND_OPTIONS.map((option) => (
            <option key={option} value={option}>{sourceKindLabel(option)}</option>
          ))}
        </select>
      </label>
      <AdminField label="Titel" value={form.source_title} onChange={(value) => setForm((previous) => ({ ...previous, source_title: value }))} />
      <AdminField label="URL" value={form.source_url} onChange={(value) => setForm((previous) => ({ ...previous, source_url: value }))} inputMode="url" type="url" />
      <AdminField label="Organisation" value={form.organization} onChange={(value) => setForm((previous) => ({ ...previous, organization: value }))} />
      <AdminField label="Land" value={form.country} onChange={(value) => setForm((previous) => ({ ...previous, country: value }))} />
      <AdminField label="Region" value={form.region} onChange={(value) => setForm((previous) => ({ ...previous, region: value }))} />
      <AdminField label="Population" value={form.population} onChange={(value) => setForm((previous) => ({ ...previous, population: value }))} />
      <AdminField label="Empfehlungsart" value={form.recommendation_type} onChange={(value) => setForm((previous) => ({ ...previous, recommendation_type: value }))} />
      <AdminField label="Mindestdosis" value={form.dose_min} onChange={(value) => setForm((previous) => ({ ...previous, dose_min: value }))} inputMode="decimal" />
      <AdminField label="Höchstdosis" value={form.dose_max} onChange={(value) => setForm((previous) => ({ ...previous, dose_max: value }))} inputMode="decimal" />
      <AdminField label="Dosis-Einheit" value={form.dose_unit} onChange={(value) => setForm((previous) => ({ ...previous, dose_unit: value }))} />
      <AdminField label="Pro kg Körpergewicht" value={form.per_kg_body_weight} onChange={(value) => setForm((previous) => ({ ...previous, per_kg_body_weight: value }))} inputMode="decimal" />
      <div className="md:col-span-2">
        <DosePlausibilityNotice warnings={plausibilityWarnings} />
      </div>
      <AdminField label="Frequenz" value={form.frequency} onChange={(value) => setForm((previous) => ({ ...previous, frequency: value }))} />
      <AdminField label="Studientyp" value={form.study_type} onChange={(value) => setForm((previous) => ({ ...previous, study_type: value }))} />
      <AdminField label="Quellenqualität" value={form.evidence_quality} onChange={(value) => setForm((previous) => ({ ...previous, evidence_quality: value }))} />
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Bewertungsstufe
        <select
          value={form.evidence_grade}
          onChange={(event) => setForm((previous) => ({ ...previous, evidence_grade: event.target.value }))}
          className="admin-select mt-1"
        >
          {EVIDENCE_GRADE_OPTIONS.map((option) => (
            <option key={option || 'nicht gesetzt'} value={option}>
              {option || 'keine Stufe'}
            </option>
          ))}
        </select>
      </label>
      <AdminField label="Dauer" value={form.duration} onChange={(value) => setForm((previous) => ({ ...previous, duration: value }))} />
      <div className="grid gap-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <AdminField label="DOI" value={form.doi} onChange={(value) => setForm((previous) => ({ ...previous, doi: value }))} />
        <AdminField label="PubMed ID" value={form.pubmed_id} onChange={(value) => setForm((previous) => ({ ...previous, pubmed_id: value }))} />
        <AdminButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void handlePubMedLookup(form, setForm, lookupKey)}
          disabled={sourceLookupLoading !== null}
        >
          {isLookupLoading ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
          PubMed holen
        </AdminButton>
        {lookupError ? (
          <p className="text-xs text-[color:var(--admin-danger-ink)] md:col-span-3">{lookupError}</p>
        ) : null}
      </div>
      <AdminField label="Quellen-Datum" value={form.source_date} onChange={(value) => setForm((previous) => ({ ...previous, source_date: value }))} type="date" />
      <AdminField label="Prüfdatum" value={form.reviewed_at} onChange={(value) => setForm((previous) => ({ ...previous, reviewed_at: value }))} type="datetime-local" />
      <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        <input
          type="checkbox"
          checked={form.is_retracted}
          onChange={(event) => setForm((previous) => ({ ...previous, is_retracted: event.target.checked }))}
          className="h-4 w-4"
        />
        Quelle wurde zurückgezogen
      </label>
      <AdminField
        label="Rückzug geprüft"
        value={form.retraction_checked_at}
        onChange={(value) => setForm((previous) => ({ ...previous, retraction_checked_at: value }))}
        type="datetime-local"
      />
      <AdminField
        label="Link zum Rückzugshinweis"
        value={form.retraction_notice_url}
        onChange={(value) => setForm((previous) => ({ ...previous, retraction_notice_url: value }))}
        inputMode="url"
        type="url"
      />
      <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        <input
          type="checkbox"
          checked={form.no_recommendation}
          onChange={(event) => setForm((previous) => ({ ...previous, no_recommendation: event.target.checked }))}
          className="h-4 w-4"
        />
        Keine Empfehlung aus dieser Quelle
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        Ergebnis
        <textarea
          value={form.finding}
          onChange={(event) => setForm((previous) => ({ ...previous, finding: event.target.value }))}
          rows={2}
          className="admin-input mt-1 min-h-[72px]"
        />
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        Studienziel / Messwert
        <textarea
          value={form.outcome}
          onChange={(event) => setForm((previous) => ({ ...previous, outcome: event.target.value }))}
          rows={2}
          className="admin-input mt-1 min-h-[72px]"
        />
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        Notizen
        <textarea
          value={form.notes}
          onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
          rows={3}
          className="admin-input mt-1 min-h-[84px]"
        />
      </label>
      <div className="md:col-span-2">{action}</div>
    </div>
    );
  };

  const renderWarningForm = (
    form: WarningFormState,
    setForm: (updater: (previous: WarningFormState) => WarningFormState) => void,
    action: ReactNode,
  ) => (
    <div className="grid gap-3 md:grid-cols-2">
      <AdminField label="Label" value={form.short_label} onChange={(value) => setForm((previous) => ({ ...previous, short_label: value }))} />
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Schweregrad
        <select
          value={form.severity}
          onChange={(event) => setForm((previous) => ({ ...previous, severity: event.target.value }))}
          className="admin-select mt-1"
        >
          {WARNING_SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>{warningSeverityLabel(option)}</option>
          ))}
        </select>
      </label>
      <AdminField label="Artikel-Slug" value={form.article_slug} onChange={(value) => setForm((previous) => ({ ...previous, article_slug: value }))} />
      <AdminField label="Mindestmenge" value={form.min_amount} onChange={(value) => setForm((previous) => ({ ...previous, min_amount: value }))} inputMode="decimal" />
      <AdminField label="Einheit" value={form.unit} onChange={(value) => setForm((previous) => ({ ...previous, unit: value }))} />
      <label className="flex items-center gap-2 text-xs font-medium text-[color:var(--admin-ink-2)]">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => setForm((previous) => ({ ...previous, active: event.target.checked }))}
          className="h-4 w-4"
        />
        Aktiv
      </label>
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        Hinweistext
        <textarea
          value={form.popover_text}
          onChange={(event) => setForm((previous) => ({ ...previous, popover_text: event.target.value }))}
          rows={3}
          className="admin-input mt-1 min-h-[84px]"
        />
      </label>
      <div className="md:col-span-2">{action}</div>
    </div>
  );

  const renderNrvForm = (
    form: NrvFormState,
    setForm: (updater: (previous: NrvFormState) => NrvFormState) => void,
    action: ReactNode,
  ) => (
    <div className="grid gap-3 md:grid-cols-2">
      <AdminField
        label="Organisation"
        value={form.organization}
        onChange={(value) => setForm((previous) => ({ ...previous, organization: value }))}
      />
      <AdminField
        label="Region"
        value={form.region}
        onChange={(value) => setForm((previous) => ({ ...previous, region: value }))}
        placeholder="EU, DE, US..."
      />
      <AdminField
        label="Zielgruppen-ID"
        value={form.population_id}
        onChange={(value) => setForm((previous) => ({ ...previous, population_id: value }))}
        inputMode="numeric"
      />
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
        Art des Referenzwerts
        <select
          value={form.kind}
          onChange={(event) => setForm((previous) => ({ ...previous, kind: event.target.value }))}
          className="admin-select mt-1"
        >
          {NRV_KIND_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {nrvKindLabel(option)}
            </option>
          ))}
        </select>
      </label>
      <AdminField
        label="Wert"
        value={form.value}
        onChange={(value) => setForm((previous) => ({ ...previous, value }))}
        inputMode="decimal"
      />
      <AdminField
        label="Einheit"
        value={form.unit}
        onChange={(value) => setForm((previous) => ({ ...previous, unit: value }))}
      />
      <AdminField
        label="Quellenname"
        value={form.source_label}
        onChange={(value) => setForm((previous) => ({ ...previous, source_label: value }))}
      />
      <AdminField
        label="Quellenjahr"
        value={form.source_year}
        onChange={(value) => setForm((previous) => ({ ...previous, source_year: value }))}
        inputMode="numeric"
      />
      <AdminField
        label="Quellen-Link"
        value={form.source_url}
        onChange={(value) => setForm((previous) => ({ ...previous, source_url: value }))}
        inputMode="url"
        type="url"
      />
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
        Notizen
        <textarea
          value={form.notes}
          onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
          rows={3}
          className="admin-input mt-1 min-h-[84px]"
        />
      </label>
      <div className="md:col-span-2">{action}</div>
    </div>
  );

  const renderOverviewTab = (detailData: AdminIngredientResearchDetail) => (
    <div className="grid gap-4 xl:grid-cols-2">
      <AdminCard title="Grunddaten" subtitle="Wirkstoff-Kerninformationen.">
        <dl className="grid gap-2 text-[13px]">
          <div>
            <dt className="admin-muted">Name</dt>
            <dd className="font-medium text-[15px]">{detailData.ingredient.name}</dd>
          </div>
          <div>
            <dt className="admin-muted">ID</dt>
            <dd className="admin-mono">{detailData.ingredient.id}</dd>
          </div>
          <div>
            <dt className="admin-muted">Kategorie</dt>
            <dd>{detailData.ingredient.category || 'ohne Kategorie'}</dd>
          </div>
          <div>
            <dt className="admin-muted">Einheit</dt>
            <dd>{detailData.ingredient.unit || 'keine Einheit'}</dd>
          </div>
          <div className="mt-2 grid gap-2">
            <div>
              <AdminBadge tone={statusTone(detailData.status.research_status)}>{`Recherche: ${statusLabel(detailData.status.research_status)}`}</AdminBadge>
            </div>
            <div>
              <AdminBadge tone={statusTone(detailData.status.calculation_status)}>{`Berechnung: ${statusLabel(detailData.status.calculation_status)}`}</AdminBadge>
            </div>
            {detailData.status.blog_url ? (
              <a
                href={detailData.status.blog_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-[13px] text-[color:var(--admin-info-ink)] underline"
              >
                Wissensartikel öffnen
              </a>
            ) : null}
          </div>
        </dl>
      </AdminCard>

      <AdminCard title="Prüfstatus" subtitle="Letzte Prüfungen und Hinweise.">
        <dl className="grid gap-2 text-[13px]">
          <div>
            <dt className="admin-muted">Prüfdatum</dt>
            <dd>{formatDate(detailData.status.reviewed_at)}</dd>
          </div>
          <div>
            <dt className="admin-muted">Prüfung fällig am</dt>
            <dd>{formatDate(detailData.status.review_due_at)}</dd>
          </div>
          <div>
            <dt className="admin-muted">Hinweistext</dt>
            <dd className="whitespace-pre-wrap">
              {detailData.status.internal_notes || 'keine Anmerkung'}
            </dd>
          </div>
        </dl>
      </AdminCard>

      <AdminCard title="Status bearbeiten" subtitle="Status und Prüftermine für diesen Wirkstoff pflegen." className="xl:col-span-2">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Recherche-Status
            <input
              className="admin-input mt-1"
              value={statusForm.research_status}
              onChange={(event) => setStatusForm((previous) => ({ ...previous, research_status: event.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Calculation-Status
            <input
              className="admin-input mt-1"
              value={statusForm.calculation_status}
              onChange={(event) => setStatusForm((previous) => ({ ...previous, calculation_status: event.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
            Interne Notiz
            <textarea
              value={statusForm.internal_notes}
              onChange={(event) => setStatusForm((previous) => ({ ...previous, internal_notes: event.target.value }))}
              rows={3}
              className="admin-input mt-1 min-h-[90px]"
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Wissensartikel URL
            <input
              className="admin-input mt-1"
              value={statusForm.blog_url}
              onChange={(event) => setStatusForm((previous) => ({ ...previous, blog_url: event.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Prüfdatum
            <input
              type="datetime-local"
              className="admin-input mt-1"
              value={statusForm.reviewed_at}
              onChange={(event) => setStatusForm((previous) => ({ ...previous, reviewed_at: event.target.value }))}
            />
          </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Nxt Prüfdatum
            <input
              type="datetime-local"
              className="admin-input mt-1"
              value={statusForm.review_due_at}
              onChange={(event) => setStatusForm((previous) => ({ ...previous, review_due_at: event.target.value }))}
            />
          </label>
          <div className="md:col-span-2">
            <AdminButton onClick={() => void handleSaveStatus()} disabled={statusSaving}>
              <Save size={15} />
              {statusSaving ? 'Speichere...' : 'Status speichern'}
            </AdminButton>
          </div>
        </div>
      </AdminCard>
    </div>
  );

  const renderFormsTab = (forms: AdminIngredientResearchForm[]) => (
    <AdminCard title="Formen" subtitle="Übersicht der bekannten Varianten für diesen Wirkstoff.">
      {forms.length === 0 ? (
        <AdminEmpty>Noch keine Formdaten vorhanden.</AdminEmpty>
      ) : (
        <div className="grid gap-2">
          {forms.map((form) => (
            <article key={form.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
              <p className="font-medium">{form.name}</p>
              <p className="admin-muted mt-1 text-[12px]">Timing: {form.timing || '-'}</p>
              <p className="admin-muted mt-1 text-[12px]">Kommentar: {form.comment || '-'}</p>
            </article>
          ))}
        </div>
      )}
    </AdminCard>
  );

  const renderPrecursorsTab = (precursors: AdminIngredientPrecursor[]) => (
    <div className="grid gap-4">
      <AdminCard
        title="Wirkstoffteile"
        subtitle="Redaktionelle Vorstufen oder Bausteine dieses Wirkstoffs. Diese Beziehungen erweitern nicht die normale Suche."
      >
        {precursorLookupError ? <AdminError>{precursorLookupError}</AdminError> : null}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Wirkstoffteil
            <select
              className="admin-select mt-1"
              value={precursorIngredientId}
              onChange={(event) => setPrecursorIngredientId(event.target.value)}
            >
              <option value="">Bitte auswahlen</option>
              {precursorIngredients.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}{option.unit ? ` (${option.unit})` : ''} - ID {option.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Sortierung
            <input
              type="number"
              step="1"
              className="admin-input mt-1"
              value={precursorSortOrder}
              onChange={(event) => setPrecursorSortOrder(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)] md:col-span-2">
            Notiz
            <input
              className="admin-input mt-1"
              value={precursorNote}
              onChange={(event) => setPrecursorNote(event.target.value)}
              placeholder="Optionaler redaktioneller Hinweis"
            />
          </label>
          <div className="md:col-span-2">
            <AdminButton onClick={() => void handleCreatePrecursor()} disabled={precursorSaving}>
              <Plus size={14} />
              {precursorSaving ? 'Speichere...' : 'Wirkstoffteil hinzufuegen'}
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Verknuepfte Wirkstoffteile" subtitle={`${precursors.length} Eintraege`}>
        {precursors.length === 0 ? (
          <AdminEmpty>Noch keine Wirkstoffteile hinterlegt.</AdminEmpty>
        ) : (
          <div className="grid gap-2">
            {precursors.map((precursor) => (
              <article
                key={precursor.precursor_ingredient_id}
                className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium">{precursor.precursor_name}</p>
                    <p className="admin-muted mt-1 text-[12px]">
                      ID {precursor.precursor_ingredient_id}
                      {precursor.precursor_unit ? ` - ${precursor.precursor_unit}` : ''}
                      {' - '}Sortierung {precursor.sort_order}
                    </p>
                    {precursor.note ? (
                      <p className="admin-muted mt-2 text-[12px]">{precursor.note}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/administrator/ingredients/${precursor.precursor_ingredient_id}`}
                      className="admin-btn admin-btn-sm"
                    >
                      Oeffnen
                    </Link>
                    <AdminButton
                      variant="danger"
                      onClick={() => void handleDeletePrecursor(precursor)}
                      disabled={precursorDeleting === precursor.precursor_ingredient_id}
                    >
                      <Trash2 size={13} />
                      Entfernen
                    </AdminButton>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );

  const renderDosingTab = (sources: AdminIngredientResearchSource[]) => {
    const sourceById = new Map<number, AdminIngredientResearchSource>();
    sources.forEach((source) => sourceById.set(source.id, source));
    const canWriteLinks = doseEndpointSource === 'admin';

    return (
      <div className="grid gap-4">
        <AdminCard
          title="Dosis-Richtwerte"
          subtitle="Dosiswerte und verknüpfte Quellen für diesen Wirkstoff."
          actions={
            <AdminButton onClick={() => void loadDoseRecommendations()} disabled={doseLoading}>
              <RefreshCw size={14} className={doseLoading ? 'animate-spin' : ''} />
              Aktualisieren
            </AdminButton>
          }
        >
          {doseError ? <AdminError>{doseError}</AdminError> : null}
          {doseEndpointSource === 'fallback-translations' ? (
            <div className="mb-3 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-warn-soft)] bg-[color:var(--admin-warn-soft)] px-3 py-2 text-[color:var(--admin-warn-ink)] text-sm">
              Die Dosiswerte kommen aktuell aus dem Lesemodus. Quellen können hier erst verknüpft werden, wenn die Bearbeitung verfügbar ist.
            </div>
          ) : null}
          {doseLoading ? (
            <AdminEmpty>
              <Loader2 size={15} className="mr-2 inline animate-spin" />
              Lade Dosis-Richtwerte...
            </AdminEmpty>
          ) : doseRecommendations.length === 0 ? (
            <AdminEmpty>Keine Dosis-Richtwerte für diesen Wirkstoff gefunden.</AdminEmpty>
          ) : (
            <div className="grid gap-3">
              {doseRecommendations.map((recommendation) => {
                const selectedSourceId = doseLinkSelections[recommendation.id] ?? '';
                const linkRole = doseLinkRoles[recommendation.id] ?? 'secondary';
                const plausibilityWarnings = getDosePlausibilityWarnings({
                  ingredientName: recommendation.ingredient_name ?? detail?.ingredient.name ?? '',
                  doseMin: recommendation.dose_min,
                  doseMax: recommendation.dose_max,
                  unit: recommendation.unit,
                  perKgBodyWeight: recommendation.per_kg_body_weight,
                });
                return (
                  <article key={recommendation.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            #{recommendation.id} {doseLabel(recommendation)}
                          </p>
                          <AdminBadge tone={recommendation.is_active === 0 ? 'neutral' : 'ok'}>
                            {recommendation.is_active === 0 ? 'inaktiv' : 'aktiv'}
                          </AdminBadge>
                          {recommendation.is_public ? <AdminBadge tone="info">{'\u00f6ffentlich'}</AdminBadge> : null}
                        </div>
                        <p className="admin-muted mt-1 text-xs">
                          {recommendation.population_slug || 'Zielgruppe offen'} - {recommendation.purpose || 'Zweck offen'} - {recommendation.source_label || 'ohne Quellenname'}
                        </p>
                        {recommendation.context_note ? (
                          <p className="mt-2 text-xs text-[color:var(--admin-ink-2)]">{recommendation.context_note}</p>
                        ) : null}
                        <div className="mt-3">
                          <DosePlausibilityNotice warnings={plausibilityWarnings} />
                        </div>
                      </div>
                      <Link to={`/administrator/dosing`} className="admin-btn admin-btn-sm admin-btn-ghost">
                        Dosis-Editor
                      </Link>
                    </div>

                    <div className="mt-3 rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
                      <p className="text-xs font-semibold text-[color:var(--admin-ink-2)]">Verlinkte Quellen</p>
                      {recommendation.sources?.length ? (
                        <div className="mt-2 grid gap-2">
                          {recommendation.sources.map((linkedSource) => {
                            const source = sourceById.get(linkedSource.research_source_id);
                            const savingKey = `${recommendation.id}:unlink:${linkedSource.research_source_id}`;
                            return (
                              <div key={`${recommendation.id}-${linkedSource.research_source_id}`} className="flex flex-col gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg-elev)] p-2 md:flex-row md:items-center md:justify-between">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    #{linkedSource.research_source_id} {source ? sourceTitle(source) : linkedSource.source_title || 'Quelle'}
                                  </p>
                                  <p className="admin-muted text-xs">
                                    Relevanz {linkedSource.relevance_weight ?? 50}
                                    {linkedSource.is_primary ? ' - Hauptquelle' : ' - weitere Quelle'}
                                    {linkedSource.note ? ` - ${linkedSource.note}` : ''}
                                  </p>
                                </div>
                                <AdminButton
                                  variant="ghost"
                                  size="sm"
                                  disabled={!canWriteLinks || doseLinkSaving === savingKey}
                                  onClick={() => void handleUnlinkDoseSource(recommendation, linkedSource.research_source_id)}
                                >
                                  {doseLinkSaving === savingKey ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  Entfernen
                                </AdminButton>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                          <p className="admin-muted mt-2 text-xs">Noch keine Quelle verlinkt.</p>
                      )}

                      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(180px,1fr)_140px_auto]">
                        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                          Quelle
                          <select
                            value={selectedSourceId}
                            onChange={(event) =>
                              setDoseLinkSelections((previous) => ({ ...previous, [recommendation.id]: event.target.value }))
                            }
                            className="admin-select mt-1"
                            disabled={!canWriteLinks || sources.length === 0}
                          >
                            <option value="">Quelle wählen</option>
                            {sources.map((source) => (
                              <option key={source.id} value={source.id}>
                                #{source.id} {source.source_title || source.source_kind}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                          Rolle
                          <select
                            value={linkRole}
                            onChange={(event) =>
                              setDoseLinkRoles((previous) => ({ ...previous, [recommendation.id]: event.target.value as DoseLinkRole }))
                            }
                            className="admin-select mt-1"
                            disabled={!canWriteLinks}
                          >
                            <option value="secondary">Weitere Quelle</option>
                            <option value="primary">Hauptquelle</option>
                          </select>
                        </label>
                        <AdminButton
                          className="self-end"
                          disabled={!canWriteLinks || sources.length === 0 || doseLinkSaving === `${recommendation.id}:${selectedSourceId}`}
                          onClick={() => void handleLinkDoseSource(recommendation)}
                        >
                          {doseLinkSaving === `${recommendation.id}:${selectedSourceId}` ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          Verkn&uuml;pfen
                        </AdminButton>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </AdminCard>

        <AdminCard
          title="Nutrient Reference Values"
          subtitle="Offizielle Referenzwerte für diesen Wirkstoff."
          actions={
            <AdminButton onClick={() => void loadNrvValues()} disabled={nrvLoading}>
              <RefreshCw size={14} className={nrvLoading ? 'animate-spin' : ''} />
              Aktualisieren
            </AdminButton>
          }
        >
          {nrvError ? <AdminError>{nrvError}</AdminError> : null}
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)]">
            <div className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
              <h3 className="mb-3 text-sm font-semibold text-[color:var(--admin-ink)]">Neuer NRV</h3>
              {renderNrvForm(
                newNrvForm,
                setNewNrvForm,
                <AdminButton onClick={() => void handleCreateNrv()} disabled={nrvSaving !== null}>
                  {nrvSaving === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  NRV anlegen
                </AdminButton>,
              )}
            </div>

            <div className="grid gap-2">
              {nrvLoading ? (
                <AdminEmpty>
                  <Loader2 size={15} className="mr-2 inline animate-spin" />
                  Lade Referenzwerte...
                </AdminEmpty>
              ) : nrvValues.length === 0 ? (
                <AdminEmpty>Keine Nutrient Reference Values hinterlegt.</AdminEmpty>
              ) : (
                nrvValues.map((value) => {
                  const isEditing = editingNrvId === value.id;
                  return (
                    <article
                      key={value.id}
                      className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3"
                    >
                      {isEditing ? (
                        renderNrvForm(
                          editingNrvForm,
                          setEditingNrvForm,
                          <div className="flex flex-wrap gap-2">
                            <AdminButton onClick={() => void handleUpdateNrv()} disabled={nrvSaving === value.id}>
                              {nrvSaving === value.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                              Speichern
                            </AdminButton>
                            <AdminButton
                              variant="ghost"
                              onClick={() => {
                                setEditingNrvId(null);
                                setEditingNrvForm(EMPTY_NRV_FORM);
                              }}
                            >
                              <X size={15} />
                              Abbrechen
                            </AdminButton>
                          </div>,
                        )
                      ) : (
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">#{value.id} {nrvLabel(value)}</p>
                              <AdminBadge tone="info">{value.organization}</AdminBadge>
                              {value.region ? <AdminBadge>{value.region}</AdminBadge> : null}
                              {value.population_id ? <AdminBadge>Population #{value.population_id}</AdminBadge> : null}
                            </div>
                            <p className="admin-muted mt-1 text-xs">
                              {value.source_label || 'Keine Quelle'} {value.source_year ? `(${value.source_year})` : ''}
                            </p>
                            {value.notes ? <p className="mt-1 text-xs whitespace-pre-wrap">{value.notes}</p> : null}
                            {value.source_url ? (
                              <a
                                href={value.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-[13px] text-[color:var(--admin-info-ink)] underline"
                              >
                                Quelle öffnen
                                <ExternalLink size={12} />
                              </a>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <AdminButton variant="ghost" size="sm" onClick={() => startEditingNrv(value)}>
                              <Pencil size={14} />
                              Bearbeiten
                            </AdminButton>
                            <AdminButton
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDeleteNrv(value.id)}
                              disabled={nrvDeleting === value.id}
                            >
                              {nrvDeleting === value.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Entfernen
                            </AdminButton>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Quellen f&uuml;r Dosiswerte" subtitle="Diese Quellen k&ouml;nnen mit Richtwerten verkn&uuml;pft werden.">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <AdminBadge>Alle: {sourceCount.all}</AdminBadge>
            <AdminBadge>Offiziell: {sourceCount.official}</AdminBadge>
            <AdminBadge>Studie: {sourceCount.study}</AdminBadge>
            <AdminBadge>Sonstige: {sourceCount.other}</AdminBadge>
          </div>
          {sources.length === 0 ? (
            <AdminEmpty>Noch keine Quellen vorhanden.</AdminEmpty>
          ) : (
            <div className="grid gap-2">
              {sources.map((source) => (
                <article key={source.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{sourceTitle(source)}</p>
                    <AdminBadge tone="neutral">{sourceKindLabel(source.source_kind)}</AdminBadge>
                  </div>
                  <p className="admin-muted mt-1 text-xs">
                    {source.organization || '-'} {source.country ? `(${source.country})` : ''} {source.population ? ` - ${source.population}` : ''}
                  </p>
                  <p className="mt-1 text-xs">
                    Dosis: {source.dose_min == null ? '-' : formatDecimalText(source.dose_min)}
                    {source.dose_max !== null ? ` - ${formatDecimalText(source.dose_max)}` : ''}
                    {' '}
                    {source.dose_unit || ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    );
  };

  const renderResearchTab = (sources: AdminIngredientResearchSource[]) => (
    <div className="grid gap-4">
      <AdminCard
        title="Quellen-Zusammenfassung"
        subtitle="Zeigt, wie gut die Quellenlage gepflegt ist und ob zurückgezogene Studien markiert wurden."
        actions={
          <AdminButton variant="ghost" size="sm" onClick={() => void loadEvidenceSummary()} disabled={evidenceSummaryLoading}>
            <RefreshCw size={14} className={evidenceSummaryLoading ? 'animate-spin' : ''} />
            Aktualisieren
          </AdminButton>
        }
      >
        {evidenceSummaryLoading ? (
          <AdminEmpty>
            <Loader2 size={15} className="mr-2 inline animate-spin" />
              Lade Quellen-Zusammenfassung...
          </AdminEmpty>
        ) : evidenceSummary ? (
          <div className="admin-card-pad grid gap-3 md:grid-cols-[repeat(6,minmax(0,1fr))]">
            <div>
              <p className="admin-muted text-xs">Quellen</p>
              <p className="text-xl font-semibold">{evidenceSummary.total_sources}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Offiziell</p>
              <p className="text-xl font-semibold">{evidenceSummary.official_sources}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Studien</p>
              <p className="text-xl font-semibold">{evidenceSummary.study_sources}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Zur&uuml;ckgezogen</p>
              <p className="text-xl font-semibold text-[color:var(--admin-warn-ink)]">{evidenceSummary.retracted_count}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Ohne Empfehlung</p>
              <p className="text-xl font-semibold">{evidenceSummary.no_recommendation_count}</p>
            </div>
            <div>
              <p className="admin-muted text-xs">Vorschlag</p>
              <AdminBadge tone={evidenceGradeTone(evidenceSummary.suggested_grade)}>
                {evidenceSummary.suggested_grade || 'offen'}
              </AdminBadge>
            </div>
            <div className="md:col-span-6 flex flex-wrap gap-1.5">
              {Object.entries(evidenceSummary.grade_counts).length > 0 ? (
                Object.entries(evidenceSummary.grade_counts).map(([grade, count]) => (
                  <AdminBadge key={grade} tone={evidenceGradeTone(grade)}>
                    Stufe {grade}: {count}
                  </AdminBadge>
                ))
              ) : (
                <AdminBadge>Keine Stufen gez&auml;hlt</AdminBadge>
              )}
            </div>
          </div>
        ) : (
          <div className="admin-card-pad">
            <p className="admin-muted text-sm">
              Quellen-Zusammenfassung nicht verf&uuml;gbar{evidenceSummaryError ? `: ${evidenceSummaryError}` : '.'}
            </p>
          </div>
        )}
      </AdminCard>

      <AdminCard title="Neue Quelle" subtitle="Offizielle Quelle, Studie oder sonstige Referenz anlegen.">
        {renderSourceForm(
          newSourceForm,
          setNewSourceForm,
          'new',
          <AdminButton onClick={() => void handleCreateSource()} disabled={sourceSaving !== null}>
            {sourceSaving === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Quelle anlegen
          </AdminButton>,
        )}
      </AdminCard>

      <AdminCard title="Quellen" subtitle="Bestehende Quellen bearbeiten oder entfernen.">
        <div className="mb-4 grid gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <AdminBadge>Alle: {sourceCount.all}</AdminBadge>
            <AdminBadge>Offiziell: {sourceCount.official}</AdminBadge>
            <AdminBadge>Studie: {sourceCount.study}</AdminBadge>
            <AdminBadge>Sonstige: {sourceCount.other}</AdminBadge>
            <AdminBadge tone={sourceCount.noRecommendation > 0 ? 'warn' : 'neutral'}>
              Keine Empfehlung: {sourceCount.noRecommendation}
            </AdminBadge>
            <AdminBadge tone={sourceCount.retracted > 0 ? 'warn' : 'neutral'}>
              Zur&uuml;ckgezogen: {sourceCount.retracted}
            </AdminBadge>
            <AdminBadge tone={sourceCount.linked > 0 ? 'ok' : 'neutral'}>
              Verlinkt: {sourceCount.linked}
            </AdminBadge>
            <AdminBadge tone={sourceCount.unlinked > 0 ? 'warn' : 'neutral'}>
              Unverlinkt: {sourceCount.unlinked}
            </AdminBadge>
            <AdminBadge tone="info">
              Sichtbar: {filteredSources.length}
            </AdminBadge>
          </div>

          <div className="admin-toolbar">
            <div className="grid gap-2 md:grid-cols-4">
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Quellenart
                <select
                  value={sourceFilters.kind}
                  onChange={(event) =>
                    setSourceFilters((previous) => ({
                      ...previous,
                      kind: event.target.value as SourceKindFilter,
                    }))
                  }
                  className="admin-select mt-1"
                >
                  <option value="all">Alle Arten</option>
                  <option value="official">Offizielle Quellen</option>
                  <option value="study">Studien</option>
                  <option value="other">Sonstige Quellen</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Quellenqualit&auml;t
                <select
                  value={sourceFilters.evidenceQuality}
                  onChange={(event) =>
                    setSourceFilters((previous) => ({
                      ...previous,
                      evidenceQuality: event.target.value,
                    }))
                  }
                  className="admin-select mt-1"
                >
                  <option value={ALL_SOURCE_FILTER}>Alle Werte</option>
                  {evidenceQualityOptions.map((quality) => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Empfehlung
                <select
                  value={sourceFilters.recommendation}
                  onChange={(event) =>
                    setSourceFilters((previous) => ({
                      ...previous,
                      recommendation: event.target.value as SourceRecommendationFilter,
                    }))
                  }
                  className="admin-select mt-1"
                >
                  <option value="all">Alle Quellen</option>
                  <option value="with_recommendation">Mit Empfehlung</option>
                  <option value="no_recommendation">Keine Empfehlung</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                Dosis-Quelle
                <select
                  value={sourceFilters.doseLink}
                  onChange={(event) =>
                    setSourceFilters((previous) => ({
                      ...previous,
                      doseLink: event.target.value as SourceDoseLinkFilter,
                    }))
                  }
                  className="admin-select mt-1"
                >
                  <option value="all">Alle Link-Status</option>
                  <option value="linked">Mit Dosis-Quelle</option>
                  <option value="unlinked">Ohne Dosis-Quelle</option>
                </select>
              </label>
            </div>
            <div className="admin-toolbar-inline">
              <AdminButton
                variant="ghost"
                size="sm"
                onClick={() => setSourceFilters(EMPTY_SOURCE_FILTERS)}
              >
                Filter zur&uuml;cksetzen
              </AdminButton>
            </div>
          </div>
        </div>
        {sources.length === 0 ? (
          <AdminEmpty>Keine Quellen gefunden.</AdminEmpty>
        ) : filteredSources.length === 0 ? (
          <AdminEmpty>Keine Quellen f&uuml;r die aktuellen Filter gefunden.</AdminEmpty>
        ) : (
          <ul className="grid gap-3">
            {filteredSources.map((source) => {
              const isEditing = editingSourceId === source.id;
              const linkedDoseCount = sourceDoseLinkCounts.get(source.id) ?? 0;
              return (
                <li key={source.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                  {isEditing ? (
                    renderSourceForm(
                      editingSourceForm,
                      setEditingSourceForm,
                      source.id,
                      <div className="flex flex-wrap gap-2">
                        <AdminButton onClick={() => void handleUpdateSource()} disabled={sourceSaving === source.id}>
                          {sourceSaving === source.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          Speichern
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          onClick={() => {
                            setEditingSourceId(null);
                            setEditingSourceForm(EMPTY_SOURCE_FORM);
                          }}
                        >
                          <X size={15} />
                          Abbrechen
                        </AdminButton>
                      </div>,
                    )
                  ) : (
                    <div>
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{sourceTitle(source)}</p>
                            <AdminBadge tone="neutral">{sourceKindLabel(source.source_kind)}</AdminBadge>
                            <AdminBadge tone={evidenceQualityTone(source.evidence_quality)}>
                              Qualit&auml;t: {source.evidence_quality || 'nicht gesetzt'}
                            </AdminBadge>
                            <AdminBadge tone={evidenceGradeTone(source.evidence_grade)}>
                              Stufe: {source.evidence_grade || 'nicht gesetzt'}
                            </AdminBadge>
                            {source.is_retracted ? <AdminBadge tone="warn">zur&uuml;ckgezogen</AdminBadge> : null}
                            <AdminBadge tone={source.study_type ? 'info' : 'neutral'}>
                              Studie: {source.study_type || 'nicht gesetzt'}
                            </AdminBadge>
                            <AdminBadge tone={linkedDoseCount > 0 ? 'ok' : 'neutral'}>
                              {sourceDoseLinkLabel(linkedDoseCount)}
                            </AdminBadge>
                            {source.no_recommendation ? <AdminBadge tone="warn">keine Empfehlung</AdminBadge> : null}
                          </div>
                          <p className="admin-muted mt-2 text-xs">
                            {source.organization || '-'} {source.country ? `(${source.country})` : ''} {source.population ? ` - ${source.population}` : ''}
                          </p>
                          <p className="admin-muted mt-1 text-xs">Typ: {source.recommendation_type || 'nicht gesetzt'}</p>
                          <p className="admin-muted mt-1 text-xs">
                            DOI: {source.doi || '-'} | PubMed: {source.pubmed_id || '-'}
                          </p>
                          {source.is_retracted ? (
                            <p className="mt-1 rounded-[var(--admin-r-sm)] bg-[color:var(--admin-warn-soft)] px-2 py-1 text-xs text-[color:var(--admin-warn-ink)]">
                              Rückzug markiert
                              {source.retraction_checked_at ? `, geprüft ${formatDate(source.retraction_checked_at)}` : ''}
                              {source.retraction_notice_url ? ' - Hinweis hinterlegt' : ''}
                            </p>
                          ) : source.retraction_checked_at ? (
                            <p className="admin-muted mt-1 text-xs">Rückzug geprüft: {formatDate(source.retraction_checked_at)}</p>
                          ) : null}
                          <p className="mt-1 text-xs">{source.outcome || source.finding || source.notes || '-'}</p>
                          <p className="mt-1 text-xs">
                            Dosis: {source.dose_min == null ? '-' : formatDecimalText(source.dose_min)}
                            {source.dose_max !== null ? ` - ${formatDecimalText(source.dose_max)}` : ''}
                            {' '}
                            {source.dose_unit || ''}
                          </p>
                          {source.source_url ? (
                            <a
                              href={source.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[13px] text-[color:var(--admin-info-ink)] underline"
                            >
                              Quelle öffnen
                              <ExternalLink size={12} />
                            </a>
                          ) : null}
                          {source.retraction_notice_url ? (
                            <a
                              href={source.retraction_notice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-3 mt-2 inline-flex items-center gap-1 text-[13px] text-[color:var(--admin-warn-ink)] underline"
                            >
                              Rückzugs-Hinweis
                              <ExternalLink size={12} />
                            </a>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AdminButton variant="ghost" size="sm" onClick={() => startEditingSource(source)}>
                            <Pencil size={14} />
                            Bearbeiten
                          </AdminButton>
                          <AdminButton
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDeleteSource(source.id)}
                            disabled={sourceDeleting === source.id}
                          >
                            {sourceDeleting === source.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Entfernen
                          </AdminButton>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </AdminCard>
    </div>
  );

  const renderInteractionFormFields = (
    form: InteractionFormState,
    setForm: Dispatch<SetStateAction<InteractionFormState>>,
    partnerEditable: boolean,
  ) => (
    <div className="grid gap-3">
      {partnerEditable ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
            Partner-Typ
            <select
              value={form.partner_type}
              onChange={(event) => {
                const nextPartnerType = event.target.value as AdminInteractionPartnerType;
                setForm((previous) => ({
                  ...previous,
                  partner_type: nextPartnerType,
                  partner_ingredient_id: nextPartnerType === 'ingredient' ? previous.partner_ingredient_id : '',
                  partner_label: nextPartnerType === 'ingredient' ? '' : previous.partner_label,
                }));
              }}
              className="admin-select mt-1"
            >
              {INTERACTION_PARTNER_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          {form.partner_type === 'ingredient' ? (
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Partner-Wirkstoff
              <select
                value={form.partner_ingredient_id}
                onChange={(event) => setForm((previous) => ({ ...previous, partner_ingredient_id: event.target.value }))}
                className="admin-select mt-1"
              >
                <option value="">Partner auswählen</option>
                {interactionIngredientOptions.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Partner-Label
              <input
                value={form.partner_label}
                onChange={(event) => setForm((previous) => ({ ...previous, partner_label: event.target.value }))}
                className="admin-input mt-1"
                placeholder="z.B. Kaffee, Levothyroxin"
              />
            </label>
          )}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Empfehlung
          <select
            value={form.type}
            onChange={(event) => setForm((previous) => ({ ...previous, type: event.target.value }))}
            className="admin-select mt-1"
          >
            {INTERACTION_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{interactionTypeLabel(option)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Schweregrad
          <select
            value={form.severity}
            onChange={(event) => setForm((previous) => ({ ...previous, severity: event.target.value as AdminInteractionSeverity }))}
            className="admin-select mt-1"
          >
            {INTERACTION_SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{interactionSeverityLabel(option)}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm text-[color:var(--admin-ink-2)]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((previous) => ({ ...previous, active: event.target.checked }))}
            className="h-4 w-4"
          />
          Aktiv
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Beschreibung
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            className="admin-input mt-1 min-h-[82px]"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Mechanismus
          <textarea
            rows={3}
            value={form.mechanism}
            onChange={(event) => setForm((previous) => ({ ...previous, mechanism: event.target.value }))}
            className="admin-input mt-1 min-h-[82px]"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Quellenname
          <input
            value={form.source_label}
            onChange={(event) => setForm((previous) => ({ ...previous, source_label: event.target.value }))}
            className="admin-input mt-1"
          />
        </label>
        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
          Quellen-Link
          <input
            value={form.source_url}
            onChange={(event) => setForm((previous) => ({ ...previous, source_url: event.target.value }))}
            className="admin-input mt-1"
            placeholder="https://..."
          />
        </label>
      </div>
    </div>
  );

  const renderInteractionsTab = () => (
    <div className="grid gap-4">
      <AdminCard
        title="Wechselwirkungen"
        subtitle="Gefilterte Pflegeansicht für diesen Wirkstoff. Neue und geänderte Einträge werden direkt gespeichert."
        actions={
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="ghost" size="sm" onClick={() => void loadInteractions()} disabled={interactionsLoading}>
              <RefreshCw size={14} className={interactionsLoading ? 'animate-spin' : ''} />
              Aktualisieren
            </AdminButton>
            <Link
              to={buildGlobalInteractionsLink(ingredientId, detail?.ingredient.name)}
              className="admin-btn admin-btn-sm"
            >
              Global gefiltert
              <ExternalLink size={13} />
            </Link>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <AdminBadge>Alle: {interactionCount.all}</AdminBadge>
          <AdminBadge tone="ok">Aktiv: {interactionCount.active}</AdminBadge>
          <AdminBadge tone="neutral">Inaktiv: {interactionCount.inactive}</AdminBadge>
          <AdminBadge tone="info">Wirkstoff-Kombinationen: {interactionCount.ingredientPairs}</AdminBadge>
          <AdminBadge tone="neutral">Filter: {filteredInteractions.length}</AdminBadge>
        </div>
        <div className="admin-toolbar-inline items-end">
          <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
            Suche
            <input
              value={interactionQuery}
              onChange={(event) => setInteractionQuery(event.target.value)}
              className="admin-input"
              placeholder="Wirkstoff, Partner oder Beschreibung suchen"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
            Status
            <select
              value={interactionStatusFilter}
              onChange={(event) => setInteractionStatusFilter(event.target.value as InteractionStatusFilter)}
              className="admin-select"
            >
              <option value="all">Alle Status</option>
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
            Schweregrad
            <select
              value={interactionSeverityFilter}
              onChange={(event) => setInteractionSeverityFilter(event.target.value as InteractionSeverityFilter)}
              className="admin-select"
            >
              <option value="all">Alle Schweregrade</option>
              {INTERACTION_SEVERITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{interactionSeverityLabel(option)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[color:var(--admin-ink-2)]">
            Empfehlung
            <select
              value={interactionTypeFilter}
              onChange={(event) => setInteractionTypeFilter(event.target.value as InteractionTypeFilter)}
              className="admin-select"
            >
              <option value="all">Alle Hinweise</option>
              {INTERACTION_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{interactionTypeLabel(option)}</option>
              ))}
            </select>
          </label>
        </div>
      </AdminCard>

      <AdminCard title="Neue Wechselwirkung" subtitle={`Ausgangs-Wirkstoff ist ${detail?.ingredient.name ?? `#${ingredientId}`}.`}>
        {interactionLookupError ? <AdminError>{interactionLookupError}</AdminError> : null}
        {renderInteractionFormFields(newInteractionForm, setNewInteractionForm, true)}
        <div className="mt-3 flex flex-wrap gap-2">
          <AdminButton onClick={() => void handleCreateInteraction()} disabled={interactionSaving !== null}>
            {interactionSaving === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Wechselwirkung speichern
          </AdminButton>
          <AdminButton variant="ghost" onClick={resetNewInteractionForm} disabled={interactionSaving !== null}>
            <X size={15} />
            Zurücksetzen
          </AdminButton>
        </div>
      </AdminCard>

      <AdminCard title="Lokale Matrix" subtitle="Kompakte Übersicht aller gefilterten Wechselwirkungen.">
        {filteredInteractions.filter((interaction) => interaction.partner_type === 'ingredient').length === 0 ? (
          <AdminEmpty>Keine Wirkstoff-Kombinationen in der aktuellen Filterung.</AdminEmpty>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filteredInteractions
              .filter((interaction) => interaction.partner_type === 'ingredient')
              .map((interaction) => (
                <article key={interaction.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminBadge tone={interactionSeverityTone(interaction.severity)}>{interactionSeverityLabel(interaction.severity)}</AdminBadge>
                    <AdminBadge tone="neutral">{interactionTypeLabel(interaction.type)}</AdminBadge>
                    <AdminBadge tone={interactionActiveLabel(interaction) === 'aktiv' ? 'ok' : 'neutral'}>
                      {interactionActiveLabel(interaction)}
                    </AdminBadge>
                  </div>
                  <p className="mt-2 text-sm font-medium">
                    {interactionPrimaryName(interaction)} {'->'} {interactionPartnerName(interaction)}
                  </p>
                  <p className="admin-muted mt-1 line-clamp-2 text-xs">
                    {interaction.mechanism || interaction.comment || 'Keine Beschreibung hinterlegt.'}
                  </p>
                </article>
              ))}
          </div>
        )}
      </AdminCard>

        <AdminCard title="Bestehende Wechselwirkungen" subtitle="Wirkstoff und Partner bleiben beim Bearbeiten unverändert; Text, Quelle und Status können aktualisiert werden.">
        {interactionsLoading ? (
          <AdminEmpty>
            <Loader2 size={15} className="mr-2 inline animate-spin" />
            Lade Interaktionen...
          </AdminEmpty>
        ) : null}
        {interactionsError ? <AdminError>{interactionsError}</AdminError> : null}
        {!interactionsLoading && !interactionsError && interactions.length === 0 ? (
          <AdminEmpty>Keine Wechselwirkungen für diesen Wirkstoff gefunden.</AdminEmpty>
        ) : null}
        {!interactionsLoading && !interactionsError && interactions.length > 0 && filteredInteractions.length === 0 ? (
          <AdminEmpty>Keine Wechselwirkungen für die aktuelle Filterung.</AdminEmpty>
        ) : null}
        {!interactionsLoading && interactions.length > 0 && filteredInteractions.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Wirkstoff</th>
                  <th>Partner</th>
                  <th>Schweregrad / Empfehlung</th>
                  <th>Quelle / Mechanismus / Beschreibung</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredInteractions.map((interaction) => {
                  const isEditing = editingInteractionId === interaction.id;
                  return (
                    <tr key={interaction.id}>
                      {isEditing ? (
                        <td colSpan={6}>
                          <div className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <AdminBadge tone="info">Bearbeitung #{interaction.id}</AdminBadge>
                              <span className="text-sm font-medium">
                                {interactionPrimaryName(interaction)} {'->'} {interactionPartnerName(interaction)}
                              </span>
                              <span className="admin-muted text-xs">Relation gesperrt</span>
                            </div>
                            {renderInteractionFormFields(editingInteractionForm, setEditingInteractionForm, false)}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <AdminButton
                                onClick={() => void handleUpdateInteraction()}
                                disabled={interactionSaving === interaction.id}
                              >
                                {interactionSaving === interaction.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                Speichern
                              </AdminButton>
                              <AdminButton
                                variant="ghost"
                                onClick={() => {
                                  setEditingInteractionId(null);
                                  setEditingInteractionForm(EMPTY_INTERACTION_FORM);
                                }}
                              >
                                <X size={15} />
                                Abbrechen
                              </AdminButton>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td>
                            <div className="font-medium">{interactionPrimaryName(interaction)}</div>
                            <div className="admin-muted text-xs">ID {interaction.ingredient_id || interaction.ingredient_a_id}</div>
                          </td>
                          <td>
                            <div className="font-medium">{interactionPartnerName(interaction)}</div>
                            <div className="admin-muted text-xs">{interactionPartnerTypeLabel(interaction.partner_type)}</div>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              <AdminBadge tone={interactionSeverityTone(interaction.severity)}>
                                {interactionSeverityLabel(interaction.severity)}
                              </AdminBadge>
                              <AdminBadge tone="neutral">{interactionTypeLabel(interaction.type)}</AdminBadge>
                            </div>
                          </td>
                          <td className="max-w-[34rem]">
                            {interaction.source_url ? (
                              <a
                                href={interaction.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[13px] text-[color:var(--admin-info-ink)] underline"
                              >
                                {interaction.source_label || 'Quelle öffnen'}
                                <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="admin-muted text-xs">{interaction.source_label || 'Keine Quelle'}</span>
                            )}
                            <p className="mt-1 text-xs">{interaction.mechanism || 'Kein Mechanismus hinterlegt.'}</p>
                            <p className="admin-muted mt-1 text-xs">{interaction.comment || 'Keine Beschreibung hinterlegt.'}</p>
                          </td>
                          <td>
                            <AdminBadge tone={interactionActiveLabel(interaction) === 'aktiv' ? 'ok' : 'neutral'}>
                              {interactionActiveLabel(interaction)}
                            </AdminBadge>
                          </td>
                          <td>
                            <div className="flex flex-wrap justify-end gap-2">
                              <AdminButton variant="ghost" size="sm" onClick={() => startEditingInteraction(interaction)}>
                                <Pencil size={14} />
                                Bearbeiten
                              </AdminButton>
                              <Link
                                to={`/administrator/interactions?ingredient_id=${ingredientId}&interaction_id=${interaction.id}`}
                                className="admin-btn admin-btn-sm admin-btn-ghost"
                              >
                                Global
                                <ExternalLink size={12} />
                              </Link>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );

  const renderWarningsTab = (warnings: AdminIngredientResearchWarning[]) => (
    <div className="grid gap-4">
      <AdminCard title="Neue Warnung" subtitle="Hinweis für Produktkarten und passende Wissensartikel anlegen.">
        {renderWarningForm(
          newWarningForm,
          setNewWarningForm,
          <AdminButton onClick={() => void handleCreateWarning()} disabled={warningSaving !== null}>
            {warningSaving === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Warnung anlegen
          </AdminButton>,
        )}
      </AdminCard>

      <AdminCard title="Warnungen" subtitle="Bestehende Sicherheitswarnungen bearbeiten oder deaktivieren.">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <AdminBadge>Alle: {warningCount.all}</AdminBadge>
          <AdminBadge tone="warn">Mit Vorsicht: {warningCount.caution}</AdminBadge>
          <AdminBadge tone="danger">Kritisch: {warningCount.danger}</AdminBadge>
          <AdminBadge tone="ok">Aktiv: {warningCount.active}</AdminBadge>
        </div>
        {warnings.length === 0 ? (
          <AdminEmpty>Keine Warnhinweise vorhanden.</AdminEmpty>
        ) : (
          <div className="grid gap-2">
            {warnings.map((warning) => {
              const isEditing = editingWarningId === warning.id;
              return (
                <article key={warning.id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                  {isEditing ? (
                    renderWarningForm(
                      editingWarningForm,
                      setEditingWarningForm,
                      <div className="flex flex-wrap gap-2">
                        <AdminButton onClick={() => void handleUpdateWarning()} disabled={warningSaving === warning.id}>
                          {warningSaving === warning.id ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          Speichern
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          onClick={() => {
                            setEditingWarningId(null);
                            setEditingWarningForm(EMPTY_WARNING_FORM);
                          }}
                        >
                          <X size={15} />
                          Abbrechen
                        </AdminButton>
                      </div>,
                    )
                  ) : (
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{warning.short_label || `Warnung #${warning.id}`}</p>
                          <AdminBadge tone={warning.active ? 'ok' : 'neutral'}>{warning.active ? 'aktiv' : 'inaktiv'}</AdminBadge>
                          <AdminBadge tone={warning.severity === 'danger' ? 'danger' : warning.severity === 'caution' ? 'warn' : 'info'}>
                            {warningSeverityLabel(warning.severity)}
                          </AdminBadge>
                        </div>
                        <p className="admin-muted mt-1 text-xs">{warning.popover_text || '-'}</p>
                        <p className="admin-muted mt-1 text-xs">
                          {warning.min_amount != null ? `Mindestmenge: ${formatDecimalText(warning.min_amount)} ${warning.unit || ''}` : 'Keine Mindestmenge'}
                          {warning.article_slug ? ` - Artikel: ${warning.article_slug}` : ''}
                        </p>
                        {warning.article_slug ? (
                          <a
                            href={`/wissen/${warning.article_slug}`}
                            className="mt-1 inline-flex items-center gap-1 text-[13px] text-[color:var(--admin-info-ink)] underline"
                          >
                            Wissensartikel
                            <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AdminButton variant="ghost" size="sm" onClick={() => startEditingWarning(warning)}>
                          <Pencil size={14} />
                          Bearbeiten
                        </AdminButton>
                        <AdminButton
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDeleteWarning(warning.id)}
                          disabled={warningDeleting === warning.id || warning.active === 0}
                        >
                          {warningDeleting === warning.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Deaktivieren
                        </AdminButton>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </AdminCard>
    </div>
  );

  const renderDisplayTab = (
    profiles: AdminIngredientDisplayProfile[],
    forms: AdminIngredientResearchForm[],
  ) => {
    const extraProfiles = profiles.filter(
      (entry) =>
        entry.sub_ingredient_id !== null ||
        (entry.form_id !== null && !forms.some((form) => form.id === entry.form_id)),
    );
    return (
      <div className="grid gap-4">
        <AdminCard title="Anzeigeprofil" subtitle="Texte für die Darstellung des Wirkstoffs pflegen.">
          <div className="grid gap-3">
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Wirkung / Kurztext
              <textarea
                rows={3}
                value={displayProfileForm.effect_summary}
                onChange={(event) => setDisplayProfileForm((previous) => ({ ...previous, effect_summary: event.target.value }))}
                className="admin-input mt-1 min-h-[84px]"
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Timing
              <input
                value={displayProfileForm.timing}
                onChange={(event) => setDisplayProfileForm((previous) => ({ ...previous, timing: event.target.value }))}
                className="admin-input mt-1"
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Timing-Notiz
              <input
                value={displayProfileForm.timing_note}
                onChange={(event) => setDisplayProfileForm((previous) => ({ ...previous, timing_note: event.target.value }))}
                className="admin-input mt-1"
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Intake-Hinweis
              <input
                value={displayProfileForm.intake_hint}
                onChange={(event) => setDisplayProfileForm((previous) => ({ ...previous, intake_hint: event.target.value }))}
                className="admin-input mt-1"
              />
            </label>
            <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
              Kartenhinweis
              <input
                value={displayProfileForm.card_note}
                onChange={(event) => setDisplayProfileForm((previous) => ({ ...previous, card_note: event.target.value }))}
                className="admin-input mt-1"
              />
            </label>
            <div>
              <AdminButton onClick={() => void handleSaveDisplayProfile()} disabled={displayProfileSaving}>
                <Save size={15} />
                {displayProfileSaving ? 'Speichere...' : 'Basis-Profil speichern'}
              </AdminButton>
            </div>
          </div>
        </AdminCard>

        <AdminCard
          title="Form-spezifische Profile"
          subtitle="Profilwerte je vorhandener Wirkstoff-Form bearbeiten oder neu anlegen."
          className="md:max-h-none"
        >
          {forms.length === 0 ? (
            <AdminEmpty>Keine Formdaten vorhanden. Profile können erst angelegt werden, wenn Varianten für diesen Wirkstoff vorhanden sind.</AdminEmpty>
          ) : (
            <div className="grid gap-3">
              {forms.map((form) => {
                const profile = formDisplayProfile(profiles, form.id);
                const formState = formProfileForms[form.id] ?? BASE_PROFILE;
                const isSaving = formProfileSaving === form.id;
                return (
                  <article
                    key={form.id}
                    className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3"
                  >
                    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">{form.name}</p>
                          <AdminBadge tone={profile ? 'ok' : 'neutral'}>
                            {profile ? `Profil #${profile.id}` : 'neu'}
                          </AdminBadge>
                        </div>
                        <p className="admin-muted mt-1 text-xs">
                          Form-Timing: {form.timing || '-'} | Kommentar: {form.comment || '-'}
                        </p>
                      </div>
                      <AdminButton
                        onClick={() => void handleSaveFormDisplayProfile(form)}
                        disabled={formProfileSaving !== null}
                        size="sm"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isSaving ? 'Speichere...' : 'Form-Profil speichern'}
                      </AdminButton>
                    </div>
                    {formProfileErrors[form.id] ? <AdminError>{formProfileErrors[form.id]}</AdminError> : null}
                    <div className="grid gap-3">
                      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                        Wirkung / Kurztext
                        <textarea
                          rows={3}
                          value={formState.effect_summary}
                          onChange={(event) => updateFormProfileForm(form.id, 'effect_summary', event.target.value)}
                          className="admin-input mt-1 min-h-[84px]"
                        />
                      </label>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                          Timing
                          <input
                            value={formState.timing}
                            onChange={(event) => updateFormProfileForm(form.id, 'timing', event.target.value)}
                            className="admin-input mt-1"
                          />
                        </label>
                        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                          Timing-Notiz
                          <input
                            value={formState.timing_note}
                            onChange={(event) => updateFormProfileForm(form.id, 'timing_note', event.target.value)}
                            className="admin-input mt-1"
                          />
                        </label>
                        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                          Intake-Hinweis
                          <input
                            value={formState.intake_hint}
                            onChange={(event) => updateFormProfileForm(form.id, 'intake_hint', event.target.value)}
                            className="admin-input mt-1"
                          />
                        </label>
                        <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                          Kartenhinweis
                          <input
                            value={formState.card_note}
                            onChange={(event) => updateFormProfileForm(form.id, 'card_note', event.target.value)}
                            className="admin-input mt-1"
                          />
                        </label>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </AdminCard>

        <AdminCard title="Weitere Anzeige-Profile" subtitle="Profile außerhalb der direkten Formenliste." className="md:max-h-none">
          {extraProfiles.length === 0 ? (
            <AdminEmpty>Keine weiteren Profile vorhanden.</AdminEmpty>
          ) : (
            <div className="grid gap-2">
              {extraProfiles.map((profile) => (
                <article
                  key={`${profile.id}-${profile.form_id ?? 'base'}-${profile.sub_ingredient_id ?? 'base'}`}
                  className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3"
                >
                  <p className="font-medium text-sm">
                    {formProfileName(profile, forms)}
                    {profile.sub_ingredient_id ? `, Sub-Wirkstoff ${profile.sub_ingredient_id}` : ''}
                  </p>
                  <p className="admin-muted text-xs mt-1">{profile.effect_summary || '-'}</p>
                </article>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    );
  };

  const renderI18nTab = () => (
    <AdminCard
      title={'\u00dcbersetzungen'}
      subtitle={'\u00dcbersetzungen werden zentral auf der \u00dcbersetzungsseite gepflegt.'}
    >
      <div className="admin-card-pad">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminBadge tone="info">Bereich: Wirkstoffe</AdminBadge>
              <AdminBadge>Sprache: {i18nLanguage}</AdminBadge>
              <AdminBadge>Lesemodus</AdminBadge>
            </div>
            <p className="admin-muted mt-2 text-sm">
              Diese Detailseite zeigt nur den Einstieg. Bearbeitung, Statusfilter und Suche laufen über die zentrale Übersetzungsseite.
            </p>
            <p className="admin-muted mt-2 text-xs">
              Fokus: Wirkstoff {ingredientId}:{i18nLanguage}
            </p>
          </div>
          {detail ? (
            <Link
              to={buildIngredientTranslationsLink(ingredientId, detail.ingredient.name, i18nLanguage)}
              className="admin-btn admin-btn-primary"
            >
              <ExternalLink size={14} />
              Übersetzung bearbeiten
            </Link>
          ) : null}
        </div>
      </div>
    </AdminCard>
  );

  return (
    <>
      <div className="mb-4">
        <Link to="/administrator/ingredients" className="admin-btn admin-btn-ghost">
          <ArrowLeft size={14} />
          Zurück zur Liste
        </Link>
      </div>

      <AdminPageHeader
        title={detail ? detail.ingredient.name : `Wirkstoff #${id || ''}`}
        subtitle={detail ? `Kategorie: ${detail.ingredient.category || 'ohne Kategorie'} | Einheit: ${detail.ingredient.unit || '-'}` : 'Lade Detaildaten'}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge tone={statusTone(detail?.status.research_status)}>{`Recherche: ${statusLabel(detail?.status.research_status)}`}</AdminBadge>
            <AdminBadge tone={statusTone(detail?.status.calculation_status)}>{`Berechnung: ${statusLabel(detail?.status.calculation_status)}`}</AdminBadge>
            <AdminBadge>
              {detail ? `Prüfung: ${formatDate(detail.status.reviewed_at)}` : 'Prüfung: -'}
            </AdminBadge>
            <AdminBadge>
              {detail ? `Fällig: ${formatDate(detail.status.review_due_at)}` : 'Fällig: -'}
            </AdminBadge>
          </div>
        }
      />

      <div className="admin-toolbar mb-4">
        <div className="admin-toolbar-inline">
          <button
            type="button"
            onClick={() => {
              void loadDetail();
              void loadDoseRecommendations();
              void loadEvidenceSummary();
              void loadNrvValues();
              if (activeTab === 'interactions') void loadInteractions();
              if (activeTab === 'precursors') void loadPrecursorIngredients();
            }}
            className={`admin-btn ${loading ? 'admin-btn-ghost' : 'admin-btn-primary'}`}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
          <Link to="/administrator/dosing" className="admin-btn">
            Zum Dosis-Editor
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Ingredient detail tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`admin-btn admin-btn-sm ${activeTab === tab.key ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminEmpty>
          <Loader2 size={15} className="mr-2 inline animate-spin" />
          Lade Wirkstoff-Detail...
        </AdminEmpty>
      ) : null}

      {error ? <AdminError>{error}</AdminError> : null}
      {message ? <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-success-soft)] bg-[color:var(--admin-success-soft)] px-3 py-2 text-[color:var(--admin-success-ink)] text-sm">{message}</div> : null}

      {!loading && detail ? (
        <div>
          {activeTab === 'overview' && renderOverviewTab(detail)}
          {activeTab === 'forms' && renderFormsTab(detail.forms)}
          {activeTab === 'precursors' && renderPrecursorsTab(detail.precursors)}
          {activeTab === 'dosing' && renderDosingTab(detail.sources)}
          {activeTab === 'research' && renderResearchTab(detail.sources)}
          {activeTab === 'interactions' && renderInteractionsTab()}
          {activeTab === 'warnings' && renderWarningsTab(detail.warnings)}
          {activeTab === 'display' && renderDisplayTab(detail.display_profiles, detail.forms)}
          {activeTab === 'i18n' && renderI18nTab()}
        </div>
      ) : null}

      {!loading && !detail ? (
        <AdminCard title="Kein Datensatz">
          <p className="admin-muted text-sm">
            Fuer diese ID liegen keine Daten vor oder die ID ist ungueltig.
          </p>
        </AdminCard>
      ) : null}
    </>
  );
}

