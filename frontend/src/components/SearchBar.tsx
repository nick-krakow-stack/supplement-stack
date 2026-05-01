import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { apiPath } from '../api/base';
import type { Ingredient } from '../types/local';

interface SearchBarProps {
  onSelect: (ingredient: Ingredient) => void;
  placeholder?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchBar({ onSelect, placeholder = 'Wirkstoff suchen…' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(apiPath(`/ingredients/search?q=${encodeURIComponent(debouncedQuery.trim())}`), {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const ingredients: Ingredient[] = data.ingredients ?? [];
        setResults(ingredients.slice(0, 10));
        setOpen(ingredients.length > 0);
        setActiveIndex(-1);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Suche fehlgeschlagen. Bitte erneut versuchen.');
          setOpen(false);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = useCallback(
    (ingredient: Ingredient) => {
      setQuery('');
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      onSelect(ingredient);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  };

  const clearInput = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative flex items-center">
        <Search
          size={20}
          className="absolute left-4 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          aria-label="Wirkstoff suchen"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-10 text-lg font-semibold text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.07)] placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-100"
        />
        {loading && (
          <div className="absolute right-10 flex items-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {query && !loading && (
          <button
            onClick={clearInput}
            className="absolute right-3 bg-transparent p-1 text-slate-400 transition-colors hover:text-slate-600"
            aria-label="Eingabe löschen"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <p className="mt-1 text-sm text-red-600 pl-1">{error}</p>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {results.map((ingredient, index) => (
            <li
              key={ingredient.id}
              id={`suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                // Use mousedown to prevent blur before click
                e.preventDefault();
                handleSelect(ingredient);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex flex-col px-4 py-3 cursor-pointer transition-colors ${
                index === activeIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'text-slate-900 hover:bg-slate-50'
              } ${index > 0 ? 'border-t border-slate-100' : ''}`}
            >
              <span className="font-medium text-sm">{ingredient.name}</span>
              {ingredient.synonyms && ingredient.synonyms.length > 0 && (
                <span className="text-xs text-gray-400 mt-0.5 truncate">
                  {ingredient.synonyms.map((s) => s.synonym).join(', ')}
                </span>
              )}
              {ingredient.unit && (
                <span className="text-xs text-gray-400 mt-0.5">Einheit: {ingredient.unit}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
