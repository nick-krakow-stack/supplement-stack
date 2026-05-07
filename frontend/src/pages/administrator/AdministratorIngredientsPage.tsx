import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, RefreshCw, Search } from 'lucide-react';
import { getAdminIngredients, type AdminIngredientListItem } from '../../api/admin';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

const PAGE_LIMIT_OPTIONS = [25, 50, 100] as const;
const REQUIRED_COVERAGE_COUNT = 8;

function researchStatusLabel(status: string | null): string {
  if (status === 'reviewed') return 'Geprüft';
  if (status === 'researching') return 'Recherche';
  if (status === 'needs_review') return 'Prüfung nötig';
  if (status === 'stale') return 'Veraltet';
  if (status === 'blocked') return 'Blockiert';
  return 'Unreviewed';
}

function calculationStatusLabel(status: string | null): string {
  if (status === 'ready') return 'Dosis ready';
  if (status === 'in_progress') return 'Dosis in Arbeit';
  if (status === 'needs_review') return 'Dosisprüfung';
  if (status === 'not_applicable') return 'Dosis n/a';
  if (status === 'blocked') return 'Dosis blockiert';
  return 'Dosis offen';
}

function countLabel(count: number, noun: string): string {
  return count > 0 ? `${count} ${noun}` : 'fehlt';
}

function hasBlogCoverage(ingredient: AdminIngredientListItem): boolean {
  return ingredient.has_blog_url || ingredient.knowledge_article_count > 0;
}

function coverageScore(ingredient: AdminIngredientListItem): { done: number; total: number } {
  const checks = [
    hasBlogCoverage(ingredient),
    ingredient.dge_source_count > 0,
    ingredient.official_source_count > 0,
    ingredient.study_source_count > 0,
    ingredient.nrv_count > 0,
    ingredient.dose_recommendation_count > 0,
    ingredient.sourced_dose_recommendation_count > 0,
    ingredient.display_profile_count > 0,
  ];
  return {
    done: checks.filter(Boolean).length,
    total: REQUIRED_COVERAGE_COUNT,
  };
}

function coverageTone(ingredient: AdminIngredientListItem): 'ok' | 'warn' | 'info' {
  const score = coverageScore(ingredient);
  if (score.done === score.total) return 'ok';
  if (score.done >= Math.ceil(score.total / 2)) return 'info';
  return 'warn';
}

function CoverageBadge({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CheckCircle2 : Circle;
  return (
    <AdminBadge tone={ok ? 'ok' : 'warn'} className="gap-1">
      <Icon size={12} />
      <span>{label}</span>
      <span className="opacity-70">{detail}</span>
    </AdminBadge>
  );
}

function IngredientCoverage({ ingredient }: { ingredient: AdminIngredientListItem }) {
  const blogDetail = ingredient.has_blog_url
    ? 'Blog-Link'
    : countLabel(ingredient.knowledge_article_count, 'Artikel');

  return (
    <div className="flex max-w-[620px] flex-wrap gap-1.5">
      <CoverageBadge ok={hasBlogCoverage(ingredient)} label="Blog/Wissen" detail={blogDetail} />
      <CoverageBadge ok={ingredient.dge_source_count > 0} label="DGE" detail={countLabel(ingredient.dge_source_count, 'Quelle')} />
      <CoverageBadge
        ok={ingredient.official_source_count > 0}
        label="Offiziell"
        detail={countLabel(ingredient.official_source_count, 'Quelle')}
      />
      <CoverageBadge ok={ingredient.study_source_count > 0} label="Studien" detail={countLabel(ingredient.study_source_count, 'Studie')} />
      <CoverageBadge ok={ingredient.nrv_count > 0} label="NRV/UL" detail={countLabel(ingredient.nrv_count, 'Wert')} />
      <CoverageBadge
        ok={ingredient.dose_recommendation_count > 0}
        label="Dosiswerte"
        detail={countLabel(ingredient.dose_recommendation_count, 'Regel')}
      />
      <CoverageBadge
        ok={ingredient.sourced_dose_recommendation_count > 0}
        label="Dosis-Quellen"
        detail={countLabel(ingredient.dose_source_link_count, 'Link')}
      />
      <CoverageBadge ok={ingredient.display_profile_count > 0} label="Profil" detail={countLabel(ingredient.display_profile_count, 'Profil')} />
    </div>
  );
}

export default function AdministratorIngredientsPage() {
  const [ingredients, setIngredients] = useState<AdminIngredientListItem[]>([]);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_LIMIT_OPTIONS)[number]>(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getAdminIngredients({ q: query, page, limit });
      setIngredients(response.ingredients);
      setTotal(response.total);
    } catch (err) {
      setIngredients([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Wirkstoffe konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [limit, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canLoadPrevious = page > 1;
  const canLoadNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(total, (page - 1) * limit + ingredients.length);
  const completeOnPage = ingredients.filter((ingredient) => {
    const score = coverageScore(ingredient);
    return score.done === score.total;
  }).length;

  useEffect(() => {
    if (!loading && page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, page, totalPages]);

  const applyQuery = useCallback(() => {
    setPage(1);
    setQuery(queryInput);
  }, [queryInput]);

  return (
    <>
      <AdminPageHeader
        title="Wirkstoffe"
        subtitle="Übersicht über Recherche, Quellen, Dosisdaten, Blogartikel und Anzeigeprofile je Wirkstoff."
        meta={(
          <div className="flex flex-wrap gap-2">
            <AdminBadge tone="info">{total} Einträge</AdminBadge>
            {!loading && ingredients.length > 0 && (
              <AdminBadge tone={completeOnPage === ingredients.length ? 'ok' : 'warn'}>
                Seite komplett: {completeOnPage}/{ingredients.length}
              </AdminBadge>
            )}
          </div>
        )}
      />

      <div className="mb-4 admin-toolbar">
        <div className="admin-toolbar-inline">
          <label className="flex min-h-[38px] min-w-[260px] flex-1 items-center gap-2 rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] px-3">
            <Search size={16} className="admin-muted" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyQuery();
              }}
              placeholder="Wirkstoff, Einheit oder ID suchen"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </label>
          <AdminButton onClick={applyQuery}>
            <Search size={13} />
            Suche
          </AdminButton>
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />
            Aktualisieren
          </AdminButton>
          <Link to="/administrator/dosing" className="admin-btn admin-btn-primary">
            Dosis-Richtwerte
          </Link>
        </div>

        <div className="admin-toolbar-inline">
          <span className="admin-muted text-sm">
            Seite {page} / {totalPages} - {rangeStart}-{rangeEnd} von {total}
          </span>
          <select
            value={limit}
            onChange={(event) => {
              setPage(1);
              setLimit(Number(event.target.value) as (typeof PAGE_LIMIT_OPTIONS)[number]);
            }}
            className="admin-select w-[140px]"
            aria-label="Einträge pro Seite"
          >
            {PAGE_LIMIT_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry} / Seite
              </option>
            ))}
          </select>
          <AdminButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!canLoadPrevious || loading}>
            <ChevronLeft size={13} />
            Zurück
          </AdminButton>
          <AdminButton onClick={() => setPage((current) => current + 1)} disabled={!canLoadNext || loading}>
            Weiter
            <ChevronRight size={13} />
          </AdminButton>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      {loading ? (
        <AdminEmpty>Lade Wirkstoffe...</AdminEmpty>
      ) : ingredients.length === 0 ? (
        <AdminEmpty>Keine Wirkstoffe gefunden.</AdminEmpty>
      ) : (
        <AdminCard
          title="Wirkstoff-Katalog"
          subtitle="Die Haken werden automatisch aus vorhandenen Admin-Daten gesetzt. Fehlende Punkte sind die nächsten Aufgaben für Recherche und Texte."
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Wirkstoff</th>
                  <th>Arbeitsstand</th>
                  <th>Recherche-Abdeckung</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ingredient) => {
                  const score = coverageScore(ingredient);
                  return (
                    <tr key={ingredient.id}>
                      <td>
                        <div className="font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                          {ingredient.name}
                        </div>
                        <div className="admin-muted admin-mono">
                          #{ingredient.id}
                          {ingredient.category ? ` - ${ingredient.category}` : ''}
                          {ingredient.unit ? ` - ${ingredient.unit}` : ''}
                        </div>
                      </td>
                      <td>
                        <div className="flex max-w-[280px] flex-wrap gap-1.5">
                          <AdminBadge tone={coverageTone(ingredient)}>
                            {score.done}/{score.total} erledigt
                          </AdminBadge>
                          <AdminBadge tone="info">{researchStatusLabel(ingredient.research_status)}</AdminBadge>
                          <AdminBadge>{calculationStatusLabel(ingredient.calculation_status)}</AdminBadge>
                          {ingredient.source_count > 0 && <AdminBadge>{ingredient.source_count} Quellen</AdminBadge>}
                          {ingredient.no_recommendation_count > 0 && (
                            <AdminBadge tone="warn">{ingredient.no_recommendation_count} ohne Empfehlung</AdminBadge>
                          )}
                          {ingredient.warning_count > 0 && <AdminBadge tone="warn">{ingredient.warning_count} Warnungen</AdminBadge>}
                          {ingredient.product_count > 0 && <AdminBadge>{ingredient.product_count} Produkte</AdminBadge>}
                        </div>
                      </td>
                      <td>
                        <IngredientCoverage ingredient={ingredient} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/administrator/ingredients/${ingredient.id}`} className="admin-btn admin-btn-sm">
                            Details
                          </Link>
                          <Link to={`/administrator/ingredients/${ingredient.id}?section=research`} className="admin-btn admin-btn-sm">
                            Quellen
                          </Link>
                          <Link to={`/administrator/ingredients/${ingredient.id}?section=dosing`} className="admin-btn admin-btn-sm">
                            Dosiswerte
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
    </>
  );
}
