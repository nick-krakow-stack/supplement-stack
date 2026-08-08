import type { CreatorSharePreview } from '../api/creatorSharing';
import {
  formatRecommendationAmount,
  formatRecommendationDate,
  formatRecommendationInterval,
} from '../lib/creatorRecommendationFormat';

export { formatRecommendationDate, formatRecommendationInterval } from '../lib/creatorRecommendationFormat';

export default function CreatorRecommendationPreview({
  preview,
  heading = 'So sehen andere deine Empfehlung',
}: {
  preview: CreatorSharePreview;
  heading?: string;
}) {
  const stand = formatRecommendationDate(preview.published_at);

  return (
    <section className="space-y-4" aria-label={heading}>
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
        <p className="text-sm font-bold text-indigo-700">{heading}</p>
        <p className="mt-4 text-sm font-semibold text-indigo-700">Empfohlen von {preview.creator.name}</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">{preview.title}</h2>
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
          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={`${item.catalog_product_id}-${index}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{item.product_name || 'Produkt nicht mehr verfügbar'}</h3>
                  {item.brand && <p className="mt-1 text-sm font-semibold text-slate-500">{item.brand}</p>}
                </div>
                {item.category_name && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {item.category_name}
                  </span>
                )}
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
                {item.timing && <p className="mt-1"><span className="font-bold">Zeitpunkt:</span> {item.timing}</p>}
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
