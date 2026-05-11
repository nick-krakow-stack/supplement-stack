import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  MailCheck,
  MousePointerClick,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react';
import { AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminError, AdminPageHeader } from './AdminUi';

type UserRole = 'user' | 'admin';
type BooleanFilter = '' | 'true' | 'false';

type AdminUser = {
  id: number;
  email: string;
  name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  role: UserRole;
  created_at: string;
  health_consent: number | null;
  health_consent_at: string | null;
  email_verified_at: string | null;
  deleted_at: string | null;
  is_trusted_product_submitter: number;
  is_blocked_product_submitter: number;
  product_submission_blocked_at: string | null;
  product_submission_block_reason: string | null;
  stack_count: number;
  last_stack_at: string | null;
  stack_item_count?: number | null;
  product_in_stack_count?: number | null;
  products_in_stack_count?: number | null;
  link_click_count?: number | null;
  product_link_click_count?: number | null;
  user_product_count: number;
  pending_user_product_count: number;
  approved_user_product_count: number;
  verified_user_product_count?: number | null;
  blocked_user_product_count: number;
};

type UsersSummary = {
  total: number;
  admins: number;
  trusted: number;
  blocked_submitters: number;
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
  user?: Partial<Pick<AdminUser, 'id' | 'email' | 'role' | 'is_trusted_product_submitter' | 'is_blocked_product_submitter'>>;
  error?: string;
};

type UserFilters = {
  q: string;
  trusted: BooleanFilter;
  blocked: BooleanFilter;
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
    trusted: '',
    blocked: '',
  };
}

function booleanFilterFromSearchParams(searchParams: URLSearchParams, key: 'trusted' | 'blocked'): BooleanFilter {
  const value = searchParams.get(key);
  return value === 'true' || value === 'false' ? value : '';
}

function filtersFromSearchParams(searchParams: URLSearchParams): UserFilters {
  return {
    q: searchParams.get('q') ?? '',
    trusted: booleanFilterFromSearchParams(searchParams, 'trusted'),
    blocked: booleanFilterFromSearchParams(searchParams, 'blocked'),
  };
}

function searchParamsFromFilters(filters: UserFilters): URLSearchParams {
  const next = new URLSearchParams();
  if (filters.q.trim()) next.set('q', filters.q.trim());
  if (filters.trusted) next.set('trusted', filters.trusted);
  if (filters.blocked) next.set('blocked', filters.blocked);
  return next;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return parsed.toLocaleDateString('de-DE');
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'unbekannt';
  return parsed.toLocaleString('de-DE');
}

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE').format(value ?? 0);
}

function formatOptionalCount(value: number | null | undefined): string {
  return value == null ? '-' : formatCount(value);
}

function displayName(user: AdminUser): string {
  return user.name?.trim() || user.display_name?.trim() || user.full_name?.trim() || '';
}

function stackProductCount(user: AdminUser): number | null | undefined {
  return user.products_in_stack_count ?? user.product_in_stack_count ?? user.stack_item_count;
}

function linkClickCount(user: AdminUser): number | null | undefined {
  return user.link_click_count ?? user.product_link_click_count;
}

function approvedProductCount(user: AdminUser): number {
  return user.verified_user_product_count ?? user.approved_user_product_count ?? 0;
}

function normalizeSummary(summary?: Partial<UsersSummary>): UsersSummary {
  return {
    total: summary?.total ?? 0,
    admins: summary?.admins ?? 0,
    trusted: summary?.trusted ?? 0,
    blocked_submitters: summary?.blocked_submitters ?? 0,
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
  onBlockedToggle,
}: {
  user: AdminUser;
  busy: boolean;
  onRoleChange: (user: AdminUser, role: UserRole) => void;
  onTrustedToggle: (user: AdminUser) => void;
  onBlockedToggle: (user: AdminUser) => void;
}) {
  return (
    <div className="grid gap-3">
      <label className="text-xs font-medium text-[color:var(--admin-ink-2)]">
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
      <div className="flex flex-wrap gap-2">
        <AdminButton size="sm" onClick={() => onTrustedToggle(user)} disabled={busy}>
          <ShieldCheck size={13} />
          {user.is_trusted_product_submitter ? 'Trusted entfernen' : 'Trusted setzen'}
        </AdminButton>
        <AdminButton
          size="sm"
          variant={user.is_blocked_product_submitter ? 'danger' : 'default'}
          onClick={() => onBlockedToggle(user)}
          disabled={busy}
        >
          <X size={13} />
          {user.is_blocked_product_submitter ? 'Sperre entfernen' : 'Einreichungen sperren'}
        </AdminButton>
      </div>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--admin-r-sm)] border border-[color:var(--admin-line)] bg-white/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--admin-ink-3)]">{label}</div>
      <div className="mt-1 font-medium text-[color:var(--admin-ink)]">{value}</div>
    </div>
  );
}

function UserDetailPanel({
  user,
  busy,
  onClose,
  onRoleChange,
  onTrustedToggle,
  onBlockedToggle,
}: {
  user: AdminUser;
  busy: boolean;
  onClose: () => void;
  onRoleChange: (user: AdminUser, role: UserRole) => void;
  onTrustedToggle: (user: AdminUser) => void;
  onBlockedToggle: (user: AdminUser) => void;
}) {
  const name = displayName(user);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/25" role="dialog" aria-modal="true" aria-labelledby="admin-user-detail-title">
      <button type="button" className="absolute inset-0 hidden md:block" aria-label="Details schliessen" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full flex-col overflow-y-auto border-l border-[color:var(--admin-line)] bg-[color:var(--admin-bg)] p-4 shadow-2xl md:max-w-[480px] md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" className="admin-btn admin-btn-sm md:hidden" onClick={onClose}>
            <ArrowLeft size={14} />
            Zurueck
          </button>
          <button type="button" className="admin-icon-btn ml-auto" onClick={onClose} aria-label="Details schliessen">
            <X size={16} />
          </button>
        </div>

        <div className="admin-card admin-card-pad">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="admin-user-detail-title" className="admin-card-title">
                {name || user.email}
              </h2>
              {name && <p className="admin-muted mt-1 truncate">{user.email}</p>}
            </div>
            <AdminBadge tone={user.role === 'admin' ? 'info' : 'neutral'}>
              {user.role === 'admin' ? 'Admin' : 'Nutzer'}
            </AdminBadge>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            <AdminBadge tone={user.email_verified_at ? 'ok' : 'warn'}>
              {user.email_verified_at ? 'Aktiv' : 'Nicht aktiv'}
            </AdminBadge>
            <AdminBadge tone={user.is_trusted_product_submitter ? 'ok' : 'neutral'}>
              {user.is_trusted_product_submitter ? 'Trusted' : 'Nicht trusted'}
            </AdminBadge>
            <AdminBadge tone={user.is_blocked_product_submitter ? 'danger' : 'neutral'}>
              {user.is_blocked_product_submitter ? 'Einreichungen gesperrt' : 'Einreichungen offen'}
            </AdminBadge>
            {user.deleted_at && <AdminBadge tone="danger">Geloescht</AdminBadge>}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DetailMetric label="Erstellt" value={formatDateTime(user.created_at)} />
          <DetailMetric label="E-Mail aktiv" value={formatDateTime(user.email_verified_at)} />
          <DetailMetric label="Health Consent" value={user.health_consent ? formatDateTime(user.health_consent_at) : '-'} />
          <DetailMetric label="Letzter Stack" value={formatDateTime(user.last_stack_at)} />
        </div>

        <div className="mt-4 admin-card admin-card-pad">
          <h3 className="admin-card-title text-base">Nutzung</h3>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--admin-ink-2)]">
            <div>Stacks: {formatCount(user.stack_count)}</div>
            <div>Produkte im Stack: {formatOptionalCount(stackProductCount(user))}</div>
            <div>Link-Klicks: {formatOptionalCount(linkClickCount(user))}</div>
          </div>
        </div>

        <div className="mt-4 admin-card admin-card-pad">
          <h3 className="admin-card-title text-base">Beitrag</h3>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--admin-ink-2)]">
            <div>Eingereichte Produkte: {formatCount(user.user_product_count)}</div>
            <div>Freigegeben/verifiziert: {formatCount(approvedProductCount(user))}</div>
            <div>Gesperrte Produkte: {formatCount(user.blocked_user_product_count)}</div>
          </div>
        </div>

        <div className="mt-4 admin-card admin-card-pad">
          <h3 className="admin-card-title text-base">Administrative Details</h3>
          <div className="mt-3">
            <UserActions
              user={user}
              busy={busy}
              onRoleChange={onRoleChange}
              onTrustedToggle={onTrustedToggle}
              onBlockedToggle={onBlockedToggle}
            />
          </div>
          {user.product_submission_blocked_at && (
            <p className="admin-muted mt-3 text-xs">
              Sperre seit {formatDateTime(user.product_submission_blocked_at)}
              {user.product_submission_block_reason ? `: ${user.product_submission_block_reason}` : ''}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function AdministratorUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<UsersSummary>(() => normalizeSummary());
  const [draftFilters, setDraftFilters] = useState<UserFilters>(() => filtersFromSearchParams(searchParams));
  const [filters, setFilters] = useState<UserFilters>(() => filtersFromSearchParams(searchParams));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canLoadPrevious = page > 1;
  const canLoadNext = page < totalPages;
  const selectedUser = selectedUserId == null ? null : users.find((user) => user.id === selectedUserId) ?? null;

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((value) => value.trim().length > 0).length;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.trusted) params.set('trusted', filters.trusted);
      if (filters.blocked) params.set('blocked', filters.blocked);
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
    setSearchParams(searchParamsFromFilters(draftFilters));
  };

  const clearFilters = () => {
    const next = emptyFilters();
    setDraftFilters(next);
    setFilters(next);
    setSearchParams(new URLSearchParams());
    setPage(1);
    setError('');
  };

  const selectFilter = (partial: Partial<UserFilters>) => {
    const next = { ...emptyFilters(), ...partial };
    setDraftFilters(next);
    setFilters(next);
    setSearchParams(searchParamsFromFilters(next));
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
                is_blocked_product_submitter:
                  data.user?.is_blocked_product_submitter ?? entry.is_blocked_product_submitter,
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
      ? `${user.email} wirklich zum Admin machen?`
      : `Admin-Rechte für ${user.email} wirklich entfernen?`;
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

  const handleBlockedToggle = (user: AdminUser) => {
    const nextBlocked = !user.is_blocked_product_submitter;
    const text = nextBlocked
      ? `Neue Produkte von ${user.email} automatisch sperren?`
      : `Sperre für ${user.email} entfernen?`;
    if (!window.confirm(text)) return;
    void patchUser(
      user,
      { blocked_submitter: nextBlocked },
      'Sperrstatus konnte nicht gespeichert werden.',
    );
  };

  return (
    <>
      <AdminPageHeader
        title="Benutzerverwaltung"
        subtitle="Konten prüfen, Rollen und Einreichungen steuern."
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
        <button type="button" className="admin-health-card" data-tone="ok" onClick={clearFilters}>
          <span className="admin-health-label">
            <MailCheck size={14} />
            Aktiv
          </span>
          <span className="admin-health-value">{formatCount(summary.verified)}</span>
          <span className="admin-health-delta">E-Mail bestaetigt</span>
        </button>
        <button type="button" className="admin-health-card" data-tone="ok" onClick={() => selectFilter({ trusted: 'true' })}>
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
          data-tone={summary.blocked_submitters > 0 ? 'danger' : 'neutral'}
          onClick={() => selectFilter({ blocked: 'true' })}
        >
          <span className="admin-health-label">
            <X size={14} />
            Gesperrt
          </span>
          <span className="admin-health-value">{formatCount(summary.blocked_submitters)}</span>
          <span className="admin-health-delta">Neue Einreichungen werden blockiert</span>
        </button>
        <div className="admin-health-card" data-tone={summary.deleted > 0 ? 'danger' : 'neutral'}>
          <span className="admin-health-label">
            <X size={14} />
            Geloescht
          </span>
          <span className="admin-health-value">{formatCount(summary.deleted)}</span>
          <span className="admin-health-delta">deleted_at gesetzt</span>
        </div>
      </div>

      <div className="mb-4 admin-filter-bar">
        <div className="admin-filter-main">
          <label className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--admin-ink-3)]" />
            <input
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((previous) => ({ ...previous, q: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters();
              }}
              placeholder="E-Mail suchen"
              className="admin-input admin-filter-search pl-9"
            />
          </label>
        </div>
        <div className="admin-filter-controls">
          <select
            value={draftFilters.trusted}
            onChange={(event) => setDraftFilters((previous) => ({ ...previous, trusted: event.target.value as BooleanFilter }))}
            className="admin-select"
            aria-label="Trusted filtern"
          >
            <option value="">Trusted: alle</option>
            <option value="true">Trusted</option>
            <option value="false">Nicht trusted</option>
          </select>
          <select
            value={draftFilters.blocked}
            onChange={(event) => setDraftFilters((previous) => ({ ...previous, blocked: event.target.value as BooleanFilter }))}
            className="admin-select"
            aria-label="Sperrstatus"
          >
            <option value="">Alle Sperren</option>
            <option value="true">Gesperrt</option>
            <option value="false">Nicht gesperrt</option>
          </select>
        </div>
        <div className="admin-filter-actions">
          <AdminButton variant="primary" onClick={applyFilters}>
            <Search size={13} />
            Suchen
          </AdminButton>
          <AdminButton onClick={clearFilters} disabled={activeFilterCount === 0 && draftFilters.q === ''}>
            <X size={13} />
            Zuruecksetzen
          </AdminButton>
          <AdminButton onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} />
            Aktualisieren
          </AdminButton>
        </div>
      </div>

      {error && <AdminError>{error}</AdminError>}

      <AdminCard
        title="Benutzerkonten"
        subtitle="Nutzung, Beiträge und Sperren im Überblick."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton size="sm" onClick={() => setPage((previous) => Math.max(1, previous - 1))} disabled={!canLoadPrevious || loading}>
              <ChevronLeft size={13} />
              Zurueck
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
              aria-label="Eintraege pro Seite"
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
              {users.map((user) => {
                const name = displayName(user);
                return (
                  <article key={user.id} className="admin-card admin-card-pad">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                          {name || user.email}
                        </div>
                        {name && <div className="admin-muted mt-1 truncate">{user.email}</div>}
                        <div className="admin-muted mt-1 text-xs">Erstellt am {formatDate(user.created_at)}</div>
                      </div>
                      {user.is_blocked_product_submitter && <AdminBadge tone="danger">Gesperrt</AdminBadge>}
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-[color:var(--admin-ink-2)]">
                      <div>Stacks: {formatCount(user.stack_count)} / Produkte im Stack: {formatOptionalCount(stackProductCount(user))}</div>
                      <div>Link-Klicks: {formatOptionalCount(linkClickCount(user))}</div>
                      <div>
                        Beitrag: {formatCount(user.user_product_count)} eingereicht, {formatCount(approvedProductCount(user))} freigegeben,{' '}
                        {formatCount(user.blocked_user_product_count)} gesperrt
                      </div>
                    </div>
                    <div className="mt-3">
                      <AdminButton size="sm" onClick={() => setSelectedUserId(user.id)}>
                        <Eye size={13} />
                        Details
                      </AdminButton>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="admin-table-wrap hidden md:block">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nutzer</th>
                    <th>Nutzung</th>
                    <th>Beitrag</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const name = displayName(user);
                    return (
                      <tr key={user.id}>
                        <td className="min-w-[260px]">
                          <div className="font-medium" style={{ fontFamily: 'var(--admin-serif)' }}>
                            {name || user.email}
                          </div>
                          {name && <div className="admin-muted mt-1 text-xs">{user.email}</div>}
                          <div className="admin-muted mt-1 flex items-center gap-1 text-xs">
                            <Calendar size={12} />
                            Erstellt am {formatDate(user.created_at)}
                          </div>
                          {user.deleted_at && (
                            <div className="mt-1 text-xs text-[color:var(--admin-danger-ink)]">
                              Geloescht: {formatDate(user.deleted_at)}
                            </div>
                          )}
                        </td>
                        <td className="min-w-[220px]">
                          <div className="flex items-center gap-2 text-xs text-[color:var(--admin-ink-2)]">
                            <PackageCheck size={13} />
                            {formatCount(user.stack_count)} Stacks
                          </div>
                          <div className="admin-muted mt-1 text-xs">
                            Produkte im Stack: {formatOptionalCount(stackProductCount(user))}
                          </div>
                          <div className="admin-muted mt-1 flex items-center gap-2 text-xs">
                            <MousePointerClick size={13} />
                            Link-Klicks: {formatOptionalCount(linkClickCount(user))}
                          </div>
                        </td>
                        <td className="min-w-[240px]">
                          <div className="flex items-center gap-2 text-xs text-[color:var(--admin-ink-2)]">
                            <Mail size={13} />
                            {formatCount(user.user_product_count)} eingereicht
                          </div>
                          <div className="admin-muted mt-1 text-xs">
                            {formatCount(approvedProductCount(user))} freigegeben/verifiziert
                          </div>
                          <div className="admin-muted mt-1 text-xs">
                            {formatCount(user.blocked_user_product_count)} gesperrt
                          </div>
                        </td>
                        <td className="w-[1%] whitespace-nowrap text-right">
                          <AdminButton size="sm" onClick={() => setSelectedUserId(user.id)}>
                            <Eye size={13} />
                            Details
                          </AdminButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminCard>

      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          busy={busyUserId === selectedUser.id}
          onClose={() => setSelectedUserId(null)}
          onRoleChange={handleRoleChange}
          onTrustedToggle={handleTrustedToggle}
          onBlockedToggle={handleBlockedToggle}
        />
      )}
    </>
  );
}
