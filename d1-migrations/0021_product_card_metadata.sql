PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN timing TEXT;
ALTER TABLE products ADD COLUMN dosage_text TEXT;
ALTER TABLE products ADD COLUMN effect_summary TEXT;
ALTER TABLE products ADD COLUMN warning_title TEXT;
ALTER TABLE products ADD COLUMN warning_message TEXT;
ALTER TABLE products ADD COLUMN warning_type TEXT;
ALTER TABLE products ADD COLUMN alternative_note TEXT;

ALTER TABLE user_products ADD COLUMN timing TEXT;
ALTER TABLE user_products ADD COLUMN dosage_text TEXT;
ALTER TABLE user_products ADD COLUMN effect_summary TEXT;
ALTER TABLE user_products ADD COLUMN warning_title TEXT;
ALTER TABLE user_products ADD COLUMN warning_message TEXT;
ALTER TABLE user_products ADD COLUMN warning_type TEXT;
ALTER TABLE user_products ADD COLUMN alternative_note TEXT;
