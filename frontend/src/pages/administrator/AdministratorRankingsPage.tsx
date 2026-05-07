import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type ProductRanking = {
  product_id: number;
  product_name: string;
  rank_score: number;
  notes: string | null;
};

type RankingResponse = {
  rankings: ProductRanking[];
};

type RowDraft = {
  rank_score: string;
  notes: string;
};

type RowState = {
  pending: boolean;
  successMessage: string;
  errorMessage: string;
};

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

function toStringValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return Number.isFinite(value) ? String(value) : '';
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

export default function AdministratorRankingsPage() {
  const [rankings, setRankings] = useState<ProductRanking[]>([]);
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const visibleRankings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rankings;
    return rankings.filter((item) => {
      return (
        item.product_name.toLowerCase().includes(needle) ||
        String(item.product_id).includes(needle)
      );
    });
  }, [query, rankings]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/product-rankings', {
        credentials: 'include',
        headers: JSON_HEADERS,
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Rankings konnten nicht geladen werden.'));
      }
      const data = (await response.json()) as RankingResponse;
      const rows = data.rankings ?? [];
      setRankings(rows);
      const nextDrafts = rows.reduce<Record<number, RowDraft>>((acc, ranking) => {
        acc[ranking.product_id] = {
          rank_score: toStringValue(ranking.rank_score),
          notes: ranking.notes ?? '',
        };
        return acc;
      }, {});
      setDrafts(nextDrafts);
      setRowStates({});
    } catch (err) {
      setRankings([]);
      setDrafts({});
      setRowStates({});
      setError(err instanceof Error ? err.message : 'Rankings konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setDraft = useCallback((productId: number, next: Partial<RowDraft>) => {
    setDrafts((previous) => ({
      ...previous,
      [productId]: {
        ...previous[productId],
        rank_score: previous[productId]?.rank_score ?? '',
        notes: previous[productId]?.notes ?? '',
        ...next,
      },
    }));
  }, []);

  const setRowState = useCallback((productId: number, patch: Partial<RowState>) => {
    setRowStates((previous) => ({
      ...previous,
      [productId]: {
        ...(previous[productId] ?? { pending: false, successMessage: '', errorMessage: '' }),
        ...patch,
      },
    }));
  }, []);

  const saveRanking = async (ranking: ProductRanking) => {
    const draft = drafts[ranking.product_id];
    if (!draft) return;

    const nextScore = Number(draft.rank_score);
    if (!Number.isFinite(nextScore)) {
      setRowState(ranking.product_id, {
        errorMessage: 'Rank-Score muss eine gueltige Zahl sein.',
        successMessage: '',
      });
      return;
    }

    setRowState(ranking.product_id, {
      pending: true,
      successMessage: '',
      errorMessage: '',
    });
    try {
      const response = await fetch(`/api/admin/product-rankings/${ranking.product_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          rank_score: nextScore,
          notes: draft.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Ranking konnte nicht gespeichert werden.'));
      }
      setRankings((previous) =>
        previous.map((row) =>
          row.product_id === ranking.product_id
            ? { ...row, rank_score: nextScore, notes: draft.notes.trim() || null }
            : row,
        ),
      );
      setRowState(ranking.product_id, {
        pending: false,
        successMessage: 'Gespeichert.',
        errorMessage: '',
      });
    } catch (err) {
      setRowState(ranking.product_id, {
        pending: false,
        errorMessage: err instanceof Error ? err.message : 'Ranking konnte nicht gespeichert werden.',
        successMessage: '',
      });
    }
  };

  const hasChanges = (ranking: ProductRanking) => {
    const draft = drafts[ranking.product_id];
    if (!draft) return false;
    return (
      draft.rank_score !== toStringValue(ranking.rank_score) ||
      (draft.notes ?? '') !== (ranking.notes ?? '')
    );
  };

  return (
    <>
      <AdminPageHeader
        title="Rankings"
        subtitle="Produkt-Rankings werden hier gepflegt. Score und Notizen nur mit explizitem Speichern aktualisieren."
        meta={<AdminBadge tone={loading ? 'warn' : 'ok'}>{rankings.length} Einträge</AdminBadge>}
      />

      <div className="admin-toolbar mb-4">
        <div className="admin-toolbar-inline">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suchen nach Produktname oder ID"
            className="admin-input min-w-[220px]"
          />
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />
            Aktualisieren
          </AdminButton>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      <AdminCard title="Produkt-Rankings bearbeiten">
        {loading && <AdminEmpty>Lade Rankings...</AdminEmpty>}

        {!loading && visibleRankings.length === 0 && <AdminEmpty>Keine Rankings vorhanden.</AdminEmpty>}

        {!loading && visibleRankings.length > 0 && (
          <>
            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Produkt-ID</th>
                    <th>Score</th>
                    <th>Notizen</th>
                    <th>Status</th>
                    <th className="w-[150px]">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRankings.map((ranking) => {
                    const state = rowStates[ranking.product_id];
                    const draft = drafts[ranking.product_id];
                    return (
                      <tr key={ranking.product_id}>
                        <td>{ranking.product_name}</td>
                        <td className="admin-mono">{ranking.product_id}</td>
                        <td>
                          <input
                            className="admin-input"
                            type="number"
                            step="0.1"
                            value={draft?.rank_score ?? toStringValue(ranking.rank_score)}
                            onChange={(event) => setDraft(ranking.product_id, { rank_score: event.target.value })}
                          />
                        </td>
                        <td>
                          <textarea
                            value={draft?.notes ?? ranking.notes ?? ''}
                            onChange={(event) => setDraft(ranking.product_id, { notes: event.target.value })}
                            className="admin-input min-h-[74px] py-2"
                          />
                        </td>
                        <td>
                          <AdminBadge tone={state?.successMessage ? 'ok' : state?.errorMessage ? 'danger' : 'neutral'}>
                            {state?.pending
                              ? 'Wird gespeichert'
                              : state?.successMessage
                                ? 'Gespeichert'
                                : state?.errorMessage
                                  ? 'Fehler'
                                  : 'Gespeichert'}
                          </AdminBadge>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <AdminButton
                              variant="primary"
                              size="sm"
                              onClick={() => void saveRanking(ranking)}
                              disabled={state?.pending || !hasChanges(ranking)}
                            >
                              {state?.pending ? <RefreshCw size={13} /> : <Save size={13} />}
                              Speichern
                            </AdminButton>
                            <div className="w-full text-xs admin-muted">
                              {state?.successMessage || state?.errorMessage}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {visibleRankings.map((ranking) => {
                const state = rowStates[ranking.product_id];
                const draft = drafts[ranking.product_id];
                const hasUnsaved = hasChanges(ranking);
                return (
                  <article key={ranking.product_id} className="rounded-[var(--admin-r-md)] border border-[color:var(--admin-line)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{ranking.product_name}</p>
                        <p className="admin-muted admin-mono text-xs">Produkt-ID {ranking.product_id}</p>
                      </div>
                      <AdminBadge tone={state?.successMessage ? 'ok' : state?.errorMessage ? 'danger' : 'neutral'}>
                        {state?.successMessage ? 'Gespeichert' : state?.errorMessage ? 'Fehler' : 'Bereit'}
                      </AdminBadge>
                    </div>

                    <label className="mt-3 block text-xs font-medium text-[color:var(--admin-ink-2)]">
                      Rank-Score
                      <input
                        type="number"
                        step="0.1"
                        className="admin-input mt-1"
                        value={draft?.rank_score ?? toStringValue(ranking.rank_score)}
                        onChange={(event) => setDraft(ranking.product_id, { rank_score: event.target.value })}
                      />
                    </label>

                    <label className="mt-3 block text-xs font-medium text-[color:var(--admin-ink-2)]">
                      Notizen
                      <textarea
                        rows={3}
                        className="admin-input mt-1 min-h-[72px] py-2"
                        value={draft?.notes ?? ranking.notes ?? ''}
                        onChange={(event) => setDraft(ranking.product_id, { notes: event.target.value })}
                      />
                    </label>

                    <AdminButton
                      variant="primary"
                      size="sm"
                      className="mt-3"
                      onClick={() => void saveRanking(ranking)}
                      disabled={state?.pending || !hasUnsaved}
                    >
                      <Save size={13} />
                      {state?.pending ? 'Speichere...' : 'Speichern'}
                    </AdminButton>
                    {(state?.successMessage || state?.errorMessage) && (
                      <p className={`mt-2 text-xs ${state?.successMessage ? 'text-[color:var(--admin-success-ink)]' : 'text-[color:var(--admin-danger-ink)]'}`}>
                        {state?.successMessage || state?.errorMessage}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </AdminCard>
    </>
  );
}
