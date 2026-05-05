import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, PackageSearch, Search } from 'lucide-react';
import { getProductQA, type AdminProductQAProduct } from '../../api/admin';

const ISSUE_OPTIONS = [
  { value: '', label: 'Alle Issues' },
  { value: 'missing_image', label: 'Bild fehlt' },
  { value: 'missing_shop_link', label: 'Shop-Link fehlt' },
  { value: 'missing_serving_data', label: 'Portionsdaten fehlen' },
  { value: 'suspicious_price_zero_or_high', label: 'Preis auffällig' },
  { value: 'missing_ingredient_rows', label: 'Wirkstoffzeilen fehlen' },
  { value: 'no_affiliate_flag_on_shop_link', label: 'Affiliate-Flag fehlt' },
] as const;

function issueLabel(issue: string): string {
  const normalized = issue.toLowerCase();
  const known = ISSUE_OPTIONS.find((option) => option.value === normalized);
  if (known && known.value) return known.label;
  return issue
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatPrice(value: number | null): string {
  if (value === null) return 'kein Preis';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function productMeta(product: AdminProductQAProduct): string {
  const parts = [
    product.serving_size !== null && product.serving_unit
      ? `${product.serving_size} ${product.serving_unit}`
      : null,
    product.servings_per_container !== null ? `${product.servings_per_container} Portionen` : null,
    product.container_count !== null ? `${product.container_count} Packung(en)` : null,
    `${product.ingredient_count} Wirkstoff(e)`,
    `${product.main_ingredient_count} Hauptwirkstoff(e)`,
  ];
  return parts.filter(Boolean).join(' · ');
}

function ProductQACard({ product }: { product: AdminProductQAProduct }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <PackageSearch size={22} className="text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <a href="/admin?tab=products" className="font-semibold text-slate-900 hover:text-indigo-700">
            #{product.id} {product.name}
          </a>
          <p className="text-sm text-slate-500">{product.brand || 'Ohne Marke'} · {formatPrice(product.price)}</p>
          <p className="mt-1 text-xs text-slate-500">{productMeta(product)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {product.issues.map((issue) => (
          <span key={issue} className="rounded-full border border-amber-100 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            {issueLabel(issue)}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className={product.is_affiliate ? 'text-emerald-700' : 'text-slate-500'}>
          {product.is_affiliate ? 'Affiliate markiert' : 'Kein Affiliate-Tag'}
        </span>
        {product.shop_link && (
          <a
            href={product.shop_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
          >
            Shop-Link
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </article>
  );
}

export default function ProductQATab() {
  const [products, setProducts] = useState<AdminProductQAProduct[]>([]);
  const [query, setQuery] = useState('');
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getProductQA({ q: query, issue, limit: 100 });
      setProducts(response.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Produkt-QA konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [issue, query]);

  useEffect(() => {
    load();
  }, [load]);

  const issueCounts = useMemo(() => {
    return products.reduce<Record<string, number>>((acc, product) => {
      product.issues.forEach((entry) => {
        acc[entry] = (acc[entry] ?? 0) + 1;
      });
      return acc;
    }, {});
  }, [products]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Produkt-QA</h2>
        <p className="text-sm text-slate-500">Auffällige Produktdaten und fehlende Pflichtangaben.</p>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Produkt oder Marke suchen"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <select
          value={issue}
          onChange={(event) => setIssue(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        >
          {ISSUE_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {Object.keys(issueCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(issueCounts).map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setIssue(name)}
              className={`min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                issue === name
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {issueLabel(name)} · {count}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {!loading && products.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Keine auffälligen Produkte gefunden.
        </p>
      )}

      {!loading && products.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {products.map((product) => (
              <ProductQACard key={product.id} product={product} />
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Produkt</th>
                  <th className="px-4 py-3">Packung</th>
                  <th className="px-4 py-3">Issues</th>
                  <th className="px-4 py-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <a href="/admin?tab=products" className="font-semibold text-slate-900 hover:text-indigo-700">
                        #{product.id} {product.name}
                      </a>
                      <p className="text-xs text-slate-500">{product.brand || 'Ohne Marke'} · {formatPrice(product.price)}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-600">{productMeta(product)}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {product.issues.map((entry) => (
                          <span key={entry} className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {issueLabel(entry)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      {product.shop_link ? (
                        <a href={product.shop_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline">
                          Shop
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span className="text-slate-400">fehlt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
