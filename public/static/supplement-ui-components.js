// Supplement Stack - UI Components
// Gemeinsame UI-Komponenten für Demo und Production Modus
// Enthält: Modals, Cards, Templates und UI-Elemente

class SupplementUIComponents {
  constructor() {
    this.modalIdCounter = 0
  }

  // === PRODUCT CARD TEMPLATES ===
  
  renderProductCard(product, permissions = {}) {
    const productData = this.normalizeProductData(product)
    const intakeTime = this.getProductIntakeTime(product)
    const labelColor = this.getIntakeTimeLabelColor(intakeTime)
    
    return `
      <div class="bg-white border-0 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
        <!-- Gradient Overlay für Premium-Look -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500"></div>
        
        <!-- Checkbox mit modernem Design -->
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center space-x-2">
            <!-- Premium Badge falls empfohlen -->
            ${productData.recommended ? `
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200">
                <i class="fas fa-star text-purple-500 mr-1"></i>Top
              </span>
            ` : ''}
          </div>
          <input type="checkbox" class="product-checkbox w-5 h-5 text-emerald-600 rounded-md focus:ring-emerald-500 focus:ring-2" data-product-id="${productData.id}" checked>
        </div>
        
        <!-- Kompaktes Produktbild und Info -->
        <div class="flex items-center mb-4 space-x-3">
          ${productData.product_image ? `
            <div class="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm">
              <img src="${productData.product_image}" alt="${productData.name}" class="w-full h-full object-cover">
            </div>
          ` : `
            <div class="w-14 h-14 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-center shadow-sm">
              <i class="fas fa-pills text-emerald-500 text-lg"></i>
            </div>
          `}
          
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-slate-800 text-sm mb-1 truncate">${productData.name}</h3>
            <p class="text-xs text-slate-500 mb-2 font-medium">${productData.brand}</p>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${labelColor} shadow-sm">
              <i class="fas fa-clock mr-1"></i>${intakeTime}
            </span>
          </div>
        </div>
        
        <!-- Kompakte Info-Grid -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <!-- Dosierung -->
          <div class="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200">
            <div class="text-xs text-slate-600 font-medium mb-1">Dosierung</div>
            <div class="text-sm font-bold text-slate-800">${productData.dosage_per_day || 1} ${this.getPluralForm(productData.dosage_per_day || 1, productData.form)}</div>
            <div class="text-xs text-slate-500">täglich</div>
          </div>
          
          <!-- Vorrat -->
          <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200">
            <div class="text-xs text-blue-600 font-medium mb-1">Vorrat</div>
            <div class="text-sm font-bold text-blue-800">${Math.floor((productData.quantity || 30) / (productData.dosage_per_day || 1))}</div>
            <div class="text-xs text-blue-500">Tage</div>
          </div>
        </div>
        
        <!-- Preise mit modernem Design -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="text-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200">
            <div class="text-xs text-slate-600 font-medium">Einmalig</div>
            <div class="text-lg font-bold text-slate-800">€${(productData.purchase_price || productData.monthly_cost * 2 || 19.90).toFixed(2)}</div>
          </div>
          <div class="text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200">
            <div class="text-xs text-emerald-600 font-medium">Monatlich</div>
            <div class="text-lg font-bold text-emerald-700">€${(productData.monthly_cost || 11.94).toFixed(2)}</div>
          </div>
        </div>
        
        <!-- Action Buttons für Edit/Delete -->
        <div class="flex gap-2">
          <button data-action="edit-product" data-product-id="${productData.id}" class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:ring-4 focus:ring-blue-200 focus:outline-none text-sm">
            <i class="fas fa-edit mr-2"></i>Bearbeiten
          </button>
          <button data-action="delete-product" data-product-id="${productData.id}" class="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3 px-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:ring-4 focus:ring-red-200 focus:outline-none text-sm">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        
        <!-- Hover-Effekt Shine -->
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transition-opacity duration-500 pointer-events-none transform -skew-x-12 -translate-x-full hover:translate-x-full"></div>
      </div>
    `
  }

  // === MODAL TEMPLATES ===

  createAddProductModal(stacks, isDemo = false) {
    return `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 38rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">
              <i class="fas fa-plus mr-2 text-green-600"></i>
              Produkt hinzufügen
            </h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Schritt 1: Wirkstoffsuche -->
          <div id="step-nutrient-search" class="step-container">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-blue-900 mb-3 flex items-center">
                <i class="fas fa-search mr-2"></i>
                Wirkstoff suchen
              </h3>
              
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Nach Wirkstoff suchen</label>
                <div class="relative">
                  <input type="text" id="nutrient-search" placeholder="z.B. D3, Cobalamin, Magnesium..." class="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                  <i class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                </div>
                <p class="text-xs text-gray-500 mt-1">Beginnen Sie zu tippen, um Wirkstoffe zu finden</p>
              </div>
              
              <!-- Suchergebnisse -->
              <div id="nutrient-search-results" class="space-y-2 hidden">
                <!-- Wird dynamisch gefüllt -->
              </div>
            </div>
          </div>

          <!-- Schritt 2: Dosierung festlegen -->
          <div id="step-dosage-selection" class="step-container hidden">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-green-900 mb-3 flex items-center">
                <i class="fas fa-calculator mr-2"></i>
                Dosierung für <span id="dosage-nutrient-name" class="font-bold">-</span> festlegen
              </h3>
              
              <!-- DGE und Studien-Empfehlungen -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div class="text-sm font-medium text-blue-800 mb-1">DGE-Empfehlung</div>
                  <div class="text-lg font-bold text-blue-600" id="dge-recommendation">800IE</div>
                  <button type="button" id="use-dge-dosage" class="mt-2 w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
                    DGE verwenden
                  </button>
                </div>
                
                <div id="study-recommendation-card" class="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div class="text-sm font-medium text-purple-800 mb-1">Studien-Empfehlung</div>
                  <div class="text-lg font-bold text-purple-600" id="study-recommendation">2000IE</div>
                  <button type="button" id="use-study-dosage" class="mt-2 w-full bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700 transition-colors">
                    Studien-Dosierung
                  </button>
                </div>
              </div>
              
              <!-- Eigene Dosierung eingeben -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Gewünschte Tagesdosis <span id="dosage-unit" class="text-green-600">(IE)</span>
                </label>
                <input type="number" id="custom-dosage" step="1" min="1" value="800" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" placeholder="800">
                <p class="text-xs text-gray-500 mt-1">Geben Sie Ihre gewünschte tägliche Menge ein</p>
              </div>
              
              <!-- Sicherheitshinweise -->
              <div id="dosage-safety" class="p-3 rounded-lg border border-yellow-200 bg-yellow-50 mb-4">
                <div class="flex items-start">
                  <i class="fas fa-exclamation-triangle mr-2 mt-0.5 text-yellow-600"></i>
                  <div class="text-sm">
                    <div class="font-medium mb-1 text-yellow-800">Innerhalb DGE-Empfehlung</div>
                    <div class="text-yellow-700">Diese Dosierung entspricht 100% der DGE-Empfehlung.</div>
                  </div>
                </div>
              </div>
              
              <!-- Stack-Auswahl -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen</label>
                <select id="supplement-stack" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white shadow-sm">
                  ${stacks.map(stack => `<option value="${stack.id}">${stack.name}</option>`).join('')}
                </select>
                <p class="text-xs text-gray-500 mt-1">Produkt wird diesem Stack hinzugefügt</p>
              </div>
              
              <!-- Notizen -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Notizen (optional)</label>
                <textarea id="personal-notes" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" placeholder="Persönliche Notizen zu diesem Supplement..."></textarea>
              </div>
            </div>
            
            <div class="flex justify-between items-center">
              <button id="back-to-nutrient-search" class="text-blue-600 hover:text-blue-800 transition-colors text-sm">
                <i class="fas fa-arrow-left mr-1"></i>Zurück zur Suche
              </button>
              <button id="continue-to-products" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                Weiter zu Produkten <i class="fas fa-arrow-right ml-1"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  }

  createEditProductModal(product, isDemo = false) {
    const productData = this.normalizeProductData(product)
    
    if (isDemo) {
      // Demo-Version mit Anmeldungsweiterleitung
      return `
        <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
          <div class="p-4 sm:p-6">
            <div class="flex justify-between items-start mb-4">
              <h2 class="text-lg sm:text-xl font-bold text-gray-900">
                <i class="fas fa-edit mr-2 text-blue-600"></i>
                ${productData.name} bearbeiten
              </h2>
              <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-blue-900 mb-2">✨ Demo-Modus</h3>
              <p class="text-blue-800 text-sm">In der Vollversion können Sie hier das Produkt vollständig bearbeiten:</p>
              <ul class="text-blue-700 text-sm mt-2 list-disc list-inside space-y-1">
                <li>Wirkstoff und Gehalt anpassen</li>
                <li>Preise und Mengen ändern</li>
                <li>Dosierungsempfehlungen bearbeiten</li>
                <li>Live-Kostenberechnungen sehen</li>
              </ul>
            </div>
            
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="text-gray-600">Aktueller Preis</div>
                  <div class="font-semibold">€${(productData.purchase_price || 19.90).toFixed(2)}</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="text-gray-600">Monatliche Kosten</div>
                  <div class="font-semibold">€${(productData.monthly_cost || 11.94).toFixed(2)}</div>
                </div>
              </div>
              
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-gray-600 text-sm">Wirkstoff</div>
                <div class="font-semibold">Unbekannt</div>
                <div class="text-gray-500 text-xs">undefined pro Kapsel</div>
              </div>
            </div>
            
            <div class="mt-6 flex justify-end space-x-3">
              <button class="close-modal bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
                Schließen
              </button>
              <button id="upgrade-to-full" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                <i class="fas fa-external-link-alt mr-2"></i>Vollversion nutzen
              </button>
            </div>
          </div>
        </div>
      `
    } else {
      // Production-Version mit vollständiger Bearbeitungsfunktion
      return `
        <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 40rem; max-height: 95vh; overflow-y: auto;">
          <div class="p-4 sm:p-6">
            <div class="flex justify-between items-start mb-4">
              <h2 class="text-lg sm:text-xl font-bold text-gray-900">
                <i class="fas fa-edit mr-2 text-blue-600"></i>
                ${productData.name} bearbeiten
              </h2>
              <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
                <i class="fas fa-times"></i>
              </button>
            </div>
            
            <form id="edit-product-form" class="space-y-6">
              <!-- Produktname -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Produktname</label>
                <input type="text" id="product-name" value="${productData.name}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" required>
              </div>
              
              <!-- Marke -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Marke</label>
                <input type="text" id="product-brand" value="${productData.brand}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" required>
              </div>
              
              <!-- Preise -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Kaufpreis (€)</label>
                  <input type="number" step="0.01" id="purchase-price" value="${productData.purchase_price || 19.90}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" required>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Monatl. Kosten (€)</label>
                  <input type="number" step="0.01" id="monthly-cost" value="${productData.monthly_cost || 11.94}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" required>
                </div>
              </div>
              
              <!-- Dosierung -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Dosierung pro Tag</label>
                  <input type="number" min="1" id="dosage-per-day" value="${productData.dosage_per_day || 1}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" required>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Menge im Paket</label>
                  <input type="number" min="1" id="package-quantity" value="${productData.quantity || 30}" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" required>
                </div>
              </div>
              
              <div class="flex justify-end space-x-3">
                <button type="button" class="close-modal px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                  Abbrechen
                </button>
                <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                  <i class="fas fa-save mr-2"></i>Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      `
    }
  }

  createCreateStackModal() {
    return `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">
              <i class="fas fa-magic mr-2 text-purple-600"></i>
              Stack erstellen
            </h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <form id="create-stack-form" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Stack-Name</label>
              <input type="text" id="stack-name" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm" placeholder="z.B. Mein Morgen-Stack" required>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
              <textarea id="stack-description" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm" placeholder="Beschreibung des Stacks..."></textarea>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button type="button" class="close-modal px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">
                Abbrechen
              </button>
              <button type="submit" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors">
                <i class="fas fa-plus mr-2"></i>Stack erstellen
              </button>
            </div>
          </form>
        </div>
      </div>
    `
  }

  // === UTILITY FUNCTIONS ===
  
  normalizeProductData(product) {
    // Normalisiert Produktdaten aus verschiedenen Quellen (DB vs Demo)
    return {
      id: product.id,
      name: product.name,
      brand: product.brand,
      form: product.form || 'Kapsel',
      category: product.category,
      
      // Preise - unterstützt verschiedene Strukturen
      monthly_cost: product.monthly_cost || 11.94,
      purchase_price: product.purchase_price || (product.monthly_cost * 2) || 19.90,
      
      // Dosierung und Menge
      dosage_per_day: product.dosage_per_day || 1,
      quantity: product.quantity || product.servings_per_package || 30,
      
      // Status und Bilder
      recommended: product.recommended || false,
      product_image: product.product_image || null,
      
      // Nährstoff-Information falls vorhanden
      main_nutrients: product.main_nutrients || [],
      
      // Beschreibungen
      description: product.description || '',
      benefits: product.benefits || []
    }
  }

  getProductIntakeTime(product) {
    // Logic für Einnahmezeit basierend auf Produkttyp
    const name = (product.name || '').toLowerCase()
    if (name.includes('vitamin d') || name.includes('magnesium')) return 'Zum Frühstück'
    if (name.includes('b12') || name.includes('vitamin c')) return 'Zum Frühstück'
    if (name.includes('omega') || name.includes('kreatin')) return 'Am Abend'
    return 'Zum Frühstück'
  }

  getIntakeTimeLabelColor(intakeTime) {
    // Farb-Schema für verschiedene Einnahmezeiten
    switch (intakeTime) {
      case 'Zum Frühstück': return 'bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 border border-orange-200'
      case 'Am Abend': return 'bg-gradient-to-r from-purple-100 to-indigo-100 text-indigo-700 border border-indigo-200'
      default: return 'bg-gradient-to-r from-green-100 to-emerald-100 text-emerald-700 border border-emerald-200'
    }
  }

  getPluralForm(count, form) {
    // Deutsche Pluralformen
    if (count === 1) {
      return form || 'Stück'
    }
    
    const formLower = (form || 'Stück').toLowerCase()
    if (formLower.includes('kapsel')) return 'Kapseln'
    if (formLower.includes('tablette')) return 'Tabletten'
    if (formLower.includes('tropfen')) return 'Tropfen'
    return form + 'e'
  }

  // === MODAL MANAGEMENT ===
  
  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove())
  }

  createModalOverlay(innerHTML) {
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    modal.innerHTML = innerHTML
    return modal
  }

  // === NOTIFICATIONS ===
  
  showQuickNotification(message, type = 'info', duration = 2000) {
    // Erweiterte notification mit anpassbarer Dauer
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-xl shadow-xl text-sm font-medium max-w-sm transition-all duration-300 transform translate-x-full ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'warning' ? 'bg-yellow-500 text-white' :
      'bg-blue-500 text-white'
    }`
    
    // Icon hinzufügen basierend auf Typ
    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-exclamation-triangle' :
                 'fa-info-circle'
    
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="fas ${icon}"></i>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(notification)
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full')
    }, 10)
    
    // Auto-remove with animation
    setTimeout(() => {
      notification.classList.add('translate-x-full', 'opacity-0')
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove()
        }
      }, 300)
    }, duration)
  }
}

// Global verfügbar machen
window.SupplementUIComponents = SupplementUIComponents
window.supplementUI = new SupplementUIComponents()