// Vereinfachte Dosierungsberechnung ohne Datenbankänderungen
// Nutzt vorhandene Produktdaten intelligent

export interface SimpleDosageCalculation {
  preis_pro_tag: number;
  preis_pro_monat: number;
  tage_pro_packung: number;
  portionen_pro_tag: number;
  dosierung_korrekt: boolean;
  berechnungsart: string;
}

/**
 * Vereinfachte Dosierungsberechnung basierend auf Produktnamen und bekannten Standards
 */
export function calculateSimpleDosage(
  produkt: any,
  gewuenschte_dosis?: number
): SimpleDosageCalculation {
  
  // Standard-Fallback
  let preis_pro_tag = produkt.preis / (produkt.einheit_anzahl || 1);
  let tage_pro_packung = produkt.einheit_anzahl || 1;
  let portionen_pro_tag = 1;
  let berechnungsart = 'standard';
  let dosierung_korrekt = false;

  // Intelligente Erkennung basierend auf Produktnamen und Wirkstoff
  const produktName = produkt.name?.toLowerCase() || '';
  const wirkstoffName = produkt.hauptwirkstoff_menge ? 
    `${produkt.hauptwirkstoff_menge}${produkt.hauptwirkstoff_einheit}` : '';

  // Vitamin D3 Tropfen - Spezialbehandlung
  if (produktName.includes('vitamin d3') && (produktName.includes('tropfen') || produkt.form?.toLowerCase() === 'tropfen')) {
    // Annahme: 50ml = 500 Tropfen (0,1ml pro Tropfen)
    // InnoNature D3+K2: 50ml Flasche, ~500 Tropfen
    const ml_inhalt = 50; // Standard für D3 Tropfen
    const tropfen_gesamt = ml_inhalt * 10; // 10 Tropfen pro ml
    const ie_pro_tropfen = 10000; // Standard: 10.000 IE pro Tropfen
    
    if (gewuenschte_dosis) {
      // Berechne benötigte Tropfen (immer aufrunden)
      portionen_pro_tag = Math.ceil(gewuenschte_dosis / ie_pro_tropfen);
    } else {
      portionen_pro_tag = 1; // Standard: 1 Tropfen = 10.000 IE
    }
    
    tage_pro_packung = Math.floor(tropfen_gesamt / portionen_pro_tag);
    preis_pro_tag = produkt.preis / tage_pro_packung;
    berechnungsart = 'vitamin_d3_tropfen';
    dosierung_korrekt = true;
  }
  
  // Magnesium Kapseln - Typisch 2 Kapseln pro Portion
  else if (produktName.includes('magnesium') && (produktName.includes('kapsel') || produkt.form?.toLowerCase() === 'kapsel')) {
    const kapseln_gesamt = produkt.einheit_anzahl || 120;
    const mg_pro_kapsel = 180; // Typisch für Magnesium
    const empfohlene_portion = 2; // 2 Kapseln = 1 Portion = 360mg
    
    if (gewuenschte_dosis) {
      // Berechne benötigte Kapseln
      const kapseln_benoetigt = Math.ceil(gewuenschte_dosis / mg_pro_kapsel);
      portionen_pro_tag = kapseln_benoetigt;
    } else {
      portionen_pro_tag = empfohlene_portion; // Standard: 2 Kapseln
    }
    
    tage_pro_packung = Math.floor(kapseln_gesamt / portionen_pro_tag);
    preis_pro_tag = produkt.preis / tage_pro_packung;
    berechnungsart = 'magnesium_kapseln';
    dosierung_korrekt = true;
  }
  
  // B12 Tabletten - Typisch 1 Tablette pro Tag
  else if (produktName.includes('b12') || produktName.includes('vitamin b12')) {
    const tabletten_gesamt = produkt.einheit_anzahl || 180;
    portionen_pro_tag = 1; // Standard: 1 Tablette täglich
    
    tage_pro_packung = Math.floor(tabletten_gesamt / portionen_pro_tag);
    preis_pro_tag = produkt.preis / tage_pro_packung;
    berechnungsart = 'b12_tabletten';
    dosierung_korrekt = true;
  }
  
  // Zink Kapseln - Typisch 1 Kapsel pro Tag
  else if (produktName.includes('zink') && (produktName.includes('kapsel') || produkt.form?.toLowerCase() === 'kapsel')) {
    const kapseln_gesamt = produkt.einheit_anzahl || 90;
    portionen_pro_tag = 1; // Standard: 1 Kapsel täglich
    
    tage_pro_packung = Math.floor(kapseln_gesamt / portionen_pro_tag);
    preis_pro_tag = produkt.preis / tage_pro_packung;
    berechnungsart = 'zink_kapseln';
    dosierung_korrekt = true;
  }
  
  // Omega-3 Flüssig - Typisch 5ml pro Tag
  else if (produktName.includes('omega') && (produktName.includes('flüssig') || produktName.includes('öl'))) {
    const ml_gesamt = 200; // Typisch für Omega-3 Flaschen
    const ml_pro_portion = 5; // Standard: 5ml pro Tag
    
    tage_pro_packung = Math.floor(ml_gesamt / ml_pro_portion);
    preis_pro_tag = produkt.preis / tage_pro_packung;
    berechnungsart = 'omega3_fluessig';
    dosierung_korrekt = true;
  }
  
  // MSM Pulver - Typisch 1g pro Tag
  else if (produktName.includes('msm') && produktName.includes('pulver')) {
    const gramm_gesamt = 1000; // Typisch: 1kg Dose
    const gramm_pro_portion = 1; // Standard: 1g pro Tag
    
    tage_pro_packung = Math.floor(gramm_gesamt / gramm_pro_portion);
    preis_pro_tag = produkt.preis / tage_pro_packung;
    berechnungsart = 'msm_pulver';
    dosierung_korrekt = true;
  }

  const preis_pro_monat = preis_pro_tag * 30;

  return {
    preis_pro_tag: Math.round(preis_pro_tag * 100) / 100,
    preis_pro_monat: Math.round(preis_pro_monat * 100) / 100,
    tage_pro_packung,
    portionen_pro_tag,
    dosierung_korrekt,
    berechnungsart
  };
}

/**
 * Formatiert deutsche Preise mit Komma-Trenner
 */
export function formatGermanPrice(price: number): string {
  return price.toFixed(2).replace('.', ',');
}

/**
 * Beispiel-Berechnungen zur Validierung
 */
export const BEISPIELE_SIMPLE = {
  vitaminD3: {
    name: 'Vitamin D3 5000 IE + K2 Tropfen',
    preis: 29.90,
    einheit_anzahl: 50, // 50ml
    berechnung_10000_ie: {
      portionen_pro_tag: 1,     // 1 Tropfen
      tage_pro_packung: 500,    // 500 Tropfen
      preis_pro_monat: 1.79     // 29.90€ / 500 * 30
    },
    berechnung_20000_ie: {
      portionen_pro_tag: 2,     // 2 Tropfen  
      tage_pro_packung: 250,    // 250 Tage
      preis_pro_monat: 3.59     // 29.90€ / 250 * 30
    }
  },
  
  magnesium: {
    name: 'Magnesium Einzelkapseln 180mg',
    preis: 18.95,
    einheit_anzahl: 360, // 360 Kapseln
    berechnung_360mg: {  // 2 Kapseln = 360mg
      portionen_pro_tag: 2,     // 2 Kapseln
      tage_pro_packung: 180,    // 360 / 2
      preis_pro_monat: 3.16     // 18.95€ / 180 * 30
    },
    berechnung_1440mg: { // 8 Kapseln = 1440mg 
      portionen_pro_tag: 8,     // 8 Kapseln
      tage_pro_packung: 45,     // 360 / 8
      preis_pro_monat: 12.63    // 18.95€ / 45 * 30
    }
  }
};