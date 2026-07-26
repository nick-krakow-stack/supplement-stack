-- Add soft-active flag for canonical ingredient catalog filtering.
-- D1 executes this separately from the catalog upsert so later statements can
-- safely reference the new column.

ALTER TABLE ingredients
ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
