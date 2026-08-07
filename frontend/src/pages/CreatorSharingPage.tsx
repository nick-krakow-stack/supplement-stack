import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getStacks } from '../api/stacks';
import {
  createCreatorShare,
  creatorSharingEnabled,
  getCreatorDashboard,
  getCreatorOwnedSharePreview,
  getCreatorOwnedShares,
  getCreatorParties,
  getCreatorShareReadiness,
  revokeCreatorShare,
  type CreatorDashboard,
  type CreatorOwnedShare,
  type CreatorOwnedSharePreview,
  type CreatorParty,
  type CreatorSharePreview,
  type CreatorShareReadiness,
  type CreatorShareStatus,
  type CreatorSourceShareGuard,
} from '../api/creatorSharing';
import CreatorRecommendationPreview from '../components/CreatorRecommendationPreview';
import type { Stack, StackItem } from '../types';

type CreatorView = 'stack' | 'product' | 'portfolio';
type ShareableStackItem = StackItem & {
  name?: string;
  brand?: string | null;
  product_type?: 'catalog' | 'user_product';
  serving_unit?: string | null;
};
type StackDetails = { stack: Stack; items: ShareableStackItem[] };
type PrefillDraft = { share: CreatorOwnedShare; preview: CreatorOwnedSharePreview };

const DISCLOSURE = 'Einige Produktlinks sind Affiliate-Links. Die Plattform oder der Stack-Anbieter kann daran verdienen; für dich ändert sich der Preis nicht.';

const STATUS_LABELS: Record<CreatorShareStatus, string> = {
  pending: 'Wird geprüft',
  approved: 'Freigegeben',
  blocked: 'Nicht freigegeben',
  revoked: 'Von dir beendet',
  expired: 'Abgelaufen',
};

const STATUS_CLASSES: Record<CreatorShareStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  blocked: 'border-rose-200 bg-rose-50 text-rose-800',
  revoked: 'border-slate-200 bg-slate-100 text-slate-700',
  expired: 'border-slate-200 bg-slate-100 text-slate-700',
};

function creatorCanEdit(party: CreatorParty | null): boolean {
  return party?.role === 'owner' || party?.role === 'editor';
}

function stackItemId(item: ShareableStackItem): number | null {
  const value = Number(item.stack_item_id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function formatCreatedAt(value: number): string {
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
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
    return `Dieser Stack kann noch nicht vollständig geteilt werden.${productText} Öffne den Stack und prüfe bei diesen Produkten die Freigabe und den Shop-Link.`;
  }
  if (response?.status === 403) return 'Du darfst diese Aktion nicht ausführen. Bitte prüfe deinen Zugriff und lade die Seite neu.';
  if (response?.status === 409) return 'Die Empfehlung hat sich inzwischen geändert. Bitte lade die Liste neu und versuche es noch einmal.';
  return fallback;
}

export default function CreatorSharingPage() {
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState(false);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [parties, setParties] = useState<CreatorParty[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksError, setStacksError] = useState(false);
  const [stacksAttempt, setStacksAttempt] = useState(0);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [stackId, setStackId] = useState<number | null>(null);
  const [details, setDetails] = useState<StackDetails | null>(null);
  const [readiness, setReadiness] = useState<CreatorShareReadiness | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [view, setView] = useState<CreatorView>('stack');
  const [stackItemIdValue, setStackItemIdValue] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [ownedShares, setOwnedShares] = useState<CreatorOwnedShare[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(false);
  const [expandedShareId, setExpandedShareId] = useState<number | null>(null);
  const [ownedPreview, setOwnedPreview] = useState<CreatorOwnedSharePreview | null>(null);
  const [busyShareId, setBusyShareId] = useState<number | null>(null);
  const [detailsRequest, setDetailsRequest] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missingOriginalProduct, setMissingOriginalProduct] = useState(false);
  const [sourceShareGuard, setSourceShareGuard] = useState<CreatorSourceShareGuard | null>(null);
  const previewTimestamp = useRef(new Date().toISOString());
  const pendingPrefill = useRef<PrefillDraft | null>(null);
  const partyGeneration = useRef(0);

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === partyId) ?? null,
    [parties, partyId],
  );
  const canEdit = creatorCanEdit(selectedParty);

  useEffect(() => {
    if (!creatorSharingEnabled) {
      setAccessLoading(false);
      return;
    }
    let cancelled = false;
    setAccessLoading(true);
    setAccessError(false);
    getCreatorParties()
      .then((nextParties) => {
        if (cancelled) return;
        const creatorParties = nextParties.filter((party) => party.type === 'creator' || party.type === 'brand');
        setParties(creatorParties);
        setPartyId(creatorParties[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setParties([]);
          setPartyId(null);
          setAccessError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => { cancelled = true; };
  }, [accessAttempt]);

  useEffect(() => {
    if (parties.length === 0) {
      setStacks([]);
      setStackId(null);
      return;
    }
    let cancelled = false;
    setStacksLoading(true);
    setStacksError(false);
    getStacks()
      .then(({ stacks: nextStacks }) => {
        if (cancelled) return;
        setStacks(nextStacks);
        setStackId((current) => nextStacks.some((stack) => stack.id === current) ? current : nextStacks[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setStacks([]);
          setStackId(null);
          setStacksError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setStacksLoading(false);
      });
    return () => { cancelled = true; };
  }, [parties.length, stacksAttempt]);

  useEffect(() => {
    if (!stackId || !partyId || !creatorSharingEnabled) {
      setDetails(null);
      setReadiness(null);
      return;
    }
    let cancelled = false;
    const draft = pendingPrefill.current;
    pendingPrefill.current = null;
    setDetails(null);
    setReadiness(null);
    setDetailsError(false);
    setDetailsLoading(true);
    Promise.all([
      apiClient.get<StackDetails>(`/stacks/${stackId}`),
      getCreatorShareReadiness(stackId, partyId),
    ])
      .then(([response, nextReadiness]) => {
        if (cancelled) return;
        const nextDetails = response.data;
        setDetails(nextDetails);
        setReadiness(nextReadiness);
        const catalogItems = nextDetails.items.filter((item) => item.product_type !== 'user_product');
        const shareableIds = new Set(nextReadiness.shareable_stack_item_ids);
        const shareableItems = catalogItems.filter((item) => {
          const itemId = stackItemId(item);
          return itemId !== null && shareableIds.has(itemId);
        });
        const requestedItemId = draft?.share.type === 'dose_recommendation' ? draft.share.entity_id : null;
        const selectedItem = requestedItemId
          ? shareableItems.find((item) => stackItemId(item) === requestedItemId) ?? null
          : shareableItems[0] ?? null;
        setStackItemIdValue(stackItemId(selectedItem ?? {} as ShareableStackItem));
        setMissingOriginalProduct(Boolean(requestedItemId && !selectedItem));
        setTitle(draft?.preview.title ?? nextDetails.stack.name);
        if (draft) {
          const nextStatements: Record<string, string> = {};
          const remaining = [...draft.preview.items];
          for (const item of shareableItems) {
            const itemId = stackItemId(item);
            const matchIndex = remaining.findIndex((candidate) => candidate.catalog_product_id === item.id);
            if (!itemId || matchIndex < 0) continue;
            const [match] = remaining.splice(matchIndex, 1);
            if (match.creator_statement) nextStatements[String(itemId)] = match.creator_statement;
          }
          setStatements(nextStatements);
        } else {
          setStatements({});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetails(null);
          setReadiness(null);
          setDetailsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => { cancelled = true; };
  }, [stackId, partyId, detailsRequest]);

  const loadPortfolio = async (nextPartyId: number, generation: number) => {
    setPortfolioLoading(true);
    setPortfolioError(false);
    try {
      const shares = await getCreatorOwnedShares(nextPartyId);
      if (partyGeneration.current === generation) setOwnedShares(shares);
    } catch {
      if (partyGeneration.current === generation) {
        setOwnedShares([]);
        setPortfolioError(true);
      }
    } finally {
      if (partyGeneration.current === generation) setPortfolioLoading(false);
    }
  };

  const loadDashboard = async (nextPartyId: number, generation: number) => {
    try {
      const nextDashboard = await getCreatorDashboard(nextPartyId);
      if (partyGeneration.current === generation) setDashboard(nextDashboard);
    } catch {
      if (partyGeneration.current === generation) setDashboard(null);
    }
  };

  useEffect(() => {
    const generation = ++partyGeneration.current;
    setOwnedShares([]);
    setExpandedShareId(null);
    setOwnedPreview(null);
    setPortfolioError(false);
    setDashboard(null);
    if (!partyId || !creatorSharingEnabled) {
      setPortfolioLoading(false);
      return;
    }
    void loadDashboard(partyId, generation);
    void loadPortfolio(partyId, generation);
  }, [partyId]);

  const catalogItems = useMemo(
    () => details?.items.filter((item) => item.product_type !== 'user_product') ?? [],
    [details],
  );
  const shareableCatalogItems = useMemo(() => {
    const shareableIds = new Set(readiness?.shareable_stack_item_ids ?? []);
    return catalogItems.filter((item) => {
      const itemId = stackItemId(item);
      return itemId !== null && shareableIds.has(itemId);
    });
  }, [catalogItems, readiness]);
  const hasUnshareableItems = Boolean(readiness && !readiness.ready);
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
      disclosure: DISCLOSURE,
      items: selectedItems.map((item) => ({
        catalog_product_id: item.id,
        product_name: item.name ?? null,
        brand: item.brand ?? null,
        quantity: item.quantity,
        unit: item.serving_unit ?? null,
        intake_interval_days: Number.isSafeInteger(item.intake_interval_days) && Number(item.intake_interval_days) > 0
          ? Number(item.intake_interval_days)
          : null,
        dosage_text: item.dosage_text ?? null,
        timing: item.timing ?? null,
        creator_statement: statements[String(stackItemId(item))]?.trim() || null,
        category_name: item.category_name ?? null,
        has_affiliate_attribution: false,
      })),
    };
  }, [selectedItems, selectedParty, statements, title, view]);

  const changeStack = (nextStackId: number) => {
    pendingPrefill.current = null;
    setMissingOriginalProduct(false);
    setStackId(nextStackId);
    setDetailsRequest((current) => current + 1);
  };

  const changeParty = (nextPartyId: number) => {
    partyGeneration.current += 1;
    pendingPrefill.current = null;
    setSourceShareGuard(null);
    setMissingOriginalProduct(false);
    setOwnedShares([]);
    setExpandedShareId(null);
    setOwnedPreview(null);
    setDashboard(null);
    setBusy(false);
    setBusyShareId(null);
    setPartyId(nextPartyId);
  };

  const chooseView = (nextView: CreatorView) => {
    setMessage(null);
    setError(null);
    setView(nextView);
    setSourceShareGuard(null);
    setMissingOriginalProduct(false);
    if (nextView === 'product') setStackItemIdValue(stackItemId(shareableCatalogItems[0] ?? {} as ShareableStackItem));
  };

  const submit = async () => {
    if (!canEdit || !partyId || !stackId || !title.trim() || selectedItems.length === 0) return;
    if (view === 'stack' && hasUnshareableItems) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const generation = partyGeneration.current;
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
      setMessage('Deine Empfehlung wurde gespeichert und wird geprüft. Sobald sie freigegeben ist, kannst du den Link unter „Meine Empfehlungen“ kopieren.');
      await loadPortfolio(partyId, generation);
      if (partyGeneration.current !== generation) return;
      setSourceShareGuard(null);
      setView('portfolio');
    } catch (caught: unknown) {
      setError(friendlyCreatorError(caught, 'Die Empfehlung konnte nicht gespeichert werden. Bitte versuche es noch einmal.'));
    } finally {
      if (partyGeneration.current === generation) setBusy(false);
    }
  };

  const showOwnedPreview = async (share: CreatorOwnedShare) => {
    if (expandedShareId === share.id) {
      setExpandedShareId(null);
      setOwnedPreview(null);
      return;
    }
    setBusyShareId(share.id);
    setError(null);
    const generation = partyGeneration.current;
    try {
      const preview = await getCreatorOwnedSharePreview(share.id);
      if (partyGeneration.current !== generation) return;
      setOwnedPreview(preview);
      setExpandedShareId(share.id);
    } catch {
      setError('Die Vorschau konnte nicht geladen werden. Bitte versuche es noch einmal.');
    } finally {
      if (partyGeneration.current === generation) setBusyShareId(null);
    }
  };

  const copyLink = async (share: CreatorOwnedShare) => {
    setBusyShareId(share.id);
    setError(null);
    const generation = partyGeneration.current;
    try {
      await navigator.clipboard.writeText(clipboardText(share.token));
      if (partyGeneration.current !== generation) return;
      setMessage('Link kopiert. Du kannst ihn jetzt teilen.');
    } catch {
      setError('Der Link konnte nicht kopiert werden. Öffne die öffentliche Seite und kopiere ihn aus der Adresszeile.');
    } finally {
      if (partyGeneration.current === generation) setBusyShareId(null);
    }
  };

  const endShare = async (share: CreatorOwnedShare) => {
    if (!window.confirm('Möchtest du diesen Link wirklich beenden? Danach kann niemand die Empfehlung über diesen Link öffnen.')) return;
    setBusyShareId(share.id);
    setError(null);
    const generation = partyGeneration.current;
    try {
      await revokeCreatorShare(share);
      if (partyGeneration.current !== generation) return;
      if (partyId) await Promise.all([
        loadPortfolio(partyId, generation),
        loadDashboard(partyId, generation),
      ]);
      setExpandedShareId(null);
      setOwnedPreview(null);
      setMessage('Der Link wurde beendet. Deine gespeicherte Empfehlung bleibt in „Meine Empfehlungen“ erhalten.');
    } catch (caught: unknown) {
      if (partyGeneration.current === generation) {
        setError(friendlyCreatorError(caught, 'Der Link konnte nicht beendet werden. Bitte lade die Seite neu und versuche es noch einmal.'));
      }
    } finally {
      if (partyGeneration.current === generation) setBusyShareId(null);
    }
  };

  const prepareAgain = async (share: CreatorOwnedShare) => {
    setBusyShareId(share.id);
    setError(null);
    setSourceShareGuard(null);
    const generation = partyGeneration.current;
    try {
      const preview = await getCreatorOwnedSharePreview(share.id);
      if (partyGeneration.current !== generation) return;
      if (preview.creator_status !== 'blocked' && preview.creator_status !== 'revoked' && preview.creator_status !== 'expired') {
        setError('Der Status dieser Empfehlung hat sich geändert. Bitte lade deine Empfehlungen neu.');
        return;
      }
      const targetStackId = share.source_stack_id;
      if (!targetStackId) {
        setError(stacks.length > 0
          ? 'Der ursprüngliche Stack ist nicht mehr verfügbar. Wähle oben „Ganzen Stack teilen“ oder „Ein Produkt empfehlen“ und danach einen anderen Stack.'
          : 'Der ursprüngliche Stack ist nicht mehr verfügbar. Lege zuerst einen Stack an.');
        return;
      }
      pendingPrefill.current = { share, preview };
      setSourceShareGuard({
        share_id: preview.share_id,
        expected_snapshot_hash: preview.snapshot_hash,
        expected_status: preview.creator_status,
        expected_moderation_status: preview.moderation_status,
        expected_is_revoked: preview.is_revoked,
        expected_expires_at: preview.expires_at,
      });
      setView(share.type === 'stack' ? 'stack' : 'product');
      setStackId(targetStackId);
      setDetailsRequest((current) => current + 1);
      setMessage(share.status === 'blocked'
        ? 'Die bisherigen Angaben sind vorausgefüllt. Prüfe sie und sende eine neue Empfehlung.'
        : 'Die bisherigen Angaben sind vorausgefüllt. Prüfe den aktuellen Stand und sende eine neue Empfehlung.');
    } catch {
      setError('Die Empfehlung konnte nicht vorbereitet werden. Bitte versuche es noch einmal.');
    } finally {
      if (partyGeneration.current === generation) setBusyShareId(null);
    }
  };

  if (!creatorSharingEnabled) {
    return <div className="card mx-auto max-w-2xl"><h1>Creator-Bereich</h1><p className="mt-3 text-gray-600">Diese Funktion ist noch nicht aktiviert.</p></div>;
  }
  if (accessLoading) return <div className="py-16 text-center text-slate-500">Creator-Bereich wird geladen…</div>;
  if (accessError) {
    return (
      <div className="card mx-auto max-w-2xl">
        <h1>Creator-Bereich konnte nicht geladen werden</h1>
        <p className="mt-3 leading-6 text-gray-600">Bitte prüfe deine Verbindung und versuche es noch einmal.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={() => setAccessAttempt((current) => current + 1)}>Erneut versuchen</button>
          <Link className="btn btn-secondary" to="/stacks">Zu meinen Stacks</Link>
        </div>
      </div>
    );
  }
  if (parties.length === 0) {
    return (
      <div className="card mx-auto max-w-2xl">
        <h1>Creator-Bereich nicht freigeschaltet</h1>
        <p className="mt-3 leading-6 text-gray-600">
          Der Creator-Bereich ist nur für freigeschaltete Creator und Marken. Wenn du eingeladen wurdest, wende dich an deine Ansprechperson.
        </p>
        <Link className="btn btn-primary mt-5 inline-flex" to="/stacks">Zu meinen Stacks</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-indigo-600">Für Creator</p>
        <h1 className="mt-2">Empfehlungen teilen</h1>
        <p className="mt-2 max-w-3xl leading-6 text-gray-600">
          Teile einen ganzen Stack oder ein einzelnes Produkt. Jede neue Empfehlung wird vor der Veröffentlichung geprüft.
        </p>
      </header>

      {parties.length > 1 && (
        <label className="block max-w-md text-sm font-bold text-slate-700">
          Wer teilt die Empfehlung?
          <select className="input mt-2" value={partyId ?? ''} onChange={(event) => changeParty(Number(event.target.value))}>
            {parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}
          </select>
        </label>
      )}

      {!canEdit && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
          Du kannst die Empfehlungen dieser Seite ansehen. Zum Erstellen oder Beenden brauchst du Schreibzugriff für {selectedParty?.name}.
        </div>
      )}

      <nav className="grid gap-3 md:grid-cols-3" aria-label="Creator-Aufgaben">
        {[
          { id: 'stack' as const, title: 'Ganzen Stack teilen', text: 'Alle teilbaren Produkte aus einem Stack gemeinsam zeigen.' },
          { id: 'product' as const, title: 'Ein Produkt empfehlen', text: 'Ein einzelnes Produkt aus einem deiner Stacks teilen.' },
          { id: 'portfolio' as const, title: 'Meine Empfehlungen', text: 'Status, Vorschau und öffentliche Links wiederfinden.' },
        ].map((entry) => (
          <button
            type="button"
            key={entry.id}
            onClick={() => chooseView(entry.id)}
            disabled={entry.id !== 'portfolio' && !canEdit}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              view === entry.id ? 'border-indigo-400 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-200'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span className="block text-lg font-black">{entry.title}</span>
            <span className="mt-2 block text-sm leading-5 text-slate-600">{entry.text}</span>
          </button>
        ))}
      </nav>

      {message && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">{message}</p>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700" role="alert">{error}</p>}

      {view !== 'portfolio' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="card space-y-5">
            <div>
              <h2 className="text-xl font-black">{view === 'stack' ? 'Ganzen Stack teilen' : 'Ein Produkt empfehlen'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Diese Empfehlung zeigt den Stand von heute. Spätere Änderungen an deinem Stack ändern diesen Link nicht.
              </p>
            </div>

            {stacksLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">Deine Stacks werden geladen…</p>
            ) : stacksError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p>Deine Stacks konnten nicht geladen werden.</p>
                <button type="button" className="mt-3 font-bold underline" onClick={() => setStacksAttempt((current) => current + 1)}>Erneut versuchen</button>
              </div>
            ) : stacks.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Du hast noch keinen Stack, den du teilen kannst. <Link className="font-bold underline" to="/stacks">Stack anlegen</Link>
              </div>
            ) : (
              <>
                <label className="block text-sm font-bold text-slate-700">
                  Welchen Stack möchtest du teilen?
                  <select className="input mt-2" value={stackId ?? ''} onChange={(event) => changeStack(Number(event.target.value))}>
                    {stacks.map((stack) => <option value={stack.id} key={stack.id}>{stack.name}</option>)}
                  </select>
                </label>

                {detailsLoading && <p className="text-sm text-slate-500">Produkte werden geladen…</p>}
                {detailsError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <p>Der gewählte Stack konnte nicht geladen werden.</p>
                    <button type="button" className="mt-3 font-bold underline" onClick={() => setDetailsRequest((current) => current + 1)}>Erneut versuchen</button>
                  </div>
                )}

                {view === 'product' && !detailsLoading && !detailsError && shareableCatalogItems.length === 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    In diesem Stack kann derzeit kein Produkt geteilt werden. Öffne den Stack und prüfe, ob das Produkt freigegeben ist und einen funktionierenden Shop-Link hat.{' '}
                    <Link className="font-bold underline" to="/stacks">Stack bearbeiten</Link>
                  </div>
                )}

                {view === 'product' && shareableCatalogItems.length > 0 && (
                  <label className="block text-sm font-bold text-slate-700">
                    Welches Produkt möchtest du empfehlen?
                    <select className="input mt-2" value={stackItemIdValue ?? ''} onChange={(event) => {
                      setStackItemIdValue(Number(event.target.value));
                      setMissingOriginalProduct(false);
                    }}>
                      <option value="" disabled>Produkt auswählen</option>
                      {shareableCatalogItems.map((item) => {
                        const itemId = stackItemId(item);
                        return itemId ? <option value={itemId} key={itemId}>{item.name ?? `Produkt ${item.id}`}</option> : null;
                      })}
                    </select>
                  </label>
                )}

                {view === 'product' && missingOriginalProduct && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="alert">
                    Das ursprünglich empfohlene Produkt ist nicht mehr in diesem Stack. Wähle ein Produkt, bevor du die neue Empfehlung sendest.
                  </div>
                )}

                <label className="block text-sm font-bold text-slate-700">
                  Name der Empfehlung
                  <input className="input mt-2" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
                </label>

                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-800">Dein Hinweis (optional)</h3>
                  <p className="text-xs leading-5 text-slate-500">
                    Schreibe kurz, warum du das Produkt nutzt. Bitte keine Heilversprechen und keine persönliche Dosierung für andere.
                  </p>
                  {selectedItems.map((item) => {
                    const itemId = stackItemId(item);
                    if (!itemId) return null;
                    return (
                      <label className="block text-sm" key={itemId}>
                        <span className="font-bold text-slate-700">{item.name ?? `Produkt ${item.id}`}</span>
                        <textarea
                          className="input mt-2 min-h-24"
                          maxLength={500}
                          value={statements[String(itemId)] ?? ''}
                          onChange={(event) => setStatements((current) => ({ ...current, [String(itemId)]: event.target.value }))}
                          placeholder="Zum Beispiel: Ich nutze dieses Produkt, weil es gut in meinen Alltag passt."
                        />
                      </label>
                    );
                  })}
                </div>

                {view === 'stack' && hasUnshareableItems && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <p>Dieser Stack kann noch nicht vollständig geteilt werden. Es wird keine unvollständige Empfehlung gespeichert.</p>
                    {readiness && readiness.unshareable_products.length > 0 && (
                      <p className="mt-2 font-bold">Betroffen: {readiness.unshareable_products.map((product) => product.product_name).join(', ')}</p>
                    )}
                    <p className="mt-2">Öffne den Stack und prüfe bei diesen Produkten die Freigabe und den Shop-Link.</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || detailsLoading || detailsError || selectedItems.length === 0 || !title.trim() || missingOriginalProduct || (view === 'stack' && hasUnshareableItems)}
                    onClick={() => void submit()}
                  >
                    {busy ? 'Wird gesendet…' : 'Zur Prüfung senden'}
                  </button>
                  <Link to="/stacks" className="text-sm font-bold text-indigo-600">Stacks bearbeiten</Link>
                </div>
              </>
            )}
          </section>

          <div>
            {draftPreview ? (
              <CreatorRecommendationPreview preview={draftPreview} />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Wähle einen Stack und einen Namen. Dann erscheint hier die Vorschau.
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'portfolio' && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-950">Meine Empfehlungen</h2>
              <p className="mt-2 text-sm text-slate-600">Hier findest du den Status, deine Vorschau und alle freigegebenen Links wieder.</p>
            </div>
            {dashboard && (
              <p className="text-sm font-bold text-slate-600">
                {dashboard.active_shares} aktuell freigegebene Links · {dashboard.imports}-mal über diese aktiven Links gespeichert
              </p>
            )}
          </div>

          {portfolioLoading ? (
            <p className="py-10 text-center text-slate-500">Empfehlungen werden geladen…</p>
          ) : portfolioError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
              <p>Deine Empfehlungen konnten nicht geladen werden.</p>
              {partyId && (
                <button type="button" className="mt-3 font-bold underline" onClick={() => void loadPortfolio(partyId, partyGeneration.current)}>Erneut versuchen</button>
              )}
            </div>
          ) : ownedShares.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="font-black text-slate-800">Noch keine Empfehlung vorhanden</p>
              <p className="mt-2 text-sm text-slate-600">Teile einen ganzen Stack oder empfehle ein einzelnes Produkt.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ownedShares.map((share) => (
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={share.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${STATUS_CLASSES[share.status]}`}>
                          {STATUS_LABELS[share.status]}
                        </span>
                        <span className="text-xs font-bold text-slate-500">{share.type === 'stack' ? 'Ganzer Stack' : 'Ein Produkt'}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-slate-950">{share.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">Stand: {formatCreatedAt(share.created_at)}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600">{share.views}-mal angesehen · {share.saves}-mal gespeichert</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-secondary" disabled={busyShareId === share.id} onClick={() => void showOwnedPreview(share)}>
                        {expandedShareId === share.id ? 'Vorschau schließen' : 'Vorschau ansehen'}
                      </button>
                      {share.status === 'approved' && (
                        <>
                          <button type="button" className="btn btn-primary" disabled={busyShareId === share.id} onClick={() => void copyLink(share)}>Link kopieren</button>
                          <a className="btn btn-secondary" href={`/share/${share.token}`} target="_blank" rel="noreferrer">Öffentliche Seite öffnen</a>
                          {canEdit && <button type="button" className="btn border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" disabled={busyShareId === share.id} onClick={() => void endShare(share)}>Link beenden</button>}
                        </>
                      )}
                      {canEdit && share.status === 'blocked' && (
                        <button type="button" className="btn btn-primary" disabled={busyShareId === share.id} onClick={() => void prepareAgain(share)}>Überarbeiten und erneut senden</button>
                      )}
                      {canEdit && (share.status === 'revoked' || share.status === 'expired') && (
                        <button type="button" className="btn btn-primary" disabled={busyShareId === share.id} onClick={() => void prepareAgain(share)}>Mit aktuellem Stand neu erstellen</button>
                      )}
                    </div>
                  </div>

                  {expandedShareId === share.id && ownedPreview && (
                    <div className="mt-6 border-t border-slate-100 pt-6">
                      <CreatorRecommendationPreview preview={ownedPreview} heading="Vorschau dieser Empfehlung" />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
