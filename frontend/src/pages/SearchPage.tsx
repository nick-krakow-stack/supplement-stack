import { useState, useCallback } from 'react';
import { X, ShoppingCart, Trash2 } from 'lucide-react';
import SearchBar from '../components/SearchBar';
import Modal1Ingredient from '../components/modals/Modal1Ingredient';
import Modal2Products from '../components/modals/Modal2Products';
import Modal3Dosage from '../components/modals/Modal3Dosage';
import type { Ingredient, Product, StackItem } from '../types/local';

type ActiveModal = 'ingredient' | 'products' | 'dosage' | null;

interface ManualDose {
  value: number;
  unit: string;
}

const POPULAR_INGREDIENTS: Array<{ id: number; name: string }> = [
  { id: -1, name: 'Magnesium' },
  { id: -2, name: 'Vitamin D' },
  { id: -3, name: 'Zink' },
  { id: -4, name: 'Omega-3' },
  { id: -5, name: 'B12' },
  { id: -6, name: 'Vitamin C' },
];

function getToken(): string | null {
  return localStorage.getItem('ss_token');
}

export default function SearchPage() {
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [stackItems, setStackItems] = useState<StackItem[]>([]);
  const [manualDose, setManualDose] = useState<ManualDose | undefined>(undefined);

  const token = getToken();

  // Step 1: User selects ingredient from search or chip
  const handleIngredientSelect = useCallback((ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setSelectedProduct(null);
    setActiveModal('ingredient');
  }, []);

  // Popular chip clicked — search for the real ingredient first
  const handlePopularChipClick = useCallback(
    async (name: string) => {
      try {
        const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(name)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ingredients: Ingredient[] = data.ingredients ?? [];
        // Find exact or first match
        const match =
          ingredients.find((i) => i.name.toLowerCase() === name.toLowerCase()) ??
          ingredients[0];
        if (match) {
          handleIngredientSelect(match);
        }
      } catch (err) {
        console.error('Chip search failed:', err);
      }
    },
    [handleIngredientSelect],
  );

  // Modal 1 → 2
  const handleShowProducts = useCallback((dose?: ManualDose) => {
    setManualDose(dose);
    setActiveModal('products');
  }, []);

  // Modal 2 → 3
  const handleProductSelect = useCallback((product: Product) => {
    setSelectedProduct(product);
    setActiveModal('dosage');
  }, []);

  // Modal 3: add to stack
  const handleAddToStack = useCallback(
    (
      _stackId: number | null,
      product: Product,
      portions: number,
      daysSupply: number,
      monthlyPrice: number,
    ) => {
      setStackItems((prev) => {
        const idx = prev.findIndex((item) => item.product.id === product.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { product, portions, daysSupply, monthlyPrice };
          return updated;
        }
        return [...prev, { product, portions, daysSupply, monthlyPrice }];
      });
    },
    [],
  );

  const handleRemoveStackItem = useCallback((productId: number) => {
    setStackItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const goBackToIngredient = useCallback(() => {
    setActiveModal('ingredient');
  }, []);

  const goBackToProducts = useCallback(() => {
    setActiveModal('products');
  }, []);

  const totalMonthly = stackItems.reduce(
    (sum, item) => sum + (item.monthlyPrice ?? item.product.price),
    0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 pb-32">
      {/* Page header */}
      <div className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Wirkstoff suchen</h1>
          <p className="text-sm text-gray-500 mb-4">Finde die richtigen Supplements für dich</p>
          <SearchBar onSelect={handleIngredientSelect} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hint text */}
        <p className="text-sm text-gray-500">
          Suche nach einem Wirkstoff, z.B.{' '}
          <span className="italic">„Magnesium"</span>,{' '}
          <span className="italic">„Vitamin B12"</span>,{' '}
          <span className="italic">„Zink"</span>
        </p>

        {/* Popular ingredient chips */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Beliebte Wirkstoffe
          </p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_INGREDIENTS.map((ing) => (
              <button
                key={ing.id}
                onClick={() => handlePopularChipClick(ing.name)}
                className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-full transition-colors"
              >
                {ing.name}
              </button>
            ))}
          </div>
        </div>

        {/* Stack items summary (inline view, above footer) */}
        {stackItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Mein Stack ({stackItems.length})
            </p>
            <div className="space-y-2">
              {stackItems.map((item) => (
                <div
                  key={item.product.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {item.product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">
                        {item.portions}× täglich
                      </p>
                      <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full">
                        €{(item.monthlyPrice ?? item.product.price).toFixed(2)}/Mo.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveStackItem(item.product.id)}
                    className="ml-3 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Entfernen"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === 'ingredient' && selectedIngredient && (
        <Modal1Ingredient
          ingredient={selectedIngredient}
          onClose={closeModal}
          onShowProducts={handleShowProducts}
        />
      )}

      {activeModal === 'products' && selectedIngredient && (
        <Modal2Products
          ingredientId={selectedIngredient.id}
          ingredientName={selectedIngredient.name}
          onClose={closeModal}
          onBack={goBackToIngredient}
          onSelect={handleProductSelect}
          recommendedDose={manualDose}
        />
      )}

      {activeModal === 'dosage' && selectedProduct && selectedIngredient && (
        <Modal3Dosage
          product={selectedProduct}
          ingredient={selectedIngredient}
          onClose={closeModal}
          onBack={goBackToProducts}
          onAddToStack={handleAddToStack}
          token={token}
          recommendedDose={manualDose}
        />
      )}

      {/* Fixed footer bar — only visible when stack has items */}
      {stackItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-3">
            {/* Summary row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ShoppingCart size={16} className="text-indigo-600 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-900">
                  {stackItems.length}{' '}
                  {stackItems.length === 1 ? 'Produkt' : 'Produkte'} ausgewählt
                </span>
                <span className="text-sm text-gray-500">
                  | Gesamt:{' '}
                  <span className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full ml-1">
                    €{totalMonthly.toFixed(2)}/Monat
                  </span>
                </span>
              </div>
              <button
                onClick={() => setStackItems([])}
                className="flex items-center gap-1 text-xs text-red-500 hover:bg-red-50 rounded-lg px-2 py-1 transition-colors font-medium flex-shrink-0 ml-2"
              >
                <Trash2 size={13} />
                Alle entfernen
              </button>
            </div>

            {/* Product chips */}
            <div className="flex flex-wrap gap-1.5 max-h-14 overflow-hidden">
              {stackItems.map((item) => (
                <span
                  key={item.product.id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full"
                >
                  <span className="max-w-[100px] truncate">{item.product.name}</span>
                  <button
                    onClick={() => handleRemoveStackItem(item.product.id)}
                    className="flex-shrink-0 ml-0.5 text-indigo-400 hover:text-indigo-700 transition-colors"
                    aria-label={`${item.product.name} entfernen`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
