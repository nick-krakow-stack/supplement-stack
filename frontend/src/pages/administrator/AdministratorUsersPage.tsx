import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MailCheck, RefreshCw, Search, ShieldCheck, UserCog, X } from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type UserRole = 'user' | 'admin';
type BooleanFilter = '' | 'true' | 'false';

type AdminUser = {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
  health_consent: number | null;
  health_consent_at: string | null;
  email_verified_at: string | null;
  deleted_at: string | null;
  is_trusted_product_submitter: number;
  stack_count: number;
  last_stack_at: string | null;
  user_product_count: number;
  pending_user_product_count: number;
  approved_user_product_count: number;
};

type UsersSummary = {
  total: number;
  admins: number;
  trusted: number;
  verified: number;
  unverified: number;
  deleted: number;
};

type UsersResponse = {
  users?: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  summary?: Partial<UsersSummary>;
};

type UserPatchResponse = {
  ok?: boolean;
  user?: Partial<Pick<AdminUser, 'id' | 'email' | 'role' | 'is_trusted_product_submitter'>>;
  error?: string;
};

type UserFilters = {
  q: string;
  role: '' | UserRole;
  trusted: BooleanFilter;
  verified: BooleanFilter;
};

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

async function parseError(response: Response, fallback: string): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

function emptyFilters(): UserFilters {
  return {
    q: '',
    role: '',
    trusted: '',
    verified: '',
  };
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return parsed.toLocaleString('de-DE');
}

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE').format(value ?? 0);
}

function roleTone(role: UserRole): 'neutral' | 'ok' | 'warn' | 'danger' | 'info' {
  return role === 'admin' ? 'info' : 'neutral';
}

function statusBadges(user: AdminUser) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AdminBadge tone={roleTone(user.role)}>{user.role === 'admin' ? 'Admin' : 'Nutzer'}</AdminBadge>
      <AdminBadge tone={user.is_trusted_product_submitter ? 'ok' : 'neutral'}>
        {user.is_trusted_product_submitter ? 'Trusted' : 'Nicht trusted'}
      </AdminBadge>
      <AdminBadge tone={user.email_verified_at ? 'ok' : 'warn'}>
        {user.email_verified_at ? 'Verifiziert' : 'Unverifiziert'}
      </AdminBadge>
      {user.deleted_at && <AdminBadge tone="danger">Gelöscht</AdminBadge>}
    </div>
  );
}

function normalizeSummary(summary?: Partial<UsersSummary>): UsersSummary {
  return {
    total: summary?.total ?? 0,
    admins: summary?.admins ?? 0,
    trusted: summary?.trusted ?? 0,
    verified: summary?.verified ?? 0,
    unverified: summary?.unverified ?? 0,
    deleted: summary?.deleted ?? 0,
  };
}

function UserActions({
  user,
  busy,
  onRoleChange,
  onTrustedToggle,
}: {
  user: AdminUser;
  busy: boolean;
  onRoleChange: (user: AdminUser, role: UserRole) => void;
  onTrustedToggle: (user: AdminUser) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-[116px] text-xs font-medium text-[color:var(--admin-ink-2)]">
        Rolle
        <select
          value={user.role}
          onChange={(event) => onRoleChange(user, event.target.value as UserRole)}
          disabled={busy}
          className="admin-select mt-1"
        >
          <option value="user">Nutzer</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <AdminButton size="sm" onClick={() => onTrustedToggle(user)} disabled={busy}>
        <ShieldCheck size={13} />
        {user.is_trusted_product_submitter ? 'Trusted entfernen' : 'Trusted setzen'}
      </AdminButton>
    </div>
  );
}

export default function AdministratorUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<UsersSummary>(() => normalizeSummary());
  const [draftFilters, setDraftFilters] = useState<UserFilters>(() => emptyFilters());
  const [filters, setFilters] = useState<UserFilters>(() => emptyFilters());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canLoadPrevious = page > 1;
  const canLoadNext = page < totalPages;

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((value) => value.trim().length > 0).length;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.role) params.set('role', filters.role);
      if (filters.trusted) params.set('trusted', filters.trusted);
      if (filters.verified) params.set('verified', filters.verified);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
        headers: JSON_HEADERS,
      });
      if (!response.ok) {
        throw new Error(await parseError(response, 'Benutzer konnten nicht geladen werden.'));
      }
      const data = (await response.json()) as UsersResponse;
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setSummary(normalizeSummary(data.summary));
    } catch (err) {
      setUsers([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Benutzer konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setError('');
    setPage(1);
    setFilters(draftFilters);
  };

  const clearFilters = () => {
    const next = emptyFilters();
    setDraftFilters(next);
    setFilters(next);
    setPage(1);
    setError('');
  };

  const patchUser = async (user: AdminUser, body: Record<string, unknown>, fallback: string) => {
    setBusyUserId(user.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, fallback));
      }
      const data = (await response.json()) as UserPatchResponse;
      setUsers((previous) =>
        previous.map((entry) =>
          entry.id === user.id
            ? {
                ...entry,
                role: data.user?.role ?? entry.role,
                is_trusted_product_submitter:
                  data.user?.is_trusted_product_submitter ?? entry.is_trusted_product_submitter,
              }
            : entry,
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRoleChange = (user: AdminUser, role: UserRole) => {
    if (role === user.role) return;
    const text = role === 'admin'
      ? `Nutzer #${user.id} wirklich zum Admin machen?`
      : `Admin-Rechte für Nutzer #${user.id} wirklich entfernen?`;
    if (!window.confirm(text)) return;
    void patchUser(user, { role }, 'Rolle konnte nicht gespeichert werden.');
  };

  const handleTrustedToggle = (user: AdminUser) => {
    void patchUser(
      user,
      { trusted_submitter: user.is_trusted_product_submitter ? false : true },
      'Trusted-Submitter-Status konnte nicht gespeichert werden.',
    );
  };

  return (
    <>
      <AdminPageHeader
        title="Benutzerverwaltung"
        subtitle="Konten suchen, Rollen prüfen und den Vertrauensstatus für eingereichte Produkte verwalten. Passwort-, Token- und Session-Daten werden hier nicht angezeigt."
        meta={<AdminBadge tone="info">{formatCount(total)} Treffer</AdminBadge>}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <button type="button" className="admin-health-card" data-tone="info" onClick={clearFilters}>
          <span className="admin-health-label">
            <UserCog size={14} />
            Gesamt
          </span>
          <span className="admin-health-value">{formatCount(summary.total)}</span>
          <span className="admin-health-delta">{formatCount(summary.admins)} Admins</span>
        </button>
        <button
          type="button"
          className="admin-health-card"
          data-tone="ok"
          onClick={() => {
            setDraftFilters((previous) => ({ ...previous, trusted: 'true' }));
            setFilters((previous) => ({ ...previous, trusted: 'true' }));
            setPage(1);
          }}
        >
          <span className="admin-health-label">
            <ShieldCheck size={14} />
            Trusted
          </span>
          <span className="admin-health-value">{formatCount(summary.trusted)}</span>
          <span className="admin-health-delta">Automatische Freigabe für Einreichungen</span>
        </button>
        <button
          type="button"
          className="admin-health-card"
          data-tone="ok"
          onClick={() => {
            setDraftFilters((previous) => ({ ...previous, verified: 'true' }));
            setFilters((previous) => ({ ...previous, verified: 'true' }));
            setPage(1);
          }}
        >
          <span className="admin-health-label">
            <MailCheck size={14} />
            Verifiziert
          </span>
          <span className="admin-health-value">{formatCount(summary.verified)}</span>
          <span className="admin-health-delta">E-Mail bestaetigt</span>
        </button>
        <button
          type="button"
          className="admin-health-card"
          data-tone="warn"
          onClick={() => {
            setDraftFilters((previous) => ({ ...previous, verified: 'false' }));
            setFilters((previous) => ({ ...previous, verified: 'false' }));
            setPage(1);
          }}
        >
          <span className="admin-health-label">Unverifiziert</span>
          <span className="admin-health-value">{formatCount(summary.unverified)}</span>
          <span className="admin-health-delta">kein Verifizierungsdatum</span>
        </button>
        <div className="admin-health-card" data-tone={summary.deleted > 0 ? 'danger' : 'neutral'}>
          <span className="admin-health-label">
            <X size={14} />
            Gelöscht
          </span>
          <span className="admin-health-value">{formatCount(summary.deleted)}</span>
          <span className="admin-health-delta">deleted_at gesetzt</span>
        </div>
      </div>

      <AdminCard className="mb-4" title="Filter" subtitle="Serverseitige Suche und Paginierung." padded>
        <div className="admin-toolbar-inline">
          <label className="relative min-w-[240px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
            <input
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, q: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters();
              }}
              placeholder="E-Mail oder Nutzer-ID suchen"
              className="admin-input pl-9"
            />
          </label>
          <select
            value={draftFilters.role}
            onChange={(event) => setDraftFilters((previous) => ({ ...previous, role: event.target.value as UserFilters['role'] }))}
            className="admin-select min-w-[150px]"
            aria-label="Rolle filtern"
          >
            <option value="">Alle Rollen</option>
            <option value="user">Nutzer</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={draftFilters.trusted}
            onChange={(event) => setDraftFilters((previous) => ({ ...previous, trusted: event.target.value as BooleanFilter }))}
            className="admin-select min-w-[170px]"
            aria-label="Trusted filtern"
          >
            <option value="">Trusted: alle</option>
            <option value="true">Trusted</option>
            <option value="false">Nicht trusted</option>
          </select>
          <select
            value={draftFilters.verified}
            onChange={(event) => setDraftFilters((previous) => ({ ...previous, verified: event.target.value as BooleanFilter }))}
            className="admin-select min-w-[190px]"
            aria-label="Verifizierung filtern"
          >
            <option value="">Verifizierung: alle</option>
            <option value="true">Verifiziert</option>
            <option value="false">Unverifiziert</option>
          </select>
          <AdminButton variant="primary" onClick={applyFilters}>
            <Search size={13} />
            Suchen
          </AdminButton>
          <AdminButton onClick={clearFilters} disabled={activeFilterCount === 0 && draftFilters.q === ''}>
            <X size={13} />
            Zurücksetzen
          </AdminButton>
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} />
            Aktualisieren
          </AdminButton>
        </div>
      </AdminCard>

      {error && <AdminError>{error}</AdminError>}

      <AdminCard
        title="Benutzerkonten"
        subtitle="Nur Rolle und Trusted-Submitter-Status sind editierbar. Weitere Kontodaten bleiben bewusst read-only."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton size="sm" onClick={() => setPage((previous) => Math.max(1, previous - 1))} disabled={!canLoadPrevious || loading}>
              <ChevronLeft size={13} />
              Zurück
            </AdminButton>
            <AdminBadge tone="neutral">
              Seite {page} / {totalPages}
            </AdminBadge>
            <AdminButton size="sm" onClick={() => setPage((previous) => previous + 1)} disabled={!canLoadNext || loading}>
              Weiter
              <ChevronRight size={13} />
            </AdminButton>
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="admin-select w-[96px]"
              aria-label="Einträge pro Seite"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {loading && <AdminEmpty>Lade Benutzer...</AdminEmpty>}

        {!loading && users.length === 0 && (
          <AdminEmpty>{activeFilterCount > 0 ? 'Keine Benutzer mit diesen Filtern gefunden.' : 'Keine Benutzer vorhanden.'}</AdminEmpty>
        )}

        {!loading && users.length > 0 && (
          <>
            <div className="grid gap-3 md:hidden">
              {users.map((user) => (
                <article key={user.id} className="admin-card admin-card-pad">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                        {user.email}
                      </div>
                      <div className="admin-muted admin-mono mt-1">#{user.id}</div>
                    </div>
                    {statusBadges(user)}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[color:var(--admin-ink-2)]">
                    <div>Erstellt: {formatDate(user.created_at)}</div>
                    <div>E-Mail verifiziert: {formatDate(user.email_verified_at)}</div>
                    <div>Stacks: {formatCount(user.stack_count)} / Einreichungen: {formatCount(user.user_product_count)}</div>
                    <div>Wartende Produkte: {formatCount(user.pending_user_product_count)}</div>
                  </div>
                  <div className="mt-3">
                    <UserActions
                      user={user}
                      busy={busyUserId === user.id}
                      onRoleChange={handleRoleChange}
                      onTrustedToggle={handleTrustedToggle}
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nutzer</th>
                    <th>Status</th>
                    <th>Nutzung</th>
                    <th>Verifizierung</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="min-w-[260px]">
                        <div className="font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                          {user.email}
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          <span className="admin-mono">#{user.id}</span>
                          {' - '}
                          Erstellt {formatDate(user.created_at)}
                        </div>
                        {user.deleted_at && (
                          <div className="mt-1 text-xs text-[color:var(--admin-danger-ink)]">
                            Gelöscht: {formatDate(user.deleted_at)}
                          </div>
                        )}
                      </td>
                      <td className="min-w-[180px]">{statusBadges(user)}</td>
                      <td className="min-w-[200px]">
                        <div className="text-xs text-[color:var(--admin-ink-2)]">
                          {formatCount(user.stack_count)} Stack(s)
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          {formatCount(user.user_product_count)} Nutzer-Produkte, {formatCount(user.pending_user_product_count)} offen
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          Letzter Stack: {formatDate(user.last_stack_at)}
                        </div>
                      </td>
                      <td className="min-w-[180px]">
                        <div className="text-xs text-[color:var(--admin-ink-2)]">
                          E-Mail: {formatDate(user.email_verified_at)}
                        </div>
                        <div className="admin-muted mt-1 text-xs">
                          Health Consent: {user.health_consent ? formatDate(user.health_consent_at) : 'fehlt'}
                        </div>
                      </td>
                      <td className="min-w-[260px]">
                        <UserActions
                          user={user}
                          busy={busyUserId === user.id}
                          onRoleChange={handleRoleChange}
                          onTrustedToggle={handleTrustedToggle}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminCard>
    </>
  );
}
