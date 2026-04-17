-- Store user-selected stack item details separately from product defaults.
-- This keeps the product catalog canonical while preserving per-stack dosage choices.

ALTER TABLE stack_items ADD COLUMN dosage_text TEXT;
ALTER TABLE stack_items ADD COLUMN timing TEXT;
