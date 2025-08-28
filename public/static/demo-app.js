// Demo App - Supplement Stack
// Vollständige CRUD-Funktionalität ohne Authentifizierung erforderlich

class SupplementDemoApp {
  constructor() {
    this.products = this.loadDemoProducts()
    this.stacks = this.loadDemoStacks()
    this.nutrients = this.loadNutrients()
    this.init()
  }

  init() {
    console.log('[Demo App] Initialisierung startet...')
    this.setupEventListeners()
    this.renderProducts()
    this.renderStacks()
    this.updateStats()
    console.log(`[Demo App] Initialisierung abgeschlossen - ${this.products.length} Produkte geladen`)
  }

  setupEventListeners() {
    // Global verfügbare Funktionen
    window.demoApp = this
    
    // Event Delegation für dynamisch generierte Buttons
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button')
      if (!button) return
      
      const productId = button.dataset.productId
      const action = button.dataset.action
      
      if (productId && action) {
        e.preventDefault()
        switch (action) {
          case 'edit':
            this.editProduct(parseInt(productId))
            break
          case 'delete':
            this.deleteProduct(parseInt(productId))
            break
          case 'details':
            this.showProductDetails(parseInt(productId))
            break
        }
      }
      
      // Produkt hinzufügen Buttons
      if (button.id === 'demo-add-product-mobile' || button.id === 'demo-add-product-desktop' || button.id === 'demo-add-product-main') {
        e.preventDefault()
        this.showAddProductModal()
      }
      
      // Nährstoff-Stack erstellen Buttons
      if (button.id === 'demo-create-stack-mobile' || button.id === 'demo-create-stack-desktop' || button.id === 'demo-create-stack-main') {
        e.preventDefault()
        this.showNutrientBasedStackModal()
      }
    })
  }

  loadDemoProducts() {
    // Realistische Demo-Produkte mit Nährstoff-Zuordnung
    return [
      {
        id: 1,
        name: 'Vitamin D3 4000 IU',
        brand: 'Sunday Natural',
        form: 'Kapsel',
        purchase_price: 19.90,
        quantity: 50,
        price_per_piece: 0.398,
        dosage_per_day: 1,
        days_supply: 50,
        monthly_cost: 11.94,
        description: 'Hochdosiertes Vitamin D3 (Cholecalciferol) aus Lanolin',
        benefits: ['Unterstützt das Immunsystem', 'Wichtig für Knochen und Zähne', 'Trägt zur normalen Muskelfunktion bei'],
        warnings: ['Nicht über 4000 IU täglich', 'Bei Nierensteinen Arzt konsultieren'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Vitamine',
        image_url: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300',
        nutrient_id: 1, // Vitamin D3
        nutrient_amount_per_unit: 100, // 100µg = 4000 IU
        shop_url: 'https://example.com/vitamin-d3'
      },
      {
        id: 2,
        name: 'B12 Methylcobalamin',
        brand: 'InnoNature',
        form: 'Tropfen',
        purchase_price: 24.90,
        quantity: 60,
        price_per_piece: 0.415,
        dosage_per_day: 0.5,
        days_supply: 120,
        monthly_cost: 6.23,
        description: 'Bioaktives Vitamin B12 als Methylcobalamin',
        benefits: ['Reduziert Müdigkeit', 'Unterstützt Nervensystem', 'Wichtig für Blutbildung'],
        warnings: ['Hochdosiert - nicht für Schwangere ohne Rücksprache'],
        dosage_recommendation: '0.5ml (10 Tropfen) jeden zweiten Tag',
        category: 'Vitamine',
        image_url: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=300',
        nutrient_id: 2, // Vitamin B12
        nutrient_amount_per_unit: 200, // 200µg pro 0.5ml
        shop_url: 'https://example.com/b12-tropfen'
      },
      {
        id: 3,
        name: 'Magnesium Glycinat',
        brand: 'Biomenta',
        form: 'Kapsel',
        purchase_price: 16.90,
        quantity: 60,
        price_per_piece: 0.282,
        dosage_per_day: 1,
        days_supply: 60,
        monthly_cost: 8.45,
        description: 'Hochwertiges Magnesium in Glycinat-Form für optimale Aufnahme',
        benefits: ['Entspannt Muskeln', 'Unterstützt Energiestoffwechsel', 'Gut verträglich'],
        warnings: ['Bei Nierenproblemen Arzt konsultieren'],
        dosage_recommendation: '1 Kapsel abends vor dem Schlafengehen',
        category: 'Mineralstoffe',
        image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
        nutrient_id: 4, // Magnesium
        nutrient_amount_per_unit: 400, // 400mg pro Kapsel
        shop_url: 'https://example.com/magnesium'
      },
      {
        id: 4,
        name: 'Omega-3 Algenöl',
        brand: 'Norsan',
        form: 'Öl',
        purchase_price: 29.90,
        quantity: 100,
        price_per_piece: 0.299,
        dosage_per_day: 1,
        days_supply: 100,
        monthly_cost: 8.97,
        description: 'Veganes Omega-3 aus Mikroalgen mit EPA und DHA',
        benefits: ['Herzgesundheit', 'Gehirnfunktion', 'Entzündungshemmend'],
        warnings: ['Nicht mit Blutverdünnern kombinieren ohne Rücksprache'],
        dosage_recommendation: '5ml täglich zu einer Mahlzeit',
        category: 'Fettsäuren',
        image_url: 'https://images.unsplash.com/photo-1615485925467-eb78e3d5d8d3?w=300',
        nutrient_id: 7, // EPA (Omega-3 hat sowohl EPA als auch DHA, hier EPA als Haupt-Nährstoff)
        nutrient_amount_per_unit: 1000, // 1000mg EPA+DHA pro 5ml
        shop_url: 'https://example.com/omega-3'
      {
        id: 5,
        name: 'Zink Bisglycinat',
        brand: 'Pure Encapsulations',
        form: 'Kapsel',
        purchase_price: 22.50,
        quantity: 60,
        price_per_piece: 0.375,
        dosage_per_day: 1,
        days_supply: 60,
        monthly_cost: 11.25,
        description: 'Hochbioverfügbares Zink in chelatierter Form',
        benefits: ['Immunsystem', 'Wundheilung', 'Haare, Haut, Nägel'],
        warnings: ['Nicht auf nüchternen Magen', 'Kann Kupfermangel verstärken'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Mineralstoffe',
        image_url: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=300',
        nutrient_id: 5, // Zink
        nutrient_amount_per_unit: 15, // 15mg pro Kapsel
        shop_url: 'https://example.com/zink'
      {
        id: 6,
        name: 'Vitamin C Ester',
        brand: 'Life Extension',
        form: 'Kapsel',
        purchase_price: 18.90,
        quantity: 90,
        price_per_piece: 0.21,
        dosage_per_day: 1,
        days_supply: 90,
        monthly_cost: 6.30,
        description: 'Magenschonendes Vitamin C als Calcium-Ascorbat',
        benefits: ['Antioxidans', 'Immunsystem', 'Kollagenbildung'],
        warnings: ['Bei Nierensteinen vorsichtig dosieren'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Vitamine',
        image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300',
        nutrient_id: 3, // Vitamin C
        nutrient_amount_per_unit: 1000, // 1000mg pro Kapsel
        shop_url: 'https://example.com/vitamin-c'
    ]
  }

  loadNutrients() {
    return [
      // Vitamine
      { id: 1, name: 'Vitamin D3', category: 'Vitamine', unit: 'µg', dge_recommended: 20, study_recommended: 75, warning_threshold: 100, description: 'Wichtig für Knochen, Immunsystem und Muskelfunktion' },
      { id: 2, name: 'Vitamin B12', category: 'Vitamine', unit: 'µg', dge_recommended: 4, study_recommended: 250, warning_threshold: 1000, description: 'Essentiell für Nervensystem und Blutbildung' },
      { id: 3, name: 'Vitamin C', category: 'Vitamine', unit: 'mg', dge_recommended: 110, study_recommended: 1000, warning_threshold: 2000, description: 'Antioxidans und wichtig für Immunsystem' },
      
      // Mineralstoffe
      { id: 4, name: 'Magnesium', category: 'Mineralstoffe', unit: 'mg', dge_recommended: 375, study_recommended: 400, warning_threshold: 600, description: 'Wichtig für Muskeln, Nerven und Energiestoffwechsel' },
      { id: 5, name: 'Zink', category: 'Mineralstoffe', unit: 'mg', dge_recommended: 10, study_recommended: 15, warning_threshold: 25, description: 'Wichtig für Immunsystem und Wundheilung' },
      { id: 6, name: 'Eisen', category: 'Mineralstoffe', unit: 'mg', dge_recommended: 15, study_recommended: 18, warning_threshold: 45, description: 'Essentiell für Sauerstofftransport' },
      
      // Fettsäuren
      { id: 7, name: 'EPA', category: 'Fettsäuren', unit: 'mg', dge_recommended: 250, study_recommended: 1000, warning_threshold: 3000, description: 'Omega-3 Fettsäure für Herz und Gehirn' },
      { id: 8, name: 'DHA', category: 'Fettsäuren', unit: 'mg', dge_recommended: 250, study_recommended: 1000, warning_threshold: 3000, description: 'Omega-3 Fettsäure für Gehirn und Augen' }
    ]
  }

  loadDemoStacks() {
    return [
      {
        id: 1,
        name: 'Grundausstattung',
        products: [
          { product_id: 1, dosage: 1 },
          { product_id: 2, dosage: 0.5 },
          { product_id: 3, dosage: 1 }
        ],
        total_cost: 26.62,
        description: 'Basis-Stack für die tägliche Versorgung'
      },
      {
        id: 2,
        name: 'Immunsystem Boost',
        products: [
          { product_id: 1, dosage: 1 },
          { product_id: 6, dosage: 1 },
          { product_id: 5, dosage: 1 }
        ],
        total_cost: 29.49,
        description: 'Optimiert für die Immunabwehr'
      }
    ]
  }

  renderProducts() {
    const grid = document.getElementById('demo-products-grid')
    const fallback = document.getElementById('demo-fallback')
    
    if (!grid) {
      console.error('[Demo App] Produkte-Grid nicht gefunden!')
      if (fallback) {
        fallback.style.display = 'block'
      }
      return
    }

    try {
      const html = this.products.map(product => this.renderProductCard(product)).join('')
      grid.innerHTML = html
      
      // Fallback verstecken wenn erfolgreich
      if (fallback) {
        fallback.style.display = 'none'
      }
      
      console.log(`[Demo App] ${this.products.length} Produkte gerendert`)
    } catch (error) {
      console.error('[Demo App] Fehler beim Rendern der Produkte:', error)
      if (fallback) {
        fallback.style.display = 'block'
      }
    }
  }

  renderProductCard(product) {
    return `
      <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        <div class="p-3 sm:p-4">
          <div class="flex items-start justify-between mb-2">
            <h3 class="font-semibold text-gray-900 text-sm sm:text-base flex-1 pr-2">${product.name}</h3>
            <div class="flex space-x-1">
              <button data-product-id="${product.id}" data-action="edit" class="p-1 text-gray-400 hover:text-blue-600 touch-target" title="Bearbeiten">
                <i class="fas fa-edit text-sm"></i>
              </button>
              <button data-product-id="${product.id}" data-action="delete" class="p-1 text-gray-400 hover:text-red-600 touch-target" title="Löschen">
                <i class="fas fa-trash text-sm"></i>
              </button>
            </div>
          </div>
          
          <p class="text-xs sm:text-sm text-gray-600 mb-3">${product.brand} • ${product.form}</p>
          
          <div class="space-y-1 text-xs text-gray-600 mb-3">
            <div class="flex justify-between">
              <span class="truncate pr-2">${product.category}</span>
              <span class="font-medium">${product.dosage_per_day}x täglich</span>
            </div>
          </div>
          
          <!-- Kostenbereich - Mobile optimiert -->
          <div class="bg-gray-50 rounded-lg p-2 sm:p-3 mb-3">
            <div class="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div>
                <span class="text-gray-500">Kaufpreis:</span>
                <div class="font-semibold text-gray-900">€${product.purchase_price.toFixed(2)}</div>
              </div>
              <div>
                <span class="text-gray-500">Pro Monat:</span>
                <div class="font-semibold text-green-600">€${product.monthly_cost.toFixed(2)}</div>
              </div>
            </div>
            <div class="text-xs text-gray-400 mt-1 sm:mt-2">
              ${product.quantity} ${product.form === 'Tropfen' ? 'Portionen' : product.form} • Hält ${product.days_supply} Tage
            </div>
          </div>
          
          <div class="flex justify-between items-center">
            <button data-product-id="${product.id}" data-action="details" class="bg-blue-600 text-white px-3 py-1 sm:px-4 sm:py-2 rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors">
              <i class="fas fa-eye mr-1"></i><span class="hidden sm:inline">Details</span>
            </button>
            <div class="text-xs text-gray-500">
              <i class="fas fa-info-circle mr-1"></i>${product.benefits.length} Vorteile
            </div>
          </div>
        </div>
      </div>
    `
  }

  showProductDetails(productId) {
    console.log('[Demo App] Zeige Produkt-Details für ID:', productId)
    const product = this.products.find(p => p.id === productId)
    if (!product) {
      console.error('[Demo App] Produkt nicht gefunden:', productId)
      return
    }

    // Schließe andere Modals
    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.right = '0'
    modal.style.bottom = '0'
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '9999'
    modal.style.padding = '16px'
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">${product.name}</h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Tab Navigation -->
          <div class="border-b border-gray-200 mb-4">
            <nav class="flex space-x-4" role="tablist">
              <button class="product-tab active px-3 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-600" data-tab="overview">
                Übersicht
              </button>
              <button class="product-tab px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="nutrient">
                Nährstoff
              </button>
              <button class="product-tab px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="dosage">
                Dosierung
              </button>
              <button class="product-tab px-3 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="costs">
                Kosten
              </button>
            </nav>
          </div>

          <!-- Tab Contents -->
          <div class="tab-content">
            <!-- Übersicht Tab -->
            <div id="tab-overview" class="tab-pane active">
              <div class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-3">Produktinfo</h3>
                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-gray-600">Marke:</span>
                        <span class="font-medium">${product.brand}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Form:</span>
                        <span class="font-medium">${product.form}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600">Packungsgröße:</span>
                        <span class="font-medium">${product.quantity} Stück</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-3">Beschreibung</h3>
                    <p class="text-sm text-gray-600 leading-relaxed">${product.description}</p>
                  </div>
                </div>
                
                <div>
                  <h3 class="font-semibold text-gray-900 mb-3">Wofür ist es gut?</h3>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${product.benefits.map(benefit => `
                      <div class="flex items-start text-sm">
                        <i class="fas fa-check-circle text-green-500 mr-2 mt-0.5 flex-shrink-0"></i>
                        <span class="text-gray-700">${benefit}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>

            <!-- Nährstoff Tab -->
            <div id="tab-nutrient" class="tab-pane hidden">
              ${this.renderNutrientInfo(product)}
            </div>

            <!-- Dosierung Tab -->
            <div id="tab-dosage" class="tab-pane hidden">
              <div class="space-y-4">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 class="font-semibold text-blue-900 mb-2">Empfohlene Dosierung</h3>
                  <p class="text-blue-800">${product.dosage_recommendation}</p>
                </div>
                
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 class="font-semibold text-yellow-800 mb-2">Wichtige Hinweise</h3>
                  <ul class="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    ${product.warnings.map(warning => `<li>${warning}</li>`).join('')}
                  </ul>
                </div>
              </div>
            </div>

            <!-- Kosten Tab -->
            <div id="tab-costs" class="tab-pane hidden">
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-gray-50 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-gray-900">€${product.purchase_price.toFixed(2)}</div>
                    <div class="text-sm text-gray-600">Kaufpreis</div>
                  </div>
                  <div class="bg-green-50 rounded-lg p-4 text-center">
                    <div class="text-2xl font-bold text-green-600">€${product.monthly_cost.toFixed(2)}</div>
                    <div class="text-sm text-gray-600">Pro Monat</div>
                  </div>
                </div>
                
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Pro Stück:</span>
                    <span class="font-medium">€${product.price_per_piece.toFixed(3)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Reicht für:</span>
                    <span class="font-medium">${product.days_supply} Tage</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Pro Tag:</span>
                    <span class="font-medium">€${(product.monthly_cost / 30).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-6 flex justify-end space-x-3">
            <button onclick="window.demoApp && window.demoApp.editProduct(${product.id}); this.closest('.modal-overlay').remove()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              <i class="fas fa-edit mr-2"></i>Bearbeiten
            </button>
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Schließen
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    console.log('[Demo App] Modal zu Body hinzugefügt')
    
    // Event-Listener für Modal-Schließen
    const closeBtn = modal.querySelector('.close-modal')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('[Demo App] Modal wird geschlossen')
        modal.remove()
      })
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('[Demo App] Modal durch Klick außerhalb geschlossen')
        modal.remove()
      }
    })
    
    // Event-Listener für Tab-Switching
    const tabButtons = modal.querySelectorAll('.product-tab')
    const tabPanes = modal.querySelectorAll('.tab-pane')
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab
        
        // Alle Tabs deaktivieren
        tabButtons.forEach(btn => {
          btn.classList.remove('active', 'border-blue-500', 'text-blue-600')
          btn.classList.add('border-transparent', 'text-gray-500')
        })
        
        // Alle Tab-Inhalte verstecken
        tabPanes.forEach(pane => {
          pane.classList.add('hidden')
          pane.classList.remove('active')
        })
        
        // Aktiven Tab aktivieren
        button.classList.add('active', 'border-blue-500', 'text-blue-600')
        button.classList.remove('border-transparent', 'text-gray-500')
        
        // Ziel-Tab-Inhalt anzeigen
        const targetPane = modal.querySelector(`#tab-${targetTab}`)
        if (targetPane) {
          targetPane.classList.remove('hidden')
          targetPane.classList.add('active')
        }
      })
    })
  }
  
  renderNutrientInfo(product) {
    const nutrient = this.nutrients.find(n => n.id === product.nutrient_id)
    
    if (!nutrient) {
      return `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Keine Nährstoffinformationen verfügbar</p>
          <p class="text-sm">Dieses Produkt ist noch nicht einem Wirkstoff zugeordnet.</p>
        </div>
      `
    }
    
    const amountPerUnit = product.nutrient_amount_per_unit || 0
    const dailyAmount = amountPerUnit * (product.dosage_per_day || 1)
    const dgePercent = Math.round((dailyAmount / nutrient.dge_recommended) * 100)
    const studyPercent = Math.round((dailyAmount / nutrient.study_recommended) * 100)
    
    return `
      <div class="space-y-4">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-center mb-3">
            <div class="bg-blue-100 rounded-full p-2 mr-3">
              <i class="fas fa-flask text-blue-600"></i>
            </div>
            <div>
              <h3 class="font-semibold text-blue-900">${nutrient.name}</h3>
              <p class="text-sm text-blue-700">${nutrient.category}</p>
            </div>
          </div>
          <p class="text-sm text-blue-800">${nutrient.description}</p>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-2">Gehalt pro Einheit</h4>
            <div class="text-2xl font-bold text-gray-900">${amountPerUnit} ${nutrient.unit}</div>
            <div class="text-sm text-gray-600">pro ${product.form}</div>
          </div>
          
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="font-semibold text-gray-900 mb-2">Tägliche Aufnahme</h4>
            <div class="text-2xl font-bold text-green-600">${dailyAmount} ${nutrient.unit}</div>
            <div class="text-sm text-gray-600">bei ${product.dosage_per_day}x täglich</div>
          </div>
        </div>
        
        <div class="space-y-3">
          <h4 class="font-semibold text-gray-900">Empfehlungsvergleich</h4>
          
          <div class="bg-green-50 border border-green-200 rounded-lg p-3">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-green-800">DGE-Empfehlung</span>
              <span class="text-sm font-bold text-green-600">${dgePercent}%</span>
            </div>
            <div class="w-full bg-green-200 rounded-full h-2">
              <div class="bg-green-600 h-2 rounded-full" style="width: ${Math.min(dgePercent, 100)}%"></div>
            </div>
            <div class="text-xs text-green-700 mt-1">${nutrient.dge_recommended} ${nutrient.unit} täglich empfohlen</div>
          </div>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-blue-800">Studien-basiert</span>
              <span class="text-sm font-bold text-blue-600">${studyPercent}%</span>
            </div>
            <div class="w-full bg-blue-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full" style="width: ${Math.min(studyPercent, 100)}%"></div>
            </div>
            <div class="text-xs text-blue-700 mt-1">${nutrient.study_recommended} ${nutrient.unit} täglich empfohlen</div>
          </div>
          
          ${dailyAmount > nutrient.warning_threshold ? `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div class="flex items-center text-yellow-800">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span class="text-sm font-medium">Achtung: Hohe Dosierung</span>
              </div>
              <p class="text-xs text-yellow-700 mt-1">Über ${nutrient.warning_threshold} ${nutrient.unit} täglich - bitte mit Arzt absprechen</p>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  showAddProductModal() {
    console.log('[Demo App] Zeige Add Product Modal')
    
    // Schließe andere Modals
    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.right = '0'
    modal.style.bottom = '0'
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '9999'
    modal.style.padding = '16px'
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">Neues Produkt hinzufügen</h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <form id="add-product-form" class="space-y-6">
            <!-- Schritt 1: Wirkstoff auswählen -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 class="font-semibold text-blue-900 mb-3 flex items-center">
                <i class="fas fa-flask mr-2"></i>
                Schritt 1: Wirkstoff auswählen
              </h3>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Hauptwirkstoff</label>
                <select name="nutrient_id" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                  <option value="">Wirkstoff auswählen</option>
                  ${this.nutrients.map(nutrient => `
                    <option value="${nutrient.id}" data-category="${nutrient.category}" data-unit="${nutrient.unit}">
                      ${nutrient.name} (${nutrient.category}) - DGE: ${nutrient.dge_recommended}${nutrient.unit}
                    </option>
                  `).join('')}
                </select>
                <p class="text-xs text-gray-500 mt-1">Der Hauptwirkstoff, den dieses Produkt liefert</p>
              </div>
            </div>

            <!-- Schritt 2: Produktinformationen -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                <i class="fas fa-box mr-2"></i>
                Schritt 2: Produktinformationen
              </h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Produktname</label>
                  <input type="text" name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="z.B. Qidosha Magnesiumcitrat">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Marke</label>
                  <input type="text" name="brand" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="z.B. Sunday Natural">
                </div>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Darreichungsform</label>
                  <select name="form" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                    <option value="">Auswählen</option>
                    <option value="Kapsel">Kapsel</option>
                    <option value="Tropfen">Tropfen</option>
                    <option value="Pulver">Pulver</option>
                    <option value="Öl">Öl</option>
                    <option value="Tablette">Tablette</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Packungsgröße</label>
                  <input type="number" name="quantity" required min="1" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="60">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Kaufpreis (€)</label>
                  <input type="number" name="purchase_price" required step="0.01" min="0.01" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="19.90">
                </div>
              </div>
            </div>

            <!-- Schritt 3: Wirkstoffgehalt -->
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 class="font-semibold text-green-900 mb-3 flex items-center">
                <i class="fas fa-calculator mr-2"></i>
                Schritt 3: Wirkstoffgehalt pro Einheit
              </h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Gehalt pro Einheit
                    <span id="nutrient-unit-display" class="text-blue-600 font-medium"></span>
                  </label>
                  <input type="number" name="nutrient_amount_per_unit" required step="0.01" min="0.01" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" placeholder="760">
                  <p class="text-xs text-gray-500 mt-1">Wie viel vom Wirkstoff ist in einer Einheit enthalten?</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Empfohlene Tagesdosis</label>
                  <input type="number" name="dosage_per_day" required step="0.1" min="0.1" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" placeholder="1" value="1">
                  <p class="text-xs text-gray-500 mt-1">Wie viele Einheiten täglich empfohlen?</p>
                </div>
              </div>
              
              <!-- Live-Berechnung -->
              <div id="dosage-calculation" class="mt-4 p-3 bg-white rounded-lg border border-green-200 hidden">
                <h4 class="font-medium text-green-800 mb-2">Automatische Berechnung:</h4>
                <div class="text-sm text-green-700 space-y-1">
                  <div>Tägliche Aufnahme: <span id="daily-intake">-</span></div>
                  <div>DGE-Abdeckung: <span id="dge-coverage">-</span></div>
                  <div>Packung reicht für: <span id="supply-duration">-</span></div>
                </div>
              </div>
            </div>
            
            <!-- Zusätzliche Angaben -->
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
                <textarea name="description" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" rows="2" placeholder="Kurze Beschreibung des Produkts"></textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Dosierungsempfehlung</label>
                <input type="text" name="dosage_recommendation" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" placeholder="1 Kapsel täglich zu einer Mahlzeit">
              </div>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
                Abbrechen
              </button>
              <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                <i class="fas fa-plus mr-2"></i>Hinzufügen
              </button>
            </div>
          </form>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Event-Listener für das Formular
    const form = modal.querySelector('#add-product-form')
    if (form) {
      // Wirkstoff-Auswahl Handler
      const nutrientSelect = form.querySelector('select[name="nutrient_id"]')
      const unitDisplay = form.querySelector('#nutrient-unit-display')
      const categorySelect = form.querySelector('select[name="category"]')
      const dosageCalculation = form.querySelector('#dosage-calculation')
      
      if (nutrientSelect) {
        nutrientSelect.addEventListener('change', (e) => {
          const selectedOption = e.target.selectedOptions[0]
          if (selectedOption && selectedOption.value) {
            const unit = selectedOption.dataset.unit
            const category = selectedOption.dataset.category
            
            // Einheit anzeigen
            if (unitDisplay) {
              unitDisplay.textContent = `(${unit})`
            }
            
            // Kategorie automatisch setzen
            if (categorySelect) {
              categorySelect.value = category
            }
            
            // Berechnungsfeld einblenden
            if (dosageCalculation) {
              dosageCalculation.classList.remove('hidden')
            }
            
            this.updateDosageCalculation(form)
          } else {
            if (unitDisplay) unitDisplay.textContent = ''
            if (dosageCalculation) dosageCalculation.classList.add('hidden')
          }
        })
      }
      
      // Live-Berechnung für Dosierung
      const calculateFields = ['nutrient_amount_per_unit', 'dosage_per_day', 'quantity', 'purchase_price']
      calculateFields.forEach(fieldName => {
        const field = form.querySelector(`input[name="${fieldName}"]`)
        if (field) {
          field.addEventListener('input', () => this.updateDosageCalculation(form))
        }
      })
      
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        try {
          const success = this.addProduct(new FormData(form))
          if (success) {
            modal.remove() // Only close modal if product was added successfully
          }
        } catch (error) {
          console.error('Fehler beim Hinzufügen:', error)
          this.showError('Fehler beim Hinzufügen des Produkts')
        }
      })
    }

    // Event-Listener für Modal-Schließen
    const closeBtn = modal.querySelector('.close-modal')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('[Demo App] Add Product Modal wird geschlossen')
        modal.remove()
      })
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('[Demo App] Add Product Modal durch Klick außerhalb geschlossen')
        modal.remove()
      }
    })
  }

  editProduct(productId) {
    console.log('[Demo App] Zeige Edit Product Modal für ID:', productId)
    const product = this.products.find(p => p.id === productId)
    if (!product) {
      console.error('[Demo App] Produkt für Bearbeitung nicht gefunden:', productId)
      return
    }

    // Schließe andere Modals
    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.right = '0'
    modal.style.bottom = '0'
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '9999'
    modal.style.padding = '16px'
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">Produkt bearbeiten</h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <form id="edit-product-form" class="space-y-6">
            <!-- Wirkstoff-Information -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 class="font-semibold text-blue-900 mb-3 flex items-center">
                <i class="fas fa-flask mr-2"></i>
                Wirkstoff
              </h3>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Hauptwirkstoff</label>
                <select name="nutrient_id" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                  <option value="">Wirkstoff auswählen</option>
                  ${this.nutrients.map(nutrient => `
                    <option value="${nutrient.id}" data-category="${nutrient.category}" data-unit="${nutrient.unit}" ${product.nutrient_id === nutrient.id ? 'selected' : ''}>
                      ${nutrient.name} (${nutrient.category}) - DGE: ${nutrient.dge_recommended}${nutrient.unit}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Produktinformationen -->
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 class="font-semibold text-gray-900 mb-3 flex items-center">
                <i class="fas fa-box mr-2"></i>
                Produktinformationen
              </h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Produktname</label>
                  <input type="text" name="name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" value="${product.name}">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Marke</label>
                  <input type="text" name="brand" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" value="${product.brand}">
                </div>
              </div>
              
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Darreichungsform</label>
                  <select name="form" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                    <option value="Kapsel" ${product.form === 'Kapsel' ? 'selected' : ''}>Kapsel</option>
                    <option value="Tropfen" ${product.form === 'Tropfen' ? 'selected' : ''}>Tropfen</option>
                    <option value="Pulver" ${product.form === 'Pulver' ? 'selected' : ''}>Pulver</option>
                    <option value="Öl" ${product.form === 'Öl' ? 'selected' : ''}>Öl</option>
                    <option value="Tablette" ${product.form === 'Tablette' ? 'selected' : ''}>Tablette</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Packungsgröße</label>
                  <input type="number" name="quantity" required min="1" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" value="${product.quantity}">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Kaufpreis (€)</label>
                  <input type="number" name="purchase_price" required step="0.01" min="0.01" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" value="${product.purchase_price}">
                </div>
              </div>
            </div>

            <!-- Wirkstoffgehalt und Dosierung -->
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 class="font-semibold text-green-900 mb-3 flex items-center">
                <i class="fas fa-calculator mr-2"></i>
                Wirkstoffgehalt und Dosierung
              </h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Gehalt pro Einheit
                    <span id="edit-nutrient-unit-display" class="text-blue-600 font-medium"></span>
                  </label>
                  <input type="number" name="nutrient_amount_per_unit" required step="0.01" min="0.01" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" value="${product.nutrient_amount_per_unit || ''}">
                  <p class="text-xs text-gray-500 mt-1">Wirkstoffgehalt pro Einheit (Kapsel/Tropfen etc.)</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Empfohlene Tagesdosis</label>
                  <input type="number" name="dosage_per_day" required step="0.1" min="0.1" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" value="${product.dosage_per_day}">
                  <p class="text-xs text-gray-500 mt-1">Anzahl Einheiten täglich</p>
                </div>
              </div>
              
              <!-- Live-Berechnung für Edit -->
              <div id="edit-dosage-calculation" class="mt-4 p-3 bg-white rounded-lg border border-green-200 hidden">
                <h4 class="font-medium text-green-800 mb-2">Aktuelle Berechnung:</h4>
                <div class="text-sm text-green-700 space-y-1">
                  <div>Tägliche Aufnahme: <span id="edit-daily-intake">-</span></div>
                  <div>DGE-Abdeckung: <span id="edit-dge-coverage">-</span></div>
                  <div>Packung reicht für: <span id="edit-supply-duration">-</span></div>
                </div>
              </div>
            </div>
            
            <!-- Zusätzliche Angaben -->
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
                <textarea name="description" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" rows="2">${product.description || ''}</textarea>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Dosierungsempfehlung</label>
                <input type="text" name="dosage_recommendation" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm" value="${product.dosage_recommendation || ''}">
              </div>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
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
    
    document.body.appendChild(modal)
    
    // Event-Listener für das Formular
    const form = modal.querySelector('#edit-product-form')
    if (form) {
      // Wirkstoff-Auswahl Handler für Edit
      const nutrientSelect = form.querySelector('select[name="nutrient_id"]')
      const unitDisplay = form.querySelector('#edit-nutrient-unit-display')
      const dosageCalculation = form.querySelector('#edit-dosage-calculation')
      
      // Initial setup for existing product
      if (nutrientSelect && product.nutrient_id) {
        const selectedOption = nutrientSelect.querySelector(`option[value="${product.nutrient_id}"]`)
        if (selectedOption && unitDisplay) {
          const unit = selectedOption.dataset.unit
          unitDisplay.textContent = `(${unit})`
          dosageCalculation?.classList.remove('hidden')
        }
      }
      
      if (nutrientSelect) {
        nutrientSelect.addEventListener('change', (e) => {
          const selectedOption = e.target.selectedOptions[0]
          if (selectedOption && selectedOption.value) {
            const unit = selectedOption.dataset.unit
            
            // Einheit anzeigen
            if (unitDisplay) {
              unitDisplay.textContent = `(${unit})`
            }
            
            // Berechnungsfeld einblenden
            if (dosageCalculation) {
              dosageCalculation.classList.remove('hidden')
            }
            
            this.updateEditDosageCalculation(form)
          } else {
            if (unitDisplay) unitDisplay.textContent = ''
            if (dosageCalculation) dosageCalculation.classList.add('hidden')
          }
        })
      }
      
      // Live-Berechnung für Edit
      const calculateFields = ['nutrient_amount_per_unit', 'dosage_per_day', 'quantity', 'purchase_price']
      calculateFields.forEach(fieldName => {
        const field = form.querySelector(`input[name="${fieldName}"]`)
        if (field) {
          field.addEventListener('input', () => this.updateEditDosageCalculation(form))
        }
      })
      
      // Initial calculation
      this.updateEditDosageCalculation(form)
      
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        try {
          const success = this.updateProduct(productId, new FormData(form))
          if (success) {
            modal.remove() // Only close modal if product was updated successfully
          }
        } catch (error) {
          console.error('Fehler beim Bearbeiten:', error)
          this.showError('Fehler beim Bearbeiten des Produkts')
        }
      })
    }

    // Event-Listener für Modal-Schließen
    const closeBtn = modal.querySelector('.close-modal')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('[Demo App] Edit Product Modal wird geschlossen')
        modal.remove()
      })
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('[Demo App] Edit Product Modal durch Klick außerhalb geschlossen')
        modal.remove()
      }
    })
  }

  updateDosageCalculation(form) {
    const nutrientId = parseInt(form.querySelector('select[name="nutrient_id"]')?.value)
    const amountPerUnit = parseFloat(form.querySelector('input[name="nutrient_amount_per_unit"]')?.value) || 0
    const dosagePerDay = parseFloat(form.querySelector('input[name="dosage_per_day"]')?.value) || 0
    const quantity = parseInt(form.querySelector('input[name="quantity"]')?.value) || 0
    const purchasePrice = parseFloat(form.querySelector('input[name="purchase_price"]')?.value) || 0
    
    if (!nutrientId || !amountPerUnit || !dosagePerDay) return
    
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    if (!nutrient) return
    
    const dailyIntake = amountPerUnit * dosagePerDay
    const dgePercent = Math.round((dailyIntake / nutrient.dge_recommended) * 100)
    const supplyDuration = Math.floor(quantity / dosagePerDay)
    
    // Update display elements
    const dailyIntakeEl = form.querySelector('#daily-intake')
    const dgeCoverageEl = form.querySelector('#dge-coverage')
    const supplyDurationEl = form.querySelector('#supply-duration')
    
    if (dailyIntakeEl) {
      dailyIntakeEl.textContent = `${dailyIntake} ${nutrient.unit}`
    }
    if (dgeCoverageEl) {
      dgeCoverageEl.textContent = `${dgePercent}% der DGE-Empfehlung`
      dgeCoverageEl.className = dgePercent >= 100 ? 'font-semibold text-green-600' : 'font-semibold text-orange-600'
    }
    if (supplyDurationEl && quantity > 0) {
      supplyDurationEl.textContent = `${supplyDuration} Tage`
    }
  }

  addProduct(formData) {
    // Validierung
    const name = formData.get('name')
    const brand = formData.get('brand')
    const form = formData.get('form')
    const purchasePrice = parseFloat(formData.get('purchase_price'))
    const quantity = parseInt(formData.get('quantity'))
    const dosagePerDay = parseFloat(formData.get('dosage_per_day'))
    const nutrientId = parseInt(formData.get('nutrient_id'))
    const nutrientAmountPerUnit = parseFloat(formData.get('nutrient_amount_per_unit'))
    
    if (!name || !brand || !form || !purchasePrice || !quantity || !dosagePerDay || !nutrientId || !nutrientAmountPerUnit) {
      this.showError('Bitte füllen Sie alle Pflichtfelder aus.')
      return false
    }
    
    if (purchasePrice <= 0 || quantity <= 0 || dosagePerDay <= 0 || nutrientAmountPerUnit <= 0) {
      this.showError('Preis, Menge, Dosierung und Wirkstoffgehalt müssen größer als 0 sein.')
      return false
    }
    
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    if (!nutrient) {
      this.showError('Ungültiger Wirkstoff ausgewählt.')
      return false
    }
    
    const pricePerPiece = purchasePrice / quantity
    const daysSupply = quantity / dosagePerDay
    const monthlyCost = (purchasePrice / daysSupply) * 30

    const newProduct = {
      id: Math.max(0, ...this.products.map(p => p.id)) + 1,
      name: name.trim(),
      brand: brand.trim(),
      form: form,
      purchase_price: purchasePrice,
      quantity: quantity,
      price_per_piece: pricePerPiece,
      dosage_per_day: dosagePerDay,
      days_supply: Math.floor(daysSupply),
      monthly_cost: monthlyCost,
      description: formData.get('description')?.trim() || '',
      benefits: [`Liefert ${nutrient.name}`, 'Unterstützt die Gesundheit', 'Hochwertige Qualität'],
      warnings: ['Dosierungsempfehlung beachten', 'Bei Überdosierung Arzt konsultieren'],
      dosage_recommendation: formData.get('dosage_recommendation')?.trim() || `${dosagePerDay} ${form} täglich`,
      category: nutrient.category,
      image_url: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=300',
      nutrient_id: nutrientId,
      nutrient_amount_per_unit: nutrientAmountPerUnit,
      shop_url: 'https://example.com/product'
    }

    this.products.push(newProduct)
    this.renderProducts()
    this.renderStacks() // Update Stack display
    this.updateStats()
    this.showSuccess(`Produkt "${name}" erfolgreich hinzugefügt!`)
    return true // Indicate success
  }

  updateEditDosageCalculation(form) {
    const nutrientId = parseInt(form.querySelector('select[name="nutrient_id"]')?.value)
    const amountPerUnit = parseFloat(form.querySelector('input[name="nutrient_amount_per_unit"]')?.value) || 0
    const dosagePerDay = parseFloat(form.querySelector('input[name="dosage_per_day"]')?.value) || 0
    const quantity = parseInt(form.querySelector('input[name="quantity"]')?.value) || 0
    const purchasePrice = parseFloat(form.querySelector('input[name="purchase_price"]')?.value) || 0
    
    if (!nutrientId || !amountPerUnit || !dosagePerDay) return
    
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    if (!nutrient) return
    
    const dailyIntake = amountPerUnit * dosagePerDay
    const dgePercent = Math.round((dailyIntake / nutrient.dge_recommended) * 100)
    const supplyDuration = Math.floor(quantity / dosagePerDay)
    
    // Update display elements
    const dailyIntakeEl = form.querySelector('#edit-daily-intake')
    const dgeCoverageEl = form.querySelector('#edit-dge-coverage')
    const supplyDurationEl = form.querySelector('#edit-supply-duration')
    
    if (dailyIntakeEl) {
      dailyIntakeEl.textContent = `${dailyIntake} ${nutrient.unit}`
    }
    if (dgeCoverageEl) {
      dgeCoverageEl.textContent = `${dgePercent}% der DGE-Empfehlung`
      dgeCoverageEl.className = dgePercent >= 100 ? 'font-semibold text-green-600' : 'font-semibold text-orange-600'
    }
    if (supplyDurationEl && quantity > 0) {
      supplyDurationEl.textContent = `${supplyDuration} Tage`
    }
  }

  updateProduct(productId, formData) {
    const productIndex = this.products.findIndex(p => p.id === productId)
    if (productIndex === -1) {
      this.showError('Produkt nicht gefunden!')
      return false
    }

    // Validierung
    const name = formData.get('name')
    const brand = formData.get('brand')
    const form = formData.get('form')
    const purchasePrice = parseFloat(formData.get('purchase_price'))
    const quantity = parseInt(formData.get('quantity'))
    const dosagePerDay = parseFloat(formData.get('dosage_per_day'))
    const nutrientId = parseInt(formData.get('nutrient_id'))
    const nutrientAmountPerUnit = parseFloat(formData.get('nutrient_amount_per_unit'))
    
    if (!name || !brand || !form || !purchasePrice || !quantity || !dosagePerDay || !nutrientId || !nutrientAmountPerUnit) {
      this.showError('Bitte füllen Sie alle Pflichtfelder aus.')
      return false
    }
    
    if (purchasePrice <= 0 || quantity <= 0 || dosagePerDay <= 0 || nutrientAmountPerUnit <= 0) {
      this.showError('Preis, Menge, Dosierung und Wirkstoffgehalt müssen größer als 0 sein.')
      return false
    }
    
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    if (!nutrient) {
      this.showError('Ungültiger Wirkstoff ausgewählt.')
      return false
    }
    
    const pricePerPiece = purchasePrice / quantity
    const daysSupply = quantity / dosagePerDay
    const monthlyCost = (purchasePrice / daysSupply) * 30

    this.products[productIndex] = {
      ...this.products[productIndex],
      name: name.trim(),
      brand: brand.trim(),
      form: form,
      purchase_price: purchasePrice,
      quantity: quantity,
      price_per_piece: pricePerPiece,
      dosage_per_day: dosagePerDay,
      days_supply: Math.floor(daysSupply),
      monthly_cost: monthlyCost,
      description: formData.get('description')?.trim() || '',
      dosage_recommendation: formData.get('dosage_recommendation')?.trim() || `${dosagePerDay} ${form} täglich`,
      category: nutrient.category,
      nutrient_id: nutrientId,
      nutrient_amount_per_unit: nutrientAmountPerUnit
    }

    this.renderProducts()
    this.renderStacks() // Update Stack display
    this.updateStats()
    this.showSuccess(`Produkt "${name}" erfolgreich aktualisiert!`)
    return true // Indicate success
  }

  deleteProduct(productId) {
    if (confirm('Möchten Sie dieses Produkt wirklich löschen?')) {
      // Remove product from products list
      this.products = this.products.filter(p => p.id !== productId)
      
      // Remove product from all stacks
      this.stacks.forEach(stack => {
        stack.products = stack.products.filter(p => p.product_id !== productId)
        stack.total_cost = this.calculateStackCost(stack)
      })
      
      this.renderProducts()
      this.renderStacks()
      this.updateStats()
      this.showSuccess('Produkt erfolgreich gelöscht!')
    }
  }

  renderStacks() {
    const stacksGrid = document.getElementById('demo-stacks-grid')
    if (!stacksGrid) {
      console.log('[Demo App] Stacks-Grid nicht gefunden - vermutlich nicht auf der Demo-Seite')
      return
    }

    try {
      if (this.stacks.length === 0) {
        stacksGrid.innerHTML = `
          <div class="col-span-full text-center py-8 text-gray-500">
            <i class="fas fa-layer-group text-3xl mb-3"></i>
            <p class="text-lg font-medium mb-2">Noch keine Stacks erstellt</p>
            <p class="text-sm">Erstellen Sie Ihren ersten nährstoffbasierten Stack!</p>
          </div>
        `
        return
      }

      const html = this.stacks.map(stack => this.renderStackCard(stack)).join('')
      stacksGrid.innerHTML = html
      
      console.log(`[Demo App] ${this.stacks.length} Stacks gerendert`)
    } catch (error) {
      console.error('[Demo App] Fehler beim Rendern der Stacks:', error)
      stacksGrid.innerHTML = `
        <div class="col-span-full text-center py-8 text-red-500">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Fehler beim Laden der Stacks</p>
        </div>
      `
    }
  }

  renderStackCard(stack) {
    const stackProducts = stack.products.map(stackProduct => {
      const product = this.products.find(p => p.id === stackProduct.product_id)
      if (!product) return null
      
      const nutrient = this.nutrients.find(n => n.id === product.nutrient_id)
      const dailyIntake = product.nutrient_amount_per_unit * stackProduct.dosage
      
      return {
        product,
        nutrient,
        dosage: stackProduct.dosage,
        dailyIntake
      }
    }).filter(Boolean)

    const totalMonthlyCost = this.calculateStackCost(stack)

    return `
      <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        <div class="p-4 sm:p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-gray-900 text-lg">${stack.name}</h3>
              <p class="text-sm text-gray-600 mt-1">${stack.description || 'Persönlicher Nährstoff-Stack'}</p>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-green-600">€${totalMonthlyCost.toFixed(2)}</div>
              <div class="text-xs text-gray-500">pro Monat</div>
            </div>
          </div>
          
          <div class="space-y-3 mb-4">
            <h4 class="text-sm font-medium text-gray-700 flex items-center">
              <i class="fas fa-pills mr-2 text-blue-500"></i>
              Enthaltene Produkte (${stackProducts.length})
            </h4>
            
            ${stackProducts.length === 0 ? `
              <div class="text-center py-4 text-gray-500">
                <i class="fas fa-plus-circle text-2xl mb-2"></i>
                <p class="text-sm">Noch keine Produkte im Stack</p>
              </div>
            ` : stackProducts.map(item => `
              <div class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div class="flex-1">
                  <div class="font-medium text-gray-900 text-sm">${item.product.name}</div>
                  <div class="text-xs text-gray-600">
                    ${item.dosage}x täglich • ${item.dailyIntake} ${item.nutrient?.unit || ''} ${item.nutrient?.name || ''}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm font-medium text-gray-900">€${((item.product.monthly_cost / item.product.dosage_per_day) * item.dosage).toFixed(2)}</div>
                  <div class="text-xs text-gray-500">pro Monat</div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="flex items-center justify-between pt-3 border-t border-gray-200">
            <div class="text-sm text-gray-600">
              <i class="fas fa-calendar-alt mr-1"></i>
              ${stackProducts.length} Produkte
            </div>
            <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors" onclick="window.demoApp && window.demoApp.showStackDetails(${stack.id})">
              <i class="fas fa-eye mr-1"></i>Details
            </button>
          </div>
        </div>
      </div>
    `
  }

  showStackDetails(stackId) {
    const stack = this.stacks.find(s => s.id === stackId)
    if (!stack) {
      this.showError('Stack nicht gefunden!')
      return
    }
    
    // Show stack details modal (simplified implementation)
    this.showSuccess(`Stack-Details für "${stack.name}" - ${stack.products.length} Produkte, €${this.calculateStackCost(stack).toFixed(2)}/Monat`)
  }

  updateStats() {
    const productsCountEl = document.getElementById('demo-products-count')
    const stacksCountEl = document.getElementById('demo-stacks-count')
    const monthlyCostEl = document.getElementById('demo-monthly-cost')
    const wishlistCountEl = document.getElementById('demo-wishlist-count')

    if (productsCountEl) productsCountEl.textContent = this.products.length
    if (stacksCountEl) stacksCountEl.textContent = this.stacks.length
    if (wishlistCountEl) wishlistCountEl.textContent = '3'
    
    // Berechne die monatlichen Gesamtkosten aller Stacks oder des ersten Stacks
    if (monthlyCostEl) {
      if (this.stacks.length > 0) {
        const myStack = this.stacks.find(s => s.name === 'Mein Stack') || this.stacks[0]
        const totalCost = this.calculateStackCost(myStack)
        monthlyCostEl.textContent = `€${totalCost.toFixed(2)}`
      } else {
        monthlyCostEl.textContent = '€0.00'
      }
    }
  }

  calculateStackCost(stack) {
    return stack.products.reduce((total, stackProduct) => {
      const product = this.products.find(p => p.id === stackProduct.product_id)
      if (product) {
        const adjustedCost = (product.monthly_cost / product.dosage_per_day) * stackProduct.dosage
        return total + adjustedCost
      }
      return total
    }, 0)
  }

  closeAllModals() {
    const existingModals = document.querySelectorAll('.modal-overlay')
    existingModals.forEach(modal => modal.remove())
    console.log('[Demo App] Alle bestehenden Modals geschlossen')
  }

  showSuccess(message) {
    this.showNotification(message, 'success')
  }

  showError(message) {
    this.showNotification(message, 'error')
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
      type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' :
      type === 'error' ? 'bg-red-100 border border-red-400 text-red-700' :
      'bg-blue-100 border border-blue-400 text-blue-700'
    }`
    
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
        <span class="text-sm">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-gray-500 hover:text-gray-700">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, 5000)
  }

  // Neuer nährstoffbasierter Stack-Workflow
  showNutrientBasedStackModal() {
    console.log('[Demo App] Zeige nährstoffbasierten Stack-Builder')
    
    // Schließe andere Modals
    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.right = '0'
    modal.style.bottom = '0'
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '9999'
    modal.style.padding = '16px'
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 40rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">Nährstoffbasierten Stack erstellen</h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Schritt 1: Nährstoff auswählen -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 class="font-semibold text-blue-900 mb-3 flex items-center">
              <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">1</span>
              Nährstoff auswählen
            </h3>
            
            <div class="space-y-3">
              <label class="block text-sm font-medium text-gray-700">Welchen Nährstoff möchten Sie in Ihren Stack aufnehmen?</label>
              <select id="stack-nutrient-select" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                <option value="">Nährstoff auswählen</option>
                ${this.nutrients.map(nutrient => `
                  <option value="${nutrient.id}" data-dge="${nutrient.dge_recommended}" data-study="${nutrient.study_recommended}" data-unit="${nutrient.unit}">
                    ${nutrient.name} (${nutrient.category})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Schritt 2: Gewünschte Menge -->
          <div id="dosage-step" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 hidden">
            <h3 class="font-semibold text-green-900 mb-3 flex items-center">
              <span class="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">2</span>
              Gewünschte tägliche Menge
            </h3>
            
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white rounded-lg p-3 border">
                  <div class="text-sm text-gray-600">DGE-Empfehlung</div>
                  <div id="dge-recommendation" class="text-lg font-semibold text-green-600">-</div>
                  <button type="button" onclick="this.closest('#dosage-step').querySelector('#desired-amount').value = this.closest('#dosage-step').querySelector('#dge-recommendation').dataset.value" class="text-xs text-blue-600 hover:underline">Übernehmen</button>
                </div>
                <div class="bg-white rounded-lg p-3 border">
                  <div class="text-sm text-gray-600">Studien-basiert</div>
                  <div id="study-recommendation" class="text-lg font-semibold text-blue-600">-</div>
                  <button type="button" onclick="this.closest('#dosage-step').querySelector('#desired-amount').value = this.closest('#dosage-step').querySelector('#study-recommendation').dataset.value" class="text-xs text-blue-600 hover:underline">Übernehmen</button>
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Gewünschte tägliche Menge</label>
                <div class="flex items-center space-x-2">
                  <input type="number" id="desired-amount" step="0.1" min="0.1" class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm">
                  <span id="unit-display" class="text-gray-600 font-medium">mg</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Sie können die Empfehlung anpassen oder einen eigenen Wert eingeben</p>
              </div>
            </div>
          </div>

          <!-- Schritt 3: Produktauswahl -->
          <div id="product-step" class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 hidden">
            <h3 class="font-semibold text-purple-900 mb-3 flex items-center">
              <span class="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">3</span>
              Produkt auswählen
            </h3>
            
            <div id="available-products" class="space-y-3">
              <!-- Wird dynamisch gefüllt -->
            </div>
          </div>

          <!-- Schritt 4: Berechnung -->
          <div id="calculation-step" class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 hidden">
            <h3 class="font-semibold text-yellow-900 mb-3 flex items-center">
              <span class="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-2">4</span>
              Automatische Berechnung
            </h3>
            
            <div id="calculation-result" class="bg-white rounded-lg p-4 border">
              <!-- Wird dynamisch gefüllt -->
            </div>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
            <button type="button" id="add-to-stack-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors hidden">
              <i class="fas fa-plus mr-2"></i>Zu Stack hinzufügen
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Event-Listener für das neue Modal
    const nutrientSelect = modal.querySelector('#stack-nutrient-select')
    const dosageStep = modal.querySelector('#dosage-step')
    const productStep = modal.querySelector('#product-step')
    const calculationStep = modal.querySelector('#calculation-step')
    const desiredAmountInput = modal.querySelector('#desired-amount')
    
    // Nährstoff-Auswahl Handler
    if (nutrientSelect) {
      nutrientSelect.addEventListener('change', (e) => {
        this.handleNutrientSelectionForStack(e, modal)
      })
    }
    
    // Gewünschte Menge Handler
    if (desiredAmountInput) {
      desiredAmountInput.addEventListener('input', (e) => {
        this.handleDesiredAmountChange(e, modal)
      })
    }

    // Event-Listener für Modal-Schließen
    const closeBtn = modal.querySelector('.close-modal')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove()
      })
    }
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    })
  }

  handleNutrientSelectionForStack(event, modal) {
    const selectedOption = event.target.selectedOptions[0]
    if (!selectedOption || !selectedOption.value) {
      modal.querySelector('#dosage-step').classList.add('hidden')
      return
    }

    const nutrientId = parseInt(selectedOption.value)
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    if (!nutrient) return

    // Schritt 2 anzeigen
    const dosageStep = modal.querySelector('#dosage-step')
    dosageStep.classList.remove('hidden')

    // Empfehlungen anzeigen
    const dgeEl = modal.querySelector('#dge-recommendation')
    const studyEl = modal.querySelector('#study-recommendation')
    const unitEl = modal.querySelector('#unit-display')

    dgeEl.textContent = `${nutrient.dge_recommended} ${nutrient.unit}`
    dgeEl.dataset.value = nutrient.dge_recommended

    studyEl.textContent = `${nutrient.study_recommended} ${nutrient.unit}`
    studyEl.dataset.value = nutrient.study_recommended

    unitEl.textContent = nutrient.unit

    // Standardwert setzen (DGE-Empfehlung)
    modal.querySelector('#desired-amount').value = nutrient.dge_recommended
    
    // Direkt Produkte anzeigen
    this.handleDesiredAmountChange({target: modal.querySelector('#desired-amount')}, modal)
  }

  handleDesiredAmountChange(event, modal) {
    const desiredAmount = parseFloat(event.target.value)
    if (!desiredAmount || desiredAmount <= 0) {
      modal.querySelector('#product-step').classList.add('hidden')
      modal.querySelector('#calculation-step').classList.add('hidden')
      return
    }

    const nutrientId = parseInt(modal.querySelector('#stack-nutrient-select').value)
    if (!nutrientId) return

    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    if (!nutrient) return

    // Verfügbare Produkte für diesen Nährstoff finden
    const availableProducts = this.products.filter(p => p.nutrient_id === nutrientId)
    
    // Schritt 3 anzeigen
    const productStep = modal.querySelector('#product-step')
    const productsContainer = modal.querySelector('#available-products')
    
    if (availableProducts.length === 0) {
      productsContainer.innerHTML = `
        <div class="text-center text-gray-500 py-4">
          <i class="fas fa-info-circle text-2xl mb-2"></i>
          <p>Keine Produkte für ${nutrient.name} verfügbar</p>
          <p class="text-sm">Fügen Sie zuerst ein Produkt mit diesem Wirkstoff hinzu.</p>
        </div>
      `
    } else {
      productsContainer.innerHTML = availableProducts.map(product => {
        const unitsNeeded = Math.ceil(desiredAmount / product.nutrient_amount_per_unit)
        const actualAmount = unitsNeeded * product.nutrient_amount_per_unit
        const daysSupply = Math.floor(product.quantity / unitsNeeded)
        const monthlyCost = (product.purchase_price / daysSupply) * 30

        return `
          <div class="bg-white rounded-lg border p-4 hover:border-blue-300 cursor-pointer product-option" data-product-id="${product.id}" data-units-needed="${unitsNeeded}">
            <div class="flex justify-between items-start mb-2">
              <h4 class="font-semibold text-gray-900">${product.name}</h4>
              <span class="text-sm text-gray-500">${product.brand}</span>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-600">Benötigt:</span>
                <span class="font-medium">${unitsNeeded} ${product.form}/Tag</span>
              </div>
              <div>
                <span class="text-gray-600">Tatsächlich:</span>
                <span class="font-medium">${actualAmount} ${nutrient.unit}/Tag</span>
              </div>
              <div>
                <span class="text-gray-600">Reicht für:</span>
                <span class="font-medium">${daysSupply} Tage</span>
              </div>
              <div>
                <span class="text-gray-600">Kosten/Monat:</span>
                <span class="font-medium text-green-600">€${monthlyCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        `
      }).join('')

      // Event-Listener für Produktauswahl
      modal.querySelectorAll('.product-option').forEach(option => {
        option.addEventListener('click', () => {
          // Alle anderen deselektieren
          modal.querySelectorAll('.product-option').forEach(opt => 
            opt.classList.remove('border-blue-500', 'bg-blue-50')
          )
          // Diese auswählen
          option.classList.add('border-blue-500', 'bg-blue-50')
          
          const productId = parseInt(option.dataset.productId)
          const unitsNeeded = parseInt(option.dataset.unitsNeeded)
          this.showStackCalculation(modal, productId, unitsNeeded, desiredAmount)
        })
      })
    }
    
    productStep.classList.remove('hidden')
  }

  showStackCalculation(modal, productId, unitsNeeded, desiredAmount) {
    const product = this.products.find(p => p.id === productId)
    const nutrient = this.nutrients.find(n => n.id === product.nutrient_id)
    
    if (!product || !nutrient) return

    const actualAmount = unitsNeeded * product.nutrient_amount_per_unit
    const daysSupply = Math.floor(product.quantity / unitsNeeded)
    const monthlyCost = (product.purchase_price / daysSupply) * 30
    const dgePercent = Math.round((actualAmount / nutrient.dge_recommended) * 100)

    const calculationStep = modal.querySelector('#calculation-step')
    const resultContainer = modal.querySelector('#calculation-result')
    
    resultContainer.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-gray-900">Gewähltes Produkt:</h4>
          <span class="text-blue-600 font-medium">${product.name}</span>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-sm text-gray-600">Gewünscht</div>
            <div class="text-lg font-semibold text-gray-900">${desiredAmount} ${nutrient.unit}</div>
          </div>
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-sm text-gray-600">Tatsächlich</div>
            <div class="text-lg font-semibold text-green-600">${actualAmount} ${nutrient.unit}</div>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">Dosierung:</span>
            <span class="font-medium">${unitsNeeded}x ${product.form} täglich</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">DGE-Abdeckung:</span>
            <span class="font-medium ${dgePercent >= 100 ? 'text-green-600' : 'text-orange-600'}">${dgePercent}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Packung reicht:</span>
            <span class="font-medium">${daysSupply} Tage</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Kosten/Monat:</span>
            <span class="font-medium text-green-600">€${monthlyCost.toFixed(2)}</span>
          </div>
        </div>
        
        ${actualAmount > nutrient.warning_threshold ? `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div class="flex items-center text-yellow-800">
              <i class="fas fa-exclamation-triangle mr-2"></i>
              <span class="text-sm font-medium">Warnung: Hohe Dosierung</span>
            </div>
            <p class="text-xs text-yellow-700 mt-1">Über ${nutrient.warning_threshold} ${nutrient.unit} täglich - bitte mit Arzt absprechen</p>
          </div>
        ` : ''}
      </div>
    `
    
    calculationStep.classList.remove('hidden')
    modal.querySelector('#add-to-stack-btn').classList.remove('hidden')
    
    // Add to Stack Button Handler
    const addBtn = modal.querySelector('#add-to-stack-btn')
    addBtn.onclick = () => {
      const success = this.addNutrientToStack(productId, unitsNeeded, desiredAmount)
      if (success) {
        modal.remove() // Only close modal if successfully added to stack
      }
    }
  }

  addNutrientToStack(productId, unitsNeeded, desiredAmount) {
    const product = this.products.find(p => p.id === productId)
    const nutrient = this.nutrients.find(n => n.id === product.nutrient_id)
    
    if (!product || !nutrient) {
      this.showError('Produkt oder Nährstoff nicht gefunden!')
      return false
    }

    // Find or create "Mein Stack" (default stack)
    let myStack = this.stacks.find(s => s.name === 'Mein Stack')
    
    if (!myStack) {
      // Create new default stack
      myStack = {
        id: Math.max(0, ...this.stacks.map(s => s.id)) + 1,
        name: 'Mein Stack',
        products: [],
        description: 'Mein persönlicher Nährstoff-Stack'
      }
      this.stacks.push(myStack)
    }
    
    // Check if product is already in stack
    const existingProductIndex = myStack.products.findIndex(p => p.product_id === productId)
    
    if (existingProductIndex >= 0) {
      // Update existing product dosage
      myStack.products[existingProductIndex].dosage = unitsNeeded
      this.showSuccess(`${product.name} Dosierung in Ihrem Stack aktualisiert: ${unitsNeeded}x täglich für ${desiredAmount} ${nutrient.unit} ${nutrient.name}.`)
    } else {
      // Add new product to stack
      myStack.products.push({
        product_id: productId,
        dosage: unitsNeeded
      })
      this.showSuccess(`${product.name} wurde zu Ihrem Stack hinzugefügt! Dosierung: ${unitsNeeded}x täglich für ${desiredAmount} ${nutrient.unit} ${nutrient.name}.`)
    }
    
    // Recalculate stack cost
    myStack.total_cost = this.calculateStackCost(myStack)
    
    // Update UI
    this.renderStacks()
    this.updateStats()
    
    console.log('[Demo App] Nährstoff zu Stack hinzugefügt:', {
      productId,
      unitsNeeded,
      desiredAmount,
      nutrient: nutrient.name,
      stackId: myStack.id
    })
    
    return true
  }
}

// Debugging-Funktion
function debugLog(message, data = null) {
  console.log(`[Demo App] ${message}`, data)
}

// Initialisierungsfunktion
function initializeDemoApp() {
  debugLog('Initialisiere Demo App...')
  
  try {
    if (!window.demoApp) {
      window.demoApp = new SupplementDemoApp()
      debugLog('Demo App erfolgreich initialisiert!', {
        products: window.demoApp.products.length,
        stacks: window.demoApp.stacks.length
      })
    } else {
      debugLog('Demo App bereits initialisiert')
    }
  } catch (error) {
    debugLog('Fehler bei der Demo App Initialisierung:', error)
  }
}

// Verschiedene Initialisierungsstrategien
if (document.readyState === 'loading') {
  debugLog('DOM lädt noch...')
  document.addEventListener('DOMContentLoaded', initializeDemoApp)
} else {
  debugLog('DOM bereits geladen, initialisiere sofort')
  initializeDemoApp()
}

// Zusätzlicher Fallback mit Timeout
setTimeout(() => {
  if (!window.demoApp) {
    debugLog('Fallback-Initialisierung nach 1 Sekunde')
    initializeDemoApp()
  }
}, 1000)