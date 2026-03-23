import { useState, useEffect } from 'react';
import { X, ExternalLink, ChevronRight, AlertTriangle } from 'lucide-react';
import ModalWrapper from './ModalWrapper';
import type { Ingredient } from '../../types/local';

interface Modal1IngredientProps {
  ingredient: Ingredient;
  onClose: () => void;
  onShowProducts: () => void;
}

export default function Modal1Ingredient({
  ingredient: initialIngredient,
  onClose,
  onShowProducts,
}: Modal1IngredientProps) {
  const [ingredient, setIngredient] = useState<Ingredient>(initialIngredient);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch full ingredient details including forms, symptoms, synonyms
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(`/api/ingredients/${initialIngredient.id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          // API may return the ingredient directly or nested
          const ing: Ingredient = data.ingredient ?? data;
          setIngredient(ing);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError('Wirkstoff-Details konnten nicht geladen werden.');
          console.error(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialIngredient.id]);

  const isNotRecommended = (comment?: string) =>
    comment?.toLowerCase().includes('nicht empfohlen') ?? false;

  return (
    <ModalWrapper onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">{ingredient.name}</h2>
          {ingredient.unit && (
            <p className="text-sm text-gray-500 mt-1">Einheit: {ingredient.unit}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          <span className="text-gray-500 text-sm">Laden…</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg mb-4">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="space-y-5">
          {/* Synonyms */}
          {ingredient.synonyms && ingredient.synonyms.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Auch bekannt als
              </p>
              <p className="text-sm text-gray-600">
                {ingredient.synonyms.map((s) => s.synonym).join(' · ')}
              </p>
            </div>
          )}

          {/* Description */}
          {ingredient.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Beschreibung
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{ingredient.description}</p>
            </div>
          )}

          {/* Forms */}
          {ingredient.forms && ingredient.forms.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Formen
              </p>
              <ul className="space-y-2">
                {ingredient.forms.map((form, idx) => (
                  <li key={idx} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-gray-800">{form.name}</span>
                    {form.comment && (
                      <span
                        className={`text-xs ${
                          isNotRecommended(form.comment)
                            ? 'text-orange-600 font-medium'
                            : 'text-gray-500'
                        }`}
                      >
                        {form.comment}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Hypo symptoms */}
          {ingredient.hypo_symptoms && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Symptome bei Mangel
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{ingredient.hypo_symptoms}</p>
            </div>
          )}

          {/* Hyper symptoms */}
          {ingredient.hyper_symptoms && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={13} className="text-amber-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Symptome bei Überdosierung
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{ingredient.hyper_symptoms}</p>
            </div>
          )}

          {/* External link */}
          {ingredient.external_url && (
            <a
              href={ingredient.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              Mehr erfahren
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={onShowProducts}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors"
        >
          Produkte anzeigen
          <ChevronRight size={18} />
        </button>
      </div>
    </ModalWrapper>
  );
}
