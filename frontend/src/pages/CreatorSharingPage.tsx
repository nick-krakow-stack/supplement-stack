import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getStacks } from '../api/stacks';
import {
  createCreatorShare,
  creatorSharingEnabled,
  getCreatorAccess,
  getCreatorDashboard,
  getCreatorOwnedSharePreview,
  getCreatorPortfolio,
  getCreatorShareReadiness,
  setCreatorShareArchived,
  updateCreatorShareLifecycle,
  type CreatorDashboard,
  type CreatorDashboardMetricSet,
  type CreatorLifecycleAction,
  type CreatorMetricsPeriod,
  type CreatorOwnedShare,
  type CreatorOwnedSharePreview,
  type CreatorParty,
  type CreatorPortfolioArchiveFilter,
  type CreatorPortfolioSort,
  type CreatorReadinessProduct,
  type CreatorSharePreview,
  type CreatorShareReadiness,
  type CreatorShareStatus,
  type CreatorSourceShareGuard,
} from '../api/creatorSharing';
import CreatorRecommendationPreview from '../components/CreatorRecommendationPreview';
import ModalWrapper from '../components/modals/ModalWrapper';
import { useAuth } from '../contexts/AuthContext';
import {
  clearCreatorAuthorDraft,
  readActiveCreatorAuthorDraft,
  readCreatorAuthorDraft,
  readSelectedCreatorParty,
  writeCreatorAuthorDraft,
  writeSelectedCreatorParty,
  type CreatorAuthorDraft,
  type CreatorAuthorDraftScope,
} from '../lib/creatorAuthorDraft';
import type { Stack, StackItem } from '../types';
import { countLabel } from '../lib/displayCopy';

type CreatorView = 'stack' | 'product' | 'portfolio';
type ShareableStackItem = StackItem & {
  name?: string;
  brand?: string | null;
  image_url?: string | null;
  product_type?: 'catalog' | 'user_product';
  serving_unit?: string | null;
  timing_label?: string | null;
};
type StackDetails = { stack: Stack; items: ShareableStackItem[] };
type PrefillDraft = { preview: CreatorOwnedSharePreview };
type ModerationGuidance = { element_id: string; reason: string; target_label: string };
type PortfolioFilters = {
  q: string;
  status: CreatorShareStatus | 'all';
  archive: CreatorPortfolioArchiveFilter;
  sort: CreatorPortfolioSort;
};

const STATUS_LABELS: Record<CreatorShareStatus, string> = {
  pending: 'Wird geprüft',
  approved: 'Freigegeben',
  blocked: 'Nicht freigegeben',
  paused: 'Pausiert',
  revoked: 'Von dir beendet',
  expired: 'Abgelaufen',
};

const STATUS_CLASSES: Record<CreatorShareStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  blocked: 'border-rose-200 bg-rose-50 text-rose-800',
  paused: 'border-blue-200 bg-blue-50 text-blue-800',
  revoked: 'border-slate-200 bg-slate-100 text-slate-700',
  expired: 'border-slate-200 bg-slate-100 text-slate-700',
};

const ROLE_LABELS: Record<CreatorParty['role'], string> = {
  owner: 'Inhaber',
  editor: 'Kann bearbeiten',
  viewer: 'Nur ansehen',
};

const READINESS_REASONS: Record<string, string> = {
  product_missing: 'Das Produkt ist nicht mehr verfügbar und muss im Stack ersetzt oder entfernt werden.',
  own_product_not_published: 'Produkt ist noch nicht freigegeben. Prüfe den Freigabestatus deines eigenen Produkts.',
  not_approved: 'Produkt ist noch nicht freigegeben.',
  not_visible: 'Das Produkt ist für diese öffentliche Empfehlung nicht sichtbar.',
  owner_inactive: 'Der Produktanbieter ist derzeit nicht freigeschaltet.',
  shop_link_missing: 'Shop-Link fehlt. Für dieses Produkt ist noch kein nutzbarer Shop-Link hinterlegt.',
  shop_link_unsafe: 'Der hinterlegte Shop-Link kann derzeit nicht sicher geöffnet werden.',
  intake_missing: 'Im Stack fehlt die Angabe, wie oft das Produkt genutzt wird.',
  main_ingredient_missing: 'Die Produktangaben sind noch nicht vollständig geprüft.',
};

const PORTFOLIO_LIMIT = 20;
const CREATOR_VIEWS: CreatorView[] = ['stack', 'product', 'portfolio'];

function creatorCanEdit(party: CreatorParty | null): boolean {
  return party?.role === 'owner' || party?.role === 'editor';
}

function stackItemId(item: ShareableStackItem): number | null {
  const value = Number(item.stack_item_id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function positiveId(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function creatorView(value: string | null): CreatorView {
  return value === 'product' || value === 'portfolio' ? value : 'stack';
}

function statusFilter(value: string | null): PortfolioFilters['status'] {
  return value && Object.prototype.hasOwnProperty.call(STATUS_LABELS, value) ? value as CreatorShareStatus : 'all';
}

function archiveFilter(value: string | null): CreatorPortfolioArchiveFilter {
  return value === 'archived' || value === 'all' ? value : 'active';
}

function sortFilter(value: string | null): CreatorPortfolioSort {
  return value === 'oldest' ? 'oldest' : 'newest';
}

function formatCreatedAt(value: number): string {
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatDay(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatTimestamp(value: number): string {
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function clipboardText(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

function friendlyCreatorError(caught: unknown, fallback: string): string {
  const response = (caught as {
    response?: {
      status?: number;
      data?: { code?: string; products?: Array<{ product_name?: string }> };
    };
  })?.response;
  if (response?.data?.code === 'STACK_NOT_FULLY_SHAREABLE') {
    const names = (response.data.products ?? [])
      .map((product) => product.product_name?.trim())
      .filter((name): name is string => Boolean(name));
    const productText = names.length > 0 ? ` Betroffen: ${names.join(', ')}.` : '';
    return `Dieser Stack kann noch nicht vollständig geteilt werden.${productText} Prüfe die Hinweise bei den betroffenen Produkten.`;
  }
  if (response?.status === 403) return 'Du darfst diese Aktion nicht ausführen. Bitte prüfe deine Rolle und lade die Seite neu.';
  if (response?.status === 409) return 'Die Empfehlung wurde inzwischen geändert. Lade die Liste neu und versuche es noch einmal.';
  return fallback;
}

function readinessReason(product: CreatorReadinessProduct): string {
  if (!product.reason_code) return 'Dieses Produkt ist noch nicht vollständig für das Teilen vorbereitet.';
  return READINESS_REASONS[product.reason_code]
    ?? 'Dieses Produkt ist noch nicht vollständig für das Teilen vorbereitet.';
}

function readBoundAuthorDraft(
  userId: number | null,
  partyId: number | null,
  view: CreatorView,
  stackId: number | null,
  stackItemIdValue: number | null,
  sourceShareId: number | null,
): CreatorAuthorDraft | null {
  if (!userId || !partyId || !stackId || view === 'portfolio') return null;
  return readCreatorAuthorDraft({
    user_id: userId,
    party_id: partyId,
    view,
    stack_id: stackId,
    stack_item_id: view === 'product' ? stackItemIdValue : null,
    source_share_id: sourceShareId,
  });
}

function effectiveStatus(share: CreatorOwnedShare): CreatorShareStatus {
  return share.paused_at && share.status === 'approved' ? 'paused' : share.status;
}

function moderationTarget(share: CreatorOwnedShare, preview?: CreatorOwnedSharePreview | null): string | null {
  if (!share.moderation_target) return null;
  if (share.moderation_target === 'title') return 'Name der Empfehlung';
  const previewItem = share.moderation_item_index === null
    ? null
    : preview?.items[share.moderation_item_index] ?? null;
  const itemName = share.moderation_item_name?.trim() || previewItem?.product_name?.trim() || null;
  if (share.moderation_target === 'creator_statement') {
    return share.moderation_item_index === null
      ? 'Persönlicher Hinweis'
      : itemName ? `Persönlicher Hinweis bei ${itemName}` : 'Persönlicher Hinweis beim betroffenen Produkt';
  }
  if (share.moderation_target === 'product') {
    return itemName ? `Produkt ${itemName}` : 'Betroffenes Produkt';
  }
  return 'Inhalt der Empfehlung';
}

function metricComparison(current: number, previous: number): string {
  const delta = current - previous;
  if (delta === 0) return 'gleich wie im vorherigen Zeitraum';
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString('de-DE')} gegenüber dem vorherigen Zeitraum`;
}

function lifecycleMessage(action: CreatorLifecycleAction): string {
  if (action === 'pause') return 'Der Link ist pausiert und kann später wieder aktiviert werden.';
  if (action === 'resume') return 'Der Link ist wieder aktiv.';
  if (action === 'set_expiry') return 'Das Ablaufdatum wurde gespeichert.';
  if (action === 'clear_expiry') return 'Das Ablaufdatum wurde entfernt.';
  return 'Der Link wurde dauerhaft beendet. Die Empfehlung bleibt in deinem Portfolio erhalten.';
}

function statusNextStep(status: CreatorShareStatus): string {
  if (status === 'pending') return 'Die Empfehlung wird geprüft. Du musst jetzt nichts tun; den verbindlichen Stand siehst du immer hier.';
  if (status === 'approved') return 'Der Link ist freigegeben. Du kannst ihn teilen oder über „Link verwalten“ pausieren, begrenzen oder beenden.';
  if (status === 'blocked') return 'Die Empfehlung ist noch nicht öffentlich. Lies die Rückmeldung und sende eine überarbeitete Version.';
  if (status === 'paused') return 'Der Link ist vorübergehend nicht erreichbar. Über „Link verwalten“ kannst du ihn wieder aktivieren.';
  if (status === 'expired') return 'Das Ablaufdatum ist erreicht und der Link nicht mehr erreichbar. Du kannst einen neuen aktuellen Stand erstellen.';
  return 'Der Link wurde dauerhaft beendet. Du kannst aus dem aktuellen Stand eine neue Empfehlung erstellen.';
}

function expirySeconds(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59`);
  const seconds = Math.floor(date.getTime() / 1000);
  return Number.isSafeInteger(seconds) && seconds > Math.floor(Date.now() / 1000) ? seconds : null;
}

function CreatorDashboardPanel({ dashboard }: { dashboard: CreatorDashboard }) {
  const cards: Array<{ key: keyof CreatorDashboardMetricSet; label: string }> = [
    { key: 'unique_visitors', label: 'Erfasste eindeutige Besuche (mit Statistik-Zustimmung)' },
    { key: 'clicks', label: 'Produktklicks' },
    { key: 'saves', label: 'In einen Stack übernommen' },
    { key: 'imported_stacks', label: 'Übernommene Stacks' },
    { key: 'clicked_products', label: 'Angeklickte Produkte' },
    { key: 'clicked_shops', label: 'Genutzte Shops' },
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="creator-dashboard-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="creator-dashboard-heading" className="text-xl font-black text-slate-950">Übersicht der letzten {dashboard.period.days} Tage</h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatDay(dashboard.period.from)} bis {formatDay(dashboard.period.to)} · Vergleich mit {formatDay(dashboard.period.previous_from)} bis {formatDay(dashboard.period.previous_to)}
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            Diese Besuchszahl ist bewusst unvollständig: Besuche ohne Statistik-Zustimmung sind nicht enthalten. Automatische Aufrufe werden, soweit erkennbar, ausgeschlossen.
          </p>
        </div>
        <p className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-800">
          {countLabel(dashboard.active_shares, 'freigegebener Link', 'freigegebene Links')}
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, label }) => (
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={key}>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{dashboard.current[key].toLocaleString('de-DE')}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{metricComparison(dashboard.current[key], dashboard.previous[key])}</p>
          </article>
        ))}
      </div>
      {dashboard.trend.length > 0 && (
        <details className="mt-5 rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-black text-slate-800">Tagestrend ansehen</summary>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto" role="list" aria-label="Tagestrend">
            {dashboard.trend.map((entry) => (
              <p className="text-sm text-slate-600" role="listitem" key={entry.date}>
                <span className="font-bold text-slate-800">{formatDay(entry.date)}:</span>{' '}
                {countLabel(entry.unique_visitors, 'erfasster eindeutiger Besuch', 'erfasste eindeutige Besuche')} (mit Statistik-Zustimmung) · {countLabel(entry.clicks, 'Klick', 'Klicks')} · {countLabel(entry.saves, 'Übernahme', 'Übernahmen')}
              </p>
            ))}
          </div>
        </details>
      )}
      <details className="mt-3 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-black text-slate-800">So werden die Zahlen gezählt</summary>
        <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          {cards.map(({ key, label }) => (
            <div key={key}><dt className="inline font-bold text-slate-800">{label}: </dt><dd className="inline">{dashboard.period.definitions[key]}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  );
}

export default function CreatorSharingPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParams = useRef(new URLSearchParams(searchParams));
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [accessState, setAccessState] = useState<'active' | 'not_invited' | 'blocked' | null>(null);
  const [parties, setParties] = useState<CreatorParty[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksLoaded, setStacksLoaded] = useState(false);
  const [stacksError, setStacksError] = useState(false);
  const [stacksAttempt, setStacksAttempt] = useState(0);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [stackId, setStackId] = useState<number | null>(positiveId(searchParams.get('stack')));
  const [details, setDetails] = useState<StackDetails | null>(null);
  const [readiness, setReadiness] = useState<CreatorShareReadiness | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [view, setView] = useState<CreatorView>(() => creatorView(searchParams.get('bereich')));
  const [stackItemIdValue, setStackItemIdValue] = useState<number | null>(positiveId(searchParams.get('product')));
  const [title, setTitle] = useState('');
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [ownedShares, setOwnedShares] = useState<CreatorOwnedShare[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioLoadingMore, setPortfolioLoadingMore] = useState(false);
  const [portfolioError, setPortfolioError] = useState(false);
  const [portfolioCursor, setPortfolioCursor] = useState<string | null>(null);
  const [portfolioHasMore, setPortfolioHasMore] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState<CreatorMetricsPeriod | null>(null);
  const [portfolioReload, setPortfolioReload] = useState(0);
  const [filters, setFilters] = useState<PortfolioFilters>(() => ({
    q: searchParams.get('q')?.trim() ?? '',
    status: statusFilter(searchParams.get('status')),
    archive: archiveFilter(searchParams.get('archive')),
    sort: sortFilter(searchParams.get('sort')),
  }));
  const [searchInput, setSearchInput] = useState(filters.q);
  const [expandedShareId, setExpandedShareId] = useState<number | null>(null);
  const [ownedPreview, setOwnedPreview] = useState<CreatorOwnedSharePreview | null>(null);
  const [directPreview, setDirectPreview] = useState<CreatorOwnedSharePreview | null>(null);
  const [pendingDeepLinkPreview, setPendingDeepLinkPreview] = useState<CreatorOwnedSharePreview | null>(null);
  const [busyShareId, setBusyShareId] = useState<number | null>(null);
  const [detailsRequest, setDetailsRequest] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missingOriginalProduct, setMissingOriginalProduct] = useState(false);
  const [sourceShareGuard, setSourceShareGuard] = useState<CreatorSourceShareGuard | null>(null);
  const [lifecycleShare, setLifecycleShare] = useState<CreatorOwnedShare | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<CreatorLifecycleAction>('pause');
  const [expiryInput, setExpiryInput] = useState('');
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [moderationGuidance, setModerationGuidance] = useState<ModerationGuidance | null>(null);
  const previewTimestamp = useRef(new Date().toISOString());
  const detailsLoadRequestId = useRef(0);
  const stackItemSelectionRef = useRef(stackItemIdValue);
  stackItemSelectionRef.current = stackItemIdValue;
  const pendingPrefill = useRef<PrefillDraft | null>(null);
  const pendingAuthorDraft = useRef<CreatorAuthorDraft | null>(null);
  const restoredDraftContext = useRef<string | null>(null);
  const partyGeneration = useRef(0);
  const portfolioRequestId = useRef(0);
  const previewRequestId = useRef(0);
  const prepareRequestId = useRef(0);
  const handledEditShare = useRef<number | null>(null);
  const pendingQuerySync = useRef<string | null>(null);
  const pendingViewNavigation = useRef<CreatorView | null>(null);
  const tabRefs = useRef<Record<CreatorView, HTMLButtonElement | null>>({ stack: null, product: null, portfolio: null });
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const authorSectionRef = useRef<HTMLElement>(null);
  const successMessageRef = useRef<HTMLParagraphElement>(null);
  const directPreviewRef = useRef<HTMLElement>(null);
  const focusAfterAccessRetry = useRef(false);
  const focusAfterStacksRetry = useRef(false);
  const focusAfterSubmit = useRef(false);
  const focusAfterLifecycle = useRef<{ shareId: number; action: CreatorLifecycleAction } | null>(null);
  const focusAfterDirectPreview = useRef(false);

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === partyId) ?? null,
    [parties, partyId],
  );
  const canEdit = creatorCanEdit(selectedParty);

  const patchQuery = useCallback((patch: Record<string, string | number | null>, replace = false) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    if (patch.bereich === 'stack' || patch.bereich === 'product' || patch.bereich === 'portfolio') {
      pendingViewNavigation.current = patch.bereich;
    }
    pendingQuerySync.current = next.toString();
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!creatorSharingEnabled) {
      setAccessLoading(false);
      return;
    }
    let cancelled = false;
    setAccessLoading(true);
    setAccessError(false);
    getCreatorAccess()
      .then((access) => {
        if (cancelled) return;
        setAccessState(access.access_state);
        setParties(access.parties);
        if (access.access_state !== 'active' || access.parties.length === 0) {
          setPartyId(null);
          return;
        }
        const requested = positiveId(initialParams.current.get('party'));
        const remembered = userId ? readSelectedCreatorParty(userId) : null;
        const nextParty = access.parties.find((party) => party.id === requested)
          ?? access.parties.find((party) => party.id === remembered)
          ?? access.parties[0];
        setPartyId(nextParty.id);
        if (nextParty.role === 'viewer') {
          setView('portfolio');
          setStackItemIdValue(null);
        }
        if (userId) writeSelectedCreatorParty(userId, nextParty.id);
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.set('party', String(nextParty.id));
          if (nextParty.role === 'viewer') {
            next.set('bereich', 'portfolio');
            next.delete('stack');
            next.delete('product');
            next.delete('repair');
            next.delete('sourceShare');
          }
          return next;
        }, { replace: true });
      })
      .catch(() => {
        if (!cancelled) {
          setAccessState(null);
          setParties([]);
          setPartyId(null);
          setAccessError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => { cancelled = true; };
  }, [accessAttempt, setSearchParams, userId]);

  useEffect(() => {
    if (!focusAfterAccessRetry.current || accessLoading || accessError || accessState !== 'active') return;
    focusAfterAccessRetry.current = false;
    window.requestAnimationFrame(() => pageHeadingRef.current?.focus());
  }, [accessError, accessLoading, accessState]);

  useEffect(() => {
    if (!message) return;
    if (focusAfterSubmit.current) {
      focusAfterSubmit.current = false;
      window.requestAnimationFrame(() => successMessageRef.current?.focus());
      return;
    }
    if (focusAfterLifecycle.current) {
      const pendingFocus = focusAfterLifecycle.current;
      focusAfterLifecycle.current = null;
      window.requestAnimationFrame(() => {
        const trigger = pendingFocus.action === 'end'
          ? null
          : document.getElementById(`creator-lifecycle-${pendingFocus.shareId}`);
        (trigger ?? successMessageRef.current)?.focus();
      });
    }
  }, [message]);

  useEffect(() => {
    if (!focusAfterDirectPreview.current || !directPreview) return;
    focusAfterDirectPreview.current = false;
    window.requestAnimationFrame(() => directPreviewRef.current?.focus());
  }, [directPreview]);

  useEffect(() => {
    if (accessState !== 'active' || parties.length === 0) {
      setStacks([]);
      setStackId(null);
      setStacksLoaded(false);
      return;
    }
    let cancelled = false;
    setStacksLoading(true);
    setStacksLoaded(false);
    setStacksError(false);
    getStacks()
      .then(({ stacks: nextStacks }) => {
        if (cancelled) return;
        setStacks(nextStacks);
        const requested = positiveId(initialParams.current.get('stack'));
        setStackId((current) => {
          if (nextStacks.some((stack) => stack.id === current)) return current;
          if (nextStacks.some((stack) => stack.id === requested)) return requested;
          return nextStacks[0]?.id ?? null;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStacks([]);
          setStackId(null);
          setStacksError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStacksLoading(false);
          setStacksLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [accessState, parties.length, stacksAttempt]);

  useEffect(() => {
    if (!focusAfterStacksRetry.current || stacksLoading || stacksError || !stacksLoaded) return;
    focusAfterStacksRetry.current = false;
    window.requestAnimationFrame(() => authorSectionRef.current?.focus());
  }, [stacksError, stacksLoaded, stacksLoading]);

  useEffect(() => {
    if (!stackId || !partyId || !creatorSharingEnabled) {
      setDetails(null);
      setReadiness(null);
      return;
    }
    let cancelled = false;
    const loadRequestId = ++detailsLoadRequestId.current;
    const resubmitDraft = pendingPrefill.current;
    const authorDraft = pendingAuthorDraft.current;
    setDetails(null);
    setReadiness(null);
    setDetailsError(false);
    setDetailsLoading(true);
    Promise.all([
      apiClient.get<StackDetails>(`/stacks/${stackId}`),
      getCreatorShareReadiness(stackId, partyId),
    ])
      .then(([response, nextReadiness]) => {
        if (cancelled || loadRequestId !== detailsLoadRequestId.current) return;
        if (pendingPrefill.current === resubmitDraft) pendingPrefill.current = null;
        if (pendingAuthorDraft.current === authorDraft) pendingAuthorDraft.current = null;
        const nextDetails = response.data;
        const normalizedProducts = Array.isArray(nextReadiness.products)
          ? nextReadiness.products
          : [
              ...nextReadiness.shareable_stack_item_ids.map((id) => ({
                stack_item_id: id, product_name: '', shareable: true, reason_code: null, repair_kind: null,
              } as CreatorReadinessProduct)),
              ...nextReadiness.unshareable_products.map((product) => ({
                ...product, shareable: false, reason_code: null, repair_kind: 'stack_product' as const,
              })),
            ];
        const normalizedReadiness = { ...nextReadiness, products: normalizedProducts };
        setDetails(nextDetails);
        setReadiness(normalizedReadiness);
        const catalogItems = nextDetails.items.filter((item) => item.product_type !== 'user_product');
        const shareableIds = new Set(normalizedProducts.filter((product) => product.shareable).map((product) => product.stack_item_id));
        const shareableItems = catalogItems.filter((item) => {
          const itemId = stackItemId(item);
          return itemId !== null && shareableIds.has(itemId);
        });
        const selectableItems = nextDetails.items.filter((item) => stackItemId(item) !== null);
        const requestedItemId = resubmitDraft?.preview.type === 'dose_recommendation'
          ? resubmitDraft.preview.entity_id
          : authorDraft?.view === 'product' ? authorDraft.stack_item_id : stackItemSelectionRef.current;
        const selectedItem = requestedItemId
          ? selectableItems.find((item) => stackItemId(item) === requestedItemId) ?? null
          : shareableItems[0] ?? selectableItems[0] ?? null;
        setStackItemIdValue(view === 'product' ? stackItemId(selectedItem ?? {} as ShareableStackItem) : null);
        setMissingOriginalProduct(Boolean(requestedItemId && !selectedItem));
        setTitle(resubmitDraft?.preview.title ?? authorDraft?.title ?? nextDetails.stack.name);
        if (resubmitDraft) {
          const nextStatements: Record<string, string> = {};
          const remaining = [...resubmitDraft.preview.items];
          for (const item of shareableItems) {
            const itemId = stackItemId(item);
            const matchIndex = remaining.findIndex((candidate) => candidate.catalog_product_id === item.id);
            if (!itemId || matchIndex < 0) continue;
            const [match] = remaining.splice(matchIndex, 1);
            if (match.creator_statement) nextStatements[String(itemId)] = match.creator_statement;
          }
          setStatements(nextStatements);
          const { preview } = resubmitDraft;
          if (preview.moderation_reason) {
            let guidance: ModerationGuidance = {
              element_id: 'creator-author-form-heading',
              reason: preview.moderation_reason,
              target_label: 'Inhalt der Empfehlung',
            };
            if (preview.moderation_target === 'title') {
              guidance = { ...guidance, element_id: 'creator-title-input', target_label: 'Name der Empfehlung' };
            } else if ((preview.moderation_target === 'creator_statement' || preview.moderation_target === 'product')
              && preview.moderation_item_index !== null) {
              const previewItem = preview.items[preview.moderation_item_index];
              const matchedItem = previewItem
                ? shareableItems.find((item) => item.id === previewItem.catalog_product_id)
                : null;
              const matchedStackItemId = matchedItem ? stackItemId(matchedItem) : null;
              if (matchedStackItemId) {
                const itemName = preview.moderation_item_name?.trim() || previewItem?.product_name?.trim() || 'betroffenes Produkt';
                guidance = {
                  ...guidance,
                  element_id: preview.moderation_target === 'creator_statement'
                    ? `creator-statement-${matchedStackItemId}`
                    : `creator-product-${matchedStackItemId}`,
                  target_label: preview.moderation_target === 'creator_statement'
                    ? `Persönlicher Hinweis bei ${itemName}`
                    : `Produkt ${itemName}`,
                };
              }
            }
            setModerationGuidance(guidance);
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
              document.getElementById(guidance.element_id)?.focus();
            }));
          } else {
            setModerationGuidance(null);
          }
        } else if (authorDraft) {
          setStatements(authorDraft.statements);
          setSourceShareGuard(authorDraft.source_share_guard);
          setModerationGuidance(null);
        } else {
          setStatements({});
          setModerationGuidance(null);
        }
      })
      .catch(() => {
        if (!cancelled && loadRequestId === detailsLoadRequestId.current) {
          setDetails(null);
          setReadiness(null);
          setDetailsError(true);
        }
      })
      .finally(() => {
        if (!cancelled && loadRequestId === detailsLoadRequestId.current) setDetailsLoading(false);
      });
    return () => { cancelled = true; };
  }, [detailsRequest, partyId, stackId, view]);

  useEffect(() => {
    const requestedView = creatorView(searchParams.get('bereich'));
    if (!userId
      || !partyId
      || !stacksLoaded
      || view === 'portfolio'
      || requestedView !== view
      || positiveId(searchParams.get('editShare'))
      || pendingPrefill.current) return;
    const requestedStack = positiveId(searchParams.get('stack'));
    const requestedProduct = positiveId(searchParams.get('product'));
    const requestedSourceShare = positiveId(searchParams.get('sourceShare'));
    const context = `${userId}:${partyId}:${view}:${requestedStack ?? 0}:${requestedProduct ?? 0}:${requestedSourceShare ?? 0}`;
    if (restoredDraftContext.current === context) return;
    restoredDraftContext.current = context;
    const saved = requestedStack
      ? readBoundAuthorDraft(userId, partyId, view, requestedStack, requestedProduct, requestedSourceShare)
      : searchParams.has('sourceShare')
        ? null
        : readActiveCreatorAuthorDraft(userId, partyId, view);
    if (!saved || !stacks.some((stack) => stack.id === saved.stack_id)) return;
    pendingAuthorDraft.current = saved;
    setView(saved.view);
    setStackId(saved.stack_id);
    setSourceShareGuard(saved.source_share_guard);
    setDetailsRequest((current) => current + 1);
    patchQuery({
      bereich: saved.view,
      party: partyId,
      stack: saved.stack_id,
      product: saved.stack_item_id,
      sourceShare: saved.source_share_id,
    }, true);
    setMessage('Dein automatisch gespeicherter Entwurf ist wieder geöffnet.');
  }, [partyId, patchQuery, searchParams, stacks, stacksLoaded, userId, view]);

  const catalogItems = useMemo(
    () => details?.items.filter((item) => item.product_type !== 'user_product') ?? [],
    [details],
  );
  const selectableProductItems = useMemo(
    () => details?.items.filter((item) => stackItemId(item) !== null) ?? [],
    [details],
  );
  const shareableCatalogItems = useMemo(() => {
    const shareableIds = new Set((readiness?.products ?? []).filter((product) => product.shareable).map((product) => product.stack_item_id));
    return catalogItems.filter((item) => {
      const itemId = stackItemId(item);
      return itemId !== null && shareableIds.has(itemId);
    });
  }, [catalogItems, readiness]);
  const unshareableProducts = useMemo(
    () => readiness?.products.filter((product) => !product.shareable) ?? [],
    [readiness],
  );
  const visibleUnshareableProducts = useMemo(
    () => view === 'product'
      ? unshareableProducts.filter((product) => product.stack_item_id === stackItemIdValue)
      : unshareableProducts,
    [stackItemIdValue, unshareableProducts, view],
  );
  const hasUnshareableItems = unshareableProducts.length > 0 || Boolean(readiness && !readiness.ready);
  const selectedItems = useMemo(() => {
    if (view === 'portfolio') return [];
    return view === 'stack'
      ? (readiness?.ready ? shareableCatalogItems : [])
      : shareableCatalogItems.filter((item) => stackItemId(item) === stackItemIdValue);
  }, [readiness?.ready, shareableCatalogItems, stackItemIdValue, view]);

  const draftPreview = useMemo<CreatorSharePreview | null>(() => {
    if (!selectedParty || !title.trim() || selectedItems.length === 0) return null;
    return {
      token: '',
      type: view === 'product' ? 'dose_recommendation' : 'stack',
      title: title.trim(),
      creator: { id: selectedParty.id, name: selectedParty.name, type: selectedParty.type },
      published_at: previewTimestamp.current,
      items: selectedItems.map((item) => ({
        catalog_product_id: item.id,
        product_name: item.name ?? null,
        brand: item.brand ?? null,
        image_url: item.image_url ?? null,
        quantity: item.quantity,
        unit: item.serving_unit ?? null,
        intake_interval_days: Number.isSafeInteger(item.intake_interval_days) && Number(item.intake_interval_days) > 0
          ? Number(item.intake_interval_days)
          : null,
        dosage_text: item.dosage_text ?? null,
        timing: item.timing ?? null,
        timing_label: item.timing_label ?? null,
        creator_statement: statements[String(stackItemId(item))]?.trim() || null,
      })),
    };
  }, [selectedItems, selectedParty, statements, title, view]);

  const currentDraftScope = useCallback((): CreatorAuthorDraftScope | null => {
    if (!userId || !partyId || !stackId || view === 'portfolio') return null;
    return {
      user_id: userId,
      party_id: partyId,
      view,
      stack_id: stackId,
      stack_item_id: view === 'product' ? stackItemIdValue : null,
      source_share_id: sourceShareGuard?.share_id ?? null,
    };
  }, [partyId, sourceShareGuard?.share_id, stackId, stackItemIdValue, userId, view]);

  const persistCurrentDraft = useCallback(() => {
    const scope = currentDraftScope();
    if (!scope) return;
    writeCreatorAuthorDraft({
      ...scope,
      title,
      statements,
      source_share_guard: sourceShareGuard,
    });
  }, [currentDraftScope, sourceShareGuard, statements, title]);

  useEffect(() => {
    if (!details || detailsLoading || !userId || !partyId || view === 'portfolio') return;
    const timer = window.setTimeout(persistCurrentDraft, 250);
    return () => window.clearTimeout(timer);
  }, [details, detailsLoading, partyId, persistCurrentDraft, userId, view]);

  const applyPartySelection = useCallback((nextPartyId: number, invalidatePrepare = true) => {
    if (nextPartyId === partyId) return;
    persistCurrentDraft();
    partyGeneration.current += 1;
    if (invalidatePrepare) prepareRequestId.current += 1;
    restoredDraftContext.current = null;
    pendingPrefill.current = null;
    pendingAuthorDraft.current = null;
    setPendingDeepLinkPreview(null);
    setSourceShareGuard(null);
    setMissingOriginalProduct(false);
    setTitle('');
    setStatements({});
    setOwnedShares([]);
    setExpandedShareId(null);
    setOwnedPreview(null);
    setDirectPreview(null);
    setDashboard(null);
    setBusy(false);
    setBusyShareId(null);
    setPartyId(nextPartyId);
    if (userId) writeSelectedCreatorParty(userId, nextPartyId);
  }, [partyId, persistCurrentDraft, userId]);

  const creatorQueryString = searchParams.toString();
  useEffect(() => {
    if (pendingViewNavigation.current) {
      if (creatorView(searchParams.get('bereich')) === pendingViewNavigation.current) {
        pendingViewNavigation.current = null;
        pendingQuerySync.current = null;
      }
      return;
    }
    if (pendingQuerySync.current) {
      if (pendingQuerySync.current !== creatorQueryString) return;
      pendingQuerySync.current = null;
      return;
    }
    if (accessState !== 'active' || parties.length === 0) return;
    if (!canEdit) {
      const editShareId = positiveId(searchParams.get('editShare'));
      const needsPortfolioUrl = creatorView(searchParams.get('bereich')) !== 'portfolio'
        || searchParams.has('stack')
        || searchParams.has('product')
        || searchParams.has('repair')
        || searchParams.has('sourceShare')
        || (!editShareId && searchParams.has('editShare'));
      if (view !== 'portfolio') setView('portfolio');
      if (needsPortfolioUrl) {
        patchQuery({
          bereich: 'portfolio',
          stack: null,
          product: null,
          repair: null,
          sourceShare: null,
          editShare: editShareId,
        }, true);
        return;
      }
    }
    const urlParty = positiveId(searchParams.get('party'));
    if (urlParty && urlParty !== partyId && parties.some((party) => party.id === urlParty)) {
      applyPartySelection(urlParty);
      return;
    }

    const urlView = creatorView(searchParams.get('bereich'));
    const urlStack = positiveId(searchParams.get('stack'));
    const urlProduct = positiveId(searchParams.get('product'));
    const urlSourceShare = positiveId(searchParams.get('sourceShare'));
    if (searchParams.has('sourceShare') && !urlSourceShare) {
      patchQuery({ sourceShare: null }, true);
      return;
    }
    if (urlView !== view) {
      persistCurrentDraft();
      prepareRequestId.current += 1;
      const saved = urlView === 'portfolio'
        ? null
        : urlStack
          ? readBoundAuthorDraft(userId, partyId, urlView, urlStack, urlProduct, urlSourceShare)
          : searchParams.has('sourceShare') || !userId || !partyId
            ? null
            : readActiveCreatorAuthorDraft(userId, partyId, urlView);
      restoredDraftContext.current = userId && partyId
        ? `${userId}:${partyId}:${urlView}:${urlStack ?? 0}:${urlProduct ?? 0}:${urlSourceShare ?? 0}`
        : null;
      pendingPrefill.current = null;
      pendingAuthorDraft.current = saved;
      setSourceShareGuard(saved?.source_share_guard ?? null);
      setModerationGuidance(null);
      setView(urlView);
      setMessage(null);
      setError(null);
      if (urlView !== 'portfolio') {
        setDetails(null);
        setReadiness(null);
        const nextStackId = saved?.stack_id
          ?? (urlStack && stacks.some((stack) => stack.id === urlStack) ? urlStack : stackId);
        setStackId(nextStackId);
        setStackItemIdValue(urlView === 'product' ? saved?.stack_item_id ?? urlProduct : null);
        setTitle(saved?.title ?? '');
        setStatements(saved?.statements ?? {});
        setDetailsRequest((current) => current + 1);
      }
      if (urlSourceShare && !saved) {
        patchQuery({ sourceShare: null }, true);
        setMessage('Dieser gespeicherte Browserentwurf ist nicht mehr verfügbar. Du kannst eine neue Empfehlung beginnen.');
      }
      return;
    }

    if (urlStack && urlStack !== stackId && stacks.some((stack) => stack.id === urlStack)) {
      persistCurrentDraft();
      prepareRequestId.current += 1;
      const saved = readBoundAuthorDraft(userId, partyId, view, urlStack, urlProduct, urlSourceShare);
      pendingPrefill.current = null;
      pendingAuthorDraft.current = saved;
      setSourceShareGuard(saved?.source_share_guard ?? null);
      setMissingOriginalProduct(false);
      setDetails(null);
      setReadiness(null);
      setStackId(urlStack);
      setStackItemIdValue(view === 'product' ? saved?.stack_item_id ?? urlProduct : null);
      setTitle(saved?.title ?? '');
      setStatements(saved?.statements ?? {});
      setDetailsRequest((current) => current + 1);
      if (urlSourceShare && !saved) {
        patchQuery({ sourceShare: null }, true);
        setMessage('Dieser gespeicherte Browserentwurf ist nicht mehr verfügbar. Du kannst eine neue Empfehlung beginnen.');
      }
      return;
    }
    const currentSourceShare = sourceShareGuard?.share_id ?? null;
    if ((view === 'product' && urlProduct !== stackItemIdValue) || urlSourceShare !== currentSourceShare) {
      persistCurrentDraft();
      const boundStackId = urlStack ?? stackId;
      const saved = readBoundAuthorDraft(userId, partyId, view, boundStackId, urlProduct, urlSourceShare);
      pendingPrefill.current = null;
      pendingAuthorDraft.current = saved;
      setSourceShareGuard(saved?.source_share_guard ?? null);
      setDetails(null);
      setReadiness(null);
      setStackItemIdValue(view === 'product' ? saved?.stack_item_id ?? urlProduct : null);
      setTitle(saved?.title ?? '');
      setStatements(saved?.statements ?? {});
      setDetailsRequest((current) => current + 1);
      if (urlSourceShare && !saved) {
        patchQuery({ sourceShare: null }, true);
        setMessage('Dieser gespeicherte Browserentwurf ist nicht mehr verfügbar. Du kannst eine neue Empfehlung beginnen.');
      }
      return;
    }

    const urlFilters: PortfolioFilters = {
      q: searchParams.get('q')?.trim() ?? '',
      status: statusFilter(searchParams.get('status')),
      archive: archiveFilter(searchParams.get('archive')),
      sort: sortFilter(searchParams.get('sort')),
    };
    if (urlFilters.q !== filters.q
      || urlFilters.status !== filters.status
      || urlFilters.archive !== filters.archive
      || urlFilters.sort !== filters.sort) {
      setFilters(urlFilters);
      setSearchInput(urlFilters.q);
    }
  }, [
    accessState,
    applyPartySelection,
    canEdit,
    creatorQueryString,
    filters,
    parties,
    partyId,
    patchQuery,
    persistCurrentDraft,
    searchParams,
    stackId,
    stackItemIdValue,
    stacks,
    sourceShareGuard?.share_id,
    userId,
    view,
  ]);

  useEffect(() => {
    const repairId = positiveId(searchParams.get('repair'));
    if (!repairId || detailsLoading || !readiness) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`creator-repair-${repairId}`);
      target?.focus();
      target?.scrollIntoView({ block: 'center' });
    });
  }, [detailsLoading, readiness, searchParams]);

  const loadDashboard = useCallback(async (nextPartyId: number, generation: number) => {
    try {
      const nextDashboard = await getCreatorDashboard(nextPartyId, 30);
      if (partyGeneration.current === generation) setDashboard(nextDashboard);
    } catch {
      if (partyGeneration.current === generation) setDashboard(null);
    }
  }, []);

  const loadPortfolioPage = useCallback(async (nextPartyId: number, cursor: string | null, append: boolean) => {
    const requestId = ++portfolioRequestId.current;
    if (append) setPortfolioLoadingMore(true);
    else setPortfolioLoading(true);
    setPortfolioError(false);
    try {
      const page = await getCreatorPortfolio({
        party_id: nextPartyId,
        q: filters.q || undefined,
        status: filters.status === 'all' ? undefined : filters.status,
        archive: filters.archive,
        sort: filters.sort,
        cursor: cursor ?? undefined,
        limit: PORTFOLIO_LIMIT,
      });
      if (requestId !== portfolioRequestId.current || nextPartyId !== partyId) return;
      setOwnedShares((current) => append
        ? [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]
        : page.items);
      setPortfolioCursor(page.next_cursor);
      setPortfolioHasMore(page.has_more);
      setMetricsPeriod(page.metrics_period);
    } catch {
      if (requestId === portfolioRequestId.current && nextPartyId === partyId) {
        if (!append) setOwnedShares([]);
        setPortfolioError(true);
      }
    } finally {
      if (requestId === portfolioRequestId.current) {
        setPortfolioLoading(false);
        setPortfolioLoadingMore(false);
      }
    }
  }, [filters, partyId]);

  useEffect(() => {
    const generation = ++partyGeneration.current;
    previewRequestId.current += 1;
    portfolioRequestId.current += 1;
    setOwnedShares([]);
    setExpandedShareId(null);
    setOwnedPreview(null);
    setPortfolioError(false);
    setDashboard(null);
    if (!partyId || !creatorSharingEnabled) return;
    void loadDashboard(partyId, generation);
  }, [loadDashboard, partyId]);

  useEffect(() => {
    if (!partyId || !creatorSharingEnabled) {
      setPortfolioLoading(false);
      return;
    }
    void loadPortfolioPage(partyId, null, false);
  }, [filters, loadPortfolioPage, partyId, portfolioReload]);

  const refreshPortfolioAndDashboard = async () => {
    if (!partyId) return;
    const generation = partyGeneration.current;
    await Promise.all([
      loadDashboard(partyId, generation),
      loadPortfolioPage(partyId, null, false),
    ]);
  };

  const changeStack = (nextStackId: number) => {
    persistCurrentDraft();
    prepareRequestId.current += 1;
    const activeTargetDraft = userId && partyId && view !== 'portfolio'
      ? readActiveCreatorAuthorDraft(userId, partyId, view)
      : null;
    const saved = activeTargetDraft?.stack_id === nextStackId
      ? activeTargetDraft
      : readBoundAuthorDraft(userId, partyId, view, nextStackId, null, null);
    restoredDraftContext.current = userId && partyId
      ? `${userId}:${partyId}:${view}:${nextStackId}:${saved?.stack_item_id ?? 0}:${saved?.source_share_id ?? 0}`
      : null;
    pendingPrefill.current = null;
    pendingAuthorDraft.current = saved;
    setSourceShareGuard(saved?.source_share_guard ?? null);
    setModerationGuidance(null);
    setMissingOriginalProduct(false);
    setDetails(null);
    setReadiness(null);
    setStatements(saved?.statements ?? {});
    setTitle(saved?.title ?? '');
    setStackId(nextStackId);
    setStackItemIdValue(view === 'product' ? saved?.stack_item_id ?? null : null);
    setDetailsRequest((current) => current + 1);
    patchQuery({
      stack: nextStackId,
      product: view === 'product' ? saved?.stack_item_id ?? null : null,
      repair: null,
      sourceShare: saved?.source_share_id ?? null,
    });
  };

  const changeProduct = (nextItemId: number) => {
    persistCurrentDraft();
    prepareRequestId.current += 1;
    const saved = readBoundAuthorDraft(userId, partyId, 'product', stackId, nextItemId, null);
    restoredDraftContext.current = userId && partyId && stackId
      ? `${userId}:${partyId}:product:${stackId}:${nextItemId}:0`
      : null;
    pendingPrefill.current = null;
    pendingAuthorDraft.current = saved;
    setSourceShareGuard(saved?.source_share_guard ?? null);
    setModerationGuidance(null);
    setMissingOriginalProduct(false);
    const defaultTitle = details?.stack.name ?? stacks.find((stack) => stack.id === stackId)?.name ?? '';
    setDetails(null);
    setReadiness(null);
    setTitle(saved?.title ?? defaultTitle);
    setStatements(saved?.statements ?? {});
    setStackItemIdValue(nextItemId);
    setDetailsRequest((current) => current + 1);
    patchQuery({ product: nextItemId, repair: null, sourceShare: null });
  };

  const changeParty = (nextPartyId: number) => {
    const nextParty = parties.find((party) => party.id === nextPartyId);
    applyPartySelection(nextPartyId);
    if (nextParty?.role === 'viewer') {
      setView('portfolio');
      setStackItemIdValue(null);
      patchQuery({ party: nextPartyId, bereich: 'portfolio', stack: null, product: null, editShare: null, repair: null, sourceShare: null }, true);
      return;
    }
    patchQuery({ party: nextPartyId, editShare: null, repair: null, sourceShare: null });
  };

  const chooseView = (nextView: CreatorView) => {
    if (nextView === view) return;
    persistCurrentDraft();
    prepareRequestId.current += 1;
    restoredDraftContext.current = userId && partyId && nextView !== 'portfolio'
      ? `${userId}:${partyId}:${nextView}`
      : null;
    setMessage(null);
    setError(null);
    setView(nextView);
    if (nextView === 'portfolio') {
      patchQuery({ bereich: nextView, editShare: null, repair: null, stack: null, product: null, sourceShare: null });
      return;
    }
    const saved = userId && partyId ? readActiveCreatorAuthorDraft(userId, partyId, nextView) : null;
    if (saved && stacks.some((stack) => stack.id === saved.stack_id)) {
      pendingAuthorDraft.current = saved;
      setDetails(null);
      setReadiness(null);
      setStackId(saved.stack_id);
      setStackItemIdValue(saved.view === 'product' ? saved.stack_item_id : null);
      setSourceShareGuard(saved.source_share_guard);
      setTitle(saved.title);
      setStatements(saved.statements);
      setDetailsRequest((current) => current + 1);
      patchQuery({
        bereich: nextView,
        editShare: null,
        repair: null,
        stack: saved.stack_id,
        product: saved.stack_item_id,
        sourceShare: saved.source_share_id,
      });
      setMessage('Dein automatisch gespeicherter Entwurf ist wieder geöffnet.');
      return;
    }
    setSourceShareGuard(null);
    setModerationGuidance(null);
    setMissingOriginalProduct(false);
    setDetails(null);
    setReadiness(null);
    setStatements({});
    setTitle(details?.stack.name ?? '');
    setDetailsRequest((current) => current + 1);
    if (nextView === 'product') {
      const nextItemId = stackItemId(shareableCatalogItems[0] ?? {} as ShareableStackItem);
      setStackItemIdValue(nextItemId);
      patchQuery({ bereich: nextView, editShare: null, repair: null, product: nextItemId, sourceShare: null });
      return;
    }
    patchQuery({ bereich: nextView, editShare: null, repair: null, product: null, sourceShare: null });
  };

  const handleTaskTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentView: CreatorView) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabledViews = CREATOR_VIEWS.filter((candidate) => candidate === 'portfolio' || canEdit);
    const currentIndex = enabledViews.indexOf(currentView);
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabledViews.length - 1;
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % enabledViews.length;
    else nextIndex = (currentIndex - 1 + enabledViews.length) % enabledViews.length;
    const nextView = enabledViews[nextIndex];
    chooseView(nextView);
    window.requestAnimationFrame(() => tabRefs.current[nextView]?.focus());
  };

  const creatorReturnPath = (repairItemId?: number): string => {
    const params = new URLSearchParams();
    params.set('bereich', view);
    if (partyId) params.set('party', String(partyId));
    if (stackId) params.set('stack', String(stackId));
    if (stackItemIdValue) params.set('product', String(stackItemIdValue));
    if (sourceShareGuard?.share_id) params.set('sourceShare', String(sourceShareGuard.share_id));
    if (repairItemId) params.set('repair', String(repairItemId));
    return `/creator?${params.toString()}`;
  };

  const stackRepairPath = (repairItemId?: number): string => {
    const params = new URLSearchParams();
    if (stackId) params.set('stack', String(stackId));
    params.set('creatorReturn', creatorReturnPath(repairItemId));
    return `/stacks?${params.toString()}`;
  };

  const ownProductRepairPath = (repairItemId?: number): string => {
    const params = new URLSearchParams();
    params.set('creatorReturn', creatorReturnPath(repairItemId));
    return `/my-products?${params.toString()}`;
  };

  const submit = async () => {
    if (!canEdit || !partyId || !stackId || !title.trim() || selectedItems.length === 0) return;
    if (view === 'stack' && hasUnshareableItems) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const generation = partyGeneration.current;
    const submittedDraftScope = currentDraftScope();
    try {
      const selectedStatements = Object.fromEntries(
        selectedItems
          .map((item) => [String(stackItemId(item)), statements[String(stackItemId(item))]?.trim()] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
      );
      await createCreatorShare({
        party_id: partyId,
        stack_id: stackId,
        type: view === 'product' ? 'dose_recommendation' : 'stack',
        title: title.trim(),
        stack_item_id: view === 'product' ? stackItemIdValue ?? undefined : undefined,
        creator_statements: selectedStatements,
        source_share_guard: sourceShareGuard ?? undefined,
      });
      if (partyGeneration.current !== generation) return;
      if (submittedDraftScope) clearCreatorAuthorDraft(submittedDraftScope);
      setSourceShareGuard(null);
      setView('portfolio');
      patchQuery({ bereich: 'portfolio', stack: null, product: null, repair: null, editShare: null, sourceShare: null });
      focusAfterSubmit.current = true;
      setMessage('Deine Empfehlung wird geprüft. Eine feste Prüfdauer können wir derzeit nicht versprechen. Verbindlich ist der Status hier unter „Meine Empfehlungen“. Wir versuchen zusätzlich, dich per E-Mail zu informieren; darauf solltest du dich nicht allein verlassen.');
      setPortfolioReload((current) => current + 1);
    } catch (caught: unknown) {
      setError(friendlyCreatorError(caught, 'Die Empfehlung konnte nicht gespeichert werden. Bitte versuche es noch einmal.'));
    } finally {
      if (partyGeneration.current === generation) setBusy(false);
    }
  };

  const showOwnedPreview = async (share: CreatorOwnedShare) => {
    if (expandedShareId === share.id) {
      previewRequestId.current += 1;
      setExpandedShareId(null);
      setOwnedPreview(null);
      return;
    }
    const requestId = ++previewRequestId.current;
    setBusyShareId(share.id);
    setError(null);
    try {
      const preview = await getCreatorOwnedSharePreview(share.id);
      if (requestId !== previewRequestId.current) return;
      setOwnedPreview(preview);
      setExpandedShareId(share.id);
    } catch {
      if (requestId === previewRequestId.current) setError('Die Vorschau konnte nicht geladen werden. Bitte versuche es noch einmal.');
    } finally {
      if (requestId === previewRequestId.current) setBusyShareId(null);
    }
  };

  const copyLink = async (share: CreatorOwnedShare) => {
    setBusyShareId(share.id);
    setError(null);
    try {
      await navigator.clipboard.writeText(clipboardText(share.token));
      setMessage('Link kopiert. Du kannst ihn jetzt teilen.');
    } catch {
      const input = document.getElementById(`creator-share-url-${share.id}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      setError('Automatisches Kopieren hat nicht geklappt. Der Link ist markiert; kopiere ihn bitte manuell.');
    } finally {
      setBusyShareId(null);
    }
  };

  const nativeShare = async (share: CreatorOwnedShare) => {
    const url = clipboardText(share.token);
    if (!navigator.share) {
      const input = document.getElementById(`creator-share-url-${share.id}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      setMessage('Die Teilen-Funktion ist in diesem Browser nicht verfügbar. Nutze den markierten Link.');
      return;
    }
    try {
      await navigator.share({ title: share.title, text: share.title, url });
      setMessage('Teilen wurde geöffnet.');
    } catch (caught) {
      if ((caught as { name?: string })?.name !== 'AbortError') {
        setError('Teilen konnte nicht geöffnet werden. Du kannst den sichtbaren Link kopieren.');
      }
    }
  };

  const beginPreparedPreview = useCallback((preview: CreatorOwnedSharePreview, replaceHistory: boolean): boolean => {
    if (preview.creator_status !== 'blocked' && preview.creator_status !== 'revoked' && preview.creator_status !== 'expired') {
      setError('Der Status dieser Empfehlung hat sich geändert. Lade den Bereich neu und prüfe den aktuellen Stand.');
      return false;
    }
    const previewParty = parties.find((party) => party.id === preview.creator.id);
    if (!previewParty || !creatorCanEdit(previewParty)) {
      setError('Du darfst diese Empfehlung nicht bearbeiten. Prüfe dein Creator-Konto oder bitte den Inhaber um Bearbeitungsrechte.');
      return false;
    }
    if (stacksLoading || !stacksLoaded || stacksError) {
      setPendingDeepLinkPreview(preview);
      setError(null);
      return false;
    }
    const targetStackId = preview.source_stack_id;
    if (!targetStackId || !stacks.some((stack) => stack.id === targetStackId)) {
      setPendingDeepLinkPreview(null);
      setError(stacks.length > 0
        ? 'Der ursprüngliche Stack ist nicht mehr verfügbar. Wähle „Ganzen Stack teilen“ oder „Ein Produkt empfehlen“ und danach bewusst einen anderen Stack.'
        : 'Der ursprüngliche Stack ist nicht mehr verfügbar. Lege zuerst einen Stack an.');
      return false;
    }
    setPendingDeepLinkPreview(null);
    if (previewParty.id !== partyId) applyPartySelection(previewParty.id, false);
    setDirectPreview(null);
    pendingPrefill.current = { preview };
    detailsLoadRequestId.current += 1;
    setSourceShareGuard({
      share_id: preview.share_id,
      expected_version: preview.version,
      expected_snapshot_hash: preview.snapshot_hash,
      expected_status: preview.creator_status,
      expected_moderation_status: preview.moderation_status,
      expected_is_revoked: preview.is_revoked,
      expected_expires_at: preview.expires_at,
    });
    const nextView = preview.type === 'stack' ? 'stack' : 'product';
    const nextProductId = nextView === 'product' ? preview.entity_id : null;
    restoredDraftContext.current = null;
    setView(nextView);
    setStackId(targetStackId);
    setStackItemIdValue(nextProductId);
    setDetailsRequest((current) => current + 1);
    patchQuery({
      party: previewParty.id,
      bereich: nextView,
      stack: targetStackId,
      product: nextProductId,
      editShare: null,
      repair: null,
      sourceShare: preview.share_id,
    }, replaceHistory);
    setMessage(preview.creator_status === 'blocked'
      ? 'Die bisherigen Angaben sind vorausgefüllt. Die Rückmeldung steht direkt an der Stelle, die du prüfen solltest.'
      : 'Die bisherigen Angaben sind vorausgefüllt. Prüfe den aktuellen Stand und sende eine neue Empfehlung.');
    return true;
  }, [applyPartySelection, parties, partyId, patchQuery, stacks, stacksError, stacksLoaded, stacksLoading]);

  const prepareAgain = useCallback(async (share: CreatorOwnedShare) => {
    const requestId = ++prepareRequestId.current;
    setBusyShareId(share.id);
    setError(null);
    setSourceShareGuard(null);
    try {
      const preview = await getCreatorOwnedSharePreview(share.id);
      if (requestId !== prepareRequestId.current) return;
      beginPreparedPreview(preview, false);
    } catch {
      if (requestId === prepareRequestId.current) {
        setError('Die Empfehlung konnte nicht vorbereitet werden. Bitte versuche es noch einmal.');
      }
    } finally {
      if (requestId === prepareRequestId.current) setBusyShareId(null);
    }
  }, [beginPreparedPreview]);

  useEffect(() => {
    const editShareId = positiveId(searchParams.get('editShare'));
    if (!editShareId) {
      handledEditShare.current = null;
      return;
    }
    if (handledEditShare.current === editShareId || accessState !== 'active') return;
    handledEditShare.current = editShareId;
    const requestId = ++prepareRequestId.current;
    setBusyShareId(editShareId);
    setError(null);
    getCreatorOwnedSharePreview(editShareId)
      .then((preview) => {
        if (requestId !== prepareRequestId.current) return;
        if (preview.creator_status === 'approved' || preview.creator_status === 'pending' || preview.creator_status === 'paused') {
          const previewParty = parties.find((party) => party.id === preview.creator.id);
          if (!previewParty) {
            setError('Diese Empfehlung gehört nicht zu einem deiner Creator-Konten.');
            return;
          }
          if (previewParty.id !== partyId) applyPartySelection(previewParty.id, false);
          setView('portfolio');
          setExpandedShareId(null);
          setOwnedPreview(null);
          focusAfterDirectPreview.current = true;
          setDirectPreview(preview);
          patchQuery({
            party: previewParty.id,
            bereich: 'portfolio',
            stack: null,
            product: null,
            repair: null,
            sourceShare: null,
            editShare: preview.share_id,
          }, true);
          setMessage(preview.creator_status === 'approved'
            ? 'Diese Empfehlung ist freigegeben. Du siehst hier genau den veröffentlichten Stand.'
            : preview.creator_status === 'paused'
              ? 'Diese Empfehlung ist pausiert. Du siehst hier den gespeicherten Stand; der öffentliche Link ist vorübergehend nicht erreichbar.'
              : 'Diese Empfehlung wird noch geprüft. Du siehst hier den eingereichten Stand.');
          return;
        }
        beginPreparedPreview(preview, true);
      })
      .catch((caught: unknown) => {
        if (requestId !== prepareRequestId.current) return;
        const status = (caught as { response?: { status?: number } })?.response?.status;
        if (status === 404) setError('Diese Empfehlung wurde nicht gefunden oder ist nicht mehr deinem Creator-Konto zugeordnet.');
        else if (status === 403) setError('Du darfst diese Empfehlung nicht öffnen. Prüfe dein Creator-Konto oder bitte den Inhaber um Zugriff.');
        else setError('Die verlinkte Empfehlung konnte nicht geladen werden. Bitte versuche es noch einmal.');
      })
      .finally(() => {
        if (requestId === prepareRequestId.current) setBusyShareId(null);
      });
  }, [accessState, applyPartySelection, beginPreparedPreview, creatorQueryString, parties, partyId, patchQuery, searchParams]);

  useEffect(() => {
    if (!pendingDeepLinkPreview || stacksLoading || !stacksLoaded || stacksError) return;
    beginPreparedPreview(pendingDeepLinkPreview, true);
  }, [beginPreparedPreview, pendingDeepLinkPreview, stacksError, stacksLoaded, stacksLoading]);

  const openLifecycle = (share: CreatorOwnedShare) => {
    setLifecycleShare(share);
    setLifecycleAction(share.paused_at ? 'resume' : 'pause');
    setExpiryInput(share.expires_at ? new Date(share.expires_at * 1000).toISOString().slice(0, 10) : '');
    setLifecycleError(null);
  };

  const closeLifecycle = useCallback(() => setLifecycleShare(null), []);

  const applyLifecycle = async () => {
    if (!lifecycleShare) return;
    const expiresAt = lifecycleAction === 'set_expiry' ? expirySeconds(expiryInput) : undefined;
    if (lifecycleAction === 'set_expiry' && !expiresAt) {
      setLifecycleError('Wähle bitte ein zukünftiges Ablaufdatum.');
      return;
    }
    setBusyShareId(lifecycleShare.id);
    setLifecycleError(null);
    try {
      const completedShareId = lifecycleShare.id;
      const completedAction = lifecycleAction;
      await updateCreatorShareLifecycle(lifecycleShare, lifecycleAction, expiresAt ?? undefined);
      setLifecycleShare(null);
      await refreshPortfolioAndDashboard();
      focusAfterLifecycle.current = { shareId: completedShareId, action: completedAction };
      setMessage(lifecycleMessage(completedAction));
    } catch (caught) {
      setLifecycleError(friendlyCreatorError(caught, 'Die Link-Einstellung konnte nicht gespeichert werden. Bitte versuche es noch einmal.'));
    } finally {
      setBusyShareId(null);
    }
  };

  const toggleArchive = async (share: CreatorOwnedShare) => {
    setBusyShareId(share.id);
    setError(null);
    try {
      const archived = share.archived_at === null;
      await setCreatorShareArchived(share, archived);
      setMessage(archived
        ? 'Die Empfehlung wurde archiviert. Ein freigegebener öffentlicher Link bleibt dadurch unverändert.'
        : 'Die Empfehlung ist wieder in deinem aktiven Portfolio.');
      setPortfolioReload((current) => current + 1);
    } catch (caught) {
      setError(friendlyCreatorError(caught, 'Die Empfehlung konnte nicht archiviert werden. Bitte versuche es noch einmal.'));
    } finally {
      setBusyShareId(null);
    }
  };

  const updateFilters = (next: Partial<PortfolioFilters>) => {
    const updated = { ...filters, ...next };
    setFilters(updated);
    patchQuery({
      q: updated.q || null,
      status: updated.status === 'all' ? null : updated.status,
      archive: updated.archive,
      sort: updated.sort,
    });
  };

  if (!creatorSharingEnabled) {
    return <div className="card mx-auto max-w-2xl"><h1>Creator-Bereich</h1><p className="mt-3 text-gray-600">Diese Funktion ist noch nicht aktiviert.</p></div>;
  }
  if (accessLoading) return <p className="py-16 text-center text-slate-500" role="status" aria-live="polite">Creator-Bereich wird geladen…</p>;
  if (accessError) {
    return (
      <div className="card mx-auto max-w-2xl" role="alert">
        <h1>Creator-Bereich konnte nicht geladen werden</h1>
        <p className="mt-3 leading-6 text-gray-600">Bitte prüfe deine Verbindung und versuche es noch einmal.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => { focusAfterAccessRetry.current = true; setAccessAttempt((current) => current + 1); }}>Erneut versuchen</button>
          <Link className="btn btn-secondary" to="/stacks">Zu meinen Stacks</Link>
        </div>
      </div>
    );
  }
  if (accessState === 'blocked') {
    return (
      <div className="card mx-auto max-w-2xl">
        <h1>Creator-Zugang derzeit gesperrt</h1>
        <p className="mt-3 leading-6 text-gray-600">Du kannst den Creator-Bereich gerade nicht nutzen. Deine normalen Stacks bleiben verfügbar. Wenn du die Sperre klären möchtest, nimm bitte Kontakt mit uns auf.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a className="btn btn-primary" href="mailto:email@nickkrakow.de">Kontakt aufnehmen</a>
          <Link className="btn btn-secondary" to="/stacks">Zu meinen Stacks</Link>
        </div>
      </div>
    );
  }
  if (accessState !== 'active' || parties.length === 0) {
    return (
      <div className="card mx-auto max-w-2xl">
        <h1>Creator-Bereich nicht freigeschaltet</h1>
        <p className="mt-3 leading-6 text-gray-600">Du brauchst eine Einladung zu einem Creator- oder Markenkonto. Bitte wende dich an die Person, die dich einladen wollte. Wenn keine Einladung geplant ist, musst du nichts weiter tun.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a className="btn btn-primary" href="mailto:email@nickkrakow.de">Kontakt aufnehmen</a>
          <Link className="btn btn-secondary" to="/stacks">Zu meinen Stacks</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip">
      <header className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-indigo-600">Für Creator</p>
        <h1 className="mt-2" ref={pageHeadingRef} tabIndex={-1}>Empfehlungen teilen</h1>
        <p className="mt-2 max-w-3xl leading-6 text-gray-600">Teile einen ganzen Stack oder ein einzelnes Produkt. Jede neue Empfehlung wird vor der Veröffentlichung geprüft.</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Eine feste Prüfdauer können wir derzeit nicht versprechen. Verbindlich sind Status, Rückmeldung und Überarbeitung hier im Portfolio. Wir versuchen zusätzlich, dich per E-Mail zu informieren; darauf solltest du dich nicht allein verlassen.</p>
        <button type="button" className="mt-4 text-sm font-black text-indigo-700 underline underline-offset-4" onClick={() => chooseView('portfolio')}>Direkt zu „Meine Empfehlungen“</button>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Aktives Creator-Konto">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Du arbeitest gerade für</p>
            <p className="mt-1 text-lg font-black text-slate-950">{selectedParty?.name}</p>
            <p className="text-sm text-slate-600">Deine Rolle: {selectedParty ? ROLE_LABELS[selectedParty.role] : 'Nicht verfügbar'}</p>
          </div>
          {parties.length > 1 && (
            <label className="block min-w-64 text-sm font-bold text-slate-700">
              Creator oder Marke wechseln
              <select className="input mt-2" value={partyId ?? ''} onChange={(event) => changeParty(Number(event.target.value))}>
                {parties.map((party) => <option value={party.id} key={party.id}>{party.name} · {ROLE_LABELS[party.role]}</option>)}
              </select>
            </label>
          )}
        </div>
        {parties.length > 1 && <p className="mt-3 text-xs leading-5 text-slate-500">Beim Wechsel ändern sich Entwürfe, Empfehlungen und Zahlen. Entwürfe werden für jede Partei getrennt gespeichert.</p>}
      </section>

      {!canEdit && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          Du kannst die Empfehlungen ansehen, aber nicht ändern. Zum Erstellen oder Beenden brauchst du Bearbeitungsrechte für {selectedParty?.name}. Bitte den Inhaber darum. Falls du nicht weißt, wer das ist, kannst du <a className="font-bold underline" href="mailto:email@nickkrakow.de">Kontakt aufnehmen</a>.
        </div>
      )}

      <nav className="grid gap-3 md:grid-cols-3" aria-label="Creator-Aufgaben" role="tablist">
        {[
          { id: 'stack' as const, title: 'Ganzen Stack teilen', text: 'Alle teilbaren Produkte aus einem Stack gemeinsam zeigen.' },
          { id: 'product' as const, title: 'Ein Produkt empfehlen', text: 'Ein einzelnes Produkt aus einem deiner Stacks teilen.' },
          { id: 'portfolio' as const, title: 'Meine Empfehlungen', text: 'Status, Zahlen, Vorschau und öffentliche Links wiederfinden.' },
        ].map((entry) => (
          <button
            type="button"
            key={entry.id}
            id={`creator-tab-${entry.id}`}
            ref={(element) => { tabRefs.current[entry.id] = element; }}
            onClick={() => chooseView(entry.id)}
            onKeyDown={(event) => handleTaskTabKeyDown(event, entry.id)}
            disabled={entry.id !== 'portfolio' && !canEdit}
            role="tab"
            aria-selected={view === entry.id}
            aria-controls={`creator-panel-${entry.id}`}
            tabIndex={view === entry.id ? 0 : -1}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              view === entry.id ? 'border-indigo-400 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-200'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="block text-lg font-black">{entry.title}</span>
            <span className="mt-2 block text-sm leading-5 text-slate-600">{entry.text}</span>
          </button>
        ))}
      </nav>

      {message && <p ref={successMessageRef} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status" tabIndex={-1}>{message}</p>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">{error}</p>}
      {view === 'portfolio' && pendingDeepLinkPreview && stacksError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
          <p className="font-black">Deine Stacks konnten nicht geladen werden.</p>
          <p>Für die verlinkte Empfehlung müssen wir zuerst den ursprünglichen Stack sicher prüfen. Es wurde noch nichts als fehlend bewertet.</p>
          <button type="button" className="mt-3 font-bold underline" onClick={() => { focusAfterStacksRetry.current = true; setStacksAttempt((current) => current + 1); }}>Stacks erneut laden</button>
        </div>
      )}

      {view === 'portfolio' && directPreview && (
        <section ref={directPreviewRef} className="min-w-0 rounded-2xl border-2 border-indigo-300 bg-indigo-50/50 p-4 sm:p-5" aria-labelledby="creator-direct-preview-heading" tabIndex={-1}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-indigo-700">Direkt geöffnete Empfehlung</p>
              <h2 id="creator-direct-preview-heading" className="mt-1 text-xl font-black text-slate-950">{STATUS_LABELS[directPreview.creator_status]}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {directPreview.creator_status === 'approved' && <a className="btn btn-primary" href={`/share/${directPreview.token}`} target="_blank" rel="noreferrer">Öffentliche Seite öffnen (neuer Tab)</a>}
              <button type="button" className="btn btn-secondary" onClick={() => { setDirectPreview(null); patchQuery({ editShare: null }, true); }}>Direktansicht schließen</button>
            </div>
          </div>
          <CreatorRecommendationPreview preview={directPreview} heading="Gespeicherte Vorschau dieser Empfehlung" />
        </section>
      )}

      {view !== 'portfolio' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" id={`creator-panel-${view}`} role="tabpanel" aria-labelledby={`creator-tab-${view}`}>
          <section className="card space-y-5" ref={authorSectionRef} tabIndex={-1}>
            <div>
              <h2 className="text-xl font-black" id="creator-author-form-heading" tabIndex={-1}>{view === 'stack' ? 'Ganzen Stack teilen' : 'Ein Produkt empfehlen'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Diese Empfehlung zeigt den Stand beim Absenden. Spätere Änderungen an deinem Stack ändern den Link nicht.</p>
              <p className="mt-1 text-xs font-bold text-emerald-700" role="status">Dein Entwurf wird in diesem Browser automatisch gespeichert.</p>
              {moderationGuidance?.element_id === 'creator-author-form-heading' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert"><span className="font-black">Bitte prüfe diesen Bereich:</span> {moderationGuidance.reason}</p>}
            </div>

            {stacksLoading ? (
              <p className="py-6 text-center text-sm text-slate-500" role="status">Deine Stacks werden geladen…</p>
            ) : stacksError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                <p>Deine Stacks konnten nicht geladen werden.</p>
                    <button type="button" className="mt-3 font-bold underline" onClick={() => { focusAfterStacksRetry.current = true; setStacksAttempt((current) => current + 1); }}>Erneut versuchen</button>
              </div>
            ) : stacks.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Du hast noch keinen Stack, den du teilen kannst. <Link className="font-bold underline" to="/stacks">Stack anlegen</Link></div>
            ) : (
              <>
                <label className="block text-sm font-bold text-slate-700">
                  Welchen Stack möchtest du teilen?
                  <select className="input mt-2" value={stackId ?? ''} onChange={(event) => changeStack(Number(event.target.value))}>
                    {stacks.map((stack) => <option value={stack.id} key={stack.id}>{stack.name}</option>)}
                  </select>
                </label>
                {stackId && <Link className="inline-flex text-sm font-bold text-indigo-700 underline underline-offset-4" to={stackRepairPath()} onClick={persistCurrentDraft}>Gewählten Stack direkt öffnen</Link>}

                {detailsLoading && <p className="text-sm text-slate-500" role="status">Produkte werden geladen…</p>}
                {detailsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                    <p>Der gewählte Stack konnte nicht geladen werden.</p>
                    <button type="button" className="mt-3 font-bold underline" onClick={() => setDetailsRequest((current) => current + 1)}>Erneut versuchen</button>
                  </div>
                )}

                {view === 'product' && !detailsLoading && !detailsError && selectableProductItems.length === 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    In diesem Stack ist derzeit kein Produkt vorhanden, das du auswählen kannst.
                  </div>
                )}

                {view === 'product' && selectableProductItems.length > 0 && (
                  <label className="block text-sm font-bold text-slate-700">
                    Welches Produkt möchtest du empfehlen?
                    <select className="input mt-2" value={stackItemIdValue ?? ''} onChange={(event) => changeProduct(Number(event.target.value))}>
                      <option value="" disabled>Produkt auswählen</option>
                      {selectableProductItems.map((item) => {
                        const itemId = stackItemId(item);
                        const productReadiness = readiness?.products.find((product) => product.stack_item_id === itemId);
                        const availability = productReadiness && !productReadiness.shareable ? ' — noch nicht teilbar' : '';
                        return itemId ? <option value={itemId} key={itemId}>{item.name ?? `Produkt ${item.id}`}{availability}</option> : null;
                      })}
                    </select>
                  </label>
                )}

                {view === 'product' && missingOriginalProduct && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="alert">
                    <p>Das ursprünglich empfohlene Produkt ist nicht mehr in diesem Stack. Wähle oben bewusst ein anderes Produkt oder repariere den Stack.</p>
                    <Link className="mt-2 inline-flex font-bold underline" to={stackRepairPath(stackItemIdValue ?? undefined)} onClick={persistCurrentDraft}>Stack reparieren</Link>
                  </div>
                )}

                <label className="block text-sm font-bold text-slate-700">
                  Name der Empfehlung
                  <input aria-label="Name der Empfehlung" id="creator-title-input" className={`input mt-2 ${moderationGuidance?.element_id === 'creator-title-input' ? 'border-amber-400 ring-2 ring-amber-200' : ''}`} value={title} maxLength={120} placeholder="Zum Beispiel: Meine Morgenroutine" onChange={(event) => setTitle(event.target.value)} />
                  <span className="mt-1 flex justify-between gap-3 text-xs font-normal text-slate-500"><span>Dieser Name steht oben auf deiner öffentlichen Empfehlung.</span><span aria-label={`${title.length} von 120 Zeichen`}>{title.length}/120</span></span>
                  {moderationGuidance?.element_id === 'creator-title-input' && <span className="mt-2 block rounded-xl border border-amber-200 bg-amber-50 p-3 font-normal text-amber-950" role="alert"><span className="font-black">Rückmeldung:</span> {moderationGuidance.reason}</span>}
                </label>

                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-800">Dein Hinweis (optional)</h3>
                  <p className="text-xs leading-5 text-slate-500">Erlaubt sind persönliche Alltagserfahrungen, zum Beispiel „Passt gut in meine Abendroutine“ oder „Ich nehme es meist zusammen mit dem Frühstück“. Bitte keine Heilversprechen und keine persönliche Dosierung für andere.</p>
                  {selectedItems.map((item) => {
                    const itemId = stackItemId(item);
                    if (!itemId) return null;
                    const statement = statements[String(itemId)] ?? '';
                    return (
                      <div className={moderationGuidance?.element_id === `creator-product-${itemId}` ? 'rounded-xl border border-amber-300 bg-amber-50 p-3' : ''} id={`creator-product-${itemId}`} tabIndex={-1} key={itemId}>
                      <label className="block text-sm">
                        <span className="font-bold text-slate-700">{item.name ?? `Produkt ${item.id}`}</span>
                        <textarea id={`creator-statement-${itemId}`} className={`input mt-2 min-h-24 ${moderationGuidance?.element_id === `creator-statement-${itemId}` ? 'border-amber-400 ring-2 ring-amber-200' : ''}`} maxLength={500} value={statement} onChange={(event) => setStatements((current) => ({ ...current, [String(itemId)]: event.target.value }))} placeholder="Zum Beispiel: Passt gut in meine Abendroutine." />
                        <span className="mt-1 block text-right text-xs text-slate-500" aria-label={`${statement.length} von 500 Zeichen`}>{statement.length}/500</span>
                      </label>
                      {(moderationGuidance?.element_id === `creator-product-${itemId}` || moderationGuidance?.element_id === `creator-statement-${itemId}`) && <p className="mt-2 rounded-xl border border-amber-200 bg-white p-3 text-sm text-amber-950" role="alert"><span className="font-black">Rückmeldung zu {moderationGuidance.target_label}:</span> {moderationGuidance.reason}</p>}
                      </div>
                    );
                  })}
                </div>

                {visibleUnshareableProducts.length > 0 && (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                    <div>
                      <p className="font-black">{view === 'product' ? 'Dieses Produkt ist noch nicht teilbar' : 'Dieser Stack braucht noch eine Reparatur'}</p>
                      <p>{view === 'product'
                        ? 'Löse den genannten Punkt und kehre danach zu diesem automatisch gespeicherten Entwurf zurück.'
                        : 'Es wird keine unvollständige Empfehlung gespeichert. Löse die Punkte und kehre danach zu diesem automatisch gespeicherten Entwurf zurück.'}</p>
                    </div>
                    {visibleUnshareableProducts.map((product) => (
                      <article className="rounded-xl border border-amber-200 bg-white p-4" id={`creator-repair-${product.stack_item_id}`} tabIndex={-1} key={product.stack_item_id}>
                        <h3 className="font-black text-slate-900">{product.product_name}</h3>
                        <p className="mt-1 text-slate-700">{readinessReason(product)}</p>
                        {product.repair_kind === 'contact_owner' ? (
                          <a className="mt-2 inline-flex font-bold text-indigo-700 underline" href="mailto:email@nickkrakow.de">Support um Hilfe bitten</a>
                        ) : product.repair_kind === 'own_product' ? (
                          <Link className="mt-2 inline-flex font-bold text-indigo-700 underline" to={ownProductRepairPath(product.stack_item_id)} onClick={persistCurrentDraft}>Eigenes Produkt und Freigabestatus prüfen</Link>
                        ) : (
                          <Link className="mt-2 inline-flex font-bold text-indigo-700 underline" to={stackRepairPath(product.stack_item_id)} onClick={persistCurrentDraft}>Dieses Produkt im Stack reparieren</Link>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className="btn btn-primary" disabled={!canEdit || busy || detailsLoading || detailsError || selectedItems.length === 0 || !title.trim() || missingOriginalProduct || (view === 'stack' && hasUnshareableItems)} onClick={() => void submit()}>{busy ? 'Wird zur Prüfung eingereicht …' : 'Zur Prüfung senden'}</button>
                  <Link to={stackRepairPath()} onClick={persistCurrentDraft} className="text-sm font-bold text-indigo-600">Stack bearbeiten</Link>
                </div>
              </>
            )}
          </section>

          <div>{draftPreview ? <CreatorRecommendationPreview preview={draftPreview} /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Wähle einen Stack und einen Namen. Dann erscheint hier die Vorschau mit Bildern und leicht verständlichen Nutzungstexten.</div>}</div>
        </div>
      )}

      {view === 'portfolio' && (
        <section className="min-w-0 space-y-5" id="creator-panel-portfolio" role="tabpanel" aria-labelledby="creator-tab-portfolio">
          {dashboard && <CreatorDashboardPanel dashboard={dashboard} />}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div><h2 className="text-2xl font-black text-slate-950">Meine Empfehlungen</h2><p className="mt-2 text-sm text-slate-600">Suche, Status, Vorschau, Zahlen und öffentliche Links an einem Ort.</p></div>
            <form className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); updateFilters({ q: searchInput.trim() }); }}>
              <label className="text-sm font-bold text-slate-700 lg:col-span-2">Empfehlung suchen<div className="mt-2 flex gap-2"><input className="input min-w-0 flex-1" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name der Empfehlung" /><button className="btn btn-secondary" type="submit">Suchen</button></div></label>
              <label className="text-sm font-bold text-slate-700">Status<select className="input mt-2" value={filters.status} onChange={(event) => updateFilters({ status: event.target.value as PortfolioFilters['status'] })}><option value="all">Alle Status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label className="text-sm font-bold text-slate-700">Ablage<select className="input mt-2" value={filters.archive} onChange={(event) => updateFilters({ archive: event.target.value as CreatorPortfolioArchiveFilter })}><option value="active">Aktiv</option><option value="archived">Archiviert</option><option value="all">Alle</option></select></label>
              <label className="text-sm font-bold text-slate-700">Sortierung<select className="input mt-2" value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value as CreatorPortfolioSort })}><option value="newest">Neueste zuerst</option><option value="oldest">Älteste zuerst</option></select></label>
              {(filters.q || filters.status !== 'all' || filters.archive !== 'active' || filters.sort !== 'newest') && <button type="button" className="self-end text-sm font-bold text-indigo-700 underline" onClick={() => { setSearchInput(''); updateFilters({ q: '', status: 'all', archive: 'active', sort: 'newest' }); }}>Filter zurücksetzen</button>}
            </form>
          </div>

          {metricsPeriod && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-black">Zahlen für {formatDay(metricsPeriod.from)} bis {formatDay(metricsPeriod.to)}</p>
              <p className="mt-1">Vergleich: {formatDay(metricsPeriod.previous_from)} bis {formatDay(metricsPeriod.previous_to)}</p>
              <p className="mt-2 text-xs leading-5">Erfasste eindeutige Besuche enthalten nur Menschen mit Statistik-Zustimmung und sind deshalb unvollständig. Automatische Aufrufe werden, soweit erkennbar, ausgeschlossen.</p>
              <details className="mt-2"><summary className="cursor-pointer font-bold">Was bedeuten die Zahlen?</summary><p className="mt-2">Erfasste eindeutige Besuche (mit Statistik-Zustimmung): {metricsPeriod.unique_visitors_definition}</p><p className="mt-1">Gespeichert: {metricsPeriod.saves_definition}</p></details>
            </div>
          )}

          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {portfolioLoading
              ? 'Empfehlungen werden geladen.'
              : portfolioError
                ? 'Empfehlungen konnten nicht geladen werden.'
                : `${ownedShares.length} ${ownedShares.length === 1 ? 'Empfehlung' : 'Empfehlungen'} angezeigt${portfolioHasMore ? ', weitere Ergebnisse sind verfügbar' : ''}. Statusfilter: ${filters.status === 'all' ? 'Alle Status' : STATUS_LABELS[filters.status]}.`}
          </p>

          {portfolioLoading ? (
            <p className="py-10 text-center text-slate-500">Empfehlungen werden geladen…</p>
          ) : portfolioError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800" role="alert"><p>Deine Empfehlungen konnten nicht geladen werden.</p><button type="button" className="mt-3 font-bold underline" onClick={() => setPortfolioReload((current) => current + 1)}>Erneut versuchen</button></div>
          ) : ownedShares.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="font-black text-slate-800">Keine passende Empfehlung gefunden</p><p className="mt-2 text-sm text-slate-600">Passe Suche oder Filter an – oder erstelle eine neue Empfehlung.</p></div>
          ) : (
            <div className="space-y-4">
              {ownedShares.map((share) => {
                const status = effectiveStatus(share);
                const url = clipboardText(share.token);
                const shareText = `${share.title}\n${url}`;
                const target = moderationTarget(share, expandedShareId === share.id ? ownedPreview : null);
                const isPublic = status === 'approved';
                return (
                  <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={share.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1 text-xs font-black ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span><span className="text-xs font-bold text-slate-500">{share.type === 'stack' ? 'Ganzer Stack' : 'Ein Produkt'}</span>{share.archived_at && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Archiviert</span>}</div>
                        <h3 className="mt-3 text-xl font-black text-slate-950">{share.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">Erstellt: {formatCreatedAt(share.created_at)}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{statusNextStep(status)}</p>
                        <p className="mt-1 text-sm font-bold text-slate-600">{share.expires_at ? `${status === 'expired' ? 'Abgelaufen am' : 'Läuft ab am'} ${formatTimestamp(share.expires_at)}` : 'Kein Ablaufdatum'}</p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-slate-700"><span>{countLabel(share.metrics.unique_visitors, 'erfasster eindeutiger Besuch', 'erfasste eindeutige Besuche')} (mit Statistik-Zustimmung)</span><span>{countLabel(share.metrics.saves, 'Übernahme', 'Übernahmen')}</span></div>
                        <p className="mt-1 text-xs text-slate-500">Erfasste Besuche: {metricComparison(share.metrics.unique_visitors, share.metrics.previous_unique_visitors)} · Übernahmen in einen Stack: {metricComparison(share.metrics.saves, share.metrics.previous_saves)}. Besuche ohne Statistik-Zustimmung sind nicht enthalten; automatische Aufrufe werden, soweit erkennbar, ausgeschlossen.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-secondary" disabled={busyShareId === share.id} onClick={() => void showOwnedPreview(share)}>{expandedShareId === share.id ? 'Vorschau schließen' : 'Vorschau ansehen'}</button>
                        {canEdit && (status === 'approved' || status === 'paused') && <button id={`creator-lifecycle-${share.id}`} type="button" className="btn btn-secondary" disabled={busyShareId === share.id} onClick={() => openLifecycle(share)}>Link verwalten</button>}
                        {canEdit && status === 'blocked' && <button type="button" className="btn btn-primary" disabled={busyShareId === share.id} onClick={() => void prepareAgain(share)}>Überarbeiten und erneut senden</button>}
                        {canEdit && (status === 'revoked' || status === 'expired') && <button type="button" className="btn btn-primary" disabled={busyShareId === share.id} onClick={() => void prepareAgain(share)}>Mit aktuellem Stand neu erstellen</button>}
                        {canEdit && <button type="button" className="btn btn-secondary" disabled={busyShareId === share.id} onClick={() => void toggleArchive(share)}>{share.archived_at ? 'Aus Archiv holen' : 'Archivieren'}</button>}
                      </div>
                    </div>

                    {status === 'blocked' && share.moderation_reason && (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950"><p className="font-black">Das solltest du überarbeiten</p>{target && <p className="mt-1"><span className="font-bold">Betroffene Stelle:</span> {target}</p>}<p className="mt-1"><span className="font-bold">Rückmeldung:</span> {share.moderation_reason}</p></div>
                    )}

                    {(status === 'approved' || status === 'paused') && (
                      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        {status === 'paused' && <p className="mb-3 text-sm font-bold text-blue-800">Dieser Link ist pausiert. Aktiviere ihn über „Link verwalten“, bevor du ihn weitergibst.</p>}
                        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Öffentliche URL<input id={`creator-share-url-${share.id}`} className="input mt-2 w-full bg-white font-mono text-xs" readOnly value={url} onFocus={(event) => event.currentTarget.select()} aria-label={`Öffentliche URL für ${share.title}`} /></label>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className="btn btn-primary" disabled={busyShareId === share.id || !isPublic} onClick={() => void copyLink(share)}>Link kopieren</button>
                          <button type="button" className="btn btn-secondary" disabled={!isPublic} onClick={() => void nativeShare(share)}>Teilen</button>
                          {isPublic ? (
                            <>
                              <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">Per WhatsApp</a>
                              <a className="btn btn-secondary" href={`mailto:?subject=${encodeURIComponent(share.title)}&body=${encodeURIComponent(shareText)}`}>Per E-Mail</a>
                              <a className="btn btn-secondary" href={`/share/${share.token}`} target="_blank" rel="noreferrer">Öffentliche Seite öffnen (neuer Tab)</a>
                            </>
                          ) : (
                            <>
                              <button className="btn btn-secondary" type="button" disabled>Per WhatsApp</button>
                              <button className="btn btn-secondary" type="button" disabled>Per E-Mail</button>
                              <button className="btn btn-secondary" type="button" disabled>Öffentliche Seite öffnen (neuer Tab)</button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {expandedShareId === share.id && ownedPreview && (
                      <div className="mt-6 border-t border-slate-100 pt-6"><CreatorRecommendationPreview preview={ownedPreview} heading="Vorschau dieser Empfehlung" /></div>
                    )}
                  </article>
                );
              })}
              {portfolioHasMore && <div className="text-center"><button type="button" className="btn btn-secondary" disabled={portfolioLoadingMore || !portfolioCursor || !partyId} onClick={() => partyId && void loadPortfolioPage(partyId, portfolioCursor, true)}>{portfolioLoadingMore ? 'Weitere werden geladen…' : 'Weitere Empfehlungen laden'}</button></div>}
            </div>
          )}
        </section>
      )}

      {lifecycleShare && (
        <ModalWrapper title="Link verwalten" onClose={closeLifecycle} size="md">
            <p className="text-sm text-slate-600">{lifecycleShare.title}</p>
            <fieldset className="mt-5 space-y-3"><legend className="font-black text-slate-900">Was möchtest du tun?</legend>
              {(lifecycleShare.paused_at ? [{ action: 'resume' as const, label: 'Link wieder aktivieren', text: 'Die öffentliche Empfehlung ist danach wieder erreichbar.' }] : [{ action: 'pause' as const, label: 'Link pausieren', text: 'Die Empfehlung bleibt gespeichert und kann später wieder aktiviert werden.' }]).map((option) => <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4" key={option.action}><input type="radio" name="lifecycle-action" aria-label={option.label} checked={lifecycleAction === option.action} onChange={() => setLifecycleAction(option.action)} /><span><span className="block font-black text-slate-900">{option.label}</span><span className="mt-1 block text-sm text-slate-600">{option.text}</span></span></label>)}
              <label className="block cursor-pointer rounded-xl border border-slate-200 p-4"><span className="flex gap-3"><input type="radio" name="lifecycle-action" aria-label="Ablaufdatum setzen" checked={lifecycleAction === 'set_expiry'} onChange={() => setLifecycleAction('set_expiry')} /><span><span className="block font-black text-slate-900">Ablaufdatum setzen</span><span className="mt-1 block text-sm text-slate-600">Der Link endet automatisch am Ende dieses Tages. Solange er pausiert ist, bleibt er nicht erreichbar.</span></span></span>{lifecycleAction === 'set_expiry' && <input className="input mt-3" type="date" min={new Date().toISOString().slice(0, 10)} value={expiryInput} onChange={(event) => setExpiryInput(event.target.value)} aria-label="Ablaufdatum" />}</label>
              {lifecycleShare.expires_at && <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="lifecycle-action" aria-label="Ablaufdatum entfernen" checked={lifecycleAction === 'clear_expiry'} onChange={() => setLifecycleAction('clear_expiry')} /><span><span className="block font-black text-slate-900">Ablaufdatum entfernen</span><span className="mt-1 block text-sm text-slate-600">Der Link läuft dann nicht mehr automatisch ab.</span></span></label>}
              <label className="flex cursor-pointer gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4"><input type="radio" name="lifecycle-action" aria-label="Link dauerhaft beenden" checked={lifecycleAction === 'end'} onChange={() => setLifecycleAction('end')} /><span><span className="block font-black text-rose-900">Link dauerhaft beenden</span><span className="mt-1 block text-sm text-rose-800">Niemand kann diesen Link danach öffnen. Die Empfehlung bleibt im Portfolio und kann als neuer Stand erneut erstellt werden.</span></span></label>
            </fieldset>
            {lifecycleError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800" role="alert">{lifecycleError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" className="btn btn-secondary" onClick={closeLifecycle}>Abbrechen</button><button type="button" className={lifecycleAction === 'end' ? 'btn border border-rose-300 bg-rose-600 text-white hover:bg-rose-700' : 'btn btn-primary'} disabled={busyShareId === lifecycleShare.id} onClick={() => void applyLifecycle()}>{busyShareId === lifecycleShare.id ? 'Wird gespeichert…' : lifecycleAction === 'end' ? 'Link dauerhaft beenden' : 'Änderung speichern'}</button></div>
        </ModalWrapper>
      )}
    </div>
  );
}
