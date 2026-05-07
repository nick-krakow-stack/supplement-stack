import { CheckCircle2, ExternalLink, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type {
  AdminDoseRecommendation,
  AdminDosePlausibilityWarning,
  AdminIngredientResearchSource,
} from '../../api/admin';
import {
  type BooleanString,
  type DoseDraft,
  type SelectedDoseId,
  type SourceLinkDraft,
  PURPOSES,
  SOURCE_TYPES,
  parseIntOrNull,
  sourceOptionLabel,
} from './AdministratorDosingTypes';
import { AdminBadge, AdminButton, AdminEmpty } from './AdminUi';

type Option = { value: string; label: string };

type Props = {
  selectedId: SelectedDoseId;
  selectedRecommendation: AdminDoseRecommendation | null;
  draft: DoseDraft;
  sourceLinks: SourceLinkDraft[];
  researchSources: AdminIngredientResearchSource[];
  ingredientOptions: Option[];
  ingredientNameById: Map<number, string>;
  saving: boolean;
  status: string;
  backendWarnings: AdminDosePlausibilityWarning[];
  onDraftChange: (field: keyof DoseDraft, value: string) => void;
  onSourceLinkChange: (index: number, field: keyof SourceLinkDraft, value: string | boolean) => void;
  onAddSourceLink: () => void;
  onRemoveSourceLink: (index: number) => void;
  onSave: () => void;
  onDeactivate: () => void;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric' | 'text' | 'url';
}) {
  return (
    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="admin-input mt-1"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="admin-select mt-1"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SourceSummary({ source }: { source: AdminIngredientResearchSource }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate">{source.source_title || `Quelle #${source.id}`}</span>
      <span className="admin-muted block truncate text-[11px]">
        {source.source_kind}
        {source.organization ? ` - ${source.organization}` : ''}
        {source.outcome ? ` - ${source.outcome}` : ''}
      </span>
    </span>
  );
}

export default function AdministratorDosingEditPanel({
  selectedId,
  selectedRecommendation,
  draft,
  sourceLinks,
  researchSources,
  ingredientOptions,
  ingredientNameById,
  saving,
  status,
  backendWarnings,
  onDraftChange,
  onSourceLinkChange,
  onAddSourceLink,
  onRemoveSourceLink,
  onSave,
  onDeactivate,
}: Props) {
  const sourceById = new Map<number, AdminIngredientResearchSource>();
  researchSources.forEach((source) => sourceById.set(source.id, source));

  const selectedIngredientName = parseIntOrNull(draft.ingredient_id)
    ? ingredientNameById.get(Number(draft.ingredient_id)) ?? `Wirkstoff #${draft.ingredient_id}`
    : 'Kein Wirkstoff';

  if (selectedId === null) {
    return (
      <AdminEmpty>Wähle einen Richtwert aus oder lege einen neuen an.</AdminEmpty>
    );
  }

  return (
    <section className="admin-card admin-card-pad">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="admin-muted text-xs uppercase tracking-wide">
              {selectedId === 'new' ? 'Neuer Richtwert' : `Richtwert #${selectedId}`}
            </p>
            <h2 className="mt-1 text-lg font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>{selectedIngredientName}</h2>
            {selectedRecommendation?.source_url && (
              <a
                href={selectedRecommendation.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-muted mt-1 inline-flex items-center gap-1 text-xs font-medium underline"
              >
                Quelle öffnen
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof selectedId === 'number' && (
              <AdminButton
                variant="danger"
                onClick={onDeactivate}
                disabled={saving}
                title="Deaktivieren"
                aria-label="Deaktivieren"
              >
                <Trash2 size={16} />
              </AdminButton>
            )}
            <AdminButton
              variant="primary"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Speichern
            </AdminButton>
          </div>
        </div>

        {status && (
          <div className="flex items-center gap-2 rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3 py-2 text-sm text-[color:var(--admin-ink-2)]">
            <CheckCircle2 size={15} className="text-[color:var(--admin-success)]" />
            {status}
          </div>
        )}

        {backendWarnings.length > 0 && (
          <div className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-warn-soft)] bg-[color:var(--admin-warn-soft)] px-3 py-2 text-sm text-[color:var(--admin-warn-ink)]">
            <p className="font-semibold">Prüfhinweise</p>
            <div className="mt-2 grid gap-1.5">
              {backendWarnings.map((warning, index) => (
                <div key={`${warning.code ?? 'warning'}-${index}`} className="rounded-[var(--admin-r-sm)] bg-[color:var(--admin-bg-elev)] px-2 py-1.5">
                  <p className="text-xs font-semibold">{warning.label || warning.code || 'Prüfhinweis'}</p>
                  <p className="text-xs">{warning.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Select label="Wirkstoff" value={draft.ingredient_id} onChange={(value) => onDraftChange('ingredient_id', value)} options={ingredientOptions} />
          <Field label="Zielgruppe" value={draft.population_slug} onChange={(value) => onDraftChange('population_slug', value)} />
          <Select
            label="Quellentyp"
            value={draft.source_type}
            onChange={(value) => onDraftChange('source_type', value)}
            options={SOURCE_TYPES.map((type) => ({ value: type, label: type }))}
          />
          <Field label="Quellenname" value={draft.source_label} onChange={(value) => onDraftChange('source_label', value)} />
          <Field label="Quellen-Link" value={draft.source_url} onChange={(value) => onDraftChange('source_url', value)} inputMode="url" />
          <Select
            label="Zweck"
            value={draft.purpose}
            onChange={(value) => onDraftChange('purpose', value)}
            options={PURPOSES.map((purpose) => ({ value: purpose, label: purpose }))}
          />
          <Field label="Mindestdosis" value={draft.dose_min} onChange={(value) => onDraftChange('dose_min', value)} inputMode="decimal" />
          <Field label="Höchstdosis" value={draft.dose_max} onChange={(value) => onDraftChange('dose_max', value)} inputMode="decimal" />
          <Field label="Einheit" value={draft.unit} onChange={(value) => onDraftChange('unit', value)} />
          <Field label="Relevanz" value={draft.relevance_score} onChange={(value) => onDraftChange('relevance_score', value)} inputMode="numeric" />
          <Field label="Pro kg Körpergewicht" value={draft.per_kg_body_weight} onChange={(value) => onDraftChange('per_kg_body_weight', value)} inputMode="decimal" />
          <Field label="Obergrenze pro kg" value={draft.per_kg_cap} onChange={(value) => onDraftChange('per_kg_cap', value)} inputMode="decimal" />
          <Field label="Einnahmezeitpunkt" value={draft.timing} onChange={(value) => onDraftChange('timing', value)} />
          <Field label="Geschlecht" value={draft.sex_filter} onChange={(value) => onDraftChange('sex_filter', value)} placeholder="male, female oder leer" />
          <Field label="Kategorie" value={draft.category_name} onChange={(value) => onDraftChange('category_name', value)} />
          <Field label="Expertenprofil-ID" value={draft.verified_profile_id} onChange={(value) => onDraftChange('verified_profile_id', value)} inputMode="numeric" />
          <Select
            label="Athlet"
            value={draft.is_athlete}
            onChange={(value) => onDraftChange('is_athlete', value as BooleanString)}
            options={[{ value: '0', label: 'Nein' }, { value: '1', label: 'Ja' }]}
          />
          <Select
            label="Standardwert"
            value={draft.is_default}
            onChange={(value) => onDraftChange('is_default', value as BooleanString)}
            options={[{ value: '0', label: 'Nein' }, { value: '1', label: 'Ja' }]}
          />
          <Select
            label="Aktiv"
            value={draft.is_active}
            onChange={(value) => onDraftChange('is_active', value as BooleanString)}
            options={[{ value: '0', label: 'Nein' }, { value: '1', label: 'Ja' }]}
          />
          <Select
            label="Öffentlich sichtbar"
            value={draft.is_public}
            onChange={(value) => onDraftChange('is_public', value as BooleanString)}
            options={[{ value: '0', label: 'Nein' }, { value: '1', label: 'Ja' }]}
          />
        </div>

        <label className="block text-xs font-medium text-[color:var(--admin-ink-2)]">
          Hinweis zur Einnahme
          <textarea
            value={draft.context_note}
            onChange={(event) => onDraftChange('context_note', event.target.value)}
            rows={3}
            className="admin-input mt-1 min-h-[84px]"
          />
        </label>

        <div className="space-y-3 rounded-[var(--admin-r-lg)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--admin-ink)]">Verknüpfte Quellen</h3>
              <p className="admin-muted text-xs">
                {researchSources.length} Quellen für diesen Wirkstoff geladen.
              </p>
            </div>
            <AdminButton
              onClick={onAddSourceLink}
            >
              <Plus size={14} />
              Quelle
            </AdminButton>
          </div>

          {selectedRecommendation?.sources?.length ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-[color:var(--admin-ink-2)]">Bereits verknüpft</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedRecommendation.sources.map((source) => (
                  <AdminBadge
                    key={`${source.research_source_id}-${source.note ?? ''}`}
                    tone={source.is_primary ? 'ok' : 'info'}
                  >
                    #{source.research_source_id}
                    {source.is_primary ? ' wichtigste Quelle' : ''}
                  </AdminBadge>
                ))}
              </div>
            </div>
          ) : (
            <p className="admin-muted text-xs">Noch keine verknüpften Quellen.</p>
          )}

          <div className="space-y-2">
            {sourceLinks.map((source, index) => {
              const selectedSource = sourceById.get(Number(source.research_source_id));
              return (
                <div key={`${index}-${source.research_source_id}`} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg-elev)] p-3">
                  <div className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_90px_90px_auto]">
                    <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
                      Quelle
                      {researchSources.length > 0 ? (
                        <select
                          value={source.research_source_id}
                          onChange={(event) => onSourceLinkChange(index, 'research_source_id', event.target.value)}
                          className="admin-select mt-1"
                        >
                          <option value="">Quelle wählen</option>
                          {researchSources.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {sourceOptionLabel(entry)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={source.research_source_id}
                          onChange={(event) => onSourceLinkChange(index, 'research_source_id', event.target.value)}
                          inputMode="numeric"
                          className="admin-input mt-1"
                        />
                      )}
                    </label>
                    <Field
                      label="Gewicht"
                      value={source.relevance_weight}
                      onChange={(value) => onSourceLinkChange(index, 'relevance_weight', value)}
                      inputMode="numeric"
                    />
                    <label className="flex items-end gap-2 text-xs font-medium text-[color:var(--admin-ink-2)]">
                      <input
                        type="checkbox"
                        checked={source.is_primary}
                        onChange={(event) => onSourceLinkChange(index, 'is_primary', event.target.checked)}
                        className="mb-3 h-4 w-4"
                      />
                       <span className="mb-2">wichtigste Quelle</span>
                    </label>
                    <AdminButton
                      variant="ghost"
                      onClick={() => onRemoveSourceLink(index)}
                      className="self-end"
                      title="Quelle entfernen"
                      aria-label="Quelle entfernen"
                    >
                      <Trash2 size={15} />
                    </AdminButton>
                  </div>
                  {selectedSource && (
                    <p className="admin-muted mt-2 text-xs">
                      <SourceSummary source={selectedSource} />
                    </p>
                  )}
                  <label className="mt-2 block text-xs font-medium text-[color:var(--admin-ink-2)]">
                    Notiz
                    <input
                      value={source.note}
                      onChange={(event) => onSourceLinkChange(index, 'note', event.target.value)}
                      className="admin-input mt-1"
                    />
                  </label>
                </div>
              );
            })}
            {sourceLinks.length === 0 && (
              <p className="admin-muted rounded-[var(--admin-r-md)] border border-dashed border-[color:var(--admin-line-strong)] bg-[color:var(--admin-bg-elev)] p-3 text-xs">
                Keine Quelle ausgewählt.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
