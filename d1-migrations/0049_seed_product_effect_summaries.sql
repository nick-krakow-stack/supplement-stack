-- Seed short product-card Wirkung summaries for the initial public catalog.
-- These are compact UI summaries, not standalone health claims.

UPDATE products
SET effect_summary = 'Immunsystem, Knochen, Hormone'
WHERE id = 1
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Energie, Stressresistenz, Immunsystem'
WHERE id = 3
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Immunsystem, Zellschutz, Kollagenbildung'
WHERE id = 4
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Immunsystem, Atemwege, Haut'
WHERE id = 5
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Darmflora, Verdauung, Mikrobiom'
WHERE id = 6
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Energie, Nervensystem, Stoffwechsel'
WHERE id = 7
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Elektrolyte, Herz, Muskelfunktion'
WHERE id = 8
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Herz, Gehirn, Zellfunktion'
WHERE id = 9
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Immunsystem, Haut, Zellschutz'
WHERE id = 10
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Kraft, Leistung, Regeneration'
WHERE id = 11
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');

UPDATE products
SET effect_summary = 'Energiestoffwechsel, Ausdauer, Fokus'
WHERE id = 12
  AND (effect_summary IS NULL OR TRIM(effect_summary) = '');
