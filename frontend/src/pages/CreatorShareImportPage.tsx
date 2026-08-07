import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  creatorSharingEnabled,
  getCreatorShare,
  importCreatorShare,
  preflightCreatorShare,
  type CreatorShareComparison,
  type CreatorSharePreflight,
  type CreatorSharePreview,
  type CreatorShareSaveResult,
  type CreatorShareTargetSelection,
} from '../api/creatorSharing';
import { getStacks } from '../api/stacks';
import CreatorRecommendationPreview from '../components/CreatorRecommendationPreview';
import { useAuth } from '../contexts/AuthContext';
import type { Stack } from '../types';
import { clearCreatorShareDraft, readCreatorShareDraft, writeCreatorShareDraft } from '../lib/creatorShareDraft';
import { formatRecommendationAmount, formatRecommendationInterval } from '../lib/creatorRecommendationFormat';
import { authPath, currentLocationReturnTo } from '../lib/returnTo';

type UnavailableKind = 'pending' | 'expired' | 'unavailable' | 'unknown';
type Decision = 'keep' | 'replace';

function errorData(caught: unknown): { code?: string; error?: string } {
  return (caught as { response?: { data?: { code?: string; error?: string } } })?.response?.data ?? {};
}

function unavailableKind(code: string | undefined): UnavailableKind | null {
  if (code === 'SHARE_PENDING') return 'pending';
  if (code === 'SHARE_EXPIRED') return 'expired';
  if (code === 'SHARE_UNAVAILABLE') return 'unavailable';
  if (code === 'SHARE_UNKNOWN') return 'unknown';
  return null;
}

function selectionFor(
  preview: CreatorSharePreview,
  targetMode: 'existing' | 'new',
  targetStackId: number | null,
  stackName: string,
): CreatorShareTargetSelection {
  if (preview.type === 'stack') return { stack_name: stackName };
  return targetMode === 'existing'
    ? { target_mode: 'existing', target_stack_id: targetStackId ?? undefined }
    : { target_mode: 'new', stack_name: stackName };
}

function Comparison({ title, value }: { title: string; value: CreatorShareComparison }) {
  const interval = formatRecommendationInterval(value.intake_interval_days);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 font-medium">{value.product_name}</p>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        <div><dt className="inline font-medium">Menge: </dt><dd className="inline">{formatRecommendationAmount(value.quantity, value.unit)}</dd></div>
        {value.dosage_text && <div><dt className="inline font-medium">Einnahme: </dt><dd className="inline">{value.dosage_text}</dd></div>}
        {interval && <div><dt className="inline font-medium">Wie oft: </dt><dd className="inline">{interval}</dd></div>}
        {value.timing && <div><dt className="inline font-medium">Wann: </dt><dd className="inline">{value.timing}</dd></div>}
      </dl>
    </div>
  );
}

function RecoveryCard({ kind, user }: { kind: UnavailableKind; user: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const content = {
    pending: {
      title: 'Diese Empfehlung wird noch geprüft.',
      text: 'Bitte versuche es später noch einmal.',
      message: 'Hallo, ich wollte deine Empfehlung öffnen. Sie wird noch geprüft. Kannst du mir Bescheid geben, sobald sie verfügbar ist?',
    },
    expired: {
      title: 'Dieser Link ist abgelaufen.',
      text: 'Bitte frage den Creator nach einem neuen Link.',
      message: 'Hallo, der Link zu deiner Empfehlung ist abgelaufen. Kannst du mir bitte einen neuen Link schicken?',
    },
    unavailable: {
      title: 'Diese Empfehlung ist nicht mehr verfügbar.',
      text: 'Der Creator kann dir sagen, ob es eine neue Empfehlung gibt.',
      message: 'Hallo, deine Empfehlung ist nicht mehr verfügbar. Gibt es eine neue Empfehlung für mich?',
    },
    unknown: {
      title: 'Diese Empfehlung wurde nicht gefunden.',
      text: 'Prüfe den Link oder frage den Creator nach einem neuen Link.',
      message: 'Hallo, ich kann deine Empfehlung über diesen Link nicht finden. Kannst du mir den aktuellen Link schicken?',
    },
  }[kind];
  const copyMessage = async () => {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(content.message);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };
  return (
    <section className="card max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold">{content.title}</h1>
      <p className="mt-3 text-slate-600">{content.text}</p>
      <button type="button" className="mt-5" onClick={copyMessage}>{copied ? 'Nachricht kopiert' : 'Nachricht an Creator kopieren'}</button>
      {copyError && <p className="mt-3 text-sm text-red-700">Das hat gerade nicht geklappt. Bitte versuche es noch einmal.</p>}
      <p className="mt-2 text-sm text-slate-500">Du kannst sie danach selbst senden.</p>
      <div className="mt-5 flex flex-wrap gap-4">
        {user && <Link to="/stacks" className="text-indigo-600">Zu meinen Stacks</Link>}
        <Link to="/" className="text-indigo-600">Zur Startseite</Link>
      </div>
    </section>
  );
}

export function ResultCard({ result, onStay }: { result: CreatorShareSaveResult; onStay: () => void }) {
  const message = result.action === 'stack_created'
    ? `Der neue Stack „${result.stack_name}“ wurde mit ${result.imported_items ?? 0} Produkten angelegt.`
    : result.action === 'added'
      ? result.created_stack
        ? `Der neue Stack „${result.stack_name}“ wurde angelegt. ${result.creator_product_name ?? 'Das Produkt'} wurde hinzugefügt.`
        : `${result.creator_product_name ?? 'Das Produkt'} wurde zu „${result.stack_name}“ hinzugefügt.`
      : result.action === 'kept_existing'
        ? `${result.existing_product_name ?? 'Dein vorhandenes Produkt'} bleibt in „${result.stack_name}“ unverändert. ${result.creator_product_name ?? 'Die Creator-Empfehlung'} wurde nicht hinzugefügt.`
        : `In „${result.stack_name}“ wurde nur ${result.replaced_product_name ?? 'das gewählte Produkt'} durch ${result.creator_product_name ?? 'die Creator-Empfehlung'} ersetzt.`;
  return (
    <section className="card border-emerald-200 bg-emerald-50">
      <h2 className="text-lg font-semibold text-emerald-900">Alles erledigt</h2>
      <p className="mt-2 text-emerald-900">{message}</p>
      {result.replaced_user_product_retained && (
        <p className="mt-2 text-sm text-emerald-900">Dein eigenes Produkt und seine private Notiz bleiben unter „Eigene Produkte“ gespeichert.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-4">
        <Link className="btn" to={`/stacks?stack=${result.stack_id}`}>Stack jetzt ansehen</Link>
        <button type="button" onClick={onStay}>Bei der Empfehlung bleiben</button>
        {result.replaced_user_product_retained && <Link to="/my-products" className="text-indigo-600 self-center">Eigene Produkte ansehen</Link>}
      </div>
    </section>
  );
}

export default function CreatorShareImportPage() {
  const { token = '' } = useParams();
  return <CreatorShareImportPageForToken key={token} token={token} />;
}

function CreatorShareImportPageForToken({ token }: { token: string }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [initialDraft] = useState(() => readCreatorShareDraft(token));
  const [preview, setPreview] = useState<CreatorSharePreview | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<UnavailableKind | null>(null);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksAttempt, setStacksAttempt] = useState(0);
  const [stacksError, setStacksError] = useState(false);
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>(initialDraft?.target_stack_id ? 'existing' : 'new');
  const [targetStackId, setTargetStackId] = useState<number | null>(initialDraft?.target_stack_id ?? null);
  const [stackName, setStackName] = useState(initialDraft?.stack_name ?? '');
  const [preflight, setPreflight] = useState<CreatorSharePreflight | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [result, setResult] = useState<CreatorShareSaveResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [technicalError, setTechnicalError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  useEffect(() => {
    if (!creatorSharingEnabled || !token) return;
    let cancelled = false;
    setPreviewLoading(true);
    setTechnicalError(null);
    setUnavailable(null);
    getCreatorShare(token)
      .then((share) => {
        if (cancelled) return;
        setPreview(share);
        setStackName((current) => current || share.title);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        const kind = unavailableKind(errorData(caught).code);
        if (kind) setUnavailable(kind);
        else setTechnicalError('Das hat gerade nicht geklappt. Bitte versuche es noch einmal.');
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [previewAttempt, token]);

  useEffect(() => {
    if (!user || preview?.type !== 'dose_recommendation') return;
    let cancelled = false;
    setStacksLoading(true);
    setStacksError(false);
    getStacks().then(({ stacks: nextStacks }) => {
      if (cancelled) return;
      setStacks(nextStacks);
      setTargetStackId((current) => {
        const valid = nextStacks.some((stack) => stack.id === current);
        if (valid) return current;
        return nextStacks[0]?.id ?? null;
      });
      setTargetMode((current) => nextStacks.length === 0 ? 'new' : current);
    }).catch(() => {
      if (!cancelled) setStacksError(true);
    }).finally(() => { if (!cancelled) setStacksLoading(false); });
    return () => { cancelled = true; };
  }, [stacksAttempt, user, preview?.type]);

  useEffect(() => {
    if (!token) return;
    writeCreatorShareDraft(token, { stack_name: stackName, target_stack_id: targetMode === 'existing' ? targetStackId : null });
  }, [stackName, targetMode, targetStackId, token]);

  const invalidateCheck = () => {
    setPreflight(null);
    setSelectedProductId(null);
    setDecision(null);
    setResult(null);
    setNotice(null);
  };

  const currentSelection = useMemo(
    () => preview ? selectionFor(preview, targetMode, targetStackId, stackName) : null,
    [preview, stackName, targetMode, targetStackId],
  );
  const selectedProduct = preflight?.similar_products.find((entry) => entry.stack_item_id === selectedProductId) ?? null;
  const returnTo = currentLocationReturnTo(location);

  const runPreflight = async () => {
    if (!preview || !currentSelection) return;
    setChecking(true);
    setNotice(null);
    setTechnicalError(null);
    setPreflight(null);
    setSelectedProductId(null);
    setDecision(null);
    try {
      const checked = await preflightCreatorShare(token, currentSelection);
      if (!activeRef.current) return;
      setPreflight(checked);
      setSelectedProductId(checked.similar_products.length === 1 ? checked.similar_products[0].stack_item_id : null);
    } catch (caught: unknown) {
      if (!activeRef.current) return;
      const data = errorData(caught);
      const kind = unavailableKind(data.code);
      if (kind) setUnavailable(kind);
      else if (data.code === 'TARGET_CHANGED' || data.code === 'INVALID_TARGET') setNotice(data.error ?? 'Bitte wähle dein Ziel noch einmal.');
      else setTechnicalError('Das hat gerade nicht geklappt. Bitte versuche es noch einmal.');
    } finally {
      if (activeRef.current) setChecking(false);
    }
  };

  const runSave = async () => {
    if (!preflight || !currentSelection) return;
    const hasSimilar = preflight.similar_products.length > 0;
    if (hasSimilar && (!selectedProduct || !decision)) return;
    setBusy(true);
    setNotice(null);
    setTechnicalError(null);
    try {
      const saved = await importCreatorShare(token, {
        ...currentSelection,
        idempotency_key: idempotencyKey,
        preflight_fingerprint: preflight.preflight_fingerprint,
        expected_snapshot_hash: preflight.snapshot_hash,
        decision: hasSimilar ? decision ?? undefined : preview?.type === 'dose_recommendation' ? 'add' : undefined,
        selected_stack_item_id: selectedProduct?.stack_item_id,
        expected_stack_item_version: selectedProduct?.version,
      });
      clearCreatorShareDraft(token);
      if (activeRef.current) setResult(saved);
    } catch (caught: unknown) {
      if (!activeRef.current) return;
      const data = errorData(caught);
      const kind = unavailableKind(data.code);
      if (kind) {
        setUnavailable(kind);
      } else if (data.code === 'PREFLIGHT_CHANGED' || data.code === 'CHOICE_REQUIRED' || data.code === 'TARGET_CHANGED') {
        invalidateCheck();
        setNotice('Die Empfehlung oder dein Stack hat sich geändert. Bitte prüfe deine Auswahl noch einmal.');
      } else {
        setTechnicalError('Das hat gerade nicht geklappt. Bitte versuche es noch einmal.');
      }
    } finally {
      if (activeRef.current) setBusy(false);
    }
  };

  if (!creatorSharingEnabled) {
    return <div className="card max-w-2xl mx-auto"><h1>Empfehlung nicht verfügbar</h1><p className="mt-3 text-gray-600">Diese Funktion ist noch nicht aktiviert.</p></div>;
  }
  if (unavailable) return <RecoveryCard kind={unavailable} user={Boolean(user)} />;
  if (!preview && technicalError) {
    return (
      <section className="card max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold">Empfehlung konnte nicht geladen werden</h1>
        <p className="mt-3 text-red-700">{technicalError}</p>
        <button type="button" className="mt-4" onClick={() => setPreviewAttempt((value) => value + 1)}>Erneut versuchen</button>
        <div className="mt-4"><Link to="/" className="text-indigo-600">Zur Startseite</Link></div>
      </section>
    );
  }
  if (previewLoading || !preview) return <div className="text-center py-16 text-gray-500">Empfehlung wird geladen…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <CreatorRecommendationPreview preview={preview} heading="Geteilte Empfehlung" />

      {!authLoading && !user ? (
        <section className="card">
          <h2 className="text-lg font-semibold">Möchtest du die Empfehlung in deinen Stacks speichern?</h2>
          <p className="text-sm text-gray-600 mt-2">Vor der Anmeldung wird nichts gespeichert.</p>
          <div className="flex gap-3 mt-4">
            <Link className="btn" to={authPath('/login', returnTo)}>Anmelden und weitermachen</Link>
            <Link className="text-indigo-600 self-center" to={authPath('/register', returnTo)}>Konto erstellen</Link>
          </div>
        </section>
      ) : user ? (
        <section className="card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Wo möchtest du die Empfehlung speichern?</h2>
            <p className="mt-1 text-sm text-slate-600">Prüfe zuerst dein Ziel. Danach siehst du genau, was beim Bestätigen passiert.</p>
          </div>

          {preview.type === 'stack' ? (
            <label className="block text-sm font-medium">Name des neuen Stacks
              <input className="input mt-1" value={stackName} maxLength={120} onChange={(event) => { setStackName(event.target.value); invalidateCheck(); }} />
            </label>
          ) : (
            <div className="space-y-4">
              {stacks.length > 0 && (
                <label className="flex gap-2 items-start">
                  <input type="radio" name="target-mode" checked={targetMode === 'existing'} onChange={() => { setTargetMode('existing'); invalidateCheck(); }} />
                  <span><strong>In einen vorhandenen Stack</strong><span className="block text-sm text-slate-600">Das Produkt wird nur zu diesem Stack hinzugefügt oder dort ausgetauscht.</span></span>
                </label>
              )}
              {targetMode === 'existing' && stacks.length > 0 && (
                <label className="block text-sm font-medium">Ziel-Stack
                  <select className="input mt-1" value={targetStackId ?? ''} onChange={(event) => { setTargetStackId(Number(event.target.value)); invalidateCheck(); }}>
                    <option value="" disabled>Stack auswählen</option>
                    {stacks.map((stack) => <option value={stack.id} key={stack.id}>{stack.name}</option>)}
                  </select>
                </label>
              )}
              <label className="flex gap-2 items-start">
                <input type="radio" name="target-mode" checked={targetMode === 'new'} onChange={() => { setTargetMode('new'); invalidateCheck(); }} />
                <span><strong>Neuen Stack anlegen</strong><span className="block text-sm text-slate-600">Der neue Stack und das Produkt werden erst beim Bestätigen gemeinsam angelegt.</span></span>
              </label>
              {targetMode === 'new' && (
                <label className="block text-sm font-medium">Name des neuen Stacks
                  <input className="input mt-1" value={stackName} maxLength={120} onChange={(event) => { setStackName(event.target.value); invalidateCheck(); }} />
                </label>
              )}
              {stacksLoading && <p className="text-sm text-slate-500">Deine Stacks werden geladen…</p>}
            </div>
          )}

          {!preflight && (
            <button
              type="button"
              disabled={checking || !stackName.trim()
                || (preview.type === 'dose_recommendation' && (stacksLoading || stacksError || (targetMode === 'existing' && !targetStackId)))}
              onClick={runPreflight}
            >
              {checking ? 'Auswahl wird geprüft…' : 'Auswahl prüfen'}
            </button>
          )}

          {notice && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{notice}</p>}
          {stacksError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-800">Das hat gerade nicht geklappt. Bitte versuche es noch einmal.</p>
              <button type="button" className="mt-3" onClick={() => setStacksAttempt((value) => value + 1)}>Erneut versuchen</button>
            </div>
          )}
          {technicalError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-800">{technicalError}</p>
              <button type="button" className="mt-3" onClick={preflight ? runSave : runPreflight}>Erneut versuchen</button>
            </div>
          )}

          {preflight && !result && (
            <div className="space-y-5">
              {preflight.target.name_already_used && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <p className="font-medium">Diesen Namen verwendest du bereits.</p>
                  {preflight.target.suggested_stack_name && (
                    <button type="button" className="mt-2 text-indigo-700" onClick={() => { setStackName(preflight.target.suggested_stack_name ?? stackName); invalidateCheck(); }}>
                      Vorschlag verwenden: {preflight.target.suggested_stack_name}
                    </button>
                  )}
                  <p className="mt-2 text-sm text-slate-600">Du kannst den Namen trotzdem behalten.</p>
                </div>
              )}

              {preflight.similar_products.length > 0 && preflight.recommendation && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold">
                      {preflight.similar_products.length === 1
                        ? 'Ein ähnliches Produkt ist schon in diesem Stack.'
                        : 'Ähnliche Produkte sind schon in diesem Stack.'}
                    </h3>
                    {preflight.main_ingredient_names.length > 0 && (
                      <p className="mt-1 text-sm text-slate-700">Diese wichtigen Inhaltsstoffe stimmen überein: {preflight.main_ingredient_names.join(', ')}.</p>
                    )}
                  </div>
                  {preflight.similar_products.length > 1 && (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">Welches vorhandene Produkt möchtest du vergleichen?</legend>
                      {preflight.similar_products.map((candidate) => (
                        <label className="flex gap-2" key={candidate.stack_item_id}>
                          <input
                            type="radio"
                            name="similar-product"
                            checked={selectedProductId === candidate.stack_item_id}
                            onChange={() => { setSelectedProductId(candidate.stack_item_id); setDecision(null); }}
                          />
                          {candidate.comparison.product_name}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {selectedProduct && (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Comparison title="Bereits in deinem Stack" value={selectedProduct.comparison} />
                        <Comparison title="Empfehlung des Creators" value={preflight.recommendation} />
                      </div>
                      {selectedProduct.private_note && <p className="text-sm text-slate-700">Deine private Notiz: {selectedProduct.private_note}</p>}
                      <div className="grid gap-3 md:grid-cols-2">
                        <button type="button" aria-pressed={decision === 'keep'} onClick={() => setDecision('keep')}>Mein Produkt behalten</button>
                        <button type="button" aria-pressed={decision === 'replace'} onClick={() => setDecision('replace')}>Empfehlung des Creators übernehmen</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
                <h3 className="font-semibold">Das passiert beim Bestätigen</h3>
                {preview.type === 'stack' ? (
                  <p className="mt-2 text-sm text-slate-700">Ein neuer Stack „{preflight.target.stack_name}“ mit {preflight.stack_item_count} Produkten wird angelegt. Deine vorhandenen Stacks bleiben unverändert.</p>
                ) : preflight.similar_products.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-700">
                    {preflight.recommendation?.product_name} wird {preflight.target.mode === 'new' ? `gemeinsam mit dem neuen Stack „${preflight.target.stack_name}“ angelegt` : `zu „${preflight.target.stack_name}“ hinzugefügt`}. Andere Produkte und Stacks bleiben unverändert.
                  </p>
                ) : decision === 'keep' && selectedProduct ? (
                  <p className="mt-2 text-sm text-slate-700">{selectedProduct.comparison.product_name} bleibt in „{preflight.target.stack_name}“ unverändert. {preflight.recommendation?.product_name} wird nicht hinzugefügt.</p>
                ) : decision === 'replace' && selectedProduct ? (
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <p>Nur {selectedProduct.comparison.product_name} wird in „{preflight.target.stack_name}“ durch {preflight.recommendation?.product_name} ersetzt. Menge, Einnahme, Häufigkeit und Zeitpunkt wechseln zu den Angaben der Creator-Empfehlung.</p>
                    <p>Kategorie und Reihenfolge bleiben gleich. Andere Stacks und Produkte bleiben unverändert.</p>
                    {selectedProduct.product_type === 'user_product' && <p>Dein eigenes Produkt und seine private Notiz bleiben gespeichert. Nur die Anzeige in diesem Stack wechselt.</p>}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Wähle zuerst aus, was mit dem ähnlichen Produkt passieren soll.</p>
                )}
              </div>

              <button
                type="button"
                disabled={busy || (preflight.similar_products.length > 0 && (!selectedProduct || !decision))}
                onClick={runSave}
              >
                {busy ? 'Wird gespeichert…' : 'Jetzt bestätigen'}
              </button>
            </div>
          )}

          {result && (
            <ResultCard result={result} onStay={() => {
              setResult(null);
              setPreflight(null);
              setDecision(null);
              setSelectedProductId(null);
              setIdempotencyKey(crypto.randomUUID());
            }} />
          )}
        </section>
      ) : null}
    </div>
  );
}
