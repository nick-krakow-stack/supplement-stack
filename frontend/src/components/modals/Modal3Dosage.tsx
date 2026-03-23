import { useState, useEffect } from 'react';
import { ChevronLeft, X, Plus, ShoppingCart } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Ingredient, Product, Stack } from '../../types/local';

interface Modal3DosageProps {
  product: Product;
  ingredient: Ingredient;
  onClose: () => void;
  onBack: () => void;
  onAddToStack: (stackId: number | null, product: Product, portions: number) => void;
  token: string | null;
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

  const dailyCost = (product.price / 30) * portions;
  const monthlyCost = product.price;

  const mainIng = product.ingredients?.find((i) => i.ingredient_id === ingredient.id);

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
      onAddToStack(null, product, portions);
      onClose();
      return;
    }

    setSubmitting(true);

    try {
      let stackId: number | null = null;

      if (selectedStackId === 'new') {
        // Create new stack first
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

      onAddToStack(stackId, product, portions);
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
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-5">
        {/* Product header card */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              width={52}
              height={52}
              className="w-[52px] h-[52px] rounded-lg object-cover bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
            {product.brand && (
              <p className="text-xs text-gray-500">{product.brand}</p>
            )}
            <p className="text-sm font-semibold text-blue-700 mt-0.5">
              €{product.price.toFixed(2)}<span className="text-xs text-gray-400 font-normal"> / Monat</span>
            </p>
          </div>
        </div>

        {/* Ingredient info */}
        <div className="p-3 bg-blue-50 rounded-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
            Wirkstoff
          </p>
          <p className="text-sm font-semibold text-blue-900">{ingredient.name}</p>
          {mainIng && mainIng.quantity != null && (
            <p className="text-xs text-blue-700 mt-0.5">
              {mainIng.quantity} {mainIng.unit ?? ingredient.unit ?? ''} pro Portion
            </p>
          )}
        </div>

        {/* Price calculation */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Dosierung
          </p>
          <div className="flex items-center gap-3 mb-3">
            <label htmlFor="portions" className="text-sm text-gray-700 whitespace-nowrap">
              Portionen pro Tag
            </label>
            <input
              id="portions"
              type="number"
              min={MIN_PORTIONS}
              max={MAX_PORTIONS}
              step={PORTIONS_STEP}
              value={portions}
              onChange={handlePortionsChange}
              className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Kosten pro Tag</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">
                €{dailyCost.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500">Kosten pro Monat</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">
                €{monthlyCost.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Stack assignment */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
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
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
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
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 rounded-xl transition-colors disabled:opacity-60"
          >
            <ShoppingCart size={16} />
            In Demo-Stack
          </button>
        ) : (
          <button
            onClick={handleAddToStack}
            disabled={submitting || (selectedStackId === 'new' && !newStackName.trim())}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-colors disabled:opacity-60"
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
