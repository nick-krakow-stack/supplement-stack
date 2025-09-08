-- Add effects column and update existing nutrients with effects descriptions
-- This script safely adds the effects column and updates all vitamins with their descriptions

-- Add effects column (will fail silently if it already exists)
ALTER TABLE nutrients ADD COLUMN effects TEXT DEFAULT NULL;

-- Update all vitamins with their effects descriptions
UPDATE nutrients SET effects = 'Knochengesundheit, Immunsystem, Calciumaufnahme' WHERE id = 1;
UPDATE nutrients SET effects = 'Blutbildung, Nervensystem, DNA-Synthese, Energiestoffwechsel' WHERE id = 2;
UPDATE nutrients SET effects = 'Immunsystem, Antioxidans, Kollagenbildung, Eisenaufnahme' WHERE id = 6;
UPDATE nutrients SET effects = 'Aminosäurestoffwechsel, Nervensystem, Immunfunktion' WHERE id = 7;
UPDATE nutrients SET effects = 'Zellteilung, DNA-Synthese, Blutbildung, Schwangerschaft' WHERE id = 8;
UPDATE nutrients SET effects = 'Stoffwechsel, Haut- und Haargesundheit, Genregulation' WHERE id = 9;
UPDATE nutrients SET effects = 'Blutgerinnung, Knochengesundheit, Herzgesundheit' WHERE id = 10;

-- Update new vitamins with effects
UPDATE nutrients SET effects = 'Sehkraft, Immunsystem, Haut- und Schleimhautgesundheit' WHERE id = 101;
UPDATE nutrients SET effects = 'Antioxidans, Zellschutz, Herzgesundheit, Durchblutung' WHERE id = 102;
UPDATE nutrients SET effects = 'Blutgerinnung, Knochengesundheit' WHERE id = 103;
UPDATE nutrients SET effects = 'Energiestoffwechsel, Nervensystem, Herzfunktion' WHERE id = 104;
UPDATE nutrients SET effects = 'Energiestoffwechsel, Zellwachstum, Sehkraft' WHERE id = 105;
UPDATE nutrients SET effects = 'Energiestoffwechsel, Cholesterinspiegel, Hautgesundheit' WHERE id = 106;
UPDATE nutrients SET effects = 'Energiestoffwechsel, Hormonproduktion, Stressresistenz' WHERE id = 107;
UPDATE nutrients SET effects = 'Blutbildung, Nervensystem, aktive B12-Form' WHERE id = 108;
UPDATE nutrients SET effects = 'Blutbildung, Nervensystem, stabile B12-Form' WHERE id = 109;
UPDATE nutrients SET effects = 'Knochengesundheit, Calciumaufnahme, pflanzliches Vitamin D' WHERE id = 110;
UPDATE nutrients SET effects = 'Aktive Folatform, Zellteilung, DNA-Synthese' WHERE id = 111;
UPDATE nutrients SET effects = 'Sehkraft, Antioxidans, Hautgesundheit, Vorstufe von Vitamin A' WHERE id = 112;