PRAGMA foreign_keys = ON;

-- The public knowledge overview reads aliases and short copy from the existing
-- canonical ingredient tables. Keep the append-only overview projection stale
-- whenever either source changes; no duplicate overview copy is introduced.
CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_synonyms_insert
AFTER INSERT ON ingredient_synonyms BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_synonyms_update
AFTER UPDATE ON ingredient_synonyms BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_synonyms_delete
AFTER DELETE ON ingredient_synonyms BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_display_profiles_insert
AFTER INSERT ON ingredient_display_profiles BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_display_profiles_update
AFTER UPDATE ON ingredient_display_profiles BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_display_profiles_delete
AFTER DELETE ON ingredient_display_profiles BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_display_translations_insert
AFTER INSERT ON display_profile_translations BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_display_translations_update
AFTER UPDATE ON display_profile_translations BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

CREATE TRIGGER IF NOT EXISTS trg_knowledge_overview_display_translations_delete
AFTER DELETE ON display_profile_translations BEGIN
  UPDATE knowledge_overview_projection_meta
  SET source_version = source_version + 1, updated_at = datetime('now')
  WHERE id = 1;
END;

-- Existing generations predate category_key, aliases and the central display
-- profile copy. Invalidate once so the guarded refresher materializes the new
-- payload before it can be served from the projection again.
UPDATE knowledge_overview_projection_meta
SET source_version = source_version + 1, updated_at = datetime('now')
WHERE id = 1;
