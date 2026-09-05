-- A reason describes an actual editorial change. Historical reasons stay unknown.
ALTER TABLE knowledge_articles
ADD COLUMN update_reason TEXT
CHECK (update_reason IS NULL OR (length(trim(update_reason)) BETWEEN 1 AND 500));
