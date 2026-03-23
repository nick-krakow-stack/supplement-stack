import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Package, ShoppingBag } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import type { Ingredient } from '../types/local';

// ---- Local types ----
interface DemoProduct {
  id: number;
  name: string;
  price: number;
  brand?: string;
  shop_link?: string;
  image_url?: string;
}

interface DemoStack {
  products: DemoProduct[];
  totalMonthly: number;
}

interface IngredientProducts {
  ingredient: { id: number; name: string };
  products: DemoProduct[];
  recommendations: Array<{ product_id: number; type: string }>;
}

const DEMO_KEY_STORAGE = 'ss_demo_key';

async function createDemoSession(): Promise<string> {
  const res = await fetch('/api/demo/sessions', { method: 'POST' });
  if (!res.ok) throw new Error('Demo-Session konnte nicht erstellt werden.');
  const data = await res.json();
  return data.key ?? data.session_key ?? data.id;
}

async function restoreDemoSession(key: string): Promise<DemoStack | null> {
  const res = await fetch(`/api/demo/sessions/${key}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.stack ?? data ?? null;
}

// ---- Product picker modal (simple inline) ----
function ProductPickerModal({
  ingredient,
  onAdd,
  onClose,
}: {
  ingredient: Ingredient;
  onAdd: (product: DemoProduct) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/ingredients/${ingredient.id}/products`)
      .then((r) => {
        if (!r.ok) throw new Error('Produkte konnten nicht geladen werden.');
        return r.json();
      })
      .then((data) => {
        const raw: IngredientProducts = data;
        setProducts(raw.products ?? []);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Fehler.');
      })
      .finally(() => setLoading(false));
  }, [ingredient.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Produkte für {ingredient.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-6">
            <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && products.length === 0 && !error && (
          <p className="text-gray-500 text-sm">Keine Produkte gefunden.</p>
        )}

        <div className="flex flex-col gap-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-3"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package size={20} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                {p.brand && <p className="text-xs text-gray-500">{p.brand}</p>}
                <p className="text-xs text-green-600 font-bold">€{p.price.toFixed(2)}/Monat</p>
              </div>
              <button
                onClick={() => { onAdd(p); onClose(); }}
                className="flex-shrink-0 bg-blue-500 text-white hover:bg-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Hinzufügen
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Main Demo page ----
export default function DemoPage() {
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [demoStack, setDemoStack] = useState<DemoStack>({ products: [], totalMonthly: 0 });
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  // Initialise demo session on mount
  useEffect(() => {
    const existingKey = localStorage.getItem(DEMO_KEY_STORAGE);
    if (existingKey) {
      restoreDemoSession(existingKey)
        .then((stack) => {
          setSessionKey(existingKey);
          if (stack) {
            setDemoStack({
              products: stack.products ?? [],
              totalMonthly: stack.totalMonthly ?? 0,
            });
          }
        })
        .catch(() => {
          // Key invalid – create new session
          return createDemoSession().then((key) => {
            localStorage.setItem(DEMO_KEY_STORAGE, key);
            setSessionKey(key);
          });
        })
        .catch((e: unknown) => {
          setSessionError(e instanceof Error ? e.message : 'Sitzungsfehler.');
        })
        .finally(() => setSessionLoading(false));
    } else {
      createDemoSession()
        .then((key) => {
          localStorage.setItem(DEMO_KEY_STORAGE, key);
          setSessionKey(key);
        })
        .catch((e: unknown) => {
          setSessionError(e instanceof Error ? e.message : 'Sitzungsfehler.');
        })
        .finally(() => setSessionLoading(false));
    }
  }, []);

  const recalcTotal = (products: DemoProduct[]): number =>
    products.reduce((sum, p) => sum + (p.price ?? 0), 0);

  const addProduct = useCallback((product: DemoProduct) => {
    setDemoStack((prev) => {
      if (prev.products.some((p) => p.id === product.id)) return prev;
      const updated = [...prev.products, product];
      return { products: updated, totalMonthly: recalcTotal(updated) };
    });
  }, []);

  const removeProduct = (id: number) => {
    setDemoStack((prev) => {
      const updated = prev.products.filter((p) => p.id !== id);
      return { products: updated, totalMonthly: recalcTotal(updated) };
    });
  };

  const clearAll = () => {
    setDemoStack({ products: [], totalMonthly: 0 });
  };

  const resetSession = () => {
    localStorage.removeItem(DEMO_KEY_STORAGE);
    setDemoStack({ products: [], totalMonthly: 0 });
    setSessionKey(null);
    setSessionLoading(true);
    createDemoSession()
      .then((key) => {
        localStorage.setItem(DEMO_KEY_STORAGE, key);
        setSessionKey(key);
      })
      .catch((e: unknown) => {
        setSessionError(e instanceof Error ? e.message : 'Sitzungsfehler.');
      })
      .finally(() => setSessionLoading(false));
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky yellow banner */}
      <div className="sticky top-0 z-30 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <p className="text-yellow-800 text-sm font-medium">
          ⚠️ Öffentliche Demo – Daten werden regelmäßig zurückgesetzt. Keine Anmeldung erforderlich.
        </p>
        <button
          onClick={resetSession}
          className="text-sm bg-yellow-200 text-yellow-800 hover:bg-yellow-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Demo zurücksetzen
        </button>
      </div>

      {sessionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {sessionError}
        </div>
      )}

      {sessionLoading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin border-4 border-blue-500 border-t-transparent rounded-full w-8 h-8" />
          <span className="ml-3 text-gray-500">Demo-Sitzung wird geladen...</span>
        </div>
      )}

      {!sessionLoading && sessionKey && (
        <>
          {/* Ingredient search */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-gray-900">Wirkstoff suchen</h2>
            <SearchBar
              onSelect={(ingredient) => setSelectedIngredient(ingredient)}
              placeholder="Wirkstoff suchen, z.B. Magnesium..."
            />
          </div>

          {/* Demo stack */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">Demo-Stack</h2>
              {demoStack.products.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Alles entfernen
                </button>
              )}
            </div>

            {demoStack.products.length === 0 ? (
              <p className="text-gray-500 text-sm italic">
                Noch keine Produkte. Suche nach einem Wirkstoff und füge Produkte hinzu.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {demoStack.products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-200 overflow-hidden flex items-center justify-center">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      {product.brand && (
                        <p className="text-xs text-gray-500">{product.brand}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm text-green-600 font-semibold">
                        €{product.price.toFixed(2)}
                      </span>
                      {product.shop_link && (
                        <a
                          href={product.shop_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label="Bei Amazon kaufen"
                        >
                          <ShoppingBag size={15} />
                        </a>
                      )}
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                        aria-label={`${product.name} entfernen`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="border-t border-gray-100 pt-3 flex justify-end">
                  <p className="text-green-600 font-bold">
                    Gesamtkosten: €{demoStack.totalMonthly.toFixed(2)}/Monat
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Info note */}
          <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            Im Demo-Modus können keine Produkte angelegt oder gespeichert werden.
          </p>

          {/* CTA */}
          <div className="flex justify-center pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 px-6 py-3 rounded-xl font-semibold transition-colors shadow-sm"
            >
              Registrieren und loslegen →
            </Link>
          </div>
        </>
      )}

      {/* Product picker modal */}
      {selectedIngredient && (
        <ProductPickerModal
          ingredient={selectedIngredient}
          onAdd={addProduct}
          onClose={() => setSelectedIngredient(null)}
        />
      )}
    </div>
  );
}
