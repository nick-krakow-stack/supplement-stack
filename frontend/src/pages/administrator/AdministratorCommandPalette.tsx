import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CornerDownLeft, Loader2, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';

type SearchResult = {
  id: string;
  title: string;
  path: string;
  category: string;
  description?: string;
  badge?: string;
};

const RESULT_LIMIT = 12;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function safeAdminPath(rawPath?: string): string | null {
  if (!rawPath) return null;

  if (rawPath.startsWith('/administrator')) return rawPath;
  if (rawPath.startsWith('administrator/')) return `/${rawPath}`;

  try {
    const parsed = new URL(rawPath, window.location.origin);
    const nextPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return parsed.origin === window.location.origin && nextPath.startsWith('/administrator') ? nextPath : null;
  } catch {
    return null;
  }
}

function resultItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  const record = asRecord(data);
  if (!record) return [];

  for (const key of ['results', 'items', 'routes', 'data']) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeResult(value: unknown, index: number): SearchResult | null {
  const record = asRecord(value);
  if (!record) return null;

  const path = safeAdminPath(
    readString(record, ['path', 'url', 'href', 'to', 'route', 'admin_path', 'adminPath'])
  );
  if (!path) return null;

  const fallbackTitle = path
    .replace(/^\/administrator\/?/, '')
    .replace(/[/?#].*$/, '')
    .replace(/[-/]/g, ' ')
    .trim();

  const rawId = readString(record, ['id', 'key', 'slug']) ?? path;

  return {
    id: `${index}-${rawId}`.replace(/[^A-Za-z0-9_-]/g, '-'),
    title: readString(record, ['title', 'label', 'name']) || fallbackTitle || path,
    path,
    category: readString(record, ['category', 'group', 'section', 'type']) ?? 'Route',
    description: readString(record, ['description', 'subtitle', 'summary', 'matched_text', 'matchedText']),
    badge: readString(record, ['badge', 'status', 'entity']),
  };
}

function normalizeResults(data: unknown): SearchResult[] {
  return resultItems(data).map(normalizeResult).filter((result): result is SearchResult => Boolean(result));
}

export default function AdministratorCommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeResult = results[activeIndex] ?? null;
  const trimmedQuery = query.trim();

  const openPalette = useCallback(() => {
    setOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setError(null);
    setActiveIndex(0);
  }, []);

  const openResult = useCallback(
    (result: SearchResult) => {
      closePalette();
      if (result.path !== `${location.pathname}${location.search}${location.hash}`) {
        navigate(result.path);
      }
    },
    [closePalette, location.hash, location.pathname, location.search, navigate]
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
        return;
      }

      if (event.key === 'Escape' && open) {
        event.preventDefault();
        closePalette();
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [closePalette, open, openPalette]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      apiClient
        .get<unknown>('/admin/search', {
          params: { q: trimmedQuery, limit: RESULT_LIMIT },
          signal: controller.signal,
        })
        .then((response) => {
          setResults(normalizeResults(response.data));
          setActiveIndex(0);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setActiveIndex(0);
          setError('Suche konnte nicht geladen werden.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 140);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmedQuery]);

  useEffect(() => {
    if (activeIndex > results.length - 1) setActiveIndex(Math.max(results.length - 1, 0));
  }, [activeIndex, results.length]);

  const statusText = useMemo(() => {
    if (loading) return trimmedQuery ? 'Suche läuft...' : 'Schnellzugriffe werden geladen...';
    if (error) return error;
    if (!results.length) return trimmedQuery ? 'Keine Treffer gefunden.' : 'Keine Schnellzugriffe verfügbar.';
    return trimmedQuery ? `${results.length} Treffer` : 'Schnellzugriffe';
  }, [error, loading, results.length, trimmedQuery]);

  return (
    <>
      <button
        type="button"
        className="admin-search-trigger"
        onClick={openPalette}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Search size={15} />
        <span className="admin-search-copy">Suchen oder springen...</span>
        <kbd className="admin-kbd">Ctrl K</kbd>
      </button>

      {open && (
        <div className="admin-command-overlay" role="presentation" onMouseDown={closePalette}>
          <div
            className="admin-command-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Administrator Suche"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-command-search">
              <Search size={17} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveIndex((previous) => (results.length ? (previous + 1) % results.length : 0));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex((previous) => (results.length ? (previous - 1 + results.length) % results.length : 0));
                  } else if (event.key === 'Enter' && activeResult) {
                    event.preventDefault();
                    openResult(activeResult);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closePalette();
                  }
                }}
                className="admin-command-input"
                placeholder="Route, Seite oder Datensatz suchen"
                aria-label="Administrator Suche"
                aria-controls="administrator-command-results"
                aria-activedescendant={activeResult ? `administrator-command-result-${activeResult.id}` : undefined}
              />
              {loading && <Loader2 className="admin-command-spinner" size={16} aria-hidden="true" />}
            </div>

            <div className="admin-command-status" aria-live="polite">
              {error && <AlertTriangle size={14} />}
              <span>{statusText}</span>
            </div>

            {!error && results.length > 0 && (
              <div id="administrator-command-results" className="admin-command-results" role="listbox">
                {results.map((result, index) => (
                  <button
                    key={`${result.id}-${result.path}`}
                    id={`administrator-command-result-${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`admin-command-result${index === activeIndex ? ' active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openResult(result)}
                  >
                    <span className="admin-command-result-main">
                      <span className="admin-command-result-title">{result.title}</span>
                      {result.description && <span className="admin-command-result-desc">{result.description}</span>}
                      <span className="admin-command-result-path">{result.path}</span>
                    </span>
                    <span className="admin-command-result-side">
                      {result.badge && <span className="admin-badge admin-badge-neutral">{result.badge}</span>}
                      <span className="admin-command-result-category">{result.category}</span>
                      {index === activeIndex && <CornerDownLeft size={14} aria-hidden="true" />}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!loading && !error && results.length === 0 && (
              <div className="admin-command-empty">
                {trimmedQuery
                  ? 'Versuche einen anderen Suchbegriff oder öffne eine Admin-Seite über die Navigation.'
                  : 'Der Backend-Suchindex hat aktuell keine Schnellzugriffe geliefert.'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
