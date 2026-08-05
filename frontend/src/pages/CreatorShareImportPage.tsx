import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { creatorSharingEnabled, getCreatorShare, importCreatorShare, type CreatorSharePreview } from '../api/creatorSharing';
import { getStacks } from '../api/stacks';
import { useAuth } from '../contexts/AuthContext';
import type { Stack } from '../types';

type Conflict = { stack_item_id: number; version: number; product_name: string };

export default function CreatorShareImportPage() {
  const { token = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<CreatorSharePreview | null>(null);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [targetStackId, setTargetStackId] = useState<number | null>(null);
  const [stackName, setStackName] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<number | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorSharingEnabled || !token) return;
    getCreatorShare(token)
      .then((share) => { setPreview(share); setStackName(share.title); })
      .catch(() => setError('Dieser Share ist nicht verfügbar oder noch nicht freigegeben.'));
  }, [token]);

  useEffect(() => {
    if (!user || preview?.type !== 'dose_recommendation') return;
    getStacks().then(({ stacks: nextStacks }) => {
      setStacks(nextStacks);
      setTargetStackId(nextStacks[0]?.id ?? null);
    }).catch(() => setError('Deine Stacks konnten nicht geladen werden.'));
  }, [user, preview?.type]);

  const redirectPath = `/share/${encodeURIComponent(token)}`;
  const selectedReplacement = useMemo(
    () => conflicts.find((conflict) => conflict.stack_item_id === selectedConflict) ?? null,
    [conflicts, selectedConflict],
  );

  if (!creatorSharingEnabled) {
    return <div className="card max-w-2xl mx-auto"><h1>Share nicht verfügbar</h1><p className="mt-3 text-gray-600">Creator-Stack-Sharing ist noch nicht aktiviert.</p></div>;
  }
  if (error && !preview) return <div className="card max-w-2xl mx-auto"><h1>Share nicht verfügbar</h1><p className="mt-3 text-red-700">{error}</p></div>;
  if (!preview) return <div className="text-center py-16 text-gray-500">Share wird geladen…</div>;

  const runImport = async (conflictAction?: 'keep' | 'replace') => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importCreatorShare(token, {
        idempotency_key: idempotencyKey,
        stack_name: preview.type === 'stack' ? stackName : undefined,
        target_stack_id: preview.type === 'dose_recommendation' ? targetStackId ?? undefined : undefined,
        conflict_action: conflictAction,
        replace_stack_item_id: conflictAction === 'replace' ? selectedReplacement?.stack_item_id : undefined,
        expected_stack_item_version: conflictAction === 'replace' ? selectedReplacement?.version : undefined,
      });
      const importedStackId = Number(result.stack_id);
      navigate(Number.isSafeInteger(importedStackId) ? `/stacks?stack=${importedStackId}` : '/stacks', { replace: true });
    } catch (caught: unknown) {
      const data = (caught as { response?: { data?: { error?: string; conflicts?: Conflict[] } } })?.response?.data;
      if (Array.isArray(data?.conflicts) && data.conflicts.length > 0) {
        setConflicts(data.conflicts);
        setSelectedConflict(data.conflicts[0].stack_item_id);
      }
      setError(data?.error ?? 'Import konnte nicht ausgeführt werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <p className="text-sm font-medium text-indigo-600">Geteilt von {preview.creator.name}</p>
        <h1 className="mt-1">{preview.title}</h1>
        <p className="text-gray-600 mt-2">Prüfe alle Angaben. Erst deine Bestätigung übernimmt den Snapshot in deinen Account.</p>
      </header>

      <section className="space-y-3">
        {preview.items.map((item, index) => (
          <article className="card" key={`${item.catalog_product_id}-${index}`}>
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold">{item.product_name}</h2>{item.brand && <p className="text-sm text-gray-500">{item.brand}</p>}</div>
              {item.category_name && <span className="text-xs bg-gray-100 rounded-full px-2 py-1">{item.category_name}</span>}
            </div>
            <dl className="grid sm:grid-cols-2 gap-2 mt-4 text-sm">
              <div><dt className="text-gray-500">Nutzung</dt><dd>{item.quantity} Einheit(en), alle {item.intake_interval_days} Tag(e)</dd></div>
              <div><dt className="text-gray-500">Zeitpunkt</dt><dd>{item.timing || 'Nicht angegeben'}</dd></div>
            </dl>
            {item.dosage_text && <p className="text-sm mt-3">Angabe im Snapshot: {item.dosage_text}</p>}
            {item.creator_statement && <blockquote className="mt-3 border-l-4 border-indigo-200 pl-3 text-sm text-gray-700">{item.creator_statement}</blockquote>}
          </article>
        ))}
      </section>

      <aside className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-950">
        <strong>Affiliate-Hinweis:</strong> {preview.disclosure}
      </aside>
      <p className="text-xs text-gray-500">Die Angaben sind keine medizinische Beratung und keine persönliche Dosierungsanweisung.</p>

      {!authLoading && !user ? (
        <section className="card">
          <h2 className="text-lg font-semibold">Zum Import anmelden</h2>
          <p className="text-sm text-gray-600 mt-2">Vor der Anmeldung wird nichts gespeichert oder importiert.</p>
          <div className="flex gap-3 mt-4">
            <Link className="btn" to={`/login?redirect=${encodeURIComponent(redirectPath)}`}>Anmelden</Link>
            <Link className="text-indigo-600 self-center" to={`/register?redirect=${encodeURIComponent(redirectPath)}`}>Registrieren</Link>
          </div>
        </section>
      ) : (
        <section className="card space-y-4">
          {preview.type === 'stack' ? (
            <label className="block text-sm font-medium">Name des neuen Stacks
              <input className="input mt-1" value={stackName} maxLength={120} onChange={(event) => setStackName(event.target.value)} />
            </label>
          ) : (
            <label className="block text-sm font-medium">Ziel-Stack
              <select className="input mt-1" value={targetStackId ?? ''} onChange={(event) => setTargetStackId(Number(event.target.value))}>
                <option value="" disabled>Stack auswählen</option>
                {stacks.map((stack) => <option value={stack.id} key={stack.id}>{stack.name}</option>)}
              </select>
            </label>
          )}

          {conflicts.length > 0 && (
            <div className="rounded-lg border border-amber-300 p-4">
              <h3 className="font-semibold">Identisches Hauptwirkstoff-Set vorhanden</h3>
              {conflicts.length > 1 && (
                <label className="block text-sm mt-3">Zu ersetzende Position
                  <select className="input mt-1" value={selectedConflict ?? ''} onChange={(event) => setSelectedConflict(Number(event.target.value))}>
                    {conflicts.map((conflict) => <option value={conflict.stack_item_id} key={conflict.stack_item_id}>{conflict.product_name}</option>)}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-3 mt-4">
                <button type="button" disabled={busy} onClick={() => runImport('keep')}>Bestehende behalten</button>
                <button type="button" disabled={busy || !selectedReplacement} onClick={() => runImport('replace')}>Durch Snapshot ersetzen</button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          {conflicts.length === 0 && <button type="button" disabled={busy || (preview.type === 'dose_recommendation' && !targetStackId)} onClick={() => runImport()}>{busy ? 'Wird importiert…' : 'Verbindlich importieren'}</button>}
        </section>
      )}
    </div>
  );
}
