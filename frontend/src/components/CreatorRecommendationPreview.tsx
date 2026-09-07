import { useId, useState } from 'react';
import type { CreatorSharePreview } from '../api/creatorSharing';
import { timingLabel } from '../lib/displayCopy';
import {
  formatRecommendationAmount,
  formatRecommendationDate,
  formatRecommendationInterval,
} from '../lib/creatorRecommendationFormat';

export { formatRecommendationDate, formatRecommendationInterval } from '../lib/creatorRecommendationFormat';

export function formatRecommendationTiming(
  managedLabel?: string | null,
  rawTiming?: string | null,
): string {
  return timingLabel(rawTiming, managedLabel);
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

function CreatorProfileImage({ imageUrl, creatorName }: { imageUrl?: string | null; creatorName: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) return null;
  return (
    <img
      src={imageUrl}
      alt={`Profilbild von ${creatorName}`}
      className="h-16 w-16 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
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
  const instanceId = `creator-share-${useId().replace(/:/g, '')}`;
  const creatorHintId = `${instanceId}-general-hint`;
  const stand = formatRecommendationDate(preview.published_at);
  const chunkSize = 8;
  const productChunks = Array.from(
    { length: Math.ceil(preview.items.length / chunkSize) },
    (_, chunkIndex) => preview.items.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize),
  );
  const longStack = preview.items.length > chunkSize;
  const creatorStatements = [...new Set(
    preview.items
      .map((item) => item.creator_statement?.trim())
      .filter((statement): statement is string => Boolean(statement)),
  )];

  return (
    <section className="min-w-0 space-y-4" aria-label={heading}>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
        <p className="text-sm font-bold text-indigo-700">{heading}</p>
        <div className="mt-4 flex items-start gap-4">
          <CreatorProfileImage imageUrl={preview.creator.profile_image_url} creatorName={preview.creator.name} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-indigo-700">Empfohlen von {preview.creator.name}</p>
            <h2 className="mt-1 break-words text-2xl font-black text-slate-950">{preview.title}</h2>
            {stand && <p className="mt-2 text-sm font-semibold text-slate-500">Stand: {stand}</p>}
          </div>
        </div>
        {stand && (
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Diese Empfehlung zeigt den Stand vom {stand}. Spätere Änderungen des Creators sind hier nicht enthalten.
          </p>
        )}
      </div>

      <aside className="rounded-2xl border border-indigo-100 bg-white p-4 sm:p-5" aria-labelledby={creatorHintId}>
        <h3 className="font-black text-slate-900" id={creatorHintId}>Allgemeiner Hinweis von {preview.creator.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Die Angaben zeigen, wie {preview.creator.name} diese Empfehlung persönlich nutzt. Sie sind keine Dosierungsanweisung für dich.
        </p>
        {creatorStatements.length > 0 && (
          <div className="mt-3 space-y-3">
            {creatorStatements.map((statement, index) => (
              <blockquote className="border-l-4 border-indigo-200 pl-4 text-sm leading-6 text-slate-700" key={`${statement}-${index}`}>
                {creatorStatements.length > 1 && <span className="sr-only">Hinweis {index + 1}: </span>}
                {statement}
              </blockquote>
            ))}
            {stand && <p className="text-xs text-slate-500">Persönliche Hinweise aus dem geteilten Stand vom {stand}.</p>}
          </div>
        )}
      </aside>

      {longStack && (
        <nav className="rounded-2xl border border-slate-200 bg-white p-4" aria-label="Übersicht der geteilten Produkte">
          <p className="font-black text-slate-900">Schnell zu den Produkten</p>
          <p className="mt-1 text-sm text-slate-600">Die {preview.items.length} Produkte sind nur für eine bessere Übersicht in nummerierte Abschnitte geteilt.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {productChunks.map((chunk, chunkIndex) => {
              const first = chunkIndex * chunkSize + 1;
              const last = first + chunk.length - 1;
              return (
                <a
                  className="inline-flex min-h-11 items-center rounded-xl border border-indigo-200 px-3 py-2 font-bold text-indigo-700 hover:bg-indigo-50"
                  href={`#${instanceId}-products-${first}-${last}`}
                  key={first}
                >
                  Produkte {first}–{last}
                </a>
              );
            })}
          </div>
        </nav>
      )}

      <div className="space-y-6">
        {productChunks.map((chunk, chunkIndex) => {
          const first = chunkIndex * chunkSize + 1;
          const last = first + chunk.length - 1;
          return (
            <section
              className="space-y-3 scroll-mt-24"
              id={`${instanceId}-products-${first}-${last}`}
              aria-labelledby={longStack ? `${instanceId}-products-title-${first}-${last}` : undefined}
              key={first}
            >
              {longStack && (
                <h3 className="text-lg font-black text-slate-900" id={`${instanceId}-products-title-${first}-${last}`}>
                  Produkte {first}–{last}
                </h3>
              )}
              {chunk.map((item, chunkItemIndex) => {
                const index = chunkIndex * chunkSize + chunkItemIndex;
          const interval = formatRecommendationInterval(item.intake_interval_days);
          const timing = formatRecommendationTiming(item.timing_label, item.timing);
          return (
            <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" key={`${item.catalog_product_id}-${index}`}>
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <PreviewProductImage imageUrl={item.image_url} productName={item.product_name} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-lg font-black text-slate-950">{item.product_name || 'Produkt nicht mehr verfügbar'}</h3>
                  {item.brand && <p className="mt-1 text-sm font-semibold text-slate-500">{item.brand}</p>}
                  {!item.product_name && (
                    <p className="mt-2 text-sm leading-6 text-amber-800" role="note">
                      Im geteilten Stand bleiben Menge, Häufigkeit und Zeitpunkt sichtbar. Name, Bild und Produktzuordnung fehlen. Beim Speichern wird der Eintrag nur übernommen, wenn die Produktzuordnung noch verfügbar ist.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-black text-slate-900">So nutzt {preview.creator.name} das Produkt:</p>
                <p className="mt-2">
                  <span className="font-bold">Menge:</span>{' '}
                  {formatRecommendationAmount(item.quantity, item.unit)}
                </p>
                <p className="mt-1"><span className="font-bold">Eigene Angabe:</span> {item.dosage_text?.trim() || 'Keine Angabe'}</p>
                <p className="mt-1"><span className="font-bold">Wie oft:</span> {interval ?? 'Keine Angabe'}</p>
                <p className="mt-1"><span className="font-bold">Zeitpunkt:</span> {timing}</p>
              </div>

            </article>
          );
              })}
            </section>
          );
        })}
      </div>

    </section>
  );
}
