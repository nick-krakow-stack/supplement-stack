ALTER TABLE stack_items
ADD COLUMN intake_interval_days INTEGER NOT NULL DEFAULT 1 CHECK (intake_interval_days >= 1);
