import { useState, useEffect } from 'react';
import { X, ExternalLink, ChevronRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Ingredient, DosageGuideline, Product } from '../../types/local';

interface ManualDose {
  value: number;
  unit: string;
}

interface Modal1IngredientProps {
  ingredient: Ingredient;
  onClose: () => void;
  onShowProducts: (manualDose?: ManualDose) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  DGE: 'DGE',
  EFSA: 'EFSA',
  NIH: 'NIH',
  study: 'Studie',
  practice: 'Praxis',
};

function formatDoseRange(gl: DosageGuideline): string {
  const unit = gl.unit ?? '';
  if (gl.dose_min != null && gl.dose_max != null && gl.dose_min !== gl.dose_max) {
    return `${gl.dose_min}–${gl.dose_max} ${unit}`;
  }
  if (gl.dose_max != null) return `${gl.dose_max} ${unit}`;
  if (gl.dose_min != null) return `${gl.dose_min} ${unit}`;
  return unit;
}

function formatFrequency(gl: DosageGuideline): string {
  const parts: string[] = [];
  if (gl.frequency) parts.push(gl.frequency);
  if (gl.timing) parts.push(gl.timing);
  return parts.join(' · ');
}

// Merge guidelines with the same dose range + unit into one card
function deduplicateByDose(guidelines: DosageGuideline[]): DosageGuideline[] {
  const seen = new Map<string, DosageGuideline>();
  for (const gl of guidelines) {
    const key = `${gl.population ?? ''}|${gl.dose_min ?? ''}|${gl.dose_max ?? ''}|${gl.unit ?? ''}`;
    if (seen.has(key)) {
      const ex = seen.get(key)!;
      const notes = [ex.notes, gl.notes].filter(Boolean).join(' / ') || undefined;
      const title = [ex.source_title, gl.source_title].filter(Boolean).join(' + ') || undefined;
      seen.set(key, { ...ex, notes, source_title: title });
    } else {
      seen.set(key, { ...gl });
    }
  }
  return Array.from(seen.values());
}

export default function Modal1Ingredient({
  ingredient: initialIngredient,
  onClose,
  onShowProducts,
}: Modal1IngredientProps) {
  const [ingredient, setIngredient] = useState<Ingredient>(initialIngredient);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dosage guidelines
  const [guidelines, setGuidelines] = useState<DosageGuideline[]>([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Product preview
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);

  // Manual dose input
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  // Accordion open/closed — Dosierung open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    dosierung: true,
    beschreibung: false,
    formen: false,
    symptome: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Fetch ingredient details + dosage guidelines in parallel
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setGuidelinesLoading(true);
    setError(null);

    const ingredientFetch = fetch(`/api/ingredients/${initialIngredient.id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const ing: Ingredient = data.ingredient ?? data;
          setIngredient(ing);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError('Wirkstoff-Details konnten nicht geladen werden.');
          console.error(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const guidelinesFetch = fetch(`/api/ingredients/${initialIngredient.id}/dosage-guidelines`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const gls: DosageGuideline[] = data.guidelines ?? [];
          setGuidelines(gls);
          // Auto-select the default or first available source
          const defaultGl = gls.find((g) => g.is_default) ?? gls[0];
          if (defaultGl) {
            setSelectedSource(defaultGl.source);
            setManualUnit(defaultGl.unit ?? '');
          }
        }
      })
      .catch((err) => {
        console.error('Guidelines fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setGuidelinesLoading(false);
      });

    const productsFetch = fetch(`/api/ingredients/${initialIngredient.id}/products`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const prods: Product[] = data.products ?? [];
          setPreviewProducts(prods.slice(0, 3));
        }
      })
      .catch((err) => {
        console.error('Products preview fetch failed:', err);
      });

    // suppress unused warning — all run in parallel
    void Promise.allSettled([ingredientFetch, guidelinesFetch, productsFetch]);

    return () => {
      cancelled = true;
    };
  }, [initialIngredient.id]);

  const isNotRecommended = (comment?: string) =>
    comment?.toLowerCase().includes('nicht empfohlen') ?? false;

  // Unique sources from guidelines
  const availableSources = Array.from(new Set(guidelines.map((g) => g.source)));

  // Guidelines for the selected source, deduplicated by dose range
  const sourceGuidelines = deduplicateByDose(
    guidelines.filter((g) => g.source === selectedSource)
  );

  // Click on a guideline card → auto-fill the manual dose input
  const handleGuidelineClick = (gl: DosageGuideline) => {
    const val = gl.dose_max ?? gl.dose_min;
    if (val != null) {
      setManualValue(String(val));
      setManualUnit(gl.unit ?? '');
    }
  };

  // Manual dose state
  const parsedManualValue = parseFloat(manualValue);
  const hasManualDose = !isNaN(parsedManualValue) && parsedManualValue > 0 && manualUnit.trim() !== '';

  const handleShowProducts = () => {
    const dose: ManualDose | undefined = hasManualDose
      ? { value: parsedManualValue, unit: manualUnit.trim() }
      : undefined;
    onShowProducts(dose);
  };

  const AccordionHeader = ({
    label,
    sectionKey,
  }: {
    label: string;
    sectionKey: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center justify-between w-full py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-700"
    >
      <span>{label}</span>
      {openSections[sectionKey] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );

  return (
    <ModalWrapper onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{ingredient.name}</h2>
          {ingredient.unit && (
            <p className="text-sm text-gray-500 mt-1">Einheit: {ingredient.unit}</p>
          )}
          {/* Synonyms inline under title */}
          {ingredient.synonyms && ingredient.synonyms.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {ingredient.synonyms.map((s) => s.synonym).join(' · ')}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          <span className="text-gray-500 text-sm">Laden…</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg mb-4">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="divide-y divide-gray-100">
          {/* ── Dosierung (open by default) ── */}
          <div>
            <AccordionHeader label="Dosierung" sectionKey="dosierung" />
            {openSections.dosierung && (
              <div className="pb-4 space-y-3">
                {guidelinesLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    Leitlinien werden geladen…
                  </div>
                ) : guidelines.length === 0 ? (
                  <p className="text-sm text-gray-500 py-1">Keine Dosierungsempfehlungen verfügbar.</p>
                ) : (
                  <>
                    {/* Source selector tabs */}
                    <div className="flex flex-wrap gap-2">
                      {availableSources.map((src) => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setSelectedSource(src)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                            selectedSource === src
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {SOURCE_LABELS[src] ?? src}
                        </button>
                      ))}
                    </div>

                    {/* Guidelines for selected source */}
                    {sourceGuidelines.length > 0 && (
                      <div className="space-y-3">
                        {sourceGuidelines.map((gl) => (
                          <button
                            key={gl.id}
                            type="button"
                            onClick={() => handleGuidelineClick(gl)}
                            className="w-full text-left p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/50 active:bg-blue-100 transition-colors group"
                            title="Klicken um Dosis zu übernehmen"
                          >
                            {/* Population label */}
                            {gl.population && (
                              <p className="text-xs text-gray-400 mb-1">{gl.population}</p>
                            )}
                            {/* Dose range + hint */}
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-2xl font-bold text-gray-900">
                                {formatDoseRange(gl)}
                              </p>
                              <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                Übernehmen ↓
                              </span>
                            </div>
                            {/* Frequency / timing */}
                            {formatFrequency(gl) && (
                              <p className="text-sm text-gray-500 mt-0.5">{formatFrequency(gl)}</p>
                            )}
                            {/* Notes */}
                            {gl.notes && (
                              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{gl.notes}</p>
                            )}
                            {/* Source URL */}
                            {gl.source_url && (
                              <a
                                href={gl.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                {gl.source_title ?? 'Quelle'}
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Manual dose input */}
                <div className="pt-1">
                  <p className="text-xs text-gray-400 mb-1.5">
                    Eigene Dosis eingeben
                    {hasManualDose && (
                      <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                        Manuell
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Menge"
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    />
                    <input
                      type="text"
                      placeholder="Einheit (z.B. mg)"
                      value={manualUnit}
                      onChange={(e) => setManualUnit(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Beschreibung ── */}
          {ingredient.description && (
            <div>
              <AccordionHeader label="Beschreibung" sectionKey="beschreibung" />
              {openSections.beschreibung && (
                <div className="pb-4">
                  <p className="text-sm text-gray-700 leading-relaxed">{ingredient.description}</p>
                  {ingredient.external_url && (
                    <a
                      href={ingredient.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Mehr erfahren
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Formen ── */}
          {ingredient.forms && ingredient.forms.length > 0 && (
            <div>
              <AccordionHeader label="Formen" sectionKey="formen" />
              {openSections.formen && (
                <div className="pb-4">
                  <ul className="space-y-2">
                    {ingredient.forms.map((form, idx) => (
                      <li key={idx} className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-gray-800">{form.name}</span>
                        {form.comment && (
                          <span
                            className={`text-xs ${
                              isNotRecommended(form.comment)
                                ? 'text-orange-600 font-medium'
                                : 'text-gray-500'
                            }`}
                          >
                            {form.comment}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Symptome ── */}
          {(ingredient.hypo_symptoms || ingredient.hyper_symptoms) && (
            <div>
              <AccordionHeader label="Symptome" sectionKey="symptome" />
              {openSections.symptome && (
                <div className="pb-4 space-y-3">
                  {ingredient.hypo_symptoms && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                        Mangel
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">{ingredient.hypo_symptoms}</p>
                    </div>
                  )}
                  {ingredient.hyper_symptoms && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={13} className="text-amber-500" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Überdosierung
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{ingredient.hyper_symptoms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-gray-100 space-y-3">
        {/* Product preview chips */}
        {previewProducts.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">Top-Produkte</p>
            <div className="flex flex-wrap gap-2">
              {previewProducts.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={handleShowProducts}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 transition-colors text-gray-700"
                >
                  <span className="max-w-[120px] truncate">{prod.name}</span>
                  <span className="text-gray-400 font-normal">€{prod.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleShowProducts}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors"
        >
          {hasManualDose && (
            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded text-white font-normal mr-1">
              {parsedManualValue} {manualUnit}
            </span>
          )}
          Produkte anzeigen
          <ChevronRight size={18} />
        </button>
      </div>
    </ModalWrapper>
  );
}
