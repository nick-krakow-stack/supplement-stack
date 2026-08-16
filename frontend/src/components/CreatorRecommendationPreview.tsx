import { useState } from 'react';
import type { CreatorSharePreview } from '../api/creatorSharing';
import {
  formatRecommendationAmount,
  formatRecommendationDate,
  formatRecommendationInterval,
} from '../lib/creatorRecommendationFormat';

export { formatRecommendationDate, formatRecommendationInterval } from '../lib/creatorRecommendationFormat';

const KNOWN_TIMING_LABELS: Record<string, string> = {
  before_breakfast: 'Vor dem Frühstück',
  after_breakfast: 'Nach dem Frühstück',
  with_breakfast: 'Zum Frühstück',
  with_meal: 'Zum Essen',
  morning: 'Morgens',
  noon: 'Mittags',
  evening: 'Abends',
  morning_evening: 'Morgens und abends',
  anytime: 'Zeit flexibel',
};

export function formatRecommendationTiming(
  timingLabel?: string | null,
  rawTiming?: string | null,
): string | null {
  const label = timingLabel?.trim();
  if (label) return label;
  const rawKey = rawTiming?.trim().toLowerCase();
  if (!rawKey) return null;
  return KNOWN_TIMING_LABELS[rawKey] ?? 'Keine Angabe';
}

function PreviewProductImage({ imageUrl, productName }: { imageUrl?: string | null; productName: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-2xl font-black text-slate-400" aria-hidden="true">
        {(productName?.trim().charAt(0) || 'P').toLocaleUpperCase('de-DE')}
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={productName ? `Produktbild: ${productName}` : 'Produktbild'}
      className="h-20 w-20 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function CreatorRecommendationPreview({
  preview,
  heading = 'So sehen andere deine Empfehlung',
}: {
  preview: CreatorSharePreview;
  heading?: string;
}) {
  const stand = formatRecommendationDate(preview.published_at);

  return (
    <section className="min-w-0 space-y-4" aria-label={heading}>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
        <p className="text-sm font-bold text-indigo-700">{heading}</p>
        <p className="mt-4 text-sm font-semibold text-indigo-700">Empfohlen von {preview.creator.name}</p>
        <h2 className="mt-1 break-words text-2xl font-black text-slate-950">{preview.title}</h2>
        {stand && <p className="mt-2 text-sm font-semibold text-slate-500">Stand: {stand}</p>}
        {stand && (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Diese Empfehlung zeigt den Stand vom {stand}. Spätere Änderungen des Creators sind hier nicht enthalten.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {preview.items.map((item, index) => {
          const interval = formatRecommendationInterval(item.intake_interval_days);
          const timing = formatRecommendationTiming(item.timing_label, item.timing);
          return (
            <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" key={`${item.catalog_product_id}-${index}`}>
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <PreviewProductImage imageUrl={item.image_url} productName={item.product_name} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-black text-slate-950">{item.product_name || 'Produkt nicht mehr verfügbar'}</h3>
                  {item.brand && <p className="mt-1 text-sm font-semibold text-slate-500">{item.brand}</p>}
                  {item.effect_summary && (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      <span className="font-black text-slate-800">Wofür es genutzt wird:</span> {item.effect_summary}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-black text-slate-900">So nutzt {preview.creator.name} das Produkt:</p>
                <p className="mt-2">
                  <span className="font-bold">Menge laut Empfehlung:</span>{' '}
                  {formatRecommendationAmount(item.quantity, item.unit)}
                </p>
                {item.dosage_text && (
                  <p className="mt-1"><span className="font-bold">Angabe des Creators:</span> {item.dosage_text}</p>
                )}
                {interval && <p className="mt-1"><span className="font-bold">Einnahme:</span> {interval}</p>}
                {timing && (
                  <p className="mt-1"><span className="font-bold">Zeitpunkt:</span> {timing}</p>
                )}
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Das ist die persönliche Nutzung des Creators und keine Dosierungsanweisung für dich.
                </p>
              </div>

              {item.creator_statement && (
                <blockquote className="mt-4 border-l-4 border-indigo-200 pl-4 text-sm leading-6 text-slate-700">
                  <span className="block font-black text-slate-900">Persönlicher Hinweis von {preview.creator.name}</span>
                  {item.creator_statement}
                </blockquote>
              )}
            </article>
          );
        })}
      </div>

    </section>
  );
}
