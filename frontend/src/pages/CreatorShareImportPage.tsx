import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  creatorSharingEnabled,
  getCreatorShare,
  importCreatorShare,
  preflightCreatorShare,
  reportCreatorShare,
  undoCreatorShareImport,
  type CreatorShareComparison,
  type CreatorSharePreflight,
  type CreatorSharePreview,
  type CreatorShareReportCategory,
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
import { countLabel, timingLabel } from '../lib/displayCopy';
import { projectShareHead, publicShareFailure } from '../../../functions/lib/share-head-projection.mjs';
import { applyPublicRouteHead } from '../lib/publicPageHead';
import { hasInitialShareHead } from '../lib/sharePageHead';

type UnavailableKind = 'pending' | 'paused' | 'expired' | 'unavailable' | 'unknown';
type Decision = 'keep' | 'replace';

const REPORT_CATEGORIES: Array<{ value: CreatorShareReportCategory; label: string; description: string }> = [
  { value: 'outdated', label: 'Nicht mehr aktuell', description: 'Produkte oder Angaben wirken veraltet.' },
  { value: 'misleading', label: 'Missverständlich', description: 'Die Empfehlung kann leicht falsch verstanden werden.' },
  { value: 'safety', label: 'Möglicherweise unsicher', description: 'Eine Angabe sollte besonders geprüft werden.' },
  { value: 'other', label: 'Anderer Grund', description: 'Etwas anderes sollte sich unser Team ansehen.' },
];

const SHARE_RADIO_CLASS = 'mt-0.5 !h-5 !w-5 min-w-5 shrink-0 !p-0 accent-indigo-600';

function validImportedItemCount(value: number | undefined): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function undoDeadlineHasPassed(expiresAt: number): boolean {
  return !Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now();
}

function errorData(caught: unknown): { code?: string; error?: string } {
  return (caught as { response?: { data?: { code?: string; error?: string } } })?.response?.data ?? {};
}

function unavailableKind(code: string | undefined): UnavailableKind | null {
  if (code === 'SHARE_PENDING') return 'pending';
  if (code === 'SHARE_PAUSED') return 'paused';
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

function comparisonDifferences(first: CreatorShareComparison, second: CreatorShareComparison): string[] {
  const differences: string[] = [];
  if (first.quantity !== second.quantity || (first.unit ?? '').trim() !== (second.unit ?? '').trim()) differences.push('Menge');
  if ((first.dosage_text ?? '').trim() !== (second.dosage_text ?? '').trim()) differences.push('Einnahme');
  if (first.intake_interval_days !== second.intake_interval_days) differences.push('Häufigkeit');
  if ((first.timing_label ?? '').trim() !== (second.timing_label ?? '').trim()) differences.push('Zeitpunkt');
  return differences;
}

function Comparison({
  title,
  value,
  differences,
}: {
  title: string;
  value: CreatorShareComparison;
  differences: ReadonlySet<string>;
}) {
  const interval = formatRecommendationInterval(value.intake_interval_days);
  const formattedTiming = timingLabel(null, value.timing_label);
  const rowClass = (name: string) => differences.has(name) ? 'rounded-md bg-amber-100 px-2 py-1' : 'px-2 py-1';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 font-medium">{value.product_name}</p>
      <dl className="mt-3 space-y-1 text-sm text-slate-700">
        <div className={rowClass('Menge')}>{differences.has('Menge') && <span className="sr-only">Unterschied: </span>}<dt className="inline font-medium">Menge: </dt><dd className="inline">{formatRecommendationAmount(value.quantity, value.unit)}</dd></div>
        <div className={rowClass('Einnahme')}>{differences.has('Einnahme') && <span className="sr-only">Unterschied: </span>}<dt className="inline font-medium">Einnahme: </dt><dd className="inline">{value.dosage_text?.trim() || 'Keine Angabe'}</dd></div>
        <div className={rowClass('Häufigkeit')}>{differences.has('Häufigkeit') && <span className="sr-only">Unterschied: </span>}<dt className="inline font-medium">Wie oft: </dt><dd className="inline">{interval ?? 'Keine Angabe'}</dd></div>
        <div className={rowClass('Zeitpunkt')}>{differences.has('Zeitpunkt') && <span className="sr-only">Unterschied: </span>}<dt className="inline font-medium">Zeitpunkt: </dt><dd className="inline">{formattedTiming}</dd></div>
      </dl>
    </div>
  );
}

function RecoveryCard({ kind, user }: { kind: UnavailableKind; user: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const recoveryRef = useRef<HTMLElement>(null);
  const copySuccessRef = useRef<HTMLParagraphElement>(null);
  const copyErrorRef = useRef<HTMLDivElement>(null);
  const content = {
    pending: {
      title: 'Diese Empfehlung wird noch geprüft.',
      text: 'Bitte versuche es später noch einmal.',
      message: 'Hallo, ich wollte deine Empfehlung öffnen. Sie wird noch geprüft. Kannst du mir Bescheid geben, sobald sie verfügbar ist?',
    },
    paused: {
      title: 'Diese Empfehlung ist vorübergehend pausiert.',
      text: 'Bitte versuche es später noch einmal oder frage den Creator, wann der Link wieder verfügbar ist.',
      message: 'Hallo, deine Empfehlung ist gerade pausiert. Kannst du mir bitte Bescheid geben, sobald der Link wieder verfügbar ist?',
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

  useEffect(() => {
    recoveryRef.current?.focus();
  }, []);

  useEffect(() => {
    if (copied) copySuccessRef.current?.focus();
  }, [copied]);

  useEffect(() => {
    if (copyError) copyErrorRef.current?.focus();
  }, [copyError]);

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
    <section
      className="card max-w-2xl mx-auto outline-none"
      ref={recoveryRef}
      role={!copied && !copyError ? 'status' : undefined}
      aria-live={!copied && !copyError ? 'polite' : undefined}
      tabIndex={-1}
    >
      <h1 className="text-xl font-semibold">{content.title}</h1>
      <p className="mt-3 text-slate-600">{content.text}</p>
      <button
        type="button"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700"
        onClick={copyMessage}
      >
        {copied ? 'Nachricht kopiert' : copyError ? 'Erneut kopieren' : 'Nachricht an Creator kopieren'}
      </button>
      {copied && (
        <p className="mt-3 text-sm font-medium text-emerald-800 outline-none" role="status" aria-live="polite" ref={copySuccessRef} tabIndex={-1}>
          Die Nachricht wurde in deine Zwischenablage kopiert.
        </p>
      )}
      {copyError && (
        <div className="mt-3 outline-none" role="alert" ref={copyErrorRef} tabIndex={-1}>
          <p className="text-sm text-red-700">Das Kopieren hat nicht geklappt. Markiere den Text und kopiere ihn selbst:</p>
          <label className="mt-2 block text-sm font-bold text-slate-700">
            Nachricht zum Kopieren
            <textarea className="input mt-1 min-h-28" readOnly value={content.message} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </div>
      )}
      <p className="mt-2 text-sm text-slate-500">Füge die kopierte Nachricht anschließend in deinen Messenger oder deine E-Mail ein.</p>
      <div className="mt-5 flex flex-wrap gap-4">
        {user && <Link to="/stacks" className="text-indigo-600">Zu meinen Stacks</Link>}
        <Link to="/" className="text-indigo-600">Zur Startseite</Link>
      </div>
    </section>
  );
}

export function ResultCard({
  result,
  shareToken,
  onStay,
}: {
  result: CreatorShareSaveResult;
  shareToken?: string;
  onStay: () => void;
}) {
  const [undoState, setUndoState] = useState<'idle' | 'busy' | 'done' | 'error' | 'expired'>(() => (
    result.undo && undoDeadlineHasPassed(result.undo.expires_at) ? 'expired' : 'idle'
  ));
  const [undoMessage, setUndoMessage] = useState<string | null>(null);
  const [undoResult, setUndoResult] = useState<Awaited<ReturnType<typeof undoCreatorShareImport>> | null>(null);
  const undoConfirmationRef = useRef<HTMLDivElement>(null);
  const undoExpirationRef = useRef<HTMLParagraphElement>(null);
  const importedItemCount = validImportedItemCount(result.imported_items);
  const undoDeadlineLabel = result.undo && Number.isFinite(result.undo.expires_at)
    ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(result.undo.expires_at * 1000))
    : null;
  const message = result.action === 'stack_created'
    ? importedItemCount === null
      ? `Der neue Stack „${result.stack_name}“ wurde angelegt.`
      : `Der neue Stack „${result.stack_name}“ wurde mit ${countLabel(importedItemCount, 'Produkt', 'Produkten')} angelegt.`
    : result.action === 'added'
      ? result.created_stack
        ? `Der neue Stack „${result.stack_name}“ wurde angelegt. ${result.creator_product_name ?? 'Das Produkt'} wurde hinzugefügt.`
        : `${result.creator_product_name ?? 'Das Produkt'} wurde zu „${result.stack_name}“ hinzugefügt.`
      : result.action === 'kept_existing'
        ? `${result.existing_product_name ?? 'Dein vorhandenes Produkt'} bleibt in „${result.stack_name}“ unverändert. ${result.creator_product_name ?? 'Die Creator-Empfehlung'} wurde nicht hinzugefügt.`
        : `In „${result.stack_name}“ wurde nur ${result.replaced_product_name ?? 'das gewählte Produkt'} durch ${result.creator_product_name ?? 'die Creator-Empfehlung'} ersetzt.`;

  useEffect(() => {
    if (!result.undo || !shareToken || undoState === 'done' || undoState === 'expired') return undefined;
    let timer: number | undefined;
    const scheduleExpiry = () => {
      const remainingMs = result.undo!.expires_at * 1000 - Date.now();
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        setUndoState('expired');
        return;
      }
      timer = window.setTimeout(scheduleExpiry, Math.min(remainingMs, 2_147_483_647));
    };
    scheduleExpiry();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [result.undo, shareToken, undoState]);

  useEffect(() => {
    if (undoState === 'done') undoConfirmationRef.current?.focus();
    if (undoState === 'expired') undoExpirationRef.current?.focus();
  }, [undoState]);

  const runUndo = async () => {
    if (!shareToken || !result.undo || undoState === 'busy' || undoState === 'done' || undoState === 'expired') return;
    if (undoDeadlineHasPassed(result.undo.expires_at)) {
      setUndoState('expired');
      return;
    }
    setUndoState('busy');
    setUndoMessage(null);
    try {
      const restored = await undoCreatorShareImport(shareToken, {
        undo_token: result.undo.token,
        expected_version: result.undo.version,
        expected_stack_id: result.undo.stack_id,
        expected_stack_item_id: result.undo.stack_item_id,
      });
      setUndoResult(restored);
      setUndoState('done');
    } catch (caught: unknown) {
      const code = errorData(caught).code;
      if (code === 'UNDO_EXPIRED') {
        setUndoState('expired');
        setUndoMessage(null);
      } else {
        setUndoState('error');
        setUndoMessage(code === 'UNDO_TARGET_CHANGED'
          ? 'Dein Stack wurde inzwischen geändert. Deshalb wurde nichts rückgängig gemacht.'
          : 'Das Rückgängigmachen hat nicht geklappt. Bitte prüfe deinen Stack.');
      }
    }
  };
  const undone = undoState === 'done';
  return (
    <section className="card border-emerald-200 bg-emerald-50" tabIndex={-1}>
      <div
        className="outline-none"
        ref={undone ? undoConfirmationRef : undefined}
        role={undone ? 'status' : undefined}
        aria-live={undone ? 'polite' : undefined}
        tabIndex={undone ? -1 : undefined}
      >
        <h2 className="text-lg font-semibold text-emerald-900">{undone ? 'Änderung rückgängig gemacht' : 'Alles erledigt'}</h2>
        <p className="mt-2 text-emerald-900">
          {undone ? undoResult?.restored_summary ?? `Der vorherige Stand in „${result.stack_name}“ wurde wiederhergestellt.` : message}
        </p>
      </div>
      {result.replaced_user_product_retained && !undone && (
        <p className="mt-2 text-sm text-emerald-900">Dein eigenes Produkt und seine private Notiz bleiben unter „Eigene Produkte“ gespeichert.</p>
      )}
      {result.undo && shareToken && !undone && (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Kurz rückgängig machen</p>
          <p className="mt-1">{result.undo.summary}</p>
          {undoState === 'expired' ? (
            <p className="mt-3 rounded-lg bg-slate-100 p-3 font-medium text-slate-700 outline-none" role="status" ref={undoExpirationRef} tabIndex={-1}>Die Frist zum Rückgängigmachen ist abgelaufen.</p>
          ) : (
            <>
              <p className="mt-1 text-slate-600">Diese Möglichkeit ist bis {undoDeadlineLabel} Uhr verfügbar und funktioniert nur, solange du dieses Produkt im Stack nicht noch einmal änderst.</p>
              <button
                type="button"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-bold text-slate-800 hover:bg-slate-50"
                disabled={undoState === 'busy'}
                onClick={runUndo}
              >
                {undoState === 'busy' ? 'Wird rückgängig gemacht…' : 'Änderung rückgängig machen'}
              </button>
            </>
          )}
        </div>
      )}
      {undoMessage && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
          {undoMessage}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700" to={`/stacks?stack=${result.stack_id}`}>Stack jetzt ansehen</Link>
        <button type="button" className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800" onClick={onStay}>Empfehlung weiter ansehen</button>
        {result.replaced_user_product_retained && <Link to="/my-products" className="text-indigo-600 self-center">Eigene Produkte ansehen</Link>}
      </div>
    </section>
  );
}

function ReportRecommendation({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CreatorShareReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const frozenReportRef = useRef<{
    idempotency_key: string;
    category: CreatorShareReportCategory;
    details?: string;
  } | null>(null);
  const reportInputsLocked = state === 'busy' || state === 'error';

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (state === 'done') successRef.current?.focus();
  }, [state]);

  const sendReport = async () => {
    if (state === 'busy' || state === 'done') return;
    let submission = frozenReportRef.current;
    if (!submission) {
      if (!category) return;
      submission = {
        idempotency_key: idempotencyKey,
        category,
        details: details.trim() || undefined,
      };
      frozenReportRef.current = submission;
    }
    setState('busy');
    try {
      await reportCreatorShare(token, submission);
      setState('done');
    } catch {
      setState('error');
    }
  };

  const startNewReport = () => {
    frozenReportRef.current = null;
    setCategory(null);
    setDetails('');
    setState('idle');
    setIdempotencyKey(crypto.randomUUID());
    headingRef.current?.focus();
  };

  const editFailedReport = () => {
    const frozenReport = frozenReportRef.current;
    if (frozenReport) {
      setCategory(frozenReport.category);
      setDetails(frozenReport.details ?? '');
    }
    frozenReportRef.current = null;
    setState('idle');
    setIdempotencyKey(crypto.randomUUID());
    headingRef.current?.focus();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="share-report-toggle">
      <button
        id="share-report-toggle"
        type="button"
        className="inline-flex min-h-11 items-center font-bold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-indigo-700"
        aria-expanded={open}
        aria-controls="share-report-panel"
        onClick={() => setOpen((current) => !current)}
      >
        Stimmt etwas mit dieser Empfehlung nicht?
      </button>
      {open && (
        <div className="mt-4 space-y-4" id="share-report-panel">
          <h2 className="text-lg font-black text-slate-900 outline-none" id="share-report-heading" ref={headingRef} tabIndex={-1}>
            Empfehlung melden
          </h2>
          {state === 'done' ? (
            <div className="space-y-3">
              <p className="rounded-xl bg-emerald-50 p-4 font-medium text-emerald-900 outline-none" role="status" aria-live="polite" ref={successRef} tabIndex={-1}>
                Danke. Deine Meldung ist angekommen und wird von unserem Team geprüft.
              </p>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-bold text-slate-800 hover:bg-slate-50"
                onClick={startNewReport}
              >
                Neue Meldung verfassen
              </button>
            </div>
          ) : (
            <>
              <fieldset className="space-y-2" disabled={reportInputsLocked}>
                <legend className="font-bold text-slate-900">Was sollen wir prüfen?</legend>
                {REPORT_CATEGORIES.map((entry) => (
                  <label className={`flex min-h-14 items-start gap-3 rounded-xl border p-3 ${reportInputsLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${category === entry.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`} key={entry.value}>
                    <input className={SHARE_RADIO_CLASS} type="radio" name="share-report-category" value={entry.value} checked={category === entry.value} onChange={() => { if (!reportInputsLocked) setCategory(entry.value); }} />
                    <span><strong className="block text-slate-900">{entry.label}</strong><span className="text-sm text-slate-600">{entry.description}</span></span>
                  </label>
                ))}
              </fieldset>
              <label className="block font-bold text-slate-900">
                Kurzer Hinweis (optional)
                <textarea className="input mt-1 min-h-24" disabled={reportInputsLocked} maxLength={500} value={details} onChange={(event) => { if (!reportInputsLocked) setDetails(event.target.value); }} />
                <span className="mt-1 block text-right text-xs font-normal text-slate-500">{details.length}/500</span>
              </label>
              {state === 'error' && (
                <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
                  <p>Die Meldung wurde nicht sicher bestätigt. Sende deshalb dieselbe Meldung noch einmal.</p>
                  <p className="mt-1 font-normal">Wenn du die Angaben ändern möchtest, beginne bewusst eine neue Meldung.</p>
                </div>
              )}
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={!category || state === 'busy'}
                onClick={sendReport}
              >
                {state === 'busy' ? 'Meldung wird gesendet…' : state === 'error' ? 'Dieselbe Meldung erneut senden' : 'Meldung senden'}
              </button>
              {state === 'error' && (
                <button
                  type="button"
                  className="ml-3 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 hover:bg-slate-50"
                  onClick={editFailedReport}
                >
                  Meldung ändern
                </button>
              )}
            </>
          )}
        </div>
      )}
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
  const [previewFailureStatus, setPreviewFailureStatus] = useState<404 | 409 | 410 | 503>(503);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const activeRef = useRef(true);
  const preflightHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const stackErrorRef = useRef<HTMLDivElement>(null);
  const technicalErrorRef = useRef<HTMLDivElement>(null);
  const preserveInitialHead = useRef(hasInitialShareHead(location.pathname));

  useLayoutEffect(() => {
    const loading = creatorSharingEnabled && !unavailable && (previewLoading || !preview && !technicalError);
    if (loading && preserveInitialHead.current) return;
    if (!loading) preserveInitialHead.current = false;
    const failure = unavailable ? publicShareFailure(
      unavailable === 'unknown' ? 404 : unavailable === 'expired' || unavailable === 'unavailable' ? 410 : 409,
      `SHARE_${unavailable.toUpperCase()}`,
    ) : null;
    const projection = projectShareHead(
      !creatorSharingEnabled ? publicShareFailure(404)
        : failure ?? (loading ? { status: 'loading' }
          : preview ? { status: 200, title: preview.title, creatorName: preview.creator.name }
            : publicShareFailure(previewFailureStatus)),
      token,
    );
    applyPublicRouteHead(projection.head);
  }, [preview, previewFailureStatus, previewLoading, technicalError, token, unavailable]);

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
        const status = (caught as { response?: { status?: number } })?.response?.status;
        setPreviewFailureStatus(publicShareFailure(status ?? 503).status);
        const kind = unavailableKind(errorData(caught).code)
          ?? (status === 404 ? 'unknown' : status === 410 ? 'unavailable' : null);
        if (kind) setUnavailable(kind);
        else setTechnicalError('Die Empfehlung konnte nicht geladen werden. Bitte versuche es noch einmal.');
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
    if (!token || !user) return;
    writeCreatorShareDraft(token, { stack_name: stackName, target_stack_id: targetMode === 'existing' ? targetStackId : null });
  }, [stackName, targetMode, targetStackId, token, user]);

  useEffect(() => {
    if (preflight) preflightHeadingRef.current?.focus();
  }, [preflight]);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  useEffect(() => {
    if (stacksError) stackErrorRef.current?.focus();
  }, [stacksError]);

  useEffect(() => {
    if (technicalError) technicalErrorRef.current?.focus();
  }, [technicalError]);

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
  const selectedDifferences = useMemo(() => new Set(
    selectedProduct && preflight?.recommendation
      ? comparisonDifferences(selectedProduct.comparison, preflight.recommendation)
      : [],
  ), [preflight?.recommendation, selectedProduct]);
  const returnTo = currentLocationReturnTo(location);
  const confirmLabel = useMemo(() => {
    if (!preflight) return 'Änderung bestätigen';
    if (preview?.type === 'stack') return `Stack mit ${countLabel(preflight.stack_item_count, 'Produkt', 'Produkten')} anlegen`;
    if (preflight.similar_products.length === 0) {
      return preflight.target.mode === 'new'
        ? `Stack mit ${preflight.recommendation?.product_name ?? 'Produkt'} anlegen`
        : `${preflight.recommendation?.product_name ?? 'Produkt'} hinzufügen`;
    }
    if (decision === 'keep') return 'Stack unverändert lassen';
    if (decision === 'replace' && selectedProduct) {
      return `${selectedProduct.comparison.product_name} ersetzen`;
    }
    return 'Zuerst eine Auswahl treffen';
  }, [decision, preflight, preview?.type, selectedProduct]);

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
      else setTechnicalError('Die Empfehlung konnte nicht geprüft werden. Bitte versuche es noch einmal.');
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
        setTechnicalError('Die Empfehlung konnte nicht gespeichert werden. Bitte versuche es noch einmal.');
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
      <section className="card max-w-2xl mx-auto outline-none" role="alert" ref={technicalErrorRef} tabIndex={-1}>
        <h1 className="text-xl font-semibold">Empfehlung konnte nicht geladen werden</h1>
        <p className="mt-3 text-red-700">{technicalError}</p>
        <button type="button" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-red-300 bg-white px-4 py-2 font-bold text-red-800 hover:bg-red-50" onClick={() => setPreviewAttempt((value) => value + 1)}>Erneut versuchen</button>
        <div className="mt-4"><Link to="/" className="text-indigo-600">Zur Startseite</Link></div>
      </section>
    );
  }
  if (previewLoading || !preview) return <div className="text-center py-16 text-gray-500" role="status" aria-live="polite">Empfehlung wird geladen…</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <CreatorRecommendationPreview preview={preview} heading="Geteilte Empfehlung" />

      {!authLoading && !user ? (
        <section className="card">
          <h2 className="text-lg font-semibold">Möchtest du die Empfehlung in deinen Stacks speichern?</h2>
          <p className="text-sm text-gray-600 mt-2">Vor der Anmeldung wird nichts gespeichert.</p>
          <p className="mt-1 text-sm text-gray-600">Nach der Anmeldung kommst du genau zu dieser Empfehlung zurück.</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link className="btn" to={authPath('/login', returnTo)}>Anmelden und weitermachen</Link>
            <Link className="text-indigo-600 self-center" to={authPath('/register', returnTo)}>Konto erstellen</Link>
          </div>
        </section>
      ) : user ? (
        <section className="card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Wo möchtest du die Empfehlung speichern?</h2>
            <p className="mt-1 text-sm text-slate-600">Prüfe zuerst dein Ziel. Danach siehst du genau, was beim Bestätigen passiert.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Deine Auswahl wird nur in diesem Browser für höchstens 30 Minuten zwischengespeichert, damit sie bei der Rückkehr erhalten bleibt. Abgelaufene Entwürfe werden entfernt. <Link className="font-bold text-indigo-700 underline" to="/datenschutz">Mehr zum Datenschutz</Link>
            </p>
          </div>

          {preview.type === 'stack' ? (
            <label className="block text-sm font-medium">Name des neuen Stacks
              <input className="input mt-1" value={stackName} maxLength={120} onChange={(event) => { setStackName(event.target.value); invalidateCheck(); }} />
            </label>
          ) : (
            <fieldset className="space-y-3">
              <legend className="font-bold text-slate-900">Ziel für dieses Produkt</legend>
              {stacks.length > 0 && (
                <label className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-4 ${targetMode === 'existing' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                  <input className={SHARE_RADIO_CLASS} type="radio" name="target-mode" checked={targetMode === 'existing'} onChange={() => { setTargetMode('existing'); invalidateCheck(); }} />
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
              <label className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-4 ${targetMode === 'new' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
                <input className={SHARE_RADIO_CLASS} type="radio" name="target-mode" checked={targetMode === 'new'} onChange={() => { setTargetMode('new'); invalidateCheck(); }} />
                <span><strong>Neuen Stack anlegen</strong><span className="block text-sm text-slate-600">Der neue Stack und das Produkt werden erst beim Bestätigen gemeinsam angelegt.</span></span>
              </label>
              {targetMode === 'new' && (
                <label className="block text-sm font-medium">Name des neuen Stacks
                  <input className="input mt-1" value={stackName} maxLength={120} onChange={(event) => { setStackName(event.target.value); invalidateCheck(); }} />
                </label>
              )}
              {stacksLoading && <p className="text-sm text-slate-500">Deine Stacks werden geladen…</p>}
            </fieldset>
          )}

          {!preflight && (
            <button
              type="button"
              disabled={checking || !stackName.trim()
                || (preview.type === 'dose_recommendation' && (stacksLoading || stacksError || (targetMode === 'existing' && !targetStackId)))}
              onClick={runPreflight}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? 'Änderungen werden vorbereitet…' : 'Änderungen ansehen'}
            </button>
          )}

          <p className="sr-only" aria-live="polite">{checking ? 'Änderungen werden vorbereitet.' : busy ? 'Änderung wird gespeichert.' : result ? 'Änderung wurde gespeichert.' : ''}</p>
          {notice && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">{notice}</p>}
          {stacksError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 outline-none" role="alert" ref={stackErrorRef} tabIndex={-1}>
              <p className="text-sm text-red-800">Deine Stacks konnten nicht geladen werden. Bitte versuche es noch einmal.</p>
              <button type="button" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-red-300 bg-white px-4 py-2 font-bold text-red-800 hover:bg-red-50" onClick={() => setStacksAttempt((value) => value + 1)}>Erneut versuchen</button>
            </div>
          )}
          {technicalError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 outline-none" role="alert" ref={technicalErrorRef} tabIndex={-1}>
              <p className="text-sm text-red-800">{technicalError}</p>
              <button type="button" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-red-300 bg-white px-4 py-2 font-bold text-red-800 hover:bg-red-50" onClick={preflight ? runSave : runPreflight}>Erneut versuchen</button>
            </div>
          )}

          {preflight && !result && (
            <div className="space-y-5">
              <h3 className="text-xl font-black text-slate-900 outline-none" ref={preflightHeadingRef} tabIndex={-1}>Änderungen ansehen</h3>
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
                    <p className="mt-2 text-sm font-medium text-slate-800">Ähnlich heißt nicht gleich. Prüfe deshalb die Unterschiede, bevor du auswählst.</p>
                  </div>
                  {preflight.similar_products.length > 1 && (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">Welches vorhandene Produkt möchtest du vergleichen?</legend>
                      {preflight.similar_products.map((candidate) => (
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2" key={candidate.stack_item_id}>
                          <input
                            className={SHARE_RADIO_CLASS}
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
                      <p className="rounded-lg bg-white p-3 text-sm text-slate-700" role="status">
                        {selectedDifferences.size > 0
                          ? `Unterschiedlich sind: ${[...selectedDifferences].join(', ')}. Die abweichenden Zeilen sind farbig markiert.`
                          : 'Bei Menge, Einnahme, Häufigkeit und Zeitpunkt wurden keine Unterschiede gefunden.'}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Comparison title="Bereits in deinem Stack" value={selectedProduct.comparison} differences={selectedDifferences} />
                        <Comparison title="Empfehlung des Creators" value={preflight.recommendation} differences={selectedDifferences} />
                      </div>
                      {selectedProduct.private_note && <p className="text-sm text-slate-700">Deine private Notiz: {selectedProduct.private_note}</p>}
                      <fieldset className="space-y-3">
                        <legend className="font-bold text-slate-900">Was möchtest du tun?</legend>
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            className={`min-h-24 rounded-xl border-2 p-4 text-left ${decision === 'keep' ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-900'}`}
                            aria-pressed={decision === 'keep'}
                            onClick={() => setDecision('keep')}
                          >
                            <strong className="block">Nichts ändern</strong>
                            <span className="mt-1 block text-sm">Mein vorhandenes Produkt bleibt im Stack.</span>
                          </button>
                          <button
                            type="button"
                            className={`min-h-24 rounded-xl border-2 p-4 text-left ${decision === 'replace' ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-300 bg-white text-slate-900'}`}
                            aria-pressed={decision === 'replace'}
                            onClick={() => setDecision('replace')}
                          >
                            <strong className="block">Produkt ersetzen</strong>
                            <span className="mt-1 block text-sm">Die Creator-Empfehlung übernimmt genau diesen Platz.</span>
                          </button>
                        </div>
                        <p className="text-sm text-slate-600">„Beide“ wird hier nicht angeboten, damit ähnliche Inhaltsstoffe nicht versehentlich doppelt in diesem Stack landen. Mit „Nichts ändern“ bleibt alles wie zuvor.</p>
                      </fieldset>
                    </>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
                <h3 className="font-semibold">Das passiert beim Bestätigen</h3>
                {preview.type === 'stack' ? (
                  <p className="mt-2 text-sm text-slate-700">Ein neuer Stack „{preflight.target.stack_name}“ mit {countLabel(preflight.stack_item_count, 'Produkt', 'Produkten')} wird angelegt. Deine vorhandenen Stacks bleiben unverändert.</p>
                ) : preflight.similar_products.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-700">
                    {preflight.recommendation?.product_name} wird {preflight.target.mode === 'new' ? `gemeinsam mit dem neuen Stack „${preflight.target.stack_name}“ angelegt` : `zu „${preflight.target.stack_name}“ hinzugefügt`}. Andere Produkte und Stacks bleiben unverändert.
                  </p>
                ) : decision === 'keep' && selectedProduct ? (
                  <p className="mt-2 text-sm text-slate-700">{selectedProduct.comparison.product_name} bleibt in „{preflight.target.stack_name}“ unverändert. {preflight.recommendation?.product_name} wird nicht hinzugefügt.</p>
                ) : decision === 'replace' && selectedProduct ? (
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <p>Nur {selectedProduct.comparison.product_name} wird in „{preflight.target.stack_name}“ durch {preflight.recommendation?.product_name} ersetzt. Menge, Einnahme, Häufigkeit und Zeitpunkt wechseln zu den Angaben der Creator-Empfehlung.</p>
                    <p>Die Reihenfolge bleibt gleich. Andere Stacks und Produkte bleiben unverändert.</p>
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
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Wird gespeichert…' : confirmLabel}
              </button>
            </div>
          )}

          {result && (
            <div className="outline-none" ref={resultRef} tabIndex={-1}>
              <ResultCard result={result} shareToken={token} onStay={() => {
                setResult(null);
                setPreflight(null);
                setDecision(null);
                setSelectedProductId(null);
                setIdempotencyKey(crypto.randomUUID());
              }} />
            </div>
          )}
        </section>
      ) : null}
      <ReportRecommendation token={token} />
    </div>
  );
}
