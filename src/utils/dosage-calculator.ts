// Dosierungsberechnung - Zentralisierte Logik für präzise Supplement-Berechnungen

export interface ProductDosageInfo {
  id: number;
  name: string;
  preis: number;
  portion_grosse: number;        // z.B. 1 (Tropfen), 2 (Kapseln pro Portion)
  portion_einheit: string;       // 'Tropfen', 'Kapsel', 'Tablette'
  gesamt_inhalt: number;         // z.B. 50 (ml), 360 (Kapseln)
  gesamt_inhalt_einheit: string; // 'ml', 'Stück', 'g'
  portionen_pro_einheit: number; // z.B. 10 (Tropfen pro ml)
  empfohlene_tagesdosis: number; // Hersteller-Empfehlung in Portionen
  wirkstoff_menge_pro_portion: number; // z.B. 10000 (IE pro Tropfen)
  wirkstoff_einheit: string;     // 'IE', 'mg', 'mcg'
}

export interface DosageCalculationResult {
  gewuenschte_tagesdosis: number;           // Eingabe in Wirkstoff-Einheit
  benoetigte_portionen_pro_tag: number;     // Berechnete Portionen
  benoetigte_einzelteile_pro_tag: number;   // Einzelne Tropfen/Kapseln
  tage_pro_packung: number;                // Reichweite
  preis_pro_tag: number;                   // Kosten pro Tag
  preis_pro_monat: number;                 // Kosten pro Monat (30 Tage)
  portionen_gesamt: number;                // Gesamtportionen in Packung
  einzelteile_gesamt: number;              // Gesamte Tropfen/Kapseln in Packung
}

/**
 * Berechnet die gesamte Anzahl verfügbarer Portionen in einer Packung
 */
function calculateTotalPortions(product: ProductDosageInfo): number {
  // Berechne Gesamtzahl der Einzelteile (Tropfen, Kapseln, etc.)
  const einzelteile_gesamt = product.gesamt_inhalt * product.portionen_pro_einheit;
  
  // Berechne Anzahl Portionen basierend auf Portionsgröße
  const portionen_gesamt = einzelteile_gesamt / product.portion_grosse;
  
  return Math.floor(portionen_gesamt);
}

/**
 * Berechnet die gesamte Anzahl einzelner Einheiten (Tropfen, Kapseln, etc.)
 */
function calculateTotalUnits(product: ProductDosageInfo): number {
  return product.gesamt_inhalt * product.portionen_pro_einheit;
}

/**
 * Berechnet benötigte Portionen für gewünschte Tagesdosis
 */
function calculateRequiredPortions(
  gewuenschte_dosis: number,
  wirkstoff_pro_portion: number
): number {
  // Immer aufrunden, da man keine halben Tropfen nehmen kann
  return Math.ceil(gewuenschte_dosis / wirkstoff_pro_portion);
}

/**
 * Hauptfunktion für Dosierungsberechnung
 */
export function calculateDosage(
  product: ProductDosageInfo,
  gewuenschte_tagesdosis: number
): DosageCalculationResult {
  
  // 1. Gesamtinhalt berechnen
  const einzelteile_gesamt = calculateTotalUnits(product);
  const portionen_gesamt = calculateTotalPortions(product);
  
  // 2. Benötigte Portionen pro Tag berechnen
  const benoetigte_portionen_pro_tag = calculateRequiredPortions(
    gewuenschte_tagesdosis,
    product.wirkstoff_menge_pro_portion
  );
  
  // 3. Benötigte Einzelteile pro Tag
  const benoetigte_einzelteile_pro_tag = benoetigte_portionen_pro_tag * product.portion_grosse;
  
  // 4. Reichweite berechnen
  const tage_pro_packung = Math.floor(einzelteile_gesamt / benoetigte_einzelteile_pro_tag);
  
  // 5. Preisberechnung
  const preis_pro_tag = product.preis / tage_pro_packung;
  const preis_pro_monat = preis_pro_tag * 30;
  
  return {
    gewuenschte_tagesdosis,
    benoetigte_portionen_pro_tag,
    benoetigte_einzelteile_pro_tag,
    tage_pro_packung,
    preis_pro_tag: Math.round(preis_pro_tag * 100) / 100,
    preis_pro_monat: Math.round(preis_pro_monat * 100) / 100,
    portionen_gesamt,
    einzelteile_gesamt
  };
}

/**
 * Konvertiert zwischen verschiedenen Einheiten eines Wirkstoffs
 */
export function convertUnit(
  menge: number,
  von_einheit: string,
  zu_einheit: string,
  konvertierungen: Array<{von_einheit: string, zu_einheit: string, faktor: number}>
): number {
  if (von_einheit === zu_einheit) return menge;
  
  const konvertierung = konvertierungen.find(k => 
    k.von_einheit === von_einheit && k.zu_einheit === zu_einheit
  );
  
  if (!konvertierung) {
    throw new Error(`Keine Konvertierung gefunden von ${von_einheit} zu ${zu_einheit}`);
  }
  
  return menge * konvertierung.faktor;
}

/**
 * Beispiel-Berechnungen für Dokumentation und Tests
 */
export const BEISPIELE = {
  // Vitamin D3 Tropfen: 50ml = 500 Tropfen, 10.000 IE pro Tropfen
  VitaminD3_10000IE: {
    product: {
      id: 2,
      name: 'Vitamin D3 5000 IE + K2',
      preis: 29.90,
      portion_grosse: 1,              // 1 Tropfen
      portion_einheit: 'Tropfen',
      gesamt_inhalt: 50,              // 50ml
      gesamt_inhalt_einheit: 'ml',
      portionen_pro_einheit: 10,      // 10 Tropfen pro ml
      empfohlene_tagesdosis: 1,       // 1 Tropfen täglich
      wirkstoff_menge_pro_portion: 10000, // 10.000 IE pro Tropfen
      wirkstoff_einheit: 'IE'
    } as ProductDosageInfo,
    
    szenarien: [
      { 
        dosis: 10000, // 10.000 IE gewünscht
        erwartet: { 
          portionen: 1,     // 1 Tropfen
          einzelteile: 1,   // 1 Tropfen  
          tage: 500,        // 500 Tropfen ÷ 1 Tropfen/Tag
          preis_monat: 1.79 // 29.90€ ÷ 500 Tage × 30 Tage
        }
      },
      {
        dosis: 13000, // 13.000 IE gewünscht  
        erwartet: {
          portionen: 2,     // 2 Tropfen (aufgerundet)
          einzelteile: 2,   // 2 Tropfen
          tage: 250,        // 500 Tropfen ÷ 2 Tropfen/Tag
          preis_monat: 3.59 // 29.90€ ÷ 250 Tage × 30 Tage
        }
      }
    ]
  },
  
  // Magnesium Kapseln: 360 Kapseln, 180mg pro Kapsel, 2 Kapseln empfohlen
  MagnesiumEinzelkapseln_1440mg: {
    product: {
      id: 7,
      name: 'Magnesium Einzelkapseln 180mg',
      preis: 18.95,
      portion_grosse: 1,              // 1 Kapsel pro Portion
      portion_einheit: 'Kapsel',
      gesamt_inhalt: 360,             // 360 Kapseln
      gesamt_inhalt_einheit: 'Stück',
      portionen_pro_einheit: 1,       // 1 Kapsel pro Stück
      empfohlene_tagesdosis: 2,       // 2 Kapseln täglich empfohlen
      wirkstoff_menge_pro_portion: 180, // 180mg pro Kapsel
      wirkstoff_einheit: 'mg'
    } as ProductDosageInfo,
    
    szenarien: [
      {
        dosis: 1440, // 1440mg gewünscht (= 8 Kapseln)
        erwartet: {
          portionen: 8,     // 8 Kapseln (1440÷180)
          einzelteile: 8,   // 8 Kapseln
          tage: 45,         // 360 Kapseln ÷ 8 Kapseln/Tag  
          preis_monat: 12.63 // 18.95€ ÷ 45 Tage × 30 Tage
        }
      },
      {
        dosis: 1600, // 1600mg gewünscht (= 8.89, aufgerundet 9 Kapseln)
        erwartet: {
          portionen: 9,     // 9 Kapseln (aufgerundet)
          einzelteile: 9,   // 9 Kapseln
          tage: 40,         // 360 Kapseln ÷ 9 Kapseln/Tag
          preis_monat: 14.21 // 18.95€ ÷ 40 Tage × 30 Tage
        }
      }
    ]
  }
};