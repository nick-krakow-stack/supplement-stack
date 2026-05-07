# Ingredient Consolidation Audit

Date: 2026-05-07
Database: remote `supplementstack-production`
Mode: read-only audit, no data changed.

## Commands

Cloudflare context was loaded from the local project script documented in
`.agent-memory/local-secrets.md`; raw token values were not read or copied.

Core duplicate/form candidate query:

```sql
WITH ni AS (
  SELECT
    id,
    name,
    lower(replace(replace(replace(name, ' ', ''), '-', ''), '_', '')) AS norm
  FROM ingredients
),
nf AS (
  SELECT
    f.id AS form_id,
    f.ingredient_id AS parent_id,
    parent.name AS parent_name,
    f.name AS form_name,
    lower(replace(replace(replace(f.name, ' ', ''), '-', ''), '_', '')) AS form_norm,
    lower(replace(replace(replace(parent.name, ' ', ''), '-', ''), '_', '')) AS parent_norm
  FROM ingredient_forms f
  JOIN ingredients parent ON parent.id = f.ingredient_id
)
SELECT
  ni.id AS duplicate_id,
  ni.name AS duplicate_name,
  nf.parent_id,
  nf.parent_name,
  nf.form_id,
  nf.form_name
FROM ni
JOIN nf ON ni.id <> nf.parent_id
WHERE ni.norm = nf.form_norm
   OR ni.norm = nf.parent_norm || nf.form_norm
   OR ni.norm = nf.form_norm || nf.parent_norm
ORDER BY nf.parent_name, ni.name
LIMIT 100;
```

## Candidate Summary

The exact normalized audit found two duplicate ingredient rows that already
have matching forms under the canonical parent:

| duplicate_id | duplicate_name | parent_id | parent_name | form_id | form_name | recommendation |
|---:|---|---:|---|---:|---|---|
| 65 | L-Carnitin Tartrat | 13 | L-Carnitin | 154 | L-Carnitin Tartrat | migrate after conflict-aware row remap |
| 66 | L-Carnitin Fumarat | 13 | L-Carnitin | 158 | L-Carnitin Fumarat | migrate after conflict-aware row remap |

Additional manual classification from Nick's decision:

| duplicate_id | duplicate_name | parent_id | parent_name | target_form | recommendation |
|---:|---|---:|---|---|---|
| 60 | Acetyl-L-Carnitin | 13 | L-Carnitin | existing form 155 `Acetyl-L-Carnitin (ALCAR)` | migrate only after preserving form-specific dose/display/interactions |

## Reference Counts For Candidates

| id | name | product_ingredients | user_product_ingredients | synonyms | forms | dose_recommendations | research_sources | warnings | display_profiles | nrv_rows | interactions |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 60 | Acetyl-L-Carnitin | 0 | 1 | 5 | 1 | 2 | 0 | 0 | 1 | 0 | 2 |
| 65 | L-Carnitin Tartrat | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 66 | L-Carnitin Fumarat | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## L-Carnitin Current Shape

Canonical candidate:

- `13` L-Carnitin, unit `mg`.

Duplicate/canonical-form rows currently present in `ingredients`:

- `60` Acetyl-L-Carnitin, unit `mg`.
- `65` L-Carnitin Tartrat, unit `mg`.
- `66` L-Carnitin Fumarat, unit `mg`.

Forms already under L-Carnitin:

- `155` Acetyl-L-Carnitin (ALCAR), score 9.
- `154` L-Carnitin Tartrat, score 9.
- `157` L-Carnitin L-Tartrat (fluessig), score 7.
- `156` Propionyl-L-Carnitin, score 7.
- `158` L-Carnitin Fumarat, score 5.

Acetyl-L-Carnitin also has its own form row:

- `189` Acetyl-L-Carnitin (ALCAR, freie Form), score 10.

## Migration Implications

The concrete consolidation migration must not be a blind `UPDATE` plus
`DELETE`, especially for ID `60`.

Required handling before deleting candidate rows:

- Move `user_product_ingredients.ingredient_id` to `13` and set the matching
  `form_id` (`155`, `154`, or `158`).
- Move or recreate synonyms under `13`, avoiding duplicates because
  `ingredient_synonyms` has no unique `(ingredient_id, synonym, language)`
  constraint.
- For ID `60`, preserve:
  - 2 dose recommendations.
  - 1 display profile.
  - 2 interactions.
  - 5 synonyms.
  - its own form row `189`, likely as a synonym/comment merge into form `155`
    rather than a separate child form.
- Confirm there are no remaining references to IDs `60`, `65`, or `66` before
  deleting those `ingredients` rows.
- Check JSON references such as `blog_posts.linked_ingredient_ids` separately.

## Decision

Do not write the destructive consolidation migration in this pass. The code
now supports canonical search, form preselection, product form filtering, and
admin precursor management. The next data step is a dedicated migration for the
three L-Carnitin candidate rows above.

