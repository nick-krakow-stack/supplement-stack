-- Migration 0004: Einfache Seed-Daten für Dosierungssystem

-- Update Vitamin D3 Tropfen mit korrekten Dosierungsdaten
UPDATE produkte SET 
  portion_grosse = 1,                    -- 1 Tropfen
  portion_einheit = 'Tropfen',
  gesamt_inhalt = 50,                    -- 50ml Flasche  
  gesamt_inhalt_einheit = 'ml',
  portionen_pro_einheit = 10,            -- 10 Tropfen pro ml (1 Tropfen = 0,1ml)
  empfohlene_tagesdosis = 1,             -- 1 Tropfen täglich
  darreichungsform_id = 1                -- Tropfen
WHERE name = 'Vitamin D3 5000 IE + K2';

-- Update B12 Tabletten
UPDATE produkte SET 
  portion_grosse = 1,                    -- 1 Tablette
  portion_einheit = 'Tablette',  
  gesamt_inhalt = 180,                   -- 180 Tabletten
  gesamt_inhalt_einheit = 'Stück',
  portionen_pro_einheit = 1,             -- 1 Tablette pro Stück
  empfohlene_tagesdosis = 1,             -- 1 Tablette täglich
  darreichungsform_id = 2                -- Tablette
WHERE name = 'Vitamin B12 Methylcobalamin 1000mcg';

-- Update Magnesium Kapseln  
UPDATE produkte SET 
  portion_grosse = 2,                    -- 2 Kapseln pro Portion (laut Hersteller)
  portion_einheit = 'Kapsel',
  gesamt_inhalt = 120,                   -- 120 Kapseln total
  gesamt_inhalt_einheit = 'Stück', 
  portionen_pro_einheit = 1,             -- 1 Kapsel pro Stück
  empfohlene_tagesdosis = 1,             -- 1 Portion (2 Kapseln) täglich
  darreichungsform_id = 2                -- Kapsel  
WHERE name = 'Magnesium Komplex 400mg';

-- Update Zink Kapseln
UPDATE produkte SET 
  portion_grosse = 1,                    -- 1 Kapsel
  portion_einheit = 'Kapsel',
  gesamt_inhalt = 90,                    -- 90 Kapseln
  gesamt_inhalt_einheit = 'Stück',
  portionen_pro_einheit = 1,             -- 1 Kapsel pro Stück  
  empfohlene_tagesdosis = 1,             -- 1 Kapsel täglich
  darreichungsform_id = 2                -- Kapsel
WHERE name = 'Zink Bisglycinat 25mg';

-- Update Omega-3 Flüssig
UPDATE produkte SET 
  portion_grosse = 5,                    -- 5ml pro Portion (typisch für Omega-3 Öl)
  portion_einheit = 'ml',
  gesamt_inhalt = 200,                   -- 200ml Flasche
  gesamt_inhalt_einheit = 'ml',
  portionen_pro_einheit = 1,             -- 1ml pro ml
  empfohlene_tagesdosis = 1,             -- 1 Portion (5ml) täglich  
  darreichungsform_id = 3                -- Flüssig
WHERE name = 'Omega-3 Fischöl 2000mg';

-- Update MSM Pulver
UPDATE produkte SET 
  portion_grosse = 1,                    -- 1g pro Portion (Standard für MSM)
  portion_einheit = 'g',
  gesamt_inhalt = 1000,                  -- 1000g Dose
  gesamt_inhalt_einheit = 'g', 
  portionen_pro_einheit = 1,             -- 1g pro g
  empfohlene_tagesdosis = 1,             -- 1 Portion (1g) täglich
  darreichungsform_id = 4                -- Pulver
WHERE name = 'MSM Pulver 1000g';

-- Update produkt_wirkstoffe mit Wirkstoffmenge pro Portion
-- Vitamin D3: 10.000 IE pro Tropfen (nicht 5000 wie im Namen)  
UPDATE produkt_wirkstoffe SET 
  menge_pro_portion = 10000,             -- 10.000 IE pro Tropfen
  portion_einheit = 'Tropfen'
WHERE produkt_id = 2 AND wirkstoff_id = 2;

-- B12: 1000 mcg pro Tablette
UPDATE produkt_wirkstoffe SET 
  menge_pro_portion = 1000,              -- 1000 mcg pro Tablette
  portion_einheit = 'Tablette'  
WHERE produkt_id = 1 AND wirkstoff_id = 1;

-- Magnesium: 400mg pro Portion (2 Kapseln)
UPDATE produkt_wirkstoffe SET 
  menge_pro_portion = 400,               -- 400mg pro Portion (2 Kapseln)
  portion_einheit = 'Portion'
WHERE produkt_id = 3 AND wirkstoff_id = 3;

-- Zink: 25mg pro Kapsel
UPDATE produkt_wirkstoffe SET 
  menge_pro_portion = 25,                -- 25mg pro Kapsel
  portion_einheit = 'Kapsel'
WHERE produkt_id = 4 AND wirkstoff_id = 4;

-- Omega-3: 2000mg pro 5ml Portion
UPDATE produkt_wirkstoffe SET 
  menge_pro_portion = 2000,              -- 2000mg pro 5ml Portion
  portion_einheit = 'Portion'
WHERE produkt_id = 5 AND wirkstoff_id = 5;

-- MSM: 1000mg pro 1g Portion  
UPDATE produkt_wirkstoffe SET 
  menge_pro_portion = 1000,              -- 1000mg pro 1g Portion  
  portion_einheit = 'Portion'
WHERE produkt_id = 6 AND wirkstoff_id = 7;

PRAGMA user_version = 4;