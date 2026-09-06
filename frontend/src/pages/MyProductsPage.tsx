import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CopyPlus, ImageOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import UserProductForm, {
  type UserProduct,
  type UserProductStackUsage,
} from '../components/modals/UserProductForm';
import { useAuth } from '../contexts/AuthContext';
import { calculateProductUsage } from '../lib/stackCalculations';

type VisibilityFilter = 'all' | 'private' | 'public';
type ProductSort = 'newest' | 'name' | 'price-asc' | 'price-desc';

const currency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 6 });

function productVisibility(product: UserProduct): 'private' | 'public' {
  return product.visibility === 'public' || product.published_product_id != null ? 'public' : 'private';
}

function formatDate(value?: string | null): string {
  if (!value) return 'Datum nicht verfügbar';
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime())
    ? 'Datum nicht verfügbar'
    : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(parsed);
}

function safeCreatorReturn(value: string | null): string | null {
  if (!value || value.length > 1000 || !value.startsWith('/creator')) return null;
  try {
    const parsed = new URL(value, 'https://supplementstack.local');
    if (parsed.origin !== 'https://supplementstack.local' || parsed.pathname !== '/creator') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function monthlyCost(product: UserProduct, usage: UserProductStackUsage): number | null {
  return calculateProductUsage({
    dosage_text: usage.dosage_text,
    intake_interval_days: usage.intake_interval_days,
    quantity: usage.quantity,
    serving_size: product.serving_size,
    serving_unit: product.serving_unit,
    servings_per_container: product.servings_per_container,
    container_count: product.container_count,
    ingredients: product.ingredients,
  }, Number(product.price)).monthlyCost;
}

function statusExplanation(product: UserProduct): string {
  if (productVisibility(product) === 'public') {
    return 'Dieses Produkt ist öffentlich auffindbar. Das veröffentlichte Original bleibt unverändert.';
  }
  if (product.status === 'rejected') {
    return product.review_note?.trim()
      ? `Warum es privat bleibt: ${product.review_note.trim()}`
      : 'Die Angaben reichen noch nicht für eine Veröffentlichung. Du kannst sie bearbeiten oder eine neue Kopie anlegen.';
  }
  if (product.status === 'blocked') {
    return product.review_note?.trim()
      ? `Warum es privat bleibt: ${product.review_note.trim()}`
      : 'Dieses Produkt bleibt derzeit privat. Prüfe die Angaben oder wende dich an den Support.';
  }
  if (product.status === 'approved') {
    return 'Die Angaben wurden geprüft. Bis zur Veröffentlichung bleibt das Produkt nur für dich sichtbar.';
  }
  return 'Nur du kannst dieses Produkt sehen. Die Angaben werden vor einer möglichen Veröffentlichung geprüft.';
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-4 p-5">
      <div className="h-16 w-16 rounded-xl bg-gray-100" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

function ProductRow({
  product,
  deleting,
  onCopy,
  onDelete,
  onEdit,
}: {
  product: UserProduct;
  deleting: boolean;
  onCopy: (product: UserProduct) => void;
  onDelete: (id: number) => void;
  onEdit: (product: UserProduct) => void;
}) {
  const visibility = productVisibility(product);
  const immutable = visibility === 'public' || product.status === 'approved';
  const servings = product.servings_per_container != null
    ? product.servings_per_container * (product.container_count ?? 1)
    : null;
  const parts = (product.ingredients ?? []).flatMap((ingredient) => ingredient.parts ?? []);
  const usages = product.stack_usage ?? [];

  return (
    <article className="p-5 transition-colors hover:bg-slate-50/70">
      <div className="flex items-start gap-4 max-[560px]:flex-col">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {product.image_url ? (
            <img src={product.image_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff size={22} className="text-slate-400" aria-label="Kein Produktfoto" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-base font-bold text-slate-950">{product.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  visibility === 'public'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {visibility === 'public' ? 'Öffentlich' : 'Privat'}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {[product.brand, product.form].filter(Boolean).join(' · ') || 'Keine weiteren Grundangaben'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!immutable && (
                <button
                  type="button"
                  onClick={() => onEdit(product)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                  aria-label={`${product.name} bearbeiten`}
                >
                  <Pencil size={16} /> <span className="max-[680px]:sr-only">Bearbeiten</span>
                </button>
              )}
              {immutable && (
                <button
                  type="button"
                  onClick={() => onCopy(product)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                  aria-label={`${product.name} als bearbeitbare Kopie anlegen`}
                >
                  <CopyPlus size={16} /> <span className="max-[680px]:sr-only">Kopie bearbeiten</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(product.id)}
                disabled={deleting || immutable}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`${product.name} löschen`}
                title={immutable
                  ? visibility === 'public'
                    ? 'Das öffentliche Original bleibt erhalten. Lege für Änderungen eine Kopie an.'
                    : 'Das geprüfte private Original bleibt erhalten. Lege für Änderungen eine Kopie an.'
                  : 'Löschen'}
              >
                <Trash2 size={16} /> <span className="max-[680px]:sr-only">Löschen</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {product.serving_size != null && product.serving_unit && (
              <span>{number.format(product.serving_size)} {product.serving_unit} pro Portion</span>
            )}
            {servings != null && <span>{number.format(servings)} Portionen insgesamt</span>}
            {(product.ingredients ?? []).length > 0 && (
              <span>{(product.ingredients ?? []).map((item) => item.ingredient_name).filter(Boolean).join(', ')}</span>
            )}
          </div>
          {parts.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Enthält: {parts.map((part) => part.part_name).filter(Boolean).join(', ')}
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Packungspreis</p>
              <p className="mt-1 text-lg font-black text-slate-950">{currency.format(Number(product.price))}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Monatskosten aus deinen Stacks</p>
              {usages.length === 0 ? (
                <p className="mt-1 text-sm text-emerald-950">Noch nicht berechenbar – das Produkt wird in keinem Stack genutzt.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm text-emerald-950">
                  {usages.map((usage) => {
                    const cost = monthlyCost(product, usage);
                    return (
                      <li key={usage.stack_item_id}>
                        <span className="font-semibold">{usage.stack_name}:</span>{' '}
                        {cost == null ? 'nicht berechenbar – Packungs- oder Nutzungsangaben fehlen' : `${currency.format(cost)} pro Monat`}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-600">{statusExplanation(product)}</p>
          <details className="mt-2 text-sm text-slate-600">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold text-indigo-700">Statusverlauf anzeigen</summary>
            {(product.status_history ?? []).length > 0 ? (
              <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
                {(product.status_history ?? []).map((entry, index) => (
                  <li key={`${entry.created_at}-${index}`}>
                    <span className="font-semibold">{entry.visibility === 'public' ? 'Öffentlich' : 'Privat'}</span>
                    <span className="text-slate-500"> · {formatDate(entry.created_at)}</span>
                    {entry.note && <p className="mt-0.5">{entry.note}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p>Privat angelegt · {formatDate(product.created_at)}</p>
            )}
          </details>
        </div>
      </div>
    </article>
  );
}

export default function MyProductsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const userId = user?.id;
  const creatorReturn = safeCreatorReturn(new URLSearchParams(location.search).get('creatorReturn'));
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [sort, setSort] = useState<ProductSort>('newest');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<UserProduct>();
  const [copyProduct, setCopyProduct] = useState<UserProduct>();

  const loadProducts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/user-products', { credentials: 'include' });
      if (!response.ok) throw new Error('Deine Produkte konnten nicht geladen werden.');
      const data = await response.json() as { products?: UserProduct[] };
      setProducts(data.products ?? []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Deine Produkte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('de');
    const matches = products.filter((product) => {
      if (visibility !== 'all' && productVisibility(product) !== visibility) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        product.name,
        product.brand,
        product.form,
        ...(product.ingredients ?? []).flatMap((ingredient) => [
          ingredient.ingredient_name,
          ...(ingredient.parts ?? []).map((part) => part.part_name),
        ]),
      ].filter(Boolean).join(' ').toLocaleLowerCase('de');
      return searchable.includes(normalizedQuery);
    });
    return [...matches].sort((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name, 'de');
      if (sort === 'price-asc') return Number(left.price) - Number(right.price);
      if (sort === 'price-desc') return Number(right.price) - Number(left.price);
      return (right.created_at ?? '').localeCompare(left.created_at ?? '');
    });
  }, [products, query, sort, visibility]);

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(undefined);
    setCopyProduct(undefined);
  };

  const handleSaved = (saved: UserProduct) => {
    setProducts((current) => current.some((product) => product.id === saved.id)
      ? current.map((product) => product.id === saved.id ? saved : product)
      : [saved, ...current]);
    setMessage(editingProduct ? 'Deine Änderungen wurden gespeichert.' : copyProduct ? 'Die private Kopie wurde angelegt.' : 'Das Produkt wurde angelegt.');
    closeForm();
  };

  const handleDelete = async (id: number) => {
    const product = products.find((item) => item.id === id);
    if (product && (productVisibility(product) === 'public' || product.status === 'approved')) {
      setError(productVisibility(product) === 'public'
        ? 'Das öffentliche Original bleibt erhalten. Lege für Änderungen bitte eine bearbeitbare Kopie an.'
        : 'Das geprüfte private Original bleibt erhalten. Lege für Änderungen bitte eine bearbeitbare Kopie an.');
      return;
    }
    if (!window.confirm(`Produkt "${product?.name ?? id}" wirklich löschen?`)) return;
    setDeletingId(id);
    setError('');
    try {
      if (!product) throw new Error('Das Produkt wurde nicht gefunden. Bitte lade die Seite neu.');
      const response = await fetch(`/api/user-products/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected_version: product.version }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Das Produkt konnte nicht gelöscht werden.');
      }
      setProducts((current) => current.filter((item) => item.id !== id));
      setMessage('Das Produkt wurde gelöscht.');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Das Produkt konnte nicht gelöscht werden.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Bitte anmelden</h1>
        <p className="text-gray-600">Melde dich an, um eigene Produkte zu verwalten.</p>
        <Link to="/login" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700">Zur Anmeldung</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">Eigene Produkte</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Lege Produkte von deiner Packung an und verwende sie anschließend in deinen Stacks.</p>
          </div>
          <button
            type="button"
            onClick={() => { setEditingProduct(undefined); setCopyProduct(undefined); setShowForm(true); }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 font-semibold text-white shadow-sm hover:from-indigo-600 hover:to-purple-700 max-[430px]:w-full"
          >
            <Plus size={18} /> Produkt anlegen
          </button>
        </header>

        {creatorReturn && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950" role="status">
            <p className="font-black">Dein Creator-Entwurf bleibt gespeichert.</p>
            <p>Prüfe hier den Status deines eigenen Produkts. Erst nach Freigabe und Veröffentlichung kann es in einer öffentlichen Empfehlung erscheinen. Wenn die Prüfung noch läuft, musst du die Entscheidung abwarten.</p>
            <Link className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-indigo-200 bg-white px-4 font-bold text-indigo-700" to={creatorReturn}>Zur Empfehlung zurück</Link>
          </div>
        )}

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}
        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{message}</div>}

        {!loading && products.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_210px]">
              <label className="relative">
                <span className="sr-only">Produkte durchsuchen</span>
                <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  placeholder="Name, Marke oder Wirkstoff suchen"
                />
              </label>
              <label>
                <span className="sr-only">Sichtbarkeit filtern</span>
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as VisibilityFilter)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="all">Privat und öffentlich</option>
                  <option value="private">Nur privat</option>
                  <option value="public">Nur öffentlich</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Produkte sortieren</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as ProductSort)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="newest">Neueste zuerst</option>
                  <option value="name">Name A–Z</option>
                  <option value="price-asc">Packungspreis aufsteigend</option>
                  <option value="price-desc">Packungspreis absteigend</option>
                </select>
              </label>
            </div>
            <p className="mt-3 text-sm text-slate-600" aria-live="polite">
              {visibleProducts.length} von {products.length} {products.length === 1 ? 'Produkt' : 'Produkten'}
            </p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading && <div><p className="px-6 py-4 text-sm text-slate-600" role="status">Deine Produkte werden geladen …</p><div className="divide-y divide-slate-100" aria-hidden="true"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div></div>}
          {!loading && !error && products.length === 0 && (
            <div className="px-6 py-16 text-center">
              <h2 className="text-lg font-bold text-slate-900">Noch keine eigenen Produkte</h2>
              <p className="mx-auto mt-2 max-w-lg text-slate-600">Lege oben dein erstes Produkt an. Danach kannst du es direkt in deinen Stacks verwenden.</p>
            </div>
          )}
          {!loading && products.length > 0 && visibleProducts.length === 0 && (
            <div className="px-6 py-12 text-center">
              <h2 className="font-bold text-slate-900">Keine passenden Produkte</h2>
              <p className="mt-1 text-sm text-slate-600">Ändere die Suche oder zeige wieder private und öffentliche Produkte an.</p>
              <button type="button" onClick={() => { setQuery(''); setVisibility('all'); }} className="mt-4 min-h-11 rounded-xl border border-indigo-200 px-4 text-sm font-semibold text-indigo-700">Filter zurücksetzen</button>
            </div>
          )}
          {!loading && visibleProducts.length > 0 && (
            <div className="divide-y divide-slate-100">
              {visibleProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  deleting={deletingId === product.id}
                  onEdit={(item) => { setEditingProduct(item); setCopyProduct(undefined); setShowForm(true); }}
                  onCopy={(item) => { setEditingProduct(undefined); setCopyProduct(item); setShowForm(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {showForm && (
          <UserProductForm
            key={`user-product-form-${userId}`}
            onClose={closeForm}
            onSaved={handleSaved}
            initialProduct={editingProduct}
            copyProduct={copyProduct}
            draftOwnerId={userId}
          />
        )}
      </div>
    </div>
  );
}
