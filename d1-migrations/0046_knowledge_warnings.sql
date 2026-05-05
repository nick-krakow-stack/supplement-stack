PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS knowledge_articles (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  reviewed_at TEXT,
  sources_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingredient_safety_warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id INTEGER NOT NULL,
  form_id INTEGER,
  short_label TEXT NOT NULL,
  popover_text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'caution' CHECK (severity IN ('info', 'caution', 'danger')),
  article_slug TEXT,
  min_amount REAL,
  unit TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  FOREIGN KEY (form_id) REFERENCES ingredient_forms(id) ON DELETE CASCADE,
  FOREIGN KEY (article_slug) REFERENCES knowledge_articles(slug) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ingredient_safety_warnings_ingredient_active
  ON ingredient_safety_warnings(ingredient_id, form_id, active);

CREATE INDEX IF NOT EXISTS idx_ingredient_safety_warnings_article
  ON ingredient_safety_warnings(article_slug);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_safety_warnings_unique_label
  ON ingredient_safety_warnings(
    ingredient_id,
    COALESCE(form_id, -1),
    short_label,
    COALESCE(article_slug, '')
  );

INSERT INTO knowledge_articles (
  slug,
  title,
  summary,
  body,
  status,
  reviewed_at,
  sources_json
) VALUES (
  'beta-carotin-raucher-lungenkrebs',
  'Beta-Carotin und Lungenkrebsrisiko bei Rauchern',
  'Hoch dosiertes Beta-Carotin wurde in grossen Studien mit einem erhoehten Lungenkrebsrisiko bei Rauchern und weiteren Risikogruppen verbunden.',
  'In zwei grossen Interventionsstudien zeigte hoch dosiertes Beta-Carotin bei Rauchern beziehungsweise Hochrisikogruppen keinen Schutz vor Lungenkrebs. Stattdessen wurde eine erhoehte Lungenkrebsinzidenz beobachtet.\n\nDie EFSA beschreibt die kritischen Dosierungen aus diesen Studien als 20 mg Beta-Carotin pro Tag sowie 30 mg Beta-Carotin pro Tag kombiniert mit Retinol. Gleichzeitig kam die EFSA fuer die allgemeine Bevoelkerung einschliesslich schwerer Raucher zu dem Schluss, dass eine Exposition unter 15 mg Beta-Carotin pro Tag aus Zusatzstoff- und Supplement-Verwendung keine Sicherheitsbedenken ausloest.\n\nDieser Hinweis ist eine allgemeine Produkt- und Wirkstoffwarnung. Er speichert keinen Raucherstatus und ersetzt keine aerztliche Beratung.',
  'published',
  '2026-05-05',
  '[{"label":"EFSA Journal: Statement on the safety of beta-carotene use in heavy smokers","url":"https://www.efsa.europa.eu/en/efsajournal/pub/2953"},{"label":"NIH Office of Dietary Supplements: Vitamin A and Carotenoids Fact Sheet","url":"https://ods.od.nih.gov/factsheets/VitaminA-HealthProfessional/"},{"label":"NCI PDQ: Lung Cancer Prevention","url":"https://www.cancer.gov/types/lung/hp/lung-prevention-pdq"}]'
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  status = excluded.status,
  reviewed_at = excluded.reviewed_at,
  sources_json = excluded.sources_json,
  updated_at = datetime('now');

INSERT INTO ingredient_safety_warnings (
  ingredient_id,
  form_id,
  short_label,
  popover_text,
  severity,
  article_slug,
  min_amount,
  unit
)
SELECT
  ingredient_forms.ingredient_id,
  ingredient_forms.id,
  'Erhoehtes Krebsrisiko bei Rauchern',
  'Grosse Studien fanden bei Rauchern und weiteren Hochrisikogruppen ein erhoehtes Lungenkrebsrisiko mit hoch dosiertem Beta-Carotin. EFSA sieht unter 15 mg/Tag aus Supplement-/Zusatzstoffverwendung keine Sicherheitsbedenken.',
  'danger',
  'beta-carotin-raucher-lungenkrebs',
  15,
  'mg'
FROM ingredient_forms
JOIN ingredients ON ingredients.id = ingredient_forms.ingredient_id
WHERE lower(ingredient_forms.name) IN ('beta-carotin', 'beta-carotene', 'beta carotene', 'betacarotin')
  AND lower(ingredients.name) = 'vitamin a'
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_safety_warnings existing
    WHERE existing.ingredient_id = ingredient_forms.ingredient_id
      AND existing.form_id = ingredient_forms.id
      AND existing.short_label = 'Erhoehtes Krebsrisiko bei Rauchern'
      AND existing.article_slug = 'beta-carotin-raucher-lungenkrebs'
  );

-- Fallback for databases that model Beta-Carotin as its own ingredient.
INSERT INTO ingredient_safety_warnings (
  ingredient_id,
  form_id,
  short_label,
  popover_text,
  severity,
  article_slug,
  min_amount,
  unit
)
SELECT
  id,
  NULL,
  'Erhoehtes Krebsrisiko bei Rauchern',
  'Grosse Studien fanden bei Rauchern und weiteren Hochrisikogruppen ein erhoehtes Lungenkrebsrisiko mit hoch dosiertem Beta-Carotin. EFSA sieht unter 15 mg/Tag aus Supplement-/Zusatzstoffverwendung keine Sicherheitsbedenken.',
  'danger',
  'beta-carotin-raucher-lungenkrebs',
  15,
  'mg'
FROM ingredients
WHERE lower(name) IN ('beta-carotin', 'beta-carotene', 'beta carotene', 'betacarotin')
  AND NOT EXISTS (
    SELECT 1
    FROM ingredient_safety_warnings existing
    WHERE existing.ingredient_id = ingredients.id
      AND existing.form_id IS NULL
      AND existing.short_label = 'Erhoehtes Krebsrisiko bei Rauchern'
      AND existing.article_slug = 'beta-carotin-raucher-lungenkrebs'
  );
