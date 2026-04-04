import { useState, useEffect } from 'react';
import { ChevronLeft, X, Plus, ShoppingCart } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Ingredient, Product, Stack } from '../../types/local';

interface ManualDose {
  value: number;
  unit: string;
}

interface Modal3DosageProps {
  product: Product;
  ingredient: Ingredient;
  onClose: () => void;
  onBack: () => void;
  onAddToStack: (
    stackId: number | null,
    product: Product,
    portions: number,
    daysSupply: number,
    monthlyPrice: number,
  ) => void;
  token: string | null;
  recommendedDose?: ManualDose;
}

const MIN_PORTIONS = 0.5;
const MAX_PORTIONS = 5;
const PORTIONS_STEP = 0.5;

export default function Modal3Dosage({
  product,
  ingredient,
  onClose,
  onBack,
  onAddToStack,
  token,
  recommendedDose,
}: Modal3DosageProps) {
  const [portions, setPortions] = useState(1);
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [selectedStackId, setSelectedStackId] = useState<number | 'new' | ''>('');
  const [newStackName, setNewStackName] = useState('');
  const [stacksLoading, setStacksLoading] = useState(false);
  const [stacksError, setStacksError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch stacks if logged in
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setStacksLoading(true);
    setStacksError(null);

    fetch('/api/stacks', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const fetchedStacks: Stack[] = data.stacks ?? [];
          setStacks(fetchedStacks);
          if (fetchedStacks.length > 0) {
            setSelectedStackId(fetchedStacks[0].id);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStacksError('Stacks konnten nicht geladen werden.');
          console.error(err);
        }
      })
      .finally(() => {
        if (!cancelled) setStacksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── Serving-size math ──
  const mainIng = product.ingredients?.find((i) => i.ingredient_id === ingredient.id);

  const totalServings =
    (product.servings_per_container ?? 30) * (product.container_count ?? 1);

  // How much of the ingredient is delivered per serving
  const ingPerServing: number =
    mainIng?.quantity != null
      ? mainIng.quantity
      : (product.serving_size ?? 1);

  // Target dose per day (from manual dose passed from Modal1 or ingredient qty)
  const targetDosePerDay: number =
    recommendedDose?.value ?? ingPerServing;

  // Servings needed per day to hit target dose × portions
  const servingsNeededPerDay: number =
    ingPerServing > 0
      ? (portions * targetDosePerDay) / ingPerServing
      : portions;

  const daysSupply: number =
    totalServings / Math.max(servingsNeededPerDay, 0.001);

  // If product has proper serving data, use the calculated monthly price
  const hasServingData =
    product.servings_per_container != null || product.serving_size != null;

  const monthlyPrice: number = hasServingData
    ? (product.price / daysSupply) * 30
    : product.price;

  const dailyCost: number = monthlyPrice / 30;

  const showSupplyNote = hasServingData && (daysSupply < 25 || daysSupply > 35);

  // Unit display for "1 portion = X"
  const portionUnit = mainIng?.unit ?? ingredient.unit ?? '';

  const handlePortionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setPortions(Math.min(MAX_PORTIONS, Math.max(MIN_PORTIONS, val)));
    }
  };

  const handleAddToStack = async () => {
    setSubmitError(null);

    if (!token) {
      // Demo mode: add without stack
      onAddToStack(null, product, portions, daysSupply, monthlyPrice);
      onClose();
      return;
    }

    setSubmitting(true);

    try {
      let stackId: number | null = null;

      if (selectedStackId === 'new') {
        const name = newStackName.trim();
        if (!name) {
          setSubmitError('Bitte einen Stack-Namen eingeben.');
          setSubmitting(false);
          return;
        }

        const res = await fetch('/api/stacks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        const data = await res.json();
        stackId = data.id ?? data.stack?.id ?? null;
      } else if (typeof selectedStackId === 'number') {
        stackId = selectedStackId;
      }

      onAddToStack(stackId, product, portions, daysSupply, monthlyPrice);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setSubmitError(`Fehler: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Zurück"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Dosierung & Stack</h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-5">
        {/* Product info section */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50/40 rounded-2xl p-4 border border-indigo-100/50 mb-4">
          <div className="flex items-start gap-3">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                width={52}
                height={52}
                className="w-[52px] h-[52px] rounded-xl object-cover bg-white flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
              {product.brand && (
                <p className="text-xs text-gray-400">{product.brand}</p>
              )}
              <p className="text-sm font-semibold text-emerald-600 mt-0.5">
                €{product.price.toFixed(2)}
                <span className="text-xs text-gray-400 font-normal"> / Packung</span>
              </p>
            </div>
          </div>

          {/* Ingredient info merged into the card */}
          <div className="mt-3 pt-3 border-t border-indigo-100/60">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Wirkstoff
            </p>
            <p className="text-sm font-semibold text-gray-900">{ingredient.name}</p>
            {ingPerServing > 0 && portionUnit && (
              <p className="text-xs text-gray-400 mt-0.5">
                1 Portion = {ingPerServing} {portionUnit}
              </p>
            )}
            {recommendedDose && (
              <p className="mt-1">
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                  Zieldosis: {recommendedDose.value} {recommendedDose.unit}/Tag
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Dosage slider + cost calculation */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Dosierung
          </p>

          {/* Portions counter */}
          <div className="flex items-center gap-3 mb-4">
            <label htmlFor="portions" className="text-sm text-gray-700 whitespace-nowrap">
              Portionen pro Tag
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPortions((p) => Math.max(MIN_PORTIONS, parseFloat((p - PORTIONS_STEP).toFixed(1))))}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 font-bold text-gray-700 transition-colors flex items-center justify-center"
              >
                −
              </button>
              <input
                id="portions"
                type="number"
                min={MIN_PORTIONS}
                max={MAX_PORTIONS}
                step={PORTIONS_STEP}
                value={portions}
                onChange={handlePortionsChange}
                className="text-xl font-bold text-gray-900 w-12 text-center border-0 bg-transparent focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setPortions((p) => Math.min(MAX_PORTIONS, parseFloat((p + PORTIONS_STEP).toFixed(1))))}
                className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-indigo-100 hover:text-indigo-700 font-bold text-gray-700 transition-colors flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 mt-0.5">Kosten pro Tag</p>
              <p className="text-xl font-bold text-emerald-600">
                €{dailyCost.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 mt-0.5">Kosten/Monat</p>
              <p className="text-xl font-bold text-emerald-600">
                €{monthlyPrice.toFixed(2)}
              </p>
            </div>
            {hasServingData && (
              <>
                <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-400 mt-0.5">Vorrat</p>
                  <p className="text-xl font-bold text-gray-900">
                    {Math.round(daysSupply)} Tage
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-400 mt-0.5">Portionen/Tag</p>
                  <p className="text-xl font-bold text-gray-900">
                    {portions}×
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Supply note */}
          {showSupplyNote && (
            <p className="mt-2 text-xs text-gray-400">
              ≠ 30 Tage Vorrat (tatsächlich {Math.round(daysSupply)} Tage)
            </p>
          )}
        </div>

        {/* Stack assignment */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Stack-Zuweisung
          </p>

          {!token ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800">
                Bitte anmelden, um zu einem Stack hinzuzufügen.
              </p>
              <a
                href="/login"
                className="inline-block mt-2 text-xs font-semibold text-amber-700 underline hover:text-amber-900"
              >
                Zum Login → Demo-Modus verfügbar
              </a>
            </div>
          ) : stacksLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
              Stacks werden geladen…
            </div>
          ) : stacksError ? (
            <p className="text-sm text-red-600">{stacksError}</p>
          ) : (
            <div className="space-y-3">
              <select
                value={String(selectedStackId)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedStackId(val === 'new' ? 'new' : parseInt(val, 10));
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
              >
                {stacks.length === 0 && (
                  <option value="" disabled>
                    Kein Stack vorhanden
                  </option>
                )}
                {stacks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="new">+ Neuen Stack erstellen</option>
              </select>

              {selectedStackId === 'new' && (
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Stack-Name eingeben…"
                    value={newStackName}
                    onChange={(e) => setNewStackName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{submitError}</p>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          <ChevronLeft size={16} />
          Zurück
        </button>

        {!token ? (
          <button
            onClick={handleAddToStack}
            disabled={submitting}
            className="flex-1 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl px-5 py-3 transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ShoppingCart size={16} />
            In Demo-Stack
          </button>
        ) : (
          <button
            onClick={handleAddToStack}
            disabled={submitting || (selectedStackId === 'new' && !newStackName.trim())}
            className="flex-1 w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl px-5 py-3 transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShoppingCart size={16} />
            )}
            Zum Stack hinzufügen
          </button>
        )}
      </div>
    </ModalWrapper>
  );
}
