// Demo App mit Modal-Layern - Supplement Stack
// Ersetzt alert()-Dialoge durch richtige Modal-Interface mit Suche

class SupplementDemoApp {
  constructor() {
    this.availableProducts = this.loadDemoProducts()  // Verfügbare Produkte
    this.products = []  // Produkte im Stack (initial leer)
    this.stacks = this.loadDemoStacks()
    this.nutrients = this.loadNutrients()
    this.init()
  }

  init() {
    console.log('[Demo Modal] Initialisierung startet...')
    this.setupEventListeners()
    this.renderProducts()
    
    // Demo-Stack mit ein paar Produkten vorbesetzen
    this.addDemoStackProducts()
    
    this.updateStats()
    console.log(`[Demo Modal] Initialisierung abgeschlossen - ${this.availableProducts.length} verfügbare Produkte, ${this.products.length} im Stack`)
  }
  
  addDemoStackProducts() {
    // Füge automatisch ein paar Produkte zum Demo-Stack hinzu
    const demoStackProducts = [
      { productId: 1, nutrientId: 1, dosageAmount: 4000, dosageUnit: 'IU' }, // Vitamin D3 4000 IU
      { productId: 3, nutrientId: 2, dosageAmount: 200, dosageUnit: 'µg' },   // B12 Methylcobalamin  
      { productId: 12, nutrientId: 2, dosageAmount: 100, dosageUnit: 'µg' },  // B-Komplex Premium
      { productId: 13, nutrientId: 11, dosageAmount: 1000, dosageUnit: 'mg' } // L-Carnitin + Vitamin C
    ]
    
    demoStackProducts.forEach(({ productId, nutrientId, dosageAmount, dosageUnit }) => {
      const product = this.availableProducts.find(p => p.id === productId)
      const nutrient = this.nutrients.find(n => n.id === nutrientId)
      
      if (product && nutrient) {
        const dosage = { amount: dosageAmount, unit: dosageUnit, category: 'custom' }
        this.finalizeAddProduct(product, nutrient, dosage)
      }
    })
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
      if (button.id === 'demo-add-product-mobile' || 
          button.id === 'demo-add-product-desktop' || 
          button.id === 'demo-add-product-main' ||
          button.id?.includes('add-product')) {
        e.preventDefault()
        this.showAddProductModal()
      }
      
      // Nährstoff-Stack erstellen Buttons
      if (button.id === 'demo-create-stack-mobile' || 
          button.id === 'demo-create-stack-desktop' || 
          button.id === 'demo-create-stack-main' ||
          button.id?.includes('create-stack')) {
        e.preventDefault()
        this.showNutrientBasedStackModal()
      }
    })
  }

  loadDemoProducts() {
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
        warnings: [],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Vitamine',
        // Haupt- und Nebenwirkstoffe
        main_nutrients: [{ nutrient_id: 1, amount_per_unit: 4000 }], // Vitamin D3 4000 IE
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/vitamin-d3'
      },
      {
        id: 11,
        name: 'Vitamin D3 2000 IU',
        brand: 'Nature Love',
        form: 'Kapsel',
        purchase_price: 14.90,
        quantity: 90,
        price_per_piece: 0.166,
        dosage_per_day: 1,
        days_supply: 90,
        monthly_cost: 4.97,
        description: 'Vitamin D3 in moderater Dosierung für die tägliche Einnahme',
        benefits: ['Unterstützt das Immunsystem', 'Wichtig für Knochen und Zähne'],
        warnings: ['Nicht über 2000 IU täglich ohne ärztliche Rücksprache'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Vitamine',
        main_nutrients: [{ nutrient_id: 1, amount_per_unit: 2000 }], // Vitamin D3 2000 IE
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 2,
        product_image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/vitamin-d3-2000'
      },
      {
        id: 2,
        name: 'B12 Methylcobalamin',
        brand: 'InnoNature',
        form: 'Tropfen',
        purchase_price: 24.90,
        quantity: 60,
        price_per_piece: 0.415,
        dosage_per_day: 1,
        days_supply: 60,
        monthly_cost: 12.45,
        description: 'Bioaktives Vitamin B12 als Methylcobalamin',
        benefits: ['Reduziert Müdigkeit', 'Unterstützt Nervensystem', 'Wichtig für Blutbildung'],
        warnings: ['Hochdosiert - nicht für Schwangere ohne Rücksprache'],
        dosage_recommendation: '1 Tropfen täglich',
        category: 'Vitamine',
        main_nutrients: [{ nutrient_id: 2, amount_per_unit: 200 }], // B12
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/b12'
      },
      {
        id: 12,
        name: 'B-Komplex Premium',
        brand: 'Biomenta',
        form: 'Kapsel',
        purchase_price: 21.90,
        quantity: 60,
        price_per_piece: 0.365,
        dosage_per_day: 1,
        days_supply: 60,
        monthly_cost: 10.95,
        description: 'Vollständiger B-Vitamin Komplex mit allen wichtigen B-Vitaminen',
        benefits: ['Unterstützt Energiestoffwechsel', 'Nervensystem', 'Reduziert Müdigkeit'],
        warnings: ['Kann Urin gelb färben (normal)', 'Nicht auf nüchternen Magen'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Vitamine',
        // Mehrere Hauptwirkstoffe bei B-Komplex
        main_nutrients: [
          { nutrient_id: 2, amount_per_unit: 100 }, // B12
          { nutrient_id: 7, amount_per_unit: 5 },   // B6
          { nutrient_id: 8, amount_per_unit: 400 }  // Folsäure
        ],
        secondary_nutrients: [],
        recommended: false,
        recommendation_rank: 3,
        shop_url: 'https://example.com/b-komplex'
      },
      {
        id: 13,
        name: 'L-Carnitin + Vitamin C',
        brand: 'Peak Performance',
        form: 'Kapsel',
        purchase_price: 29.90,
        quantity: 90,
        price_per_piece: 0.332,
        dosage_per_day: 2,
        days_supply: 45,
        monthly_cost: 19.93,
        description: 'L-Carnitin für Energiestoffwechsel mit Vitamin C als Antioxidans',
        benefits: ['Unterstützt Fettstoffwechsel', 'Energieproduktion', 'Antioxidative Wirkung'],
        warnings: ['Kann bei empfindlichen Personen Übelkeit verursachen'],
        dosage_recommendation: '2 Kapseln täglich vor dem Training',
        category: 'Aminosäuren',
        // L-Carnitin ist Hauptwirkstoff, Vitamin C nur Nebenwirkstoff
        main_nutrients: [{ nutrient_id: 11, amount_per_unit: 500 }], // L-Carnitin (neue ID)
        secondary_nutrients: [{ nutrient_id: 6, amount_per_unit: 80 }], // Vitamin C
        recommended: true,
        recommendation_rank: 1,
        shop_url: 'https://example.com/l-carnitin'
      },
      {
        id: 3,
        name: 'Magnesium Glycinat',
        brand: 'Biomenta',
        form: 'Kapsel',
        purchase_price: 16.90,
        quantity: 60,
        price_per_piece: 0.282,
        dosage_per_day: 2,
        days_supply: 30,
        monthly_cost: 16.90,
        description: 'Hochwertiges Magnesium in Chelat-Form für optimale Bioverfügbarkeit',
        benefits: ['Reduziert Müdigkeit', 'Unterstützt normale Muskelfunktion', 'Trägt zum Elektrolytgleichgewicht bei'],
        warnings: [],
        dosage_recommendation: '2 Kapseln täglich zu den Mahlzeiten',
        category: 'Mineralien',
        main_nutrients: [{ nutrient_id: 3, amount_per_unit: 200 }], // 200mg pro Kapsel
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/magnesium'
      },
      {
        id: 14,
        name: 'Magnesium Citrat',
        brand: 'Pure Encapsulations',
        form: 'Kapsel',
        purchase_price: 22.50,
        quantity: 90,
        price_per_piece: 0.25,
        dosage_per_day: 3,
        days_supply: 30,
        monthly_cost: 22.50,
        description: 'Magnesium als Citrat für gute Absorption',
        benefits: ['Gut verträglich', 'Hohe Bioverfügbarkeit', 'Unterstützt Muskelfunktion'],
        warnings: [],
        dosage_recommendation: '3 Kapseln täglich verteilt zu den Mahlzeiten',
        category: 'Mineralien',
        main_nutrients: [{ nutrient_id: 3, amount_per_unit: 133 }], // 133mg pro Kapsel
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 2,
        shop_url: 'https://example.com/magnesium-citrat'
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
        description: 'Veganes EPA und DHA aus nachhaltiger Algenzucht',
        benefits: ['Unterstützt Herzfunktion', 'Wichtig für Gehirn und Augen', 'Entzündungshemmend'],
        warnings: ['Kühl lagern', 'Nach Anbruch 3 Monate haltbar'],
        dosage_recommendation: '1 Teelöffel täglich zu einer Mahlzeit',
        category: 'Fettsäuren',
        nutrient_id: 4,
        nutrient_amount_per_unit: 1000,
        shop_url: 'https://example.com/omega3'
      },
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
        description: 'Hochbioverfügbares Zink in Chelat-Form',
        benefits: ['Unterstützt Immunsystem', 'Wichtig für Haut und Haare', 'Trägt zur DNA-Synthese bei'],
        warnings: ['Nicht auf nüchternen Magen', 'Abstand zu Kaffee und Tee'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Mineralien',
        nutrient_id: 5,
        nutrient_amount_per_unit: 15,
        shop_url: 'https://example.com/zink'
      },
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
        description: 'Gepuffertes Vitamin C mit verzögerter Freisetzung',
        benefits: ['Unterstützt Immunsystem', 'Antioxidative Wirkung', 'Fördert Kollagenbildung'],
        warnings: ['Bei Nierensteinen vorsichtig dosieren'],
        dosage_recommendation: '1 Kapsel täglich zu einer Mahlzeit',
        category: 'Vitamine',
        nutrient_id: 6,
        nutrient_amount_per_unit: 1000,
        shop_url: 'https://example.com/vitamin-c'
      }
    ]
  }

  loadDemoStacks() {
    return [
      {
        id: 1,
        name: 'Basis Gesundheit',
        products: [1, 3, 5],
        total_monthly_cost: 31.64,
        description: 'Grundversorgung mit wichtigsten Vitaminen und Mineralien'
      },
      {
        id: 2,
        name: 'Immunsystem Plus',
        products: [1, 2, 5, 6],
        total_monthly_cost: 35.42,
        description: 'Optimale Unterstützung des Immunsystems'
      }
    ]
  }

  loadNutrients() {
    return [
      { 
        id: 1, 
        name: 'Vitamin D3', 
        unit: 'IE', 
        category: 'Vitamine', 
        dge_recommendation: 800, 
        dge_upper_limit: 4000, 
        description: 'Wichtig für Knochengesundheit und Immunsystem',
        study_recommendation: 2000,
        study_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6266123/',
        study_title: 'Vitamin D3 Supplementation in Adults - Systematic Review'
      },
      { 
        id: 2, 
        name: 'Vitamin B12', 
        unit: 'µg', 
        category: 'Vitamine', 
        dge_recommendation: 4, 
        dge_upper_limit: 1000, 
        description: 'Essential für Nervensystem und Blutbildung' 
      },
      { 
        id: 3, 
        name: 'Magnesium', 
        unit: 'mg', 
        category: 'Mineralien', 
        dge_recommendation: 375, 
        dge_upper_limit: 350, 
        description: 'Wichtig für Muskeln und Energiestoffwechsel',
        study_recommendation: 400,
        study_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5637834/',
        study_title: 'Magnesium Supplementation and Health Outcomes'
      },
      { 
        id: 4, 
        name: 'EPA', 
        unit: 'mg', 
        category: 'Fettsäuren', 
        dge_recommendation: 250, 
        dge_upper_limit: 5000, 
        description: 'Omega-3-Fettsäure für Herz und Gehirn' 
      },
      { 
        id: 5, 
        name: 'Zink', 
        unit: 'mg', 
        category: 'Mineralien', 
        dge_recommendation: 10, 
        dge_upper_limit: 25, 
        description: 'Essential für Immunsystem und Wundheilung' 
      },
      { 
        id: 6, 
        name: 'Vitamin C', 
        unit: 'mg', 
        category: 'Vitamine', 
        dge_recommendation: 110, 
        dge_upper_limit: 1000, 
        description: 'Antioxidans und Kollagenbildung',
        study_recommendation: 1000,
        study_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579810/',
        study_title: 'Vitamin C and Immune Function'
      },
      { 
        id: 7, 
        name: 'Vitamin B6', 
        unit: 'mg', 
        category: 'Vitamine', 
        dge_recommendation: 1.4, 
        dge_upper_limit: 25, 
        description: 'Aminosäurestoffwechsel und Nervenfunktion' 
      },
      { 
        id: 8, 
        name: 'Folsäure', 
        unit: 'µg', 
        category: 'Vitamine', 
        dge_recommendation: 400, 
        dge_upper_limit: 1000, 
        description: 'DNA-Synthese und Zellteilung' 
      },
      { 
        id: 9, 
        name: 'Eisen', 
        unit: 'mg', 
        category: 'Mineralien', 
        dge_recommendation: 15, 
        dge_upper_limit: 45, 
        description: 'Sauerstofftransport und Energiestoffwechsel' 
      },
      { 
        id: 10, 
        name: 'Calcium', 
        unit: 'mg', 
        category: 'Mineralien', 
        dge_recommendation: 1000, 
        dge_upper_limit: 2500, 
        description: 'Knochen- und Zahngesundheit' 
      },
      { 
        id: 11, 
        name: 'L-Carnitin', 
        unit: 'mg', 
        category: 'Aminosäuren', 
        dge_recommendation: 300, 
        dge_upper_limit: 3000, 
        description: 'Unterstützt Fettstoffwechsel und Energieproduktion' 
      }
    ]
  }

  renderProducts() {
    const grid = document.getElementById('demo-products-grid')
    if (!grid) {
      console.error('[Demo Modal] Grid nicht gefunden!')
      return
    }
    
    const html = this.availableProducts.map(product => `
      <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        <div class="p-4">
          <!-- Layout wie in Vorlage: Produktbild links oben mit Content -->
          <div class="flex items-start mb-3">
            <!-- Produktbild links oben - wie in Vorlage -->
            ${product.product_image ? `
              <div class="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 mr-3">
                <img src="${product.product_image}" alt="${product.name}" class="w-full h-full object-cover">
              </div>
            ` : `
              <div class="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mr-3">
                <i class="fas fa-pills text-gray-400 text-lg"></i>
              </div>
            `}
            
            <!-- Produktinfo rechts vom Bild -->
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 text-sm sm:text-base mb-1 leading-tight">${product.name}</h3>
              <p class="text-xs sm:text-sm text-gray-600 mb-2">${product.brand} • ${product.form}</p>
              
              <!-- Dosierung Info -->
              <div class="text-xs text-gray-700">
                <div class="font-medium">Dosierung:</div>
                <div>${(() => {
                  const mainNutrient = this.getMainNutrientInfo(product)
                  return `${mainNutrient.amount}${mainNutrient.unit} ${mainNutrient.name}`
                })()}</div>
              </div>
            </div>
          </div>

          
          <div class="bg-blue-50 rounded-lg p-3 mb-3">
            ${(() => {
              const mainNutrient = this.getMainNutrientInfo(product)
              return `
                <div class="text-sm font-medium text-blue-800 mb-1">🧬 ${mainNutrient.name}</div>
                <div class="text-xs text-blue-600">${mainNutrient.amount}${mainNutrient.unit} pro ${product.form}</div>
              `
            })()}
          </div>
          
          <div class="bg-gray-50 rounded-lg p-3 mb-3">
            <div class="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <div>
                <span class="text-gray-500">Kaufpreis:</span>
                <div class="font-semibold text-gray-900">€${product.purchase_price.toFixed(2)}</div>
              </div>
              <div>
                <span class="text-gray-500">Pro Monat:</span>
                <div class="font-semibold text-green-600">€${product.monthly_cost.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div class="flex justify-between items-center">
            <button data-action="details" data-product-id="${product.id}" class="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
              <i class="fas fa-eye mr-1"></i>Details
            </button>
            <div class="text-xs text-gray-500">
              <i class="fas fa-flask mr-1"></i>Nährstoffbasiert
            </div>
          </div>
        </div>
      </div>
    `).join('')
    
    grid.innerHTML = html
    console.log('[Demo Modal] Produkte gerendert:', this.products.length)
  }

  getNutrientName(nutrientId) {
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    return nutrient ? nutrient.name : 'Unbekannt'
  }

  getNutrientUnit(nutrientId) {
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    return nutrient ? nutrient.unit : ''
  }

  // Hilfsfunktion für Singular/Plural
  getPluralForm(amount, form) {
    if (amount === 1) {
      return form // Singular: 1 Kapsel, 1 Tropfen, 1 Tablette
    }
    
    // Plural-Regeln für deutsche Darreichungsformen
    switch(form.toLowerCase()) {
      case 'kapsel':
        return 'Kapseln'
      case 'tablette':
        return 'Tabletten'
      case 'tropfen':
        return 'Tropfen' // Tropfen ist bereits Plural
      case 'pulver':
        return 'Pulver' // Pulver bleibt gleich
      case 'öl':
        return 'Öl' // Öl bleibt gleich
      case 'gummies':
        return 'Gummies' // Gummies ist bereits Plural
      default:
        return form + 'n' // Fallback: einfach 'n' anhängen
    }
  }

  // Hilfsfunktion für neue Produktstruktur
  getMainNutrientInfo(product) {
    if (product.main_nutrients && product.main_nutrients.length > 0) {
      const mainNutrient = product.main_nutrients[0]
      const nutrient = this.nutrients.find(n => n.id === mainNutrient.nutrient_id)
      return {
        name: nutrient ? nutrient.name : 'Unbekannt',
        unit: nutrient ? nutrient.unit : '',
        amount: mainNutrient.amount_per_unit
      }
    }
    // Fallback für alte Struktur
    return {
      name: this.getNutrientName(product.nutrient_id),
      unit: this.getNutrientUnit(product.nutrient_id),
      amount: product.nutrient_amount_per_unit || 0
    }
  }

  updateStats() {
    // Update various stats displays
    const totalProducts = this.availableProducts.length
    const totalStacks = this.stacks.length
    
    // Update stack count if element exists
    const stackCountElement = document.querySelector('.stack-count')
    if (stackCountElement) {
      stackCountElement.textContent = totalStacks
    }
    
    // Update price footer
    this.updatePriceFooter()
  }

  updatePriceFooter() {
    const totalProducts = this.products.length
    
    if (totalProducts === 0) {
      this.hidePriceFooter()
      return
    }
    
    // Berechne Gesamtkosten
    const totalMonthlyPrice = this.products.reduce((sum, product) => {
      return sum + (product.monthly_cost || 0)
    }, 0)
    
    const totalPurchasePrice = this.products.reduce((sum, product) => {
      return sum + (product.purchase_price || 0)
    }, 0)
    
    this.showPriceFooter(totalProducts, totalMonthlyPrice, totalPurchasePrice)
  }

  showPriceFooter(productCount, monthlyPrice, purchasePrice) {
    let footer = document.getElementById('price-footer')
    
    if (!footer) {
      footer = document.createElement('div')
      footer.id = 'price-footer'
      footer.className = 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 transform translate-y-full transition-transform duration-300'
      document.body.appendChild(footer)
    }
    
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="text-sm text-gray-600">
              <i class="fas fa-shopping-cart mr-1"></i>
              ${productCount} ${productCount === 1 ? 'Produkt' : 'Produkte'} im Stack
            </div>
            <div class="text-sm">
              <span class="text-gray-600">Einmalig:</span>
              <span class="font-semibold text-gray-900">€${purchasePrice.toFixed(2)}</span>
            </div>
            <div class="text-sm">
              <span class="text-gray-600">Monatlich:</span>
              <span class="font-semibold text-green-600">€${monthlyPrice.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <button onclick="window.demoApp.clearStack()" class="text-sm text-gray-500 hover:text-orange-600 px-3 py-2 rounded">
              <i class="fas fa-trash mr-1"></i>Stack leeren
            </button>
            <button onclick="window.demoApp.proceedToCheckout()" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm font-medium">
              <i class="fas fa-shopping-cart mr-2"></i>Alle auswählen
            </button>
            <button onclick="window.demoApp.hidePriceFooter()" class="text-gray-400 hover:text-gray-600 p-2">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>
    `
    
    // Footer einblenden
    setTimeout(() => {
      footer.classList.remove('translate-y-full')
      footer.classList.add('translate-y-0')
    }, 100)
  }

  hidePriceFooter() {
    const footer = document.getElementById('price-footer')
    if (footer) {
      footer.classList.remove('translate-y-0')
      footer.classList.add('translate-y-full')
      setTimeout(() => {
        footer.remove()
      }, 300)
    }
  }

  clearStack() {
    if (confirm('Möchten Sie wirklich alle Produkte aus dem Stack entfernen?')) {
      this.products = []
      this.renderProducts()
      this.updateStats()
      this.showMessage('🗑️ Stack geleert', 'info')
    }
  }

  proceedToCheckout() {
    const totalMonthlyPrice = this.products.reduce((sum, product) => {
      return sum + (product.monthly_cost || 0)
    }, 0)
    
    this.showMessage(`🛒 Demo-Checkout\n\n${this.products.length} Produkte\n💰 €${totalMonthlyPrice.toFixed(2)}/Monat\n\nIn der Vollversion werden Sie zu Amazon weitergeleitet.`, 'info')
  }

  closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay')
    modals.forEach(modal => modal.remove())
  }

  // MODAL FUNKTIONEN - Ersetzen die alert()-Dialoge

  showAddProductModal() {
    console.log('[Demo Modal] Zeige Add Product Modal')
    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
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
              
              <!-- Suchergebnisse - initial leer -->
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
                  <div class="text-lg font-bold text-blue-600" id="dge-recommendation">-</div>
                  <button type="button" id="use-dge-dosage" class="mt-2 w-full bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
                    DGE verwenden
                  </button>
                </div>
                
                <div id="study-recommendation-card" class="bg-purple-50 border border-purple-200 rounded-lg p-3 hidden">
                  <div class="text-sm font-medium text-purple-800 mb-1">Studien-Empfehlung</div>
                  <div class="text-lg font-bold text-purple-600" id="study-recommendation">-</div>
                  <button type="button" id="use-study-dosage" class="mt-2 w-full bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700 transition-colors">
                    Studien-Dosierung
                  </button>
                </div>
              </div>
              
              <!-- Eigene Dosierung eingeben -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Gewünschte Tagesdosis <span id="dosage-unit" class="text-green-600">-</span>
                </label>
                <input type="number" id="custom-dosage" step="0.1" min="0.1" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm" placeholder="1000">
                <p class="text-xs text-gray-500 mt-1">Geben Sie Ihre gewünschte tägliche Menge ein</p>
              </div>
              
              <!-- Sicherheitshinweise -->
              <div id="dosage-safety" class="p-3 rounded-lg border mb-4 hidden">
                <div class="flex items-start">
                  <i class="fas fa-exclamation-triangle mr-2 mt-0.5"></i>
                  <div class="text-sm">
                    <div class="font-medium mb-1" id="safety-title">-</div>
                    <div id="safety-message">-</div>
                  </div>
                </div>
              </div>
              
              <!-- Kategorie -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Kategorie</label>
                <select id="supplement-category" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white shadow-sm">
                  <option value="Basisausstattung">Basisausstattung</option>
                  <option value="Gesundheit">Gesundheit</option>
                  <option value="Sport & Leistung">Sport & Leistung</option>
                  <option value="Spezielle Bedürfnisse">Spezielle Bedürfnisse</option>
                </select>
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

          <!-- Schritt 3: Produktauswahl -->
          <div id="step-product-selection" class="step-container hidden">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-green-900 mb-3 flex items-center">
                <i class="fas fa-shopping-cart mr-2"></i>
                Produktauswahl für <span id="selected-nutrient-name" class="font-bold">-</span>
              </h3>
              
              <!-- Empfohlene Produkte -->
              <div id="recommended-products" class="space-y-3 mb-4">
                <!-- Wird dynamisch gefüllt -->
              </div>
              
              <!-- Mehr anzeigen Button -->
              <button id="show-more-products" class="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm hidden">
                <i class="fas fa-chevron-down mr-2"></i>Mehr Produkte anzeigen
              </button>
              
              <!-- Weitere Produkte -->
              <div id="more-products" class="space-y-3 mt-4 hidden">
                <!-- Wird dynamisch gefüllt -->
              </div>
            </div>
            
            <!-- Zurück Button -->
            <div class="flex justify-between items-center">
              <button id="back-to-search" class="text-blue-600 hover:text-blue-800 transition-colors text-sm">
                <i class="fas fa-arrow-left mr-1"></i>Zurück zur Suche
              </button>
            </div>
          </div>

          <!-- Schritt 4: Produkt zu Stack hinzufügen -->
          <div id="step-add-to-stack" class="step-container hidden">
            <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-purple-900 mb-3 flex items-center">
                <i class="fas fa-check-circle mr-2"></i>
                Produkt ausgewählt
              </h3>
              
              <div id="selected-product-summary" class="bg-white rounded-lg p-3 border mb-4">
                <!-- Wird dynamisch gefüllt -->
              </div>
              
              <div class="text-sm text-purple-800">
                <p>✅ Dieses Produkt wird zu Ihrem aktuellen Stack hinzugefügt</p>
                <p>✅ Automatische Berechnung von Dosierung und Kosten</p>
              </div>
            </div>
            
            <div class="flex justify-between items-center">
              <button id="back-to-products" class="text-blue-600 hover:text-blue-800 transition-colors text-sm">
                <i class="fas fa-arrow-left mr-1"></i>Zurück zu Produkten
              </button>
              <button id="add-product-final" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                <i class="fas fa-plus mr-2"></i>Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    this.setupAddProductModalHandlers(modal)
  }

  setupAddProductModalHandlers(modal) {
    const searchInput = modal.querySelector('#nutrient-search')
    const searchResults = modal.querySelector('#nutrient-search-results')
    const stepNutrientSearch = modal.querySelector('#step-nutrient-search')
    const stepDosageSelection = modal.querySelector('#step-dosage-selection')
    const stepProductSelection = modal.querySelector('#step-product-selection')
    const stepAddToStack = modal.querySelector('#step-add-to-stack')
    
    let selectedNutrient = null
    let selectedDosage = null
    let selectedProduct = null

    // 1. Wirkstoff-Suche Handler
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase()
        
        if (query.length < 2) {
          searchResults.classList.add('hidden')
          searchResults.innerHTML = ''
          return
        }
        
        const filtered = this.nutrients.filter(n => 
          n.name.toLowerCase().includes(query) || 
          n.category.toLowerCase().includes(query)
        )
        
        if (filtered.length > 0) {
          searchResults.classList.remove('hidden')
          searchResults.innerHTML = filtered.slice(0, 8).map(nutrient => `
            <div class="nutrient-option p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors" data-nutrient-id="${nutrient.id}">
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-medium text-gray-900">${nutrient.name}</div>
                  <div class="text-sm text-gray-600">${nutrient.category} • DGE: ${nutrient.dge_recommendation}${nutrient.unit}</div>
                </div>
                <div class="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  ${nutrient.unit}
                </div>
              </div>
            </div>
          `).join('')
        } else {
          searchResults.classList.remove('hidden')
          searchResults.innerHTML = `
            <div class="p-4 text-center text-gray-500">
              <i class="fas fa-search text-2xl mb-2"></i>
              <p>Keine Wirkstoffe für "${query}" gefunden</p>
            </div>
          `
        }
      })
    }

    // 2. Wirkstoff-Auswahl Handler
    searchResults.addEventListener('click', (e) => {
      const option = e.target.closest('.nutrient-option')
      if (option) {
        const nutrientId = option.dataset.nutrientId
        selectedNutrient = this.nutrients.find(n => n.id == nutrientId)
        
        if (selectedNutrient) {
          this.showDosageSelection(modal, selectedNutrient)
        }
      }
    })

    // 3. Zurück zur Suche (von Dosierung)
    modal.querySelector('#back-to-nutrient-search')?.addEventListener('click', () => {
      stepDosageSelection.classList.add('hidden')
      stepNutrientSearch.classList.remove('hidden')
      selectedNutrient = null
    })

    // 4. Weiter zu Produkten (von Dosierung)
    modal.querySelector('#continue-to-products')?.addEventListener('click', () => {
      const customDosage = parseFloat(modal.querySelector('#custom-dosage').value)
      const category = modal.querySelector('#supplement-category').value
      const notes = modal.querySelector('#personal-notes').value
      
      if (customDosage > 0) {
        selectedDosage = {
          amount: customDosage,
          unit: selectedNutrient.unit,
          category: category,
          notes: notes
        }
        this.showProductSelection(modal, selectedNutrient, selectedDosage)
      } else {
        this.showMessage('Bitte geben Sie eine gültige Dosierung ein', 'error')
      }
    })

    // 5. Zurück zur Suche (von Produkten)
    modal.querySelector('#back-to-search')?.addEventListener('click', () => {
      stepProductSelection.classList.add('hidden')
      stepDosageSelection.classList.remove('hidden')
      selectedProduct = null
    })

    // 6. Zurück zu Produkten (von Zusammenfassung)
    modal.querySelector('#back-to-products')?.addEventListener('click', () => {
      stepAddToStack.classList.add('hidden')
      stepProductSelection.classList.remove('hidden')
      selectedProduct = null
    })

    // 7. Finales Hinzufügen
    modal.querySelector('#add-product-final')?.addEventListener('click', () => {
      if (selectedProduct && selectedNutrient && selectedDosage) {
        this.addSelectedProductToStack(selectedProduct, selectedNutrient, selectedDosage)
        modal.remove()
      }
    })

    // Modal schließen
    modal.querySelector('.close-modal')?.addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  showDosageSelection(modal, nutrient) {
    const stepNutrientSearch = modal.querySelector('#step-nutrient-search')
    const stepDosageSelection = modal.querySelector('#step-dosage-selection')
    const dosageNutrientName = modal.querySelector('#dosage-nutrient-name')
    const dgeRecommendation = modal.querySelector('#dge-recommendation')
    const studyRecommendationCard = modal.querySelector('#study-recommendation-card')
    const studyRecommendation = modal.querySelector('#study-recommendation')
    const dosageUnit = modal.querySelector('#dosage-unit')
    const customDosage = modal.querySelector('#custom-dosage')
    const dosageSafety = modal.querySelector('#dosage-safety')
    
    // Schritt wechseln
    stepNutrientSearch.classList.add('hidden')
    stepDosageSelection.classList.remove('hidden')
    
    // Nährstoff-Info anzeigen
    dosageNutrientName.textContent = nutrient.name
    dgeRecommendation.textContent = `${nutrient.dge_recommendation}${nutrient.unit}`
    dosageUnit.textContent = `(${nutrient.unit})`
    
    // Studien-Empfehlung anzeigen falls vorhanden
    if (nutrient.study_recommendation) {
      studyRecommendationCard.classList.remove('hidden')
      studyRecommendation.textContent = `${nutrient.study_recommendation}${nutrient.unit}`
    } else {
      studyRecommendationCard.classList.add('hidden')
    }
    
    // Standard auf DGE-Empfehlung setzen
    customDosage.value = nutrient.dge_recommendation
    customDosage.placeholder = nutrient.dge_recommendation
    
    // DGE-Button Handler
    modal.querySelector('#use-dge-dosage').addEventListener('click', () => {
      customDosage.value = nutrient.dge_recommendation
      this.updateDosageSafety(modal, nutrient, nutrient.dge_recommendation)
    })
    
    // Studien-Button Handler (falls vorhanden)
    if (nutrient.study_recommendation) {
      modal.querySelector('#use-study-dosage').addEventListener('click', () => {
        customDosage.value = nutrient.study_recommendation
        this.updateDosageSafety(modal, nutrient, nutrient.study_recommendation)
      })
    }
    
    // Live-Sicherheitscheck
    customDosage.addEventListener('input', (e) => {
      const amount = parseFloat(e.target.value) || 0
      this.updateDosageSafety(modal, nutrient, amount)
    })
    
    // Initial Safety Check
    this.updateDosageSafety(modal, nutrient, nutrient.dge_recommendation)
  }

  updateDosageSafety(modal, nutrient, amount) {
    const dosageSafety = modal.querySelector('#dosage-safety')
    const safetyTitle = modal.querySelector('#safety-title')
    const safetyMessage = modal.querySelector('#safety-message')
    
    if (amount <= 0) {
      dosageSafety.classList.add('hidden')
      return
    }
    
    dosageSafety.classList.remove('hidden')
    
    if (amount > nutrient.dge_upper_limit) {
      // Über DGE-Obergrenze - aber nur gelb statt rot
      dosageSafety.className = 'p-3 rounded-lg border border-yellow-200 bg-yellow-50 mb-4'
      safetyTitle.textContent = 'Hinweis: Über DGE-Obergrenze'
      safetyTitle.className = 'font-medium mb-1 text-yellow-800'
      safetyMessage.innerHTML = `Die Dosierung liegt über der <a href="https://dge.de" target="_blank" class="text-blue-600 underline">DGE-Obergrenze</a> von ${nutrient.dge_upper_limit}${nutrient.unit}. <a href="https://dge.de" target="_blank" class="text-blue-600 underline">Mehr Infos bei der DGE</a>`
      safetyMessage.className = 'text-yellow-700'
    } else if (amount > nutrient.dge_recommendation * 2) {
      // Hoch aber noch sicher
      dosageSafety.className = 'p-3 rounded-lg border border-yellow-200 bg-yellow-50 mb-4'
      safetyTitle.textContent = 'Hohe Dosierung'
      safetyTitle.className = 'font-medium mb-1 text-yellow-800'
      safetyMessage.innerHTML = `Diese Dosierung ist ${Math.round(amount / nutrient.dge_recommendation)}x höher als die <a href="https://dge.de" target="_blank" class="text-blue-600 underline">DGE-Empfehlung</a>.`
      safetyMessage.className = 'text-yellow-700'
    } else {
      // Sicher
      dosageSafety.className = 'p-3 rounded-lg border border-green-200 bg-green-50 mb-4'
      safetyTitle.textContent = 'Innerhalb DGE-Empfehlung'
      safetyTitle.className = 'font-medium mb-1 text-green-800'
      safetyMessage.innerHTML = `Diese Dosierung entspricht ${Math.round(amount / nutrient.dge_recommendation * 100)}% der <a href="https://dge.de" target="_blank" class="text-blue-600 underline">DGE-Empfehlung</a>.`
      safetyMessage.className = 'text-green-700'
    }
  }

  showProductSelection(modal, nutrient, dosage) {
    const stepDosageSelection = modal.querySelector('#step-dosage-selection')
    const stepProductSelection = modal.querySelector('#step-product-selection')
    const selectedNutrientName = modal.querySelector('#selected-nutrient-name')
    const recommendedProducts = modal.querySelector('#recommended-products')
    const showMoreBtn = modal.querySelector('#show-more-products')
    const moreProducts = modal.querySelector('#more-products')
    
    // Schritt wechseln
    stepDosageSelection.classList.add('hidden')
    stepProductSelection.classList.remove('hidden')
    selectedNutrientName.textContent = `${nutrient.name} (${dosage.amount}${dosage.unit})`

    // Produkte für diesen Wirkstoff finden
    const availableProducts = this.products.filter(product => 
      product.main_nutrients?.some(n => n.nutrient_id == nutrient.id)
    )

    if (availableProducts.length === 0) {
      recommendedProducts.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-box-open text-2xl mb-2"></i>
          <p>Keine Produkte für ${nutrient.name} gefunden</p>
          <p class="text-sm">Wir werden bald Produkte für diesen Wirkstoff hinzufügen.</p>
        </div>
      `
      return
    }

    // Empfohlene Produkte (max 2)
    const recommended = availableProducts.filter(p => p.recommended).slice(0, 2)
    const others = availableProducts.filter(p => !p.recommended || !recommended.includes(p))

    recommendedProducts.innerHTML = recommended.map(product => 
      this.renderProductCard(product, nutrient, dosage, true)
    ).join('')

    // Mehr anzeigen Button und weitere Produkte
    if (others.length > 0) {
      showMoreBtn.classList.remove('hidden')
      moreProducts.innerHTML = others.map(product => 
        this.renderProductCard(product, nutrient, dosage, false)
      ).join('')
      
      showMoreBtn.addEventListener('click', () => {
        moreProducts.classList.toggle('hidden')
        const icon = showMoreBtn.querySelector('i')
        if (moreProducts.classList.contains('hidden')) {
          icon.className = 'fas fa-chevron-down mr-2'
          showMoreBtn.innerHTML = '<i class="fas fa-chevron-down mr-2"></i>Mehr Produkte anzeigen'
        } else {
          icon.className = 'fas fa-chevron-up mr-2'
          showMoreBtn.innerHTML = '<i class="fas fa-chevron-up mr-2"></i>Weniger anzeigen'
        }
      })
    } else {
      showMoreBtn.classList.add('hidden')
    }

    // Produkt-Auswahl Handler
    const handleProductSelection = (e) => {
      const card = e.target.closest('.product-card')
      if (card) {
        const productId = card.dataset.productId
        const selectedProduct = availableProducts.find(p => p.id == productId)
        
        if (selectedProduct) {
          this.showAddToStack(modal, selectedProduct, nutrient, dosage)
        }
      }
    }

    recommendedProducts.addEventListener('click', handleProductSelection)
    moreProducts.addEventListener('click', handleProductSelection)
  }

  renderProductCard(product, nutrient, dosage, isRecommended) {
    const nutrientInfo = product.main_nutrients.find(n => n.nutrient_id == nutrient.id)
    const amountPerUnit = nutrientInfo ? nutrientInfo.amount_per_unit : 0
    
    // WICHTIG: Berechnung basierend auf gewünschter Dosierung
    const requiredUnitsPerDay = Math.ceil(dosage.amount / amountPerUnit)
    const daysSupply = Math.floor(product.quantity / requiredUnitsPerDay)
    const monthlySupplyNeeded = 30 / daysSupply
    const customMonthlyPrice = product.purchase_price * monthlySupplyNeeded
    
    return `
      <div class="product-card border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${isRecommended ? 'border-green-300 bg-green-50' : ''} overflow-hidden" data-product-id="${product.id}">
        ${product.product_image ? `
          <div class="h-32 bg-gray-200">
            <img src="${product.product_image}" alt="${product.name}" class="w-full h-full object-cover">
          </div>
        ` : ''}
        
        <div class="p-4">
          ${isRecommended ? '<div class="text-xs text-green-600 font-medium mb-2"><i class="fas fa-star mr-1"></i>Empfohlen</div>' : ''}
          <div class="flex justify-between items-start mb-2">
          <div class="flex-1">
            <h4 class="font-semibold text-gray-900">${product.name}</h4>
            <p class="text-sm text-gray-600">${product.brand} • ${product.form}</p>
          </div>
          <div class="text-right text-sm">
            <div class="font-semibold text-gray-900">€${product.purchase_price.toFixed(2)}</div>
            <div class="text-green-600 font-medium">€${customMonthlyPrice.toFixed(2)}/Monat</div>
          </div>
        </div>
        
        <div class="bg-blue-50 rounded p-2 mb-2">
          <div class="text-sm text-blue-800">
            <strong>${amountPerUnit}${nutrient.unit}</strong> ${nutrient.name} pro ${product.form}
          </div>
          <div class="text-xs text-blue-600">
            ${requiredUnitsPerDay} ${this.getPluralForm(requiredUnitsPerDay, product.form)}/Tag für ${dosage.amount}${dosage.unit}
          </div>
        </div>
        
          <div class="text-xs text-gray-500">
            ${product.quantity} ${this.getPluralForm(product.quantity, product.form)} • Reicht ${daysSupply} Tage
          </div>
        </div>
      </div>
    `
  }

  showAddToStack(modal, product, nutrient, dosage) {
    const stepProductSelection = modal.querySelector('#step-product-selection')
    const stepAddToStack = modal.querySelector('#step-add-to-stack')
    const productSummary = modal.querySelector('#selected-product-summary')
    
    // Schritt wechseln
    stepProductSelection.classList.add('hidden')
    stepAddToStack.classList.remove('hidden')
    
    const nutrientInfo = product.main_nutrients.find(n => n.nutrient_id == nutrient.id)
    const amountPerUnit = nutrientInfo ? nutrientInfo.amount_per_unit : 0
    
    // Berechnung mit individueller Dosierung
    const requiredUnitsPerDay = Math.ceil(dosage.amount / amountPerUnit)
    const daysSupply = Math.floor(product.quantity / requiredUnitsPerDay)
    const monthlySupplyNeeded = 30 / daysSupply
    const customMonthlyPrice = product.purchase_price * monthlySupplyNeeded
    
    productSummary.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900 mb-1">${product.name}</h4>
          <p class="text-sm text-gray-600 mb-2">${product.brand} • ${product.form}</p>
          <div class="text-sm text-blue-600 mb-2">
            <strong>${amountPerUnit}${nutrient.unit}</strong> ${nutrient.name} pro ${product.form}
          </div>
          <div class="text-sm text-purple-600">
            <strong>Ihre Dosierung:</strong> ${dosage.amount}${dosage.unit} täglich
          </div>
          <div class="text-xs text-gray-500 mt-1">
            ${requiredUnitsPerDay} ${this.getPluralForm(requiredUnitsPerDay, product.form)}/Tag • ${product.quantity} ${this.getPluralForm(product.quantity, product.form)} reichen ${daysSupply} Tage
          </div>
          ${dosage.category ? `<div class="text-xs text-gray-500 mt-1">📂 ${dosage.category}</div>` : ''}
          ${dosage.notes ? `<div class="text-xs text-gray-500 mt-1">📝 ${dosage.notes}</div>` : ''}
        </div>
        <div class="text-right">
          <div class="text-lg font-semibold text-gray-900">€${product.purchase_price.toFixed(2)}</div>
          <div class="text-sm text-green-600 font-medium">€${customMonthlyPrice.toFixed(2)}/Monat</div>
          <div class="text-xs text-gray-500">bei Ihrer Dosierung</div>
        </div>
      </div>
    `
    
    // Speichere ausgewähltes Produkt mit Dosierung
    this.selectedProductForStack = { product, nutrient, dosage }
  }

  addSelectedProductToStack(product, nutrient, dosage) {
    console.log('[Demo Modal] Produkt zu Stack hinzugefügt:', product.name, 'Dosierung:', dosage.amount + dosage.unit)
    
    // HAUPTPRÜFUNG: Prüfung auf gleichen Wirkstoff/Nährstoff (wichtiger als Produkt)
    const existingNutrientProduct = this.products.find(p => {
      if (p.main_nutrients) {
        return p.main_nutrients.some(n => n.nutrient_id === nutrient.id)
      }
      return p.nutrient_id === nutrient.id // Fallback für alte Struktur
    })
    
    if (existingNutrientProduct) {
      // Gleicher Nährstoff bereits im Stack - egal ob gleiches oder anderes Produkt
      this.showDuplicateNutrientDialog(product, nutrient, dosage, existingNutrientProduct)
      return
    }
    
    // Wenn kein Nährstoff-Konflikt: Direkt hinzufügen
    this.finalizeAddProduct(product, nutrient, dosage)
  }

  showDuplicateProductDialog(product, nutrient, dosage, existingProduct) {
    this.closeAllModals()
    
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 28rem;">
        <div class="p-4 sm:p-6">
          <div class="flex items-center mb-4">
            <i class="fas fa-exclamation-triangle text-2xl text-orange-600 mr-3"></i>
            <h2 class="text-lg font-bold text-gray-900">Produkt bereits vorhanden</h2>
          </div>
          
          <p class="text-gray-700 mb-4">
            <strong>"${product.name}"</strong> ist bereits in Ihrem Stack enthalten.
          </p>
          
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div class="text-sm">
              <div class="font-medium text-yellow-800 mb-2">Aktuelle vs. Neue Dosierung:</div>
              <div class="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span class="text-yellow-700">Aktuell:</span>
                  <div class="font-medium">${existingProduct.custom_dosage || 'Standard'} ${this.getNutrientUnit(nutrient.id)}</div>
                </div>
                <div>
                  <span class="text-yellow-700">Neu:</span>
                  <div class="font-medium">${dosage.amount}${dosage.unit}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="flex flex-col space-y-2">
            <button id="replace-product" class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors">
              <i class="fas fa-sync mr-2"></i>Dosierung aktualisieren
            </button>
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Replace Handler
    modal.querySelector('#replace-product').addEventListener('click', () => {
      // Entferne das alte Produkt
      this.products = this.products.filter(p => p.id !== product.id)
      // Füge das neue hinzu
      this.finalizeAddProduct(product, nutrient, dosage)
      modal.remove()
    })
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  showDuplicateNutrientDialog(product, nutrient, dosage, existingProduct) {
    this.closeAllModals()
    
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem;">
        <div class="p-4 sm:p-6">
          <div class="flex items-center mb-4">
            <i class="fas fa-info-circle text-2xl text-blue-600 mr-3"></i>
            <h2 class="text-lg font-bold text-gray-900">Wirkstoff bereits vorhanden</h2>
          </div>
          
          <p class="text-gray-700 mb-4">
            Sie haben bereits ein Produkt für <strong>${nutrient.name}</strong> in Ihrem Stack:
          </p>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div class="font-medium text-blue-900 mb-1">Aktuelles Produkt:</div>
            <div class="text-sm text-blue-800">${existingProduct.name}</div>
            <div class="text-xs text-blue-600">${existingProduct.brand}</div>
          </div>
          
          <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div class="font-medium text-green-900 mb-1">Neues Produkt:</div>
            <div class="text-sm text-green-800">${product.name}</div>
            <div class="text-xs text-green-600">${product.brand}</div>
          </div>
          
          <div class="flex flex-col space-y-2">
            <button id="replace-nutrient-product" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              <i class="fas fa-sync mr-2"></i>Produkt ersetzen
            </button>
            <button id="keep-both" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
              <i class="fas fa-plus mr-2"></i>Trotzdem hinzufügen
            </button>
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Replace Handler
    modal.querySelector('#replace-nutrient-product').addEventListener('click', () => {
      this.products = this.products.filter(p => p.id !== existingProduct.id)
      this.finalizeAddProduct(product, nutrient, dosage)
      modal.remove()
    })
    
    // Keep Both Handler
    modal.querySelector('#keep-both').addEventListener('click', () => {
      this.finalizeAddProduct(product, nutrient, dosage)
      modal.remove()
    })
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  finalizeAddProduct(product, nutrient, dosage) {
    const nutrientInfo = product.main_nutrients.find(n => n.nutrient_id == nutrient.id)
    const amountPerUnit = nutrientInfo ? nutrientInfo.amount_per_unit : 0
    const requiredUnitsPerDay = Math.ceil(dosage.amount / amountPerUnit)
    const daysSupply = Math.floor(product.quantity / requiredUnitsPerDay)
    const monthlySupplyNeeded = 30 / daysSupply
    const customMonthlyPrice = product.purchase_price * monthlySupplyNeeded
    
    this.showMessage(`✅ "${product.name}" wurde zu Ihrem Stack hinzugefügt!\n💊 ${requiredUnitsPerDay} ${this.getPluralForm(requiredUnitsPerDay, product.form)}/Tag\n💰 €${customMonthlyPrice.toFixed(2)}/Monat`, 'success')
    
    // Produkt mit angepassten Werten zur Liste hinzufügen
    const customProduct = {
      ...product,
      // Angepasste Werte basierend auf individueller Dosierung
      dosage_per_day: requiredUnitsPerDay,
      days_supply: daysSupply,
      monthly_cost: customMonthlyPrice,
      custom_dosage: dosage.amount,
      custom_category: dosage.category,
      custom_notes: dosage.notes
    }
    this.products.push(customProduct)
    this.renderProducts()
  }

  updateDosageCalculation(form) {
    const nutrientId = form.querySelector('input[name="nutrient_id"]').value
    const amountPerUnit = parseFloat(form.querySelector('input[name="nutrient_amount_per_unit"]').value) || 0
    const dosagePerDay = parseFloat(form.querySelector('input[name="dosage_per_day"]').value) || 0
    const quantity = parseFloat(form.querySelector('input[name="quantity"]').value) || 0
    const purchasePrice = parseFloat(form.querySelector('input[name="purchase_price"]').value) || 0

    if (nutrientId && amountPerUnit > 0 && dosagePerDay > 0) {
      const nutrient = this.nutrients.find(n => n.id == nutrientId)
      
      if (nutrient) {
        // WICHTIG: Dosierung immer auf ganze Einheiten aufrunden
        const roundedDosage = Math.ceil(dosagePerDay)
        const dailyIntake = amountPerUnit * roundedDosage
        const dgePercent = ((dailyIntake / nutrient.dge_recommendation) * 100).toFixed(0)
        const supplyDuration = Math.floor(quantity / roundedDosage)
        const monthlyCosts = (purchasePrice / supplyDuration * 30).toFixed(2)

        form.querySelector('#daily-intake').textContent = `${dailyIntake}${nutrient.unit}`
        form.querySelector('#dge-coverage').textContent = `${dgePercent}% der DGE-Empfehlung`
        form.querySelector('#supply-duration').textContent = `${supplyDuration} Tage`
        form.querySelector('#monthly-costs').textContent = `€${monthlyCosts}`
        
        // Warnung bei aufgerundeter Dosierung anzeigen
        if (roundedDosage !== dosagePerDay) {
          const dosageInput = form.querySelector('input[name="dosage_per_day"]')
          dosageInput.value = roundedDosage
          this.showMessage(`Dosierung auf ${roundedDosage} aufgerundet - keine halben Einheiten möglich`, 'info')
        }
      }
    }
  }

  createStack(formData) {
    console.log('[Demo Modal] Neuer Stack erstellt (Demo)')
    const stackName = formData.get('stack_name')
    const description = formData.get('description') || ''
    
    // Demo: Stack zur Liste hinzufügen
    const newStack = {
      id: this.stacks.length + 1,
      name: stackName,
      description: description,
      products: [],
      total_monthly_cost: 0,
      created_at: new Date().toISOString()
    }
    
    this.stacks.push(newStack)
    this.updateStats()
    this.showMessage(`✅ Stack "${stackName}" erstellt! Fügen Sie jetzt Nährstoffe hinzu.`, 'success')
  }

  showNutrientBasedStackModal() {
    console.log('[Demo Modal] Zeige Stack erstellen Modal')
    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">
              <i class="fas fa-layer-group mr-2 text-purple-600"></i>
              Neuen Stack erstellen
            </h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h3 class="font-semibold text-purple-900 mb-2">📋 Was ist ein Stack?</h3>
            <div class="text-sm text-purple-800 space-y-1">
              <div>Ein Stack ist eine Sammlung von Nahrungsergänzungsmitteln</div>
              <div>Erstellen Sie erst den Stack, danach fügen Sie Nährstoffe hinzu</div>
            </div>
          </div>

          <form id="create-stack-form" class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Stack-Name *</label>
              <input type="text" name="stack_name" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm" placeholder="z.B. Basis Gesundheit, Immunsystem Plus">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Beschreibung</label>
              <textarea name="description" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm" placeholder="Kurze Beschreibung für was dieser Stack gedacht ist..."></textarea>
            </div>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 class="font-medium text-blue-900 mb-2">📌 Nach der Erstellung</h4>
              <div class="text-sm text-blue-800 space-y-1">
                <div>✅ Stack wird in Ihrer Liste angezeigt</div>
                <div>✅ Sie können Nährstoffe hinzufügen</div>
                <div>✅ Automatische Kostenberechnung</div>
              </div>
            </div>
            
            <div class="flex justify-end space-x-3 pt-4">
              <button type="button" onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
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
    
    document.body.appendChild(modal)
    this.setupCreateStackModalHandlers(modal)
  }

  setupCreateStackModalHandlers(modal) {
    const form = modal.querySelector('#create-stack-form')
    
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        this.createStack(new FormData(form))
        modal.remove()
      })
    }

    // Modal schließen
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  updateStackCalculation(modal, nutrient) {
    const desiredAmount = parseFloat(modal.querySelector('#desired-amount').value) || 0
    
    if (desiredAmount > 0) {
      // Ihre Menge anzeigen
      modal.querySelector('#your-amount').textContent = `${desiredAmount}${nutrient.unit}`
      
      // Verfügbare Produkte finden
      const availableProducts = this.products.filter(p => p.nutrient_id === nutrient.id)
      
      if (availableProducts.length > 0) {
        modal.querySelector('#product-selection').classList.remove('hidden')
        
        const productHTML = availableProducts.map(product => {
          // WICHTIG: Immer auf ganze Einheiten aufrunden
          const requiredDosage = Math.ceil(desiredAmount / product.nutrient_amount_per_unit)
          const dailyCost = (product.purchase_price / product.quantity * requiredDosage).toFixed(2)
          const monthlyCost = (dailyCost * 30).toFixed(2)
          
          return `
            <div class="product-option p-3 border border-gray-200 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors" data-product-id="${product.id}" data-required-dosage="${requiredDosage}">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="font-medium text-gray-900">${product.name}</div>
                  <div class="text-sm text-gray-600">${product.brand} • ${product.form}</div>
                  <div class="text-sm text-blue-600 mt-1">${product.nutrient_amount_per_unit}${nutrient.unit} pro ${product.form}</div>
                </div>
                <div class="text-right text-sm">
                  <div class="font-medium text-orange-600">${requiredDosage} ${product.form}/Tag</div>
                  <div class="text-gray-600">€${monthlyCost}/Monat</div>
                </div>
              </div>
            </div>
          `
        }).join('')
        
        modal.querySelector('#available-products').innerHTML = productHTML
        
        // Produkt-Auswahl Handler
        modal.querySelector('#available-products').addEventListener('click', (e) => {
          const option = e.target.closest('.product-option')
          if (option) {
            // Auswahl markieren
            modal.querySelectorAll('.product-option').forEach(opt => {
              opt.classList.remove('bg-orange-100', 'border-orange-300')
            })
            option.classList.add('bg-orange-100', 'border-orange-300')
            
            // Stack-Ergebnis anzeigen
            const productId = option.dataset.productId
            const requiredDosage = option.dataset.requiredDosage
            this.showStackResult(modal, nutrient, desiredAmount, productId, requiredDosage)
          }
        })
      } else {
        modal.querySelector('#available-products').innerHTML = `
          <div class="text-center text-gray-500 py-4">
            <i class="fas fa-info-circle text-2xl mb-2"></i>
            <p>Keine Produkte für ${nutrient.name} verfügbar</p>
            <p class="text-sm">Fügen Sie zuerst ein Produkt mit diesem Wirkstoff hinzu.</p>
          </div>
        `
      }
    }
  }

  showStackResult(modal, nutrient, desiredAmount, productId, requiredDosage) {
    const product = this.products.find(p => p.id == productId)
    
    if (product) {
      // WICHTIG: requiredDosage ist bereits aufgerundet
      const roundedDosage = Math.ceil(parseFloat(requiredDosage))
      const dailyCost = (product.purchase_price / product.quantity * roundedDosage)
      const monthlyCost = dailyCost * 30
      const packageDuration = Math.floor(product.quantity / roundedDosage)
      const actualIntake = product.nutrient_amount_per_unit * roundedDosage
      const dgePercent = ((actualIntake / nutrient.dge_recommendation) * 100).toFixed(0)
      
      modal.querySelector('#stack-result').classList.remove('hidden')
      modal.querySelector('#create-stack-btn').classList.remove('hidden')
      
      modal.querySelector('#stack-summary').innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div class="bg-white p-3 rounded-lg border">
              <div class="text-sm text-gray-600">Produkt</div>
              <div class="font-medium">${product.name}</div>
              <div class="text-xs text-gray-500">${product.brand}</div>
            </div>
            
            <div class="bg-white p-3 rounded-lg border">
              <div class="text-sm text-gray-600">Dosierung</div>
              <div class="font-medium text-lg">${roundedDosage} ${this.getPluralForm(roundedDosage, product.form)}/Tag</div>
              <div class="text-xs text-gray-500">für ${desiredAmount}${nutrient.unit} ${nutrient.name}</div>
            </div>
          </div>
          
          <div class="space-y-3">
            <div class="bg-white p-3 rounded-lg border">
              <div class="text-sm text-gray-600">Nährstoffaufnahme</div>
              <div class="font-medium text-lg">${actualIntake}${nutrient.unit}</div>
              <div class="text-xs ${dgePercent >= 100 ? 'text-green-600' : 'text-orange-600'}">${dgePercent}% der DGE-Empfehlung</div>
            </div>
            
            <div class="bg-white p-3 rounded-lg border">
              <div class="text-sm text-gray-600">Kosten</div>
              <div class="font-medium text-lg">€${monthlyCost.toFixed(2)}/Monat</div>
              <div class="text-xs text-gray-500">Packung reicht ${packageDuration} Tage</div>
            </div>
          </div>
        </div>
      `
    }
  }

  showProductDetails(productId) {
    console.log('[Demo Modal] Zeige Product Details Modal für ID:', productId)
    const product = this.products.find(p => p.id === productId)
    if (!product) return

    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 42rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">${product.name}</h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Tab Navigation -->
          <div class="border-b border-gray-200 mb-6">
            <nav class="-mb-px flex space-x-8" aria-label="Tabs">
              <button class="product-tab border-b-2 border-blue-500 text-blue-600 py-2 px-1 text-sm font-medium" data-tab="overview">
                Übersicht
              </button>
              <button class="product-tab border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-2 px-1 text-sm font-medium" data-tab="nutrient">
                Nährstoff
              </button>
              <button class="product-tab border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-2 px-1 text-sm font-medium" data-tab="dosage">
                Dosierung
              </button>
              <button class="product-tab border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 py-2 px-1 text-sm font-medium" data-tab="costs">
                Kosten
              </button>
            </nav>
          </div>

          <div class="tab-content">
            <!-- Übersicht Tab -->
            <div id="tab-overview" class="tab-pane active">
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-gray-50 rounded-lg p-4">
                    <div class="text-sm text-gray-600">Hersteller</div>
                    <div class="font-semibold text-gray-900">${product.brand}</div>
                  </div>
                  <div class="bg-gray-50 rounded-lg p-4">
                    <div class="text-sm text-gray-600">Form</div>
                    <div class="font-semibold text-gray-900">${product.form}</div>
                  </div>
                </div>
                
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 class="font-semibold text-blue-900 mb-2">Beschreibung</h3>
                  <p class="text-blue-800">${product.description}</p>
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
    this.setupProductDetailsModal(modal)
  }

  setupProductDetailsModal(modal) {
    // Tab-Switching
    const tabButtons = modal.querySelectorAll('.product-tab')
    const tabPanes = modal.querySelectorAll('.tab-pane')
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset.tab
        
        // Alle Tabs deaktivieren
        tabButtons.forEach(btn => {
          btn.classList.remove('border-blue-500', 'text-blue-600')
          btn.classList.add('border-transparent', 'text-gray-500')
        })
        
        // Alle Tab-Inhalte verstecken
        tabPanes.forEach(pane => {
          pane.classList.add('hidden')
        })
        
        // Aktiven Tab aktivieren
        button.classList.add('border-blue-500', 'text-blue-600')
        button.classList.remove('border-transparent', 'text-gray-500')
        
        // Ziel-Tab-Inhalt anzeigen
        const targetPane = modal.querySelector(`#tab-${targetTab}`)
        if (targetPane) {
          targetPane.classList.remove('hidden')
        }
      })
    })

    // Modal schließen
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  renderNutrientInfo(product) {
    // Unterstützung für neue und alte Produktstruktur
    let nutrient, amountPerUnit
    
    if (product.main_nutrients && product.main_nutrients.length > 0) {
      // Neue Struktur
      const mainNutrientInfo = product.main_nutrients[0]
      nutrient = this.nutrients.find(n => n.id === mainNutrientInfo.nutrient_id)
      amountPerUnit = mainNutrientInfo.amount_per_unit
    } else {
      // Alte Struktur
      nutrient = this.nutrients.find(n => n.id === product.nutrient_id)
      amountPerUnit = product.nutrient_amount_per_unit || 0
    }
    
    if (!nutrient) {
      return `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>Keine Nährstoffinformationen verfügbar</p>
          <p class="text-sm">Dieses Produkt ist noch nicht einem Wirkstoff zugeordnet.</p>
        </div>
      `
    }
    
    const dailyAmount = amountPerUnit * (product.dosage_per_day || 1)
    const dgePercent = dailyAmount > 0 ? ((dailyAmount / nutrient.dge_recommendation) * 100).toFixed(0) : 0
    
    return `
      <div class="space-y-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 class="font-semibold text-blue-900 mb-3">${nutrient.name}</h3>
          <p class="text-blue-800 text-sm mb-3">${nutrient.description}</p>
          
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-blue-700">Kategorie:</span>
              <div class="font-medium">${nutrient.category}</div>
            </div>
            <div>
              <span class="text-blue-700">Einheit:</span>
              <div class="font-medium">${nutrient.unit}</div>
            </div>
          </div>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-600">Pro ${product.form}</div>
            <div class="text-xl font-bold text-gray-900">${amountPerUnit}${nutrient.unit}</div>
          </div>
          <div class="bg-green-50 rounded-lg p-4">
            <div class="text-sm text-gray-600">Täglich bei ${product.dosage_per_day} ${product.form}</div>
            <div class="text-xl font-bold text-green-600">${dailyAmount}${nutrient.unit}</div>
          </div>
        </div>
        
        <div class="space-y-3">
          <div class="flex justify-between items-center py-2 border-b border-gray-200">
            <span class="text-gray-600">DGE-Empfehlung:</span>
            <span class="font-medium">${nutrient.dge_recommendation}${nutrient.unit}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-200">
            <span class="text-gray-600">Ihre Aufnahme:</span>
            <span class="font-medium text-green-600">${dailyAmount}${nutrient.unit}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-200">
            <span class="text-gray-600">DGE-Abdeckung:</span>
            <span class="font-medium ${dgePercent >= 100 ? 'text-green-600' : 'text-orange-500'}">${dgePercent}%</span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="text-gray-600">DGE-Obergrenze:</span>
            <span class="font-medium ${dailyAmount > nutrient.dge_upper_limit ? 'text-yellow-600' : 'text-gray-900'}">${nutrient.dge_upper_limit}${nutrient.unit}</span>
          </div>
        </div>
        
        ${dailyAmount > nutrient.dge_upper_limit ? `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div class="flex items-center text-yellow-800">
              <i class="fas fa-info-circle mr-2"></i>
              <span class="font-medium">Hinweis: Über DGE-Obergrenze</span>
            </div>
            <p class="text-yellow-700 text-sm mt-1">Die tägliche Aufnahme liegt über der <a href="https://dge.de" target="_blank" class="text-blue-600 underline">DGE-Obergrenze</a>.</p>
          </div>
        ` : ''}
      </div>
    `
  }

  editProduct(productId) {
    console.log('[Demo Modal] Zeige Edit Modal für Produkt ID:', productId)
    // Vereinfachte Edit-Funktion für Demo
    const product = this.products.find(p => p.id === productId)
    if (!product) return

    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 32rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">
              <i class="fas fa-edit mr-2 text-blue-600"></i>
              ${product.name} bearbeiten
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
                <div class="font-semibold">€${product.purchase_price.toFixed(2)}</div>
              </div>
              <div class="bg-green-50 rounded-lg p-3">
                <div class="text-gray-600">Monatliche Kosten</div>
                <div class="font-semibold text-green-600">€${product.monthly_cost.toFixed(2)}</div>
              </div>
            </div>
            
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="text-gray-600 text-sm">Wirkstoff</div>
              <div class="font-semibold">${this.getNutrientName(product.nutrient_id)}</div>
              <div class="text-sm text-gray-500">${product.nutrient_amount_per_unit}${this.getNutrientUnit(product.nutrient_id)} pro ${product.form}</div>
            </div>
          </div>
          
          <div class="mt-6 flex justify-end space-x-3">
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Schließen
            </button>
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              <i class="fas fa-external-link-alt mr-2"></i>Vollversion nutzen
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Modal schließen
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  deleteProduct(productId) {
    console.log('[Demo Modal] Delete Product:', productId)
    const product = this.products.find(p => p.id === productId)
    if (!product) return

    this.closeAllModals()

    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 28rem;">
        <div class="p-4 sm:p-6">
          <div class="flex items-center mb-4">
            <i class="fas fa-trash text-2xl text-orange-600 mr-3"></i>
            <h2 class="text-lg font-bold text-gray-900">Produkt löschen</h2>
          </div>
          
          <p class="text-gray-700 mb-4">
            Möchten Sie <strong>"${product.name}"</strong> wirklich löschen?
          </p>
          
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p class="text-yellow-800 text-sm">
              <i class="fas fa-info-circle mr-1"></i>
              In der Demo werden keine Daten dauerhaft gelöscht.
            </p>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
            <button onclick="window.demoApp.confirmDelete(${productId}); this.closest('.modal-overlay').remove()" class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors">
              <i class="fas fa-trash mr-2"></i>Löschen
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Modal schließen
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
  }

  confirmDelete(productId) {
    console.log('[Demo Modal] Produkt gelöscht (Demo):', productId)
    // In echter App: API-Aufruf zum Löschen
    // Für Demo: Feedback anzeigen
    this.showMessage('✅ Produkt gelöscht (Demo-Modus)', 'success')
  }

  addProduct(formData) {
    console.log('[Demo Modal] Neues Produkt hinzugefügt (Demo)')
    // In echter App: API-Aufruf zum Hinzufügen
    // Für Demo: Feedback anzeigen
    this.showMessage('✅ Produkt hinzugefügt (Demo-Modus)', 'success')
    
    // Demo: Produkt zur Liste hinzufügen
    const newProduct = {
      id: this.products.length + 1,
      name: formData.get('name'),
      brand: formData.get('brand'),
      form: formData.get('form'),
      purchase_price: parseFloat(formData.get('purchase_price')),
      quantity: parseInt(formData.get('quantity')),
      nutrient_id: parseInt(formData.get('nutrient_id')),
      nutrient_amount_per_unit: parseFloat(formData.get('nutrient_amount_per_unit')),
      dosage_per_day: parseFloat(formData.get('dosage_per_day')),
      category: formData.get('category'),
      description: formData.get('description') || 'Hinzugefügt in Demo',
      benefits: ['Demo-Vorteil 1', 'Demo-Vorteil 2'],
      warnings: ['Demo-Warnung'],
      dosage_recommendation: formData.get('dosage_recommendation') || 'Nach Packungsangabe'
    }
    
    // Berechnungen
    newProduct.price_per_piece = newProduct.purchase_price / newProduct.quantity
    newProduct.days_supply = Math.floor(newProduct.quantity / newProduct.dosage_per_day)
    newProduct.monthly_cost = (newProduct.purchase_price / newProduct.days_supply * 30)
    
    this.products.push(newProduct)
    this.renderProducts()
    this.updateStats()
  }

  showMessage(message, type = 'info') {
    const toast = document.createElement('div')
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
      type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
      type === 'error' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
      'bg-blue-100 text-blue-800 border border-blue-200'
    }`
    toast.textContent = message
    
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.style.opacity = '0'
      toast.style.transform = 'translateX(100%)'
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }
}

// Initialisierung
console.log('[Demo Modal] Lade Modal-Demo...')

function initDemoModal() {
  console.log('[Demo Modal] Initialisiere Modal-Demo...')
  if (window.demoApp) {
    console.log('[Demo Modal] Demo bereits geladen, überspringe...')
    return
  }
  
  try {
    window.demoApp = new SupplementDemoApp()
    console.log('[Demo Modal] Modal-Demo erfolgreich initialisiert!')
  } catch (error) {
    console.error('[Demo Modal] Fehler bei Initialisierung:', error)
  }
}

// Mehrfache Initialisierung sicherstellen
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDemoModal)
} else {
  initDemoModal()
}

// Zusätzlicher Fallback
setTimeout(initDemoModal, 500)
setTimeout(initDemoModal, 2000)

console.log('[Demo Modal] Script geladen')