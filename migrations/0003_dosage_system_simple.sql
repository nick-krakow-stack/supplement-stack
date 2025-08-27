-- Migration 0003: Einfaches Dosierungssystem ohne Foreign Keys
-- Erweitert bestehende Tabellen um Dosierungsfelder

-- 1. Erweitere Produkte-Tabelle um Dosierungsfelder (ohne Foreign Keys)
ALTER TABLE produkte ADD COLUMN portion_grosse REAL;
ALTER TABLE produkte ADD COLUMN portion_einheit TEXT; 
ALTER TABLE produkte ADD COLUMN gesamt_inhalt REAL;
ALTER TABLE produkte ADD COLUMN gesamt_inhalt_einheit TEXT;
ALTER TABLE produkte ADD COLUMN portionen_pro_einheit REAL; 
ALTER TABLE produkte ADD COLUMN empfohlene_tagesdosis REAL;
ALTER TABLE produkte ADD COLUMN darreichungsform_id INTEGER;

-- 2. Erweitere produkt_wirkstoffe um Dosierungsangaben
ALTER TABLE produkt_wirkstoffe ADD COLUMN menge_pro_portion REAL;
ALTER TABLE produkt_wirkstoffe ADD COLUMN portion_einheit TEXT;

PRAGMA user_version = 3;