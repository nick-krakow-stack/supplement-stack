import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getStacks } from '../api/stacks';
import {
  createCreatorShare,
  creatorSharingEnabled,
  getCreatorDashboard,
  getCreatorParties,
  type CreatorDashboard,
  type CreatorParty,
} from '../api/creatorSharing';
import type { Stack, StackItem } from '../types';

type StackDetails = { stack: Stack; items: Array<StackItem & { name?: string; brand?: string | null }> };

export default function CreatorSharingPage() {
  const [parties, setParties] = useState<CreatorParty[]>([]);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [partyId, setPartyId] = useState<number | null>(null);
  const [stackId, setStackId] = useState<number | null>(null);
  const [details, setDetails] = useState<StackDetails | null>(null);
  const [shareType, setShareType] = useState<'stack' | 'dose_recommendation'>('stack');
  const [stackItemId, setStackItemId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [statements, setStatements] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<CreatorDashboard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!creatorSharingEnabled) return;
    Promise.all([getCreatorParties(), getStacks()])
      .then(([nextParties, stackResponse]) => {
        setParties(nextParties.filter((party) => party.type === 'creator' || party.type === 'brand'));
        setStacks(stackResponse.stacks);
        setPartyId(nextParties.find((party) => party.type === 'creator' || party.type === 'brand')?.id ?? null);
        setStackId(stackResponse.stacks[0]?.id ?? null);
      })
      .catch(() => setError('Creator-Daten konnten nicht geladen werden.'));
  }, []);

  useEffect(() => {
    if (!stackId || !creatorSharingEnabled) return;
    apiClient.get<StackDetails>(`/stacks/${stackId}`).then((response) => {
      setDetails(response.data);
      setTitle(response.data.stack.name);
      setStackItemId(response.data.items[0]?.stack_item_id ?? null);
    }).catch(() => setError('Stack konnte nicht geladen werden.'));
  }, [stackId]);

  useEffect(() => {
    if (!partyId || !creatorSharingEnabled) return;
    getCreatorDashboard(partyId).then(setDashboard).catch(() => setDashboard(null));
  }, [partyId]);

  const selectedItems = useMemo(() => {
    if (!details) return [];
    return shareType === 'stack'
      ? details.items
      : details.items.filter((item) => item.stack_item_id === stackItemId);
  }, [details, shareType, stackItemId]);

  if (!creatorSharingEnabled) {
    return <div className="card max-w-2xl mx-auto"><h1>Creator-Stack-Sharing</h1><p className="text-gray-600 mt-3">Diese Funktion ist noch nicht aktiviert.</p></div>;
  }

  const submit = async () => {
    if (!partyId || !stackId || !title.trim() || (shareType === 'dose_recommendation' && !stackItemId)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const selectedStatements = Object.fromEntries(
        selectedItems
          .map((item) => [String(item.stack_item_id), statements[String(item.stack_item_id)]?.trim()] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
      );
      const share = await createCreatorShare({
        party_id: partyId,
        stack_id: stackId,
        type: shareType,
        title: title.trim(),
        stack_item_id: shareType === 'dose_recommendation' ? stackItemId ?? undefined : undefined,
        creator_statements: selectedStatements,
      });
      setMessage(`Share erstellt und zur Moderation eingereicht. Nach Freigabe: ${window.location.origin}/share/${share.token}`);
    } catch (caught: unknown) {
      setError((caught as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Share konnte nicht erstellt werden.');
    } finally {
      setBusy(false);
    }
  };

  if (parties.length === 0) {
    return <div className="card max-w-2xl mx-auto"><h1>Creator-Stack-Sharing</h1><p className="text-gray-600 mt-3">Deinem Konto ist noch keine freigegebene Creator- oder Markenpartei zugeordnet.</p></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1>Creator-Stack-Sharing</h1>
        <p className="text-gray-600 mt-2">Erstelle einen unveränderlichen Share-Snapshot. Neue Shares werden erst nach Moderation öffentlich.</p>
      </div>

      {dashboard && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Creator-Kennzahlen">
          {[
            ['Klicks gesamt', dashboard.clicks_total],
            ['Klicks (30 Tage)', dashboard.clicks],
            ['Vorherige 30 Tage', dashboard.previous_clicks],
            ['Aktive importierte Stacks', dashboard.imported_stacks],
            ['Verwendete Produkte / Shops', `${dashboard.clicked_products} / ${dashboard.clicked_shops}`],
            ['Importe', dashboard.imports],
          ].map(([label, value]) => <div className="card" key={String(label)}><div className="text-sm text-gray-500">{label}</div><div className="text-2xl font-semibold mt-1">{value}</div></div>)}
        </section>
      )}

      <section className="card space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium">Creator/Marke
            <select className="input mt-1" value={partyId ?? ''} onChange={(event) => setPartyId(Number(event.target.value))}>
              {parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Stack
            <select className="input mt-1" value={stackId ?? ''} onChange={(event) => setStackId(Number(event.target.value))}>
              {stacks.map((stack) => <option value={stack.id} key={stack.id}>{stack.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Freigabeart
            <select className="input mt-1" value={shareType} onChange={(event) => setShareType(event.target.value as typeof shareType)}>
              <option value="stack">Ganzer Stack</option>
              <option value="dose_recommendation">Einzelne Empfehlung</option>
            </select>
          </label>
          <label className="text-sm font-medium">Titel
            <input className="input mt-1" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
          </label>
        </div>

        {shareType === 'dose_recommendation' && (
          <label className="text-sm font-medium block">Position
            <select className="input mt-1" value={stackItemId ?? ''} onChange={(event) => setStackItemId(Number(event.target.value))}>
              {details?.items.map((item) => <option value={item.stack_item_id} key={item.stack_item_id}>{item.name ?? `Produkt ${item.id}`}</option>)}
            </select>
          </label>
        )}

        <div className="space-y-3">
          <h2 className="text-base font-semibold">Optionale Creator-Aussagen</h2>
          {selectedItems.map((item) => (
            <label className="block text-sm" key={item.stack_item_id}>
              <span className="font-medium">{item.name ?? `Produkt ${item.id}`}</span>
              <textarea
                className="input mt-1 min-h-20"
                maxLength={500}
                value={statements[String(item.stack_item_id)] ?? ''}
                onChange={(event) => setStatements((current) => ({ ...current, [String(item.stack_item_id)]: event.target.value }))}
                placeholder="Sachlicher Kontext, keine Heil- oder individuellen Dosierungsversprechen"
              />
            </label>
          ))}
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
          Produktlinks können Affiliate-Links sein. Das muss im späteren öffentlichen Share sichtbar gekennzeichnet bleiben.
        </div>
        {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{message}</p>}
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
        <div className="flex gap-3 items-center">
          <button type="button" disabled={busy || selectedItems.length === 0} onClick={submit}>{busy ? 'Wird erstellt…' : 'Zur Moderation einreichen'}</button>
          <Link to="/stacks" className="text-sm text-indigo-600">Stacks bearbeiten</Link>
        </div>
      </section>
    </div>
  );
}
