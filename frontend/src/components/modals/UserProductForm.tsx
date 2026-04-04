import { useState } from 'react';
import ModalWrapper from './ModalWrapper';

export interface UserProduct {
  id: number;
  user_id?: number;
  name: string;
  brand?: string;
  form?: string;
  price: number;
  shop_link?: string;
  image_url?: string;
  serving_size?: number;
  serving_unit?: string;
  servings_per_container?: number;
  container_count?: number;
  is_affiliate?: number | boolean;
  notes?: string;
  created_at?: string;
}

interface UserProductFormProps {
  onClose: () => void;
  onSaved: (product: UserProduct) => void;
  initialProduct?: UserProduct;
}

function getToken(): string | null {
  return localStorage.getItem('ss_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const FORM_OPTIONS = ['Kapsel', 'Tablette', 'Pulver', 'Tropfen', 'Gel', 'Sonstige'];

export default function UserProductForm({ onClose, onSaved, initialProduct }: UserProductFormProps) {
  const isEdit = initialProduct !== undefined;

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [brand, setBrand] = useState(initialProduct?.brand ?? '');
  const [form, setForm] = useState(initialProduct?.form ?? '');
  const [price, setPrice] = useState(initialProduct?.price != null ? String(initialProduct.price) : '');
  const [servingSize, setServingSize] = useState(
    initialProduct?.serving_size != null ? String(initialProduct.serving_size) : ''
  );
  const [servingUnit, setServingUnit] = useState(initialProduct?.serving_unit ?? '');
  const [servingsPerContainer, setServingsPerContainer] = useState(
    initialProduct?.servings_per_container != null ? String(initialProduct.servings_per_container) : ''
  );
  const [containerCount, setContainerCount] = useState(
    initialProduct?.container_count != null ? String(initialProduct.container_count) : '1'
  );
  const [shopLink, setShopLink] = useState(initialProduct?.shop_link ?? '');
  const [isAffiliate, setIsAffiliate] = useState(
    initialProduct?.is_affiliate ? Boolean(initialProduct.is_affiliate) : false
  );
  const [notes, setNotes] = useState(initialProduct?.notes ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Bitte einen Produktnamen eingeben.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Bitte einen gültigen Preis eingeben.');
      return;
    }

    const body: Record<string, unknown> = {
      name: trimmedName,
      price: parsedPrice,
      is_affiliate: isAffiliate ? 1 : 0,
    };
    if (brand.trim()) body.brand = brand.trim();
    if (form) body.form = form;
    if (servingSize !== '') body.serving_size = parseFloat(servingSize);
    if (servingUnit.trim()) body.serving_unit = servingUnit.trim();
    if (servingsPerContainer !== '') body.servings_per_container = parseInt(servingsPerContainer, 10);
    if (containerCount !== '') body.container_count = parseInt(containerCount, 10);
    if (shopLink.trim()) body.shop_link = shopLink.trim();
    if (notes.trim()) body.notes = notes.trim();

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/user-products/${initialProduct!.id}` : '/api/user-products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Anfrage fehlgeschlagen.');
      }

      const data = await res.json();

      // PUT returns { product: UserProduct }, POST returns { id: number }
      const saved: UserProduct = isEdit
        ? (data.product ?? { ...initialProduct!, ...body })
        : { id: data.id, ...(body as Omit<UserProduct, 'id'>) } as UserProduct;

      onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler.');
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <ModalWrapper onClose={onClose} title={isEdit ? 'Produkt bearbeiten' : 'Neues Produkt erstellen'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className={labelClass}>
            Produktname <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="z.B. Omega-3 Fischöl"
            required
          />
        </div>

        {/* Brand */}
        <div>
          <label className={labelClass}>Marke</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className={inputClass}
            placeholder="z.B. Now Foods"
          />
        </div>

        {/* Form */}
        <div>
          <label className={labelClass}>Form</label>
          <select
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className={inputClass}
          >
            <option value="">— bitte wählen —</option>
            {FORM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Price */}
        <div>
          <label className={labelClass}>
            Preis <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
            placeholder="€ Preis/Monat"
            step="0.01"
            min="0"
            required
          />
        </div>

        {/* Serving size + unit */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelClass}>Portionsgröße</label>
            <input
              type="number"
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
              className={inputClass}
              placeholder="z.B. 1000"
              step="any"
              min="0"
            />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Einheit</label>
            <input
              type="text"
              value={servingUnit}
              onChange={(e) => setServingUnit(e.target.value)}
              className={inputClass}
              placeholder="z.B. mg"
            />
          </div>
        </div>

        {/* Servings per container + container count */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelClass}>Portionen pro Behälter</label>
            <input
              type="number"
              value={servingsPerContainer}
              onChange={(e) => setServingsPerContainer(e.target.value)}
              className={inputClass}
              placeholder="z.B. 60"
              step="1"
              min="0"
            />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Anzahl Behälter</label>
            <input
              type="number"
              value={containerCount}
              onChange={(e) => setContainerCount(e.target.value)}
              className={inputClass}
              placeholder="1"
              step="1"
              min="1"
            />
          </div>
        </div>

        {/* Shop link */}
        <div>
          <label className={labelClass}>Shop-Link</label>
          <input
            type="text"
            value={shopLink}
            onChange={(e) => setShopLink(e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </div>

        {/* Affiliate checkbox */}
        <div className="flex items-center gap-2">
          <input
            id="is_affiliate"
            type="checkbox"
            checked={isAffiliate}
            onChange={(e) => setIsAffiliate(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
          />
          <label htmlFor="is_affiliate" className="text-sm text-gray-700 cursor-pointer">
            Affiliate-Link
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            rows={3}
            placeholder="Persönliche Notizen zum Produkt..."
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Speichere...' : isEdit ? 'Speichern' : 'Erstellen'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
