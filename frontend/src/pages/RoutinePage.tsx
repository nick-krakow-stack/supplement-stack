import { useEffect, useMemo, useState } from 'react';
import { apiPath } from '../api/base';

type RoutineProduct = {
  id: number;
  name: string;
  brand?: string;
  dosage_text?: string;
  timing?: string;
  quantity?: number;
  unit?: string;
  ingredients?: Array<{
    ingredient_id: number;
    ingredient_name?: string;
    quantity?: number | null;
    unit?: string | null;
    search_relevant?: number | boolean;
  }>;
};

type RoutineStack = {
  id: number | string;
  name: string;
  products: RoutineProduct[];
};

const ROUTINE_ORDER = ['morning', 'noon', 'evening', 'flexible'] as const;
type RoutineKey = typeof ROUTINE_ORDER[number];

const ROUTINE_LABELS: Record<RoutineKey, string> = {
  morning: 'Morgens',
  noon: 'Mittags',
  evening: 'Abends',
  flexible: 'Flexibel',
};

function routineKey(timing?: string): RoutineKey {
  const value = (timing ?? '').toLowerCase();
  if (value.includes('morgen') || value.includes('frueh') || value.includes('fruh') || value.includes('morning')) return 'morning';
  if (value.includes('mittag') || value.includes('noon')) return 'noon';
  if (value.includes('abend') || value.includes('evening') || value.includes('nacht')) return 'evening';
  return 'flexible';
}

function primaryIngredient(product: RoutineProduct): { name: string; quantity?: number | null; unit?: string | null } {
  const row = product.ingredients?.find((item) => Boolean(item.search_relevant ?? 1)) ?? product.ingredients?.[0];
  return {
    name: row?.ingredient_name ?? product.name,
    quantity: row?.quantity ?? product.quantity,
    unit: row?.unit ?? product.unit,
  };
}

function amountLabel(quantity?: number | null, unit?: string | null): string {
  if (quantity == null || !Number.isFinite(quantity)) return 'Menge offen';
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(quantity)} ${unit ?? ''}`.trim();
}

export default function RoutinePage() {
  const [stacks, setStacks] = useState<RoutineStack[]>([]);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(apiPath('/stacks'), { credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error('Stacks konnten nicht geladen werden.');
        return response.json() as Promise<{ stacks?: Array<{ id: number; name: string }> }>;
      })
      .then(async (data) => {
        const list = data.stacks ?? [];
        const detailed = await Promise.all(list.map(async (stack) => {
          const response = await fetch(apiPath(`/stacks/${stack.id}`), {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) return { ...stack, products: [] };
          const detail = await response.json();
          return {
            id: stack.id,
            name: detail.stack?.name ?? stack.name,
            products: (detail.products ?? detail.items ?? []) as RoutineProduct[],
          };
        }));
        if (!cancelled) setStacks(detailed);
      })
      .catch((err) => {
        if (!cancelled) {
          setStatusType('error');
          setStatus(err instanceof Error ? err.message : 'Einnahmeplan konnte nicht geladen werden.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(() => stacks.flatMap((stack) => stack.products.map((product) => ({ ...product, stackName: stack.name }))), [stacks]);
  const groups = useMemo(() => {
    const next: Record<RoutineKey, typeof products> = { morning: [], noon: [], evening: [], flexible: [] };
    for (const product of products) next[routineKey(product.timing)].push(product);
    return next;
  }, [products]);

  const totals = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; quantity: number; open: number }>();
    for (const product of products) {
      const ingredient = primaryIngredient(product);
      const unit = ingredient.unit ?? '';
      const key = `${ingredient.name}:${unit}`;
      const current = map.get(key) ?? { name: ingredient.name, unit, quantity: 0, open: 0 };
      if (typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity)) current.quantity += ingredient.quantity;
      else current.open += 1;
      map.set(key, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [products]);

  const handleEmailRoutine = async () => {
    setEmailSending(true);
    setStatus('');
    setStatusType('idle');
    try {
      const response = await fetch(apiPath('/stacks/routine/email'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Einnahmeplan-Mail konnte nicht gesendet werden.');
      }
      setStatusType('success');
      setStatus('Einnahmeplan wurde an deine E-Mail-Adresse gesendet.');
    } catch (err) {
      setStatusType('error');
      setStatus(err instanceof Error ? err.message : 'Einnahmeplan-Mail konnte nicht gesendet werden.');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-950">Einnahmeplan</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Tagesuebersicht nach Einnahmezeit und Gesamtuebersicht deiner Wirkstoffe.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}>Plan drucken/PDF</button>
          <button type="button" onClick={handleEmailRoutine} disabled={emailSending}>
            {emailSending ? 'Wird gesendet...' : 'Plan mailen'}
          </button>
        </div>
      </div>

      {status && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
            statusType === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : statusType === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          {status}
        </div>
      )}

      {loading ? (
        <div className="text-sm font-semibold text-slate-500">Laden...</div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ROUTINE_ORDER.map((key) => (
              <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black text-slate-950">{ROUTINE_LABELS[key]}</h2>
                <div className="mt-4 space-y-3">
                  {groups[key].length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">Keine Produkte</p>
                  ) : (
                    groups[key].map((product) => (
                      <div key={`${product.stackName}-${product.id}`} className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="text-sm font-black text-slate-900">{product.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{product.stackName}</p>
                        <p className="mt-1 text-sm font-bold text-slate-700">{product.dosage_text ?? amountLabel(product.quantity, product.unit)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Tagesgesamtuebersicht</h2>
            <div className="mt-4 grid gap-2">
              {totals.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">Keine Wirkstoffe im Plan.</p>
              ) : (
                totals.map((item) => (
                  <div key={`${item.name}-${item.unit}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2">
                    <span className="text-sm font-bold text-slate-700">{item.name}</span>
                    <span className="text-sm font-black text-slate-950">
                      {item.quantity > 0 ? amountLabel(item.quantity, item.unit) : `${item.open} Produkt(e)`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
