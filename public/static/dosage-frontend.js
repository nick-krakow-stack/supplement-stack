// Frontend-Dosierungsberechnung für bessere User Experience
// Diese Datei wird in app.js eingebunden

/**
 * Berechnet Dosierung auf dem Frontend für sofortige Feedback
 */
class DosageCalculatorFE {
  
  /**
   * Formatiert Preise für deutsche Locale
   */
  static formatPrice(preis) {
    if (!preis || isNaN(preis)) return '0,00'
    
    // Runde auf 2 Dezimalstellen und formatiere mit Komma
    return preis.toFixed(2).replace('.', ',')
  }
  
  /**
   * Parst deutsche Dezimalzahlen (mit Komma) zurück zu Float
   */
  static parseGermanDecimal(value) {
    if (typeof value === 'number') return value
    return parseFloat(String(value).replace(',', '.'))
  }
  
  /**
   * Berechnet benötigte Portionen basierend auf gewünschter Dosis
   */
  static calculateRequiredPortions(gewuenschteDosis, wirkstoffProPortion) {
    if (!gewuenschteDosis || !wirkstoffProPortion) return 0
    // Immer aufrunden - man kann keine halben Tropfen nehmen
    return Math.ceil(gewuenschteDosis / wirkstoffProPortion)
  }
  
  /**
   * Hauptfunktion für Dosierungsberechnung im Frontend
   */
  static calculateDosageDisplay(produkt, gewuenschteDosis) {
    // Prüfe ob alle erforderlichen Felder vorhanden sind
    if (!produkt || !produkt.portion_grosse || !produkt.gesamt_inhalt || 
        !produkt.portionen_pro_einheit || !produkt.menge_pro_portion) {
      // Fallback auf alte Berechnung
      return {
        preis_pro_tag: (produkt.preis / (produkt.einheit_anzahl || 1)),
        preis_pro_monat: (produkt.preis / (produkt.einheit_anzahl || 1)) * 30,
        tage_pro_packung: (produkt.einheit_anzahl || 1),
        portionen_pro_tag: 1,
        einzelteile_pro_tag: 1,
        fallback: true
      }
    }
    
    // 1. Gesamtinhalt berechnen
    const einzelteile_gesamt = produkt.gesamt_inhalt * produkt.portionen_pro_einheit
    
    // 2. Benötigte Portionen pro Tag
    const portionen_pro_tag = this.calculateRequiredPortions(
      gewuenschteDosis, 
      produkt.menge_pro_portion
    )
    
    // 3. Benötigte Einzelteile pro Tag
    const einzelteile_pro_tag = portionen_pro_tag * produkt.portion_grosse
    
    // 4. Reichweite berechnen
    const tage_pro_packung = Math.floor(einzelteile_gesamt / einzelteile_pro_tag)
    
    // 5. Preisberechnung
    const preis_pro_tag = tage_pro_packung > 0 ? produkt.preis / tage_pro_packung : 0
    const preis_pro_monat = preis_pro_tag * 30
    
    return {
      preis_pro_tag: Math.round(preis_pro_tag * 100) / 100,
      preis_pro_monat: Math.round(preis_pro_monat * 100) / 100,
      tage_pro_packung,
      portionen_pro_tag,
      einzelteile_pro_tag,
      einzelteile_gesamt,
      gewuenschte_dosis: gewuenschteDosis,
      wirkstoff_pro_portion: produkt.menge_pro_portion,
      fallback: false
    }
  }
  
  /**
   * Formatiert Dosierungsdetails für Display
   */
  static formatDosageDetails(calculation, produkt) {
    if (calculation.fallback) {
      return `Standarddosierung: ${produkt.empfohlene_tagesdosis || 1} ${produkt.portion_einheit || 'Portion'} täglich`
    }
    
    const portionText = calculation.portionen_pro_tag === 1 ? 
      `${calculation.portionen_pro_tag} ${produkt.portion_einheit}` :
      `${calculation.portionen_pro_tag} ${produkt.portion_einheit}`
    
    return `${portionText} täglich (${calculation.tage_pro_packung} Tage Reichweite)`
  }
  
  /**
   * Generiert eine vollständige Produktanzeige mit korrekter Dosierung
   */
  static renderProductWithDosage(produkt, gewuenschteDosis = null) {
    // Verwende gewünschte Dosis oder Herstellerempfehlung
    const targetDosis = gewuenschteDosis || 
                       (produkt.empfohlene_tagesdosis * (produkt.menge_pro_portion || 1))
    
    const calculation = this.calculateDosageDisplay(produkt, targetDosis)
    
    return {
      ...produkt,
      calculatedDosage: calculation,
      preis_pro_tag_formatted: this.formatPrice(calculation.preis_pro_tag),
      preis_pro_monat_formatted: this.formatPrice(calculation.preis_pro_monat),
      dosage_details: this.formatDosageDetails(calculation, produkt)
    }
  }
}

// Globale Funktionen für app.js
window.DosageCalculatorFE = DosageCalculatorFE;