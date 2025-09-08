// Demo App mit Modal-Layern - Supplement Stack
// Ersetzt alert()-Dialoge durch richtige Modal-Interface mit Suche

class SupplementDemoApp {
  constructor() {
    this.availableProducts = this.loadDemoProducts()  // Verfügbare Produkte (Demo-Daten als Fallback)
    this.products = []  // Produkte im Stack (initial leer)
    this.stacks = []  // Will be loaded based on mode
    this.nutrients = this.loadNutrients()
    this.currentStackId = null  // Aktuell ausgewählter Stack
    this.userStacks = []  // User's personal stacks (Dashboard only)
    this.userProducts = []  // User's personal products (Dashboard only)
    this.dataLoaded = false  // Track if user data has been loaded
    this.init()
  }

  async init() {
    console.log('[Demo Modal] Initialisierung startet...')
    
    // Add visible indicator that JavaScript is working - mode-aware title
    if (this.isDashboardMode()) {
      document.title = 'Dashboard - Supplement Stack (JS Modal Loaded!)'
    } else {
      document.title = 'Demo - Supplement Stack (JS Modal Loaded!)'
    }
    
    this.setupEventListeners()
    
    // Check if we're in dashboard mode and load user data
    if (this.isDashboardMode()) {
      console.log('[Dashboard Mode] Loading user-specific data...')
      await this.loadDashboardData()
    } else {
      console.log('[Demo Mode] Loading demo stacks...')
      // Try to load from session storage first
      const sessionStacks = this.loadDemoStacksFromSession()
      if (sessionStacks && sessionStacks.length > 0) {
        this.stacks = sessionStacks
        console.log('[Demo Mode] Using session-stored stacks:', this.stacks.length)
      } else {
        this.stacks = this.loadDemoStacks()
        console.log('[Demo Mode] Using default hardcoded stacks:', this.stacks.length)
        // Save initial stacks to session
        this.saveDemoStacksToSession()
      }
    }
    
    // Stack-Selector initialisieren
    setTimeout(async () => await this.initStackSelector(), 100)
    
    // Demo-Stack mit ein paar Produkten vorbesetzen
    // this.addDemoStackProducts() // Deaktiviert, da wir vordefinierte Stacks verwenden
    
    // Stack-Rendering nach DOM-Load
    setTimeout(() => this.renderStack(), 500)
    
    this.updateStats()
    
    // Show success message based on mode
    const modeMessage = this.isDashboardMode() ? 
      'Dashboard erfolgreich geladen! Ihre Daten werden automatisch gespeichert.' :
      'Demo-Modal-App erfolgreich geladen! Modals schließen sich jetzt automatisch.'
    this.showSuccess(modeMessage)
    
    console.log(`[Demo Modal] Initialisierung abgeschlossen - ${this.availableProducts.length} verfügbare Produkte, ${this.products.length} im Stack, Mode: ${this.isDashboardMode() ? 'Dashboard' : 'Demo'}`)
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

  showQuickNotification(message, type = 'info') {
    const notification = document.createElement('div')
    notification.className = `fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all duration-500 transform translate-x-full ${
      type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' :
      type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' :
      'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
    }`
    
    // Add icon based on type
    const icon = type === 'success' ? 'fas fa-check-circle' : 
                type === 'error' ? 'fas fa-exclamation-circle' : 
                'fas fa-info-circle'
    
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <i class="${icon}"></i>
        <span>${message}</span>
      </div>
    `
    
    document.body.appendChild(notification)
    
    // Einblenden
    setTimeout(() => {
      notification.classList.remove('translate-x-full')
      notification.classList.add('translate-x-0')
    }, 100)
    
    // Ausblenden nach 1.5 Sekunden
    setTimeout(() => {
      notification.classList.remove('translate-x-0')
      notification.classList.add('translate-x-full')
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove()
        }
      }, 500)
    }, 1500)
  }

  addDemoStackProducts() {
    console.log('[Demo Modal] Skipping addDemoStackProducts - using predefined stacks instead')
    // Diese Funktion wird nicht mehr benötigt, da wir vordefinierte Stacks verwenden
    // Die Produkte werden über loadStack() aus den Stack-Definitionen geladen
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

    // Event Delegation für Checkbox-Änderungen in Produkten
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('product-checkbox')) {
        console.log('[Demo Modal] Product checkbox changed:', e.target.dataset.productId, 'checked:', e.target.checked)
        
        // Aktualisiere Footer-Preise wenn Checkbox geändert wird
        this.updatePriceFooter()
        
        // Optional: Zeige kurze Rückmeldung
        const productId = e.target.dataset.productId
        const product = this.products.find(p => p.id == productId)
        if (product) {
          const message = e.target.checked ? 
            `✅ ${product.name} ausgewählt` : 
            `❌ ${product.name} abgewählt`
          
          // Kurze Benachrichtigung (nur 1 Sekunde)
          this.showQuickNotification(message, e.target.checked ? 'success' : 'info')
        }
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
        main_nutrients: [{ nutrient_id: 4, amount_per_unit: 1000 }], // Omega-3 1000mg (Gesamt)
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center',
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
        main_nutrients: [{ nutrient_id: 5, amount_per_unit: 15 }], // Zink 15mg
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop&crop=center',
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
        main_nutrients: [{ nutrient_id: 6, amount_per_unit: 1000 }], // Vitamin C 1000mg
        secondary_nutrients: [],
        recommended: true,
        recommendation_rank: 1,
        product_image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center',
        shop_url: 'https://example.com/vitamin-c'
      }
    ]
  }

  // Save stacks to session storage
  saveDemoStacksToSession() {
    try {
      sessionStorage.setItem('demoStacks', JSON.stringify(this.stacks))
      console.log('[Demo Modal] Saved', this.stacks.length, 'stacks to session storage')
    } catch (error) {
      console.warn('[Demo Modal] Failed to save stacks to session storage:', error)
    }
  }
  
  // Load stacks from session storage
  loadDemoStacksFromSession() {
    try {
      const savedStacks = sessionStorage.getItem('demoStacks')
      if (savedStacks) {
        const stacks = JSON.parse(savedStacks)
        console.log('[Demo Modal] Loaded', stacks.length, 'stacks from session storage')
        return stacks
      }
    } catch (error) {
      console.warn('[Demo Modal] Failed to load stacks from session storage:', error)
    }
    return null
  }
  
  // Clear demo stacks from session storage
  clearDemoStacksFromSession() {
    try {
      sessionStorage.removeItem('demoStacks')
      console.log('[Demo Modal] Cleared stacks from session storage')
    } catch (error) {
      console.warn('[Demo Modal] Failed to clear stacks from session storage:', error)
    }
  }

  loadDemoStacks() {
    return [
      {
        id: 1,
        name: 'Basisausstattung',
        products: [1, 3, 5],
        total_monthly_cost: 31.64,
        description: 'Grundversorgung mit wichtigsten Vitaminen und Mineralien'
      },
      {
        id: 2,
        name: 'Gesundheit',
        products: [1, 2, 5, 6],
        total_monthly_cost: 35.42,
        description: 'Optimale Unterstützung des Immunsystems'
      },
      {
        id: 3,
        name: 'Sport & Leistung',
        products: [11, 4],
        total_monthly_cost: 28.90,
        description: 'Supplements für sportliche Performance'
      },
      {
        id: 4,
        name: 'Spezielle Bedürfnisse',
        products: [],
        total_monthly_cost: 0,
        description: 'Individuell angepasste Supplements'
      }
    ]
  }

  loadNutrients() {
    return [
      // HAUPTWIRKSTOFFE - Das, was Nutzer suchen
      { 
        id: 1, 
        name: 'Vitamin D3', 
        unit: 'IE', 
        category: 'Vitamine', 
        is_main_nutrient: true,
        dge_recommendation: 800, 
        dge_upper_limit: 4000, 
        description: 'Wichtig für Knochengesundheit und Immunsystem',
        study_recommendation: 2000,
        study_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6266123/',
        study_title: 'Vitamin D3 Supplementation in Adults - Systematic Review',
        dge_info_url: 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-d/',
        synonyms: ['D3', 'Cholecalciferol', 'Vitamin D', 'Sonnenvitamin']
      },
      { 
        id: 2, 
        name: 'Vitamin B12', 
        unit: 'µg', 
        category: 'Vitamine', 
        is_main_nutrient: true,
        dge_recommendation: 4, 
        dge_upper_limit: 1000, 
        description: 'Essential für Nervensystem und Blutbildung',
        dge_info_url: 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-b12/',
        synonyms: ['B12', 'Cobalamin', 'Methylcobalamin', 'Cyanocobalamin']
      },
      { 
        id: 3, 
        name: 'Magnesium', 
        unit: 'mg', 
        category: 'Mineralien', 
        is_main_nutrient: true,
        dge_recommendation: 300, 
        dge_upper_limit: 350, 
        description: 'Wichtig für Muskeln und Energiestoffwechsel',
        study_recommendation: 400,
        study_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5637834/',
        study_title: 'Magnesium Supplementation and Health Outcomes',
        dge_info_url: 'https://www.dge.de/wissenschaft/referenzwerte/magnesium/',
        synonyms: ['Mg', 'Magnium']
      },
      { 
        id: 4, 
        name: 'Omega-3', 
        unit: 'mg', 
        category: 'Fettsäuren', 
        is_main_nutrient: true,
        dge_recommendation: 250, 
        dge_upper_limit: 5000, 
        description: 'Essentielle Fettsäuren für Herz, Gehirn und Entzündungshemmung',
        dge_info_url: 'https://www.dge.de/wissenschaft/referenzwerte/fett/',
        synonyms: ['Omega 3', 'Fischöl', 'Algenöl', 'Marine Omega'],
        sub_nutrients: [41, 42, 43] // EPA, DHA, DPA
      },
      { 
        id: 5, 
        name: 'Zink', 
        unit: 'mg', 
        category: 'Mineralien', 
        is_main_nutrient: true,
        dge_recommendation: 10, 
        dge_upper_limit: 25, 
        description: 'Essential für Immunsystem und Wundheilung',
        dge_info_url: 'https://www.dge.de/wissenschaft/referenzwerte/zink/',
        synonyms: ['Zn', 'Zinc', 'Bisglycinat', 'Citrat']
      },
      { 
        id: 6, 
        name: 'Vitamin C', 
        unit: 'mg', 
        category: 'Vitamine', 
        is_main_nutrient: true,
        dge_recommendation: 110, 
        dge_upper_limit: 1000, 
        description: 'Antioxidans und Kollagenbildung',
        study_recommendation: 1000,
        study_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579810/',
        study_title: 'Vitamin C and Immune Function',
        dge_info_url: 'https://www.dge.de/wissenschaft/referenzwerte/vitamin-c/',
        synonyms: ['C', 'Ascorbinsäure', 'Ester-C']
      },
      { 
        id: 11, 
        name: 'L-Carnitin', 
        unit: 'mg', 
        category: 'Aminosäuren', 
        is_main_nutrient: true,
        dge_recommendation: 300, 
        dge_upper_limit: 3000, 
        description: 'Unterstützt Fettstoffwechsel und Energieproduktion',
        synonyms: ['Carnitin', 'Acetyl-L-Carnitin']
      },
      
      // SUB-WIRKSTOFFE - Können gesucht werden, verweisen auf Hauptwirkstoff
      { 
        id: 41, 
        name: 'EPA', 
        unit: 'mg', 
        category: 'Fettsäuren', 
        is_main_nutrient: false,
        parent_nutrient_id: 4, // Verweist auf Omega-3
        dge_recommendation: 250, 
        dge_upper_limit: 5000, 
        description: 'Eicosapentaensäure - eine der wichtigsten Omega-3-Fettsäuren',
        synonyms: ['Eicosapentaensäure']
      },
      { 
        id: 42, 
        name: 'DHA', 
        unit: 'mg', 
        category: 'Fettsäuren', 
        is_main_nutrient: false,
        parent_nutrient_id: 4, // Verweist auf Omega-3
        dge_recommendation: 100, 
        dge_upper_limit: 5000, 
        description: 'Docosahexaensäure - wichtig für Gehirn und Augen',
        synonyms: ['Docosahexaensäure']
      },
      { 
        id: 43, 
        name: 'DPA', 
        unit: 'mg', 
        category: 'Fettsäuren', 
        is_main_nutrient: false,
        parent_nutrient_id: 4, // Verweist auf Omega-3
        dge_recommendation: 10, 
        dge_upper_limit: 1000, 
        description: 'Docosapentaensäure - weitere wichtige Omega-3-Fettsäure',
        synonyms: ['Docosapentaensäure']
      },
      
      // Weitere bekannte Nährstoffe für Vollständigkeit
      { 
        id: 7, 
        name: 'Vitamin B6', 
        unit: 'mg', 
        category: 'Vitamine', 
        is_main_nutrient: true,
        dge_recommendation: 1.4, 
        dge_upper_limit: 25, 
        description: 'Aminosäurestoffwechsel und Nervenfunktion',
        synonyms: ['B6', 'Pyridoxin']
      },
      { 
        id: 8, 
        name: 'Folsäure', 
        unit: 'µg', 
        category: 'Vitamine', 
        is_main_nutrient: true,
        dge_recommendation: 400, 
        dge_upper_limit: 1000, 
        description: 'DNA-Synthese und Zellteilung',
        synonyms: ['Folat', 'Vitamin B9']
      },
      { 
        id: 9, 
        name: 'Eisen', 
        unit: 'mg', 
        category: 'Mineralien', 
        is_main_nutrient: true,
        dge_recommendation: 15, 
        dge_upper_limit: 45, 
        description: 'Sauerstofftransport und Energiestoffwechsel',
        synonyms: ['Fe', 'Iron']
      },
      { 
        id: 10, 
        name: 'Calcium', 
        unit: 'mg', 
        category: 'Mineralien', 
        is_main_nutrient: true,
        dge_recommendation: 1000, 
        dge_upper_limit: 2500, 
        description: 'Knochen- und Zahngesundheit',
        synonyms: ['Ca', 'Kalzium']
      }
    ]
  }



  renderStack() {
    const stackGrid = document.getElementById('demo-stack-grid')
    if (!stackGrid) {
      console.log('[Demo Modal] Stack-Grid nicht gefunden - wird später geladen')
      return
    }
    
    try {
      // Bestimme welche Produkte angezeigt werden sollen basierend auf aktuellem Stack
      const currentProducts = this.getCurrentProducts()
      console.log('[Demo Modal] Rendering stack with', currentProducts.length, 'products')
    
    const html = currentProducts.map((product, index) => {
      // Bestimme Einnahmezeit basierend auf Produkttyp/Name für Konsistenz
      const intakeTime = this.getProductIntakeTime(product)
      
      // Bestimme Farbe basierend auf Einnahmezeit
      const labelColor = this.getIntakeTimeLabelColor(intakeTime)
      
      return `
        <div class="bg-white border-0 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
          <!-- Gradient Overlay für Premium-Look -->
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500"></div>
          
          <!-- Checkbox mit modernem Design -->
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-2">
              <!-- Premium Badge falls empfohlen -->
              ${product.recommended ? `
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200">
                  <i class="fas fa-star text-purple-500 mr-1"></i>Top
                </span>
              ` : ''}
            </div>
            <input type="checkbox" class="product-checkbox w-5 h-5 text-emerald-600 rounded-md focus:ring-emerald-500 focus:ring-2" data-product-id="${product.id}" checked>
          </div>
          
          <!-- Kompaktes Produktbild und Info -->
          <div class="flex items-center mb-4 space-x-3">
            ${product.product_image ? `
              <div class="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm">
                <img src="${product.product_image}" alt="${product.name}" class="w-full h-full object-cover">
              </div>
            ` : `
              <div class="w-14 h-14 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex items-center justify-center shadow-sm">
                <i class="fas fa-pills text-emerald-500 text-lg"></i>
              </div>
            `}
            
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-slate-800 text-sm mb-1 truncate">${product.name}</h3>
              <p class="text-xs text-slate-500 mb-2 font-medium">${product.brand}</p>
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
              <div class="text-sm font-bold text-slate-800">${product.dosage_per_day} ${this.getPluralForm(product.dosage_per_day, product.form)}</div>
              <div class="text-xs text-slate-500">täglich</div>
            </div>
            
            <!-- Vorrat -->
            <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-200">
              <div class="text-xs text-blue-600 font-medium mb-1">Vorrat</div>
              <div class="text-sm font-bold text-blue-800">${Math.floor(product.quantity / product.dosage_per_day)}</div>
              <div class="text-xs text-blue-500">Tage</div>
            </div>
          </div>
          
          <!-- Wirkung kompakt -->
          <div class="mb-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200">
            <div class="flex items-start space-x-2">
              <i class="fas fa-leaf text-emerald-500 mt-0.5 flex-shrink-0"></i>
              <div>
                <div class="text-xs font-semibold text-emerald-700 mb-1">Wirkung</div>
                <div class="text-xs text-emerald-600 leading-relaxed">${(product.benefits || []).slice(0, 2).join(' • ')}</div>
              </div>
            </div>
          </div>
          
          <!-- Preise mit modernem Design -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="text-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200">
              <div class="text-xs text-slate-600 font-medium">Einmalig</div>
              <div class="text-lg font-bold text-slate-800">€${(product.purchase_price || 0).toFixed(2)}</div>
            </div>
            <div class="text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-3 border border-emerald-200">
              <div class="text-xs text-emerald-600 font-medium">Monatlich</div>
              <div class="text-lg font-bold text-emerald-700">€${(product.monthly_cost || 0).toFixed(2)}</div>
            </div>
          </div>
          
          <!-- Action Buttons for Edit/Delete -->
          <div class="flex gap-2">
            <button onclick="window.demoApp && window.demoApp.editProduct(${product.id})" class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:ring-4 focus:ring-blue-200 focus:outline-none text-sm">
              <i class="fas fa-edit mr-2"></i>Bearbeiten
            </button>
            <button onclick="window.demoApp && window.demoApp.deleteProduct(${product.id})" class="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-3 px-2 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:ring-4 focus:ring-red-200 focus:outline-none text-sm">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          
          <!-- Hover-Effekt Shine -->
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 hover:opacity-20 transition-opacity duration-500 pointer-events-none transform -skew-x-12 -translate-x-full hover:translate-x-full"></div>
        </div>
      `
    }).join('')
    
    console.log('[Demo Modal] Generated HTML length:', html.length, 'characters')
    console.log('[Demo Modal] Setting stackGrid innerHTML...')
    stackGrid.innerHTML = html
    console.log('[Demo Modal] StackGrid innerHTML set, element children:', stackGrid.children.length)
    this.updateStackSummary()
      
      // WICHTIG: Nach dem Rendering auch Footer aktualisieren
      setTimeout(() => {
        this.updatePriceFooter()
      }, 100)
      
      console.log('[Demo Modal] Stack gerendert:', currentProducts.length, 'Produkte')
      
    } catch (error) {
      console.error('[Demo Modal] Error in renderStack:', error)
      stackGrid.innerHTML = `
        <div class="col-span-full text-center py-8">
          <div class="text-gray-500">
            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
            <p>Fehler beim Laden der Produkte</p>
            <p class="text-sm">Bitte laden Sie die Seite neu</p>
          </div>
        </div>
      `
    }
  }

  // Hilfsmethode: Gibt die aktuellen Produkte basierend auf dem ausgewählten Stack zurück
  getCurrentProducts() {
    console.log('[Demo Modal] getCurrentProducts called, currentStackId:', this.currentStackId)
    console.log('[Demo Modal] App instance check - this === window.demoApp:', this === window.demoApp)
    
    // Always return this.products as it contains the loaded products for the current stack
    // regardless of currentStackId state
    console.log('[Demo Modal] Returning loaded products from this.products:', this.products.length)
    return this.products || []
  }

  updateStackSummary() {
    // Verwende nur ausgewählte Produkte für die Berechnung
    const selectedProducts = this.getSelectedProducts()
    const totalPurchase = selectedProducts.reduce((sum, p) => sum + p.purchase_price, 0)
    const totalMonthly = selectedProducts.reduce((sum, p) => sum + p.monthly_cost, 0)
    
    const purchaseCostEl = document.getElementById('total-purchase-cost')
    const monthlyCostEl = document.getElementById('total-monthly-cost')
    
    if (purchaseCostEl) purchaseCostEl.textContent = `€${totalPurchase.toFixed(2)}`
    if (monthlyCostEl) monthlyCostEl.textContent = `€${totalMonthly.toFixed(2)}`
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
    // Sichere Behandlung von undefined/null Werten
    if (!form || typeof form !== 'string') {
      console.warn('[Demo Modal] Invalid form parameter in getPluralForm:', form)
      return 'Einheiten' // Fallback
    }
    
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
    
    // Update price footer and stack summary
    this.updateStackSummary()
    this.updatePriceFooter()
  }

  updatePriceFooter() {
    const totalProducts = this.products.length
    
    if (totalProducts === 0) {
      this.hidePriceFooter()
      return
    }
    
    // Berechne Gesamtkosten nur für ausgewählte/aktivierte Produkte
    const selectedProducts = this.getSelectedProducts()
    const totalMonthlyPrice = selectedProducts.reduce((sum, product) => {
      return sum + (product.monthly_cost || 0)
    }, 0)
    
    const totalPurchasePrice = selectedProducts.reduce((sum, product) => {
      return sum + (product.purchase_price || 0)
    }, 0)
    
    this.showPriceFooter(selectedProducts.length, totalMonthlyPrice, totalPurchasePrice)
  }

  // Neue Hilfsfunktion: Gibt nur die ausgewählten (aktivierten) Produkte zurück
  getSelectedProducts() {
    // Sichere Prüfung ob DOM bereit ist
    const checkboxes = document.querySelectorAll('.product-checkbox:checked')
    
    // Falls noch keine Checkboxen existieren, gebe alle Produkte zurück (Fallback)
    if (checkboxes.length === 0) {
      // Prüfe ob überhaupt Checkboxen da sind (vs. alle abgewählt)
      const allCheckboxes = document.querySelectorAll('.product-checkbox')
      if (allCheckboxes.length === 0) {
        // Noch keine Checkboxen gerendert - gebe alle Produkte zurück
        return this.products || []
      } else {
        // Checkboxen existieren aber alle sind abgewählt - gebe leeres Array zurück
        return []
      }
    }
    
    const selectedProductIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.productId))
    return this.products.filter(product => selectedProductIds.includes(product.id))
  }

  showPriceFooter(productCount, monthlyPrice, purchasePrice) {
    let footer = document.getElementById('price-footer')
    
    if (!footer) {
      footer = document.createElement('div')
      footer.id = 'price-footer'
      footer.className = 'fixed bottom-0 left-0 right-0 bg-gradient-to-r from-white to-slate-50 backdrop-blur-lg border-t border-slate-200 shadow-2xl z-40 transform translate-y-full transition-all duration-500'
      document.body.appendChild(footer)
    }
    
    // Prüfe ob alle Produkte ausgewählt sind
    const allSelected = this.areAllProductsSelected()
    
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-6">
            <!-- Produkt-Counter -->
            <div class="flex items-center space-x-2 bg-gradient-to-br from-emerald-50 to-teal-50 px-3 py-2 rounded-xl border border-emerald-200">
              <div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span class="text-sm font-semibold text-emerald-700">
                ${productCount} ${productCount === 1 ? 'Produkt' : 'Produkte'}
              </span>
            </div>
            
            <!-- Preise -->
            <div class="flex items-center space-x-4">
              <div class="text-center">
                <div class="text-xs text-slate-500 font-medium">Einmalig</div>
                <div class="text-lg font-bold text-slate-800">€${purchasePrice.toFixed(2)}</div>
              </div>
              <div class="w-px h-8 bg-slate-300"></div>
              <div class="text-center">
                <div class="text-xs text-emerald-600 font-medium">Pro Monat</div>
                <div class="text-lg font-bold text-emerald-700">€${monthlyPrice.toFixed(2)}</div>
              </div>
            </div>
          </div>
          
          <div class="flex items-center space-x-3">
            ${allSelected ? `
              <button onclick="window.demoApp.deselectAllProducts()" class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 text-sm font-semibold shadow-lg hover:shadow-xl focus:ring-4 focus:ring-orange-200 focus:outline-none">
                <i class="fas fa-times mr-2"></i>Alles abwählen
              </button>
            ` : `
              <button onclick="window.demoApp.selectAllProducts()" class="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 text-sm font-semibold shadow-lg hover:shadow-xl focus:ring-4 focus:ring-emerald-200 focus:outline-none">
                <i class="fas fa-check mr-2"></i>Alles auswählen
              </button>
            `}

            
            <button onclick="window.demoApp.hidePriceFooter()" class="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <!-- Zusätzliche Info-Leiste -->
        <div class="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div class="flex items-center space-x-4">
            <span class="flex items-center">
              <i class="fas fa-shield-alt mr-1 text-emerald-500"></i>
              Geprüfte Qualität
            </span>
            <span class="flex items-center">
              <i class="fas fa-truck mr-1 text-blue-500"></i>
              Schneller Versand
            </span>
            <span class="flex items-center">
              <i class="fas fa-undo mr-1 text-purple-500"></i>
              30 Tage Rückgabe
            </span>
          </div>
          <div class="text-slate-400">
            Preise inkl. MwSt. • Änderungen vorbehalten
          </div>
        </div>
      </div>
    `
    
    // Footer einblenden mit eleganter Animation
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
      this.renderStack()
      this.updateStats()
      this.showMessage('🗑️ Stack geleert', 'info')
    }
  }

  areAllProductsSelected() {
    if (this.products.length === 0) return false
    
    const checkboxes = document.querySelectorAll('.product-checkbox')
    if (checkboxes.length === 0) return false
    
    return Array.from(checkboxes).every(checkbox => checkbox.checked)
  }

  selectAllProducts() {
    const checkboxes = document.querySelectorAll('.product-checkbox')
    checkboxes.forEach(checkbox => {
      checkbox.checked = true
    })
    this.updatePriceFooter() // Aktualisiere Footer
    this.showMessage('✅ Alle Produkte ausgewählt', 'success')
  }

  deselectAllProducts() {
    const checkboxes = document.querySelectorAll('.product-checkbox')
    checkboxes.forEach(checkbox => {
      checkbox.checked = false
    })
    this.updatePriceFooter() // Aktualisiere Footer
    this.showMessage('❌ Alle Produkte abgewählt', 'info')
  }



  async initStackSelector() {
    const selector = document.getElementById('stack-selector')
    if (!selector) {
      console.log('[Demo Modal] Stack-Selector nicht gefunden')
      return
    }
    
    // In Dashboard mode, refresh stacks from database to ensure we have the latest data
    if (this.isDashboardMode()) {
      console.log('[Dashboard] Refreshing stacks from database before updating selector')
      try {
        const refreshedStacks = await this.loadUserStacks()
        this.userStacks = refreshedStacks
        this.stacks = this.userStacks
        console.log('[Dashboard] Refreshed stacks from database:', this.stacks.length, 'stacks')
      } catch (error) {
        console.error('[Dashboard] Error refreshing stacks:', error)
      }
    } else {
      // In Demo mode, ensure we use session storage if available
      console.log('[Demo Modal] Using current stacks for selector, not reloading from hardcoded source')
      console.log('[Demo Modal] Current stack count:', this.stacks.length)
    }
    
    // Stacks in Dropdown laden - nur validierte Stacks anzeigen
    console.log('[Demo Modal] Updating stack selector with', this.stacks.length, 'stacks')
    
    // Filter out invalid stacks
    const validStacks = this.stacks.filter(stack => {
      const isValid = stack && stack.id !== undefined && stack.id !== null && 
                     stack.name !== undefined && stack.name !== null && stack.name.trim() !== ''
      if (!isValid) {
        console.warn('[Demo Modal] Invalid stack found:', stack)
      }
      return isValid
    })
    
    console.log('[Demo Modal] Found', validStacks.length, 'valid stacks out of', this.stacks.length, 'total stacks')
    
    // Set the innerHTML directly - no cloning needed
    const selectorHTML = `
      <option value="">Stack auswählen...</option>
      ${validStacks.map(stack => `
        <option value="${stack.id}">${stack.name}</option>
      `).join('')}
    `
    
    console.log('[Demo Modal] Setting selector HTML:', selectorHTML)
    selector.innerHTML = selectorHTML
    console.log('[Demo Modal] Selector innerHTML set, new option count:', selector.options.length)
    
    // Remove existing event listeners without cloning the element
    // Store reference to avoid losing DOM element reference that delete button handler uses
    const oldSelector = selector.cloneNode(false)
    
    // Clear event listeners by removing and re-adding all event attributes
    const events = ['onchange', 'onclick', 'onmousedown', 'onmouseup']
    events.forEach(event => {
      if (selector[event]) {
        selector[event] = null
      }
    })
    
    console.log('[Demo Modal] Event listeners cleared, keeping original DOM element')
    
    // Use original selector (not clone) to maintain DOM references
    selector.addEventListener('change', async (e) => {
      const stackId = e.target.value ? parseInt(e.target.value) : null
      console.log('[Demo Modal] Stack switching to:', stackId, 'from selector value:', e.target.value)
      
      if (stackId) {
        await this.loadStack(stackId)
      } else {
        // Leeren Stack anzeigen wenn nichts ausgewählt
        console.log('[Demo Modal] No stack selected, clearing products')
        this.currentStackId = null
        this.products = []
        this.renderStack()
        this.updateStats()
        this.updateNutrientOverview()
      }
    })
    
    // Ersten Stack automatisch laden
    if (this.stacks.length > 0) {
      const firstStack = this.stacks[0]
      console.log('[Demo Modal] Auto-selecting first stack:', firstStack.name, 'ID:', firstStack.id)
      selector.value = firstStack.id
      
      // Ensure currentStackId is set before loading
      this.currentStackId = firstStack.id
      await this.loadStack(firstStack.id)
      
      // Trigger change event to enable delete button
      console.log('[Demo Modal] Triggering change event for delete button activation')
      const changeEvent = new Event('change', { bubbles: true })
      selector.dispatchEvent(changeEvent)
      
      // Also call the global update function if available
      if (typeof window.updateDemoDeleteButtonState === 'function') {
        console.log('[Demo Modal] Calling global delete button update function')
        window.updateDemoDeleteButtonState()
      }
    } else {
      console.warn('[Demo Modal] No stacks available for auto-selection')
      this.currentStackId = null
    }
  }

  async loadStack(stackId) {
    console.log(`[Demo Modal] Loading stack with ID: ${stackId}`)
    
    if (!stackId) {
      this.currentStackId = null
      this.products = []
      this.renderStack()
      return
    }
    
    this.currentStackId = stackId
    
    // In Dashboard mode, refresh stack data from database to get latest products
    if (this.isDashboardMode()) {
      console.log(`[Dashboard] Refreshing stack ${stackId} from database to get latest products`)
      await this.refreshStackFromDatabase(stackId)
    }
    
    const stack = this.stacks.find(s => s.id == stackId) // Use == for type-flexible comparison
    if (!stack) {
      console.error(`[Demo Modal] Stack with ID ${stackId} not found`)
      return
    }
    
    console.log(`[Demo Modal] Found stack:`, stack)
    console.log(`[Demo Modal] Available products:`, this.availableProducts.length)
    console.log(`[Demo Modal] User products:`, this.userProducts?.length || 0)
    
    // Produkte für diesen Stack laden
    this.products = []
    if (stack.products && Array.isArray(stack.products)) {
      console.log(`[Demo Modal] Processing ${stack.products.length} products in stack`)
      
      stack.products.forEach((product, index) => {
        if (typeof product === 'number') {
          // Product ID - need to find it in either userProducts (for dashboard) or availableProducts (for demo)
          console.log(`[Demo Modal] Looking for product ID: ${product}`)
          
          // First try to find in userProducts (Dashboard mode)
          let foundProduct = this.userProducts ? this.userProducts.find(p => p.id == product) : null
          
          if (foundProduct) {
            console.log(`[Demo Modal] Found user product:`, foundProduct.name)
            this.products.push({ ...foundProduct })
          } else {
            // Fallback: try availableProducts (Demo mode or for available products)
            foundProduct = this.availableProducts.find(p => p.id == product)
            if (foundProduct) {
              console.log(`[Demo Modal] Found available product:`, foundProduct.name)
              this.products.push({ ...foundProduct })
            } else {
              console.warn(`[Demo Modal] Product with ID ${product} not found in userProducts or availableProducts`)
              console.log(`[Demo Modal] Available userProducts IDs:`, this.userProducts ? this.userProducts.map(p => p.id) : 'none')
              console.log(`[Demo Modal] Available availableProducts IDs:`, this.availableProducts ? this.availableProducts.map(p => p.id) : 'none')
              console.log(`[Demo Modal] Looking for product ID:`, product, typeof product)
            }
          }
        } else if (typeof product === 'object' && product !== null) {
          // Falls es bereits ein vollständiges Produktobjekt ist (benutzererstellte Struktur)
          console.log(`[Demo Modal] Adding full product object:`, product.name)
          this.products.push({ ...product })
        } else {
          console.warn(`[Demo Modal] Invalid product at index ${index}:`, product)
        }
      })
    }
    
    console.log(`[Demo Modal] Stack "${stack.name}" loaded with ${this.products.length} products`)
    console.log('[Demo Modal] Loaded products:', this.products.map(p => ({ id: p.id, name: p.name, form: p.form })))
    
    this.renderStack()
    this.updateStats()
    
    // Update delete button state after loading stack
    if (typeof window.updateDemoDeleteButtonState === 'function') {
      window.updateDemoDeleteButtonState()
    }
    
    // Update layer section and nutrient overview after loading stack
    this.updateLayerSectionVisibility()
    this.updateNutrientOverview()
  }

  // Refresh a specific stack from database to get latest product associations
  async refreshStackFromDatabase(stackId) {
    try {
      if (!this.isDashboardMode()) {
        console.log('[Demo Modal] Not in dashboard mode, skipping database refresh')
        return
      }
      
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        console.error('[Dashboard] No auth token for stack refresh')
        return
      }
      
      console.log(`[Dashboard] Refreshing stack ${stackId} from database`)
      
      const response = await fetch('/api/protected/stacks', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        console.error('[Dashboard] Failed to refresh stacks:', response.status)
        return
      }
      
      const refreshedStacks = await response.json()
      console.log('[Dashboard] Refreshed stacks from database:', refreshedStacks)
      
      // Update our local stacks array with fresh data
      this.userStacks = refreshedStacks
      this.stacks = this.userStacks
      
      // Find the specific stack we're loading to verify it has updated products
      const refreshedStack = this.stacks.find(s => s.id == stackId)
      if (refreshedStack) {
        console.log(`[Dashboard] Refreshed stack ${stackId} now has ${refreshedStack.products?.length || 0} products:`, refreshedStack.products)
      }
      
    } catch (error) {
      console.error('[Dashboard] Error refreshing stack from database:', error)
    }
  }

  closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay')
    modals.forEach(modal => modal.remove())
  }

  // Bestimme Einnahmezeit basierend auf Produkt für konsistente Zuordnung
  getProductIntakeTime(product) {
    const productName = product.name?.toLowerCase() || ''
    const productId = product.id || 0
    
    // Definiere feste Regeln basierend auf Produkttyp/Inhalt
    if (productName.includes('vitamin d') || productName.includes('d3')) {
      return 'Zum Frühstück'  // Vitamin D optimal mit Fett
    }
    if (productName.includes('b12') || productName.includes('b-komplex') || productName.includes('b6')) {
      return 'Nach dem Aufstehen'  // B-Vitamine für Energie am Morgen
    }
    if (productName.includes('magnesium') || productName.includes('melatonin')) {
      return 'Am Abend'  // Magnesium für Entspannung
    }
    if (productName.includes('eisen') || productName.includes('iron')) {
      return 'Nach dem Aufstehen'  // Eisen auf leeren Magen optimal
    }
    if (productName.includes('omega') || productName.includes('fischöl')) {
      return 'Zum Mittagessen'  // Omega-3 mit Hauptmahlzeit
    }
    
    // Fallback: Verwende Produkt-ID für konsistente Zuordnung
    const intakeTimes = ['Nach dem Aufstehen', 'Zum Frühstück', 'Zum Mittagessen', 'Am Abend']
    return intakeTimes[productId % intakeTimes.length]
  }
  
  // Bestimme Labelfarbe basierend auf Einnahmezeit
  getIntakeTimeLabelColor(intakeTime) {
    const colorMap = {
      'Nach dem Aufstehen': 'bg-orange-100 text-orange-800',
      'Zum Frühstück': 'bg-green-100 text-green-800', 
      'Zum Mittagessen': 'bg-blue-100 text-blue-800',
      'Am Abend': 'bg-purple-100 text-purple-800'
    }
    return colorMap[intakeTime] || 'bg-gray-100 text-gray-800'
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
              
              <!-- Stack-Auswahl -->
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Stack auswählen</label>
                <select id="supplement-stack" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white shadow-sm">
                  ${this.stacks.map(stack => `<option value="${stack.id}">${stack.name}</option>`).join('')}
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

          <!-- Schritt 3: Produktauswahl -->
          <div id="step-product-selection" class="step-container hidden">
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 class="font-semibold text-green-900 mb-3 flex items-center">
                <i class="fas fa-pills mr-2"></i>
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
        
        // Erst alle passenden Nährstoffe finden (Haupt- und Sub-Wirkstoffe)
        const allMatches = this.nutrients.filter(n => {
          const name = n.name.toLowerCase()
          const category = n.category.toLowerCase()
          const description = n.description.toLowerCase()
          const synonyms = (n.synonyms || []).join(' ').toLowerCase()
          
          // Suche in Name, Kategorie, Beschreibung und Synonymen
          return name.includes(query) || 
                 category.includes(query) ||
                 description.includes(query) ||
                 synonyms.includes(query) ||
                 // Auch in verfügbaren Produktnamen suchen
                 this.availableProducts.some(p => 
                   p.name.toLowerCase().includes(query) && 
                   ((p.main_nutrients && p.main_nutrients.some(mn => mn.nutrient_id === n.id)) ||
                    (p.nutrient_id === n.id))
                 )
        })
        
        // Haupt- und Sub-Wirkstoffe intelligent verarbeiten
        const filtered = []
        const addedMainNutrients = new Set()
        
        allMatches.forEach(nutrient => {
          if (nutrient.is_main_nutrient) {
            // Hauptwirkstoff direkt hinzufügen
            filtered.push(nutrient)
            addedMainNutrients.add(nutrient.id)
          } else if (nutrient.parent_nutrient_id) {
            // Sub-Wirkstoff: Hauptwirkstoff finden und hinzufügen
            const parentNutrient = this.nutrients.find(n => n.id === nutrient.parent_nutrient_id)
            if (parentNutrient && !addedMainNutrients.has(parentNutrient.id)) {
              // Erweitere den Hauptwirkstoff mit Sub-Wirkstoff Info
              const enhancedParent = {
                ...parentNutrient,
                search_match_info: `Gefunden über: ${nutrient.name}`,
                sub_match: nutrient
              }
              filtered.push(enhancedParent)
              addedMainNutrients.add(parentNutrient.id)
            }
          }
        })
        
        if (filtered.length > 0) {
          searchResults.classList.remove('hidden')
          searchResults.innerHTML = filtered.slice(0, 8).map(nutrient => `
            <div class="nutrient-option p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors" data-nutrient-id="${nutrient.id}">
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-medium text-gray-900">${nutrient.name}</div>
                  <div class="text-sm text-gray-600">${nutrient.category} • DGE: ${nutrient.dge_recommendation}${nutrient.unit}</div>
                  ${nutrient.search_match_info ? `
                    <div class="text-xs text-purple-600 mt-1">
                      <i class="fas fa-search mr-1"></i>${nutrient.search_match_info}
                    </div>
                  ` : ''}
                </div>
                <div class="text-right">
                  <div class="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded mb-1">
                    ${nutrient.unit}
                  </div>
                  ${nutrient.is_main_nutrient ? `
                    <div class="text-xs text-green-600 font-medium">
                      <i class="fas fa-star mr-1"></i>Hauptwirkstoff
                    </div>
                  ` : ''}
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
          // Setze auch Modal-Variable
          modal._selectedNutrient = selectedNutrient
          console.log('[Demo Modal] Nutrient selected:', selectedNutrient.name)
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
      const stackId = parseInt(modal.querySelector('#supplement-stack').value)
      const notes = modal.querySelector('#personal-notes').value
      
      if (customDosage > 0) {
        selectedDosage = {
          amount: customDosage,
          unit: selectedNutrient.unit,
          stackId: stackId,
          notes: notes
        }
        // Setze auch Modal-Variable
        modal._selectedDosage = selectedDosage
        console.log('[Demo Modal] Dosage selected:', selectedDosage.amount + selectedDosage.unit)
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
      console.log('[Demo Modal] Final add button clicked')
      
      // Verwende die im Modal gespeicherten Werte
      const finalProduct = modal._selectedProduct || selectedProduct
      const finalNutrient = modal._selectedNutrient || selectedNutrient
      const finalDosage = modal._selectedDosage || selectedDosage
      
      console.log('[Demo Modal] Selected values:', {
        product: finalProduct ? finalProduct.name : 'NOT SELECTED',
        nutrient: finalNutrient ? finalNutrient.name : 'NOT SELECTED', 
        dosage: finalDosage ? `${finalDosage.amount}${finalDosage.unit}` : 'NOT SELECTED',
        fromModal: {
          product: modal._selectedProduct?.name || 'NOT SET',
          nutrient: modal._selectedNutrient?.name || 'NOT SET',
          dosage: modal._selectedDosage ? `${modal._selectedDosage.amount}${modal._selectedDosage.unit}` : 'NOT SET'
        },
        fromScope: {
          product: selectedProduct?.name || 'NOT SET',
          nutrient: selectedNutrient?.name || 'NOT SET',
          dosage: selectedDosage ? `${selectedDosage.amount}${selectedDosage.unit}` : 'NOT SET'
        }
      })
      
      if (finalProduct && finalNutrient && finalDosage) {
        try {
          this.addSelectedProductToStack(finalProduct, finalNutrient, finalDosage)
          this.showSuccess(`${finalProduct.name} erfolgreich hinzugefügt!`)
          
          // Stack sofort aktualisieren
          console.log('[Demo Modal] Triggering immediate stack update after product addition')
          setTimeout(() => {
            this.renderStack()
            this.updateStats()
          }, 50)
          
          // Modal IMMER schließen nach erfolgreichem Hinzufügen
          console.log('[Demo Modal] Closing modal after successful addition')
          setTimeout(() => modal.remove(), 200)
          
        } catch (error) {
          console.error('Fehler beim Hinzufügen:', error)
          this.showError(`Fehler beim Hinzufügen: ${error.message || 'Unbekannter Fehler'}`)
          // Modal auch bei Fehler schließen
          setTimeout(() => modal.remove(), 2000)
        }
      } else {
        console.error('[Demo Modal] Missing selections for final add')
        console.error('[Demo Modal] Debug info:', { finalProduct, finalNutrient, finalDosage })
        this.showError('Bitte wählen Sie ein Produkt, einen Nährstoff und eine Dosierung aus')
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
    
    // Studien-Empfehlung nur anzeigen wenn vorhanden
    if (nutrient.study_recommendation && nutrient.study_url) {
      studyRecommendationCard.classList.remove('hidden')
      studyRecommendation.textContent = `${nutrient.study_recommendation}${nutrient.unit}`
    } else {
      studyRecommendationCard.classList.add('hidden')
    }
    
    // Standard auf DGE-Empfehlung setzen
    customDosage.value = nutrient.dge_recommendation
    customDosage.placeholder = nutrient.dge_recommendation
    
    // Aktuellen Stack im Dropdown vorauswählen
    const stackSelect = modal.querySelector('#supplement-stack')
    if (stackSelect && this.currentStackId) {
      stackSelect.value = this.currentStackId
    }
    
    // DGE-Button Handler
    modal.querySelector('#use-dge-dosage').addEventListener('click', () => {
      customDosage.value = nutrient.dge_recommendation
      this.updateDosageSafety(modal, nutrient, nutrient.dge_recommendation)
    })
    
    // Studien-Button Handler (nur wenn Studien vorhanden)
    if (nutrient.study_recommendation && nutrient.study_url) {
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
    const availableProducts = this.availableProducts.filter(product => 
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
    
    // WICHTIG: Setze die globalen Modal-Variablen
    // Finde und setze die Variablen im Modal-Scope
    modal._selectedProduct = product
    modal._selectedNutrient = nutrient  
    modal._selectedDosage = dosage
    
    console.log('[Demo Modal] showAddToStack - Setting variables:', {
      product: product?.name,
      nutrient: nutrient?.name,
      dosage: dosage?.amount + dosage?.unit
    })
    
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
    console.log('[Demo Modal] Adding product to stack:', product?.name, 'Dosage:', dosage?.amount + dosage?.unit)
    
    // Validierung der Parameter
    if (!product || !nutrient || !dosage) {
      console.error('[Demo Modal] Invalid parameters:', { product, nutrient, dosage })
      throw new Error('Ungültige Parameter beim Hinzufügen des Produkts')
    }
    
    try {
      // HAUPTPRÜFUNG: Prüfung auf gleichen Wirkstoff/Nährstoff (wichtiger als Produkt)
      const currentProducts = this.getCurrentProducts()
      console.log('[Demo Modal] Current products in stack:', currentProducts?.length || 0)
      
      const existingNutrientProduct = currentProducts.find(p => {
        if (p.main_nutrients) {
          return p.main_nutrients.some(n => n.nutrient_id === nutrient.id)
        }
        return p.nutrient_id === nutrient.id // Fallback für alte Struktur
      })
      
      if (existingNutrientProduct) {
        // Gleicher Nährstoff bereits im Stack - egal ob gleiches oder anderes Produkt
        console.log('[Demo Modal] Duplicate nutrient found, showing dialog')
        this.showDuplicateNutrientDialog(product, nutrient, dosage, existingNutrientProduct)
        return
      }
      
      // Wenn kein Nährstoff-Konflikt: Direkt hinzufügen
      console.log('[Demo Modal] No conflicts, finalizing add product')
      this.finalizeAddProduct(product, nutrient, dosage)
      
    } catch (error) {
      console.error('[Demo Modal] Error in addSelectedProductToStack:', error)
      throw error // Re-throw für übergeordnete Fehlerbehandlung
    }
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
    console.log('[Demo Modal] Finalizing add product:', { product: product?.name, nutrient: nutrient?.name, dosage })
    
    // Validierung
    if (!product || !nutrient || !dosage) {
      throw new Error('Fehlende Parameter für finalizeAddProduct')
    }
    
    // Nährstoff-Info finden (mit besserer Fehlerbehandlung)
    let nutrientInfo = null
    let amountPerUnit = 0
    
    if (product.main_nutrients && Array.isArray(product.main_nutrients)) {
      nutrientInfo = product.main_nutrients.find(n => n.nutrient_id == nutrient.id)
      amountPerUnit = nutrientInfo ? nutrientInfo.amount_per_unit : 0
    } else if (product.nutrient_id == nutrient.id) {
      // Fallback für alte Struktur
      amountPerUnit = product.nutrient_amount_per_unit || 0
    }
    
    if (amountPerUnit <= 0) {
      console.warn('[Demo Modal] No nutrient info found, using default values')
      amountPerUnit = dosage.amount // Fallback: 1:1 Verhältnis
    }
    
    const requiredUnitsPerDay = Math.ceil(dosage.amount / amountPerUnit)
    const daysSupply = Math.floor((product.quantity || 30) / requiredUnitsPerDay)
    const monthlySupplyNeeded = daysSupply > 0 ? 30 / daysSupply : 1
    const customMonthlyPrice = (product.purchase_price || 0) * monthlySupplyNeeded
    
    const productName = product.name || 'Unbekanntes Produkt'
    const productForm = product.form || 'Einheit'
    const pluralForm = this.getPluralForm(requiredUnitsPerDay, productForm)
    
    this.showMessage(`✅ "${productName}" wurde zu Ihrem Stack hinzugefügt!\n💊 ${requiredUnitsPerDay} ${pluralForm}/Tag\n💰 €${customMonthlyPrice.toFixed(2)}/Monat`, 'success')
    
    // Produkt mit angepassten Werten zur Liste hinzufügen
    const customProduct = {
      ...product,
      // Sicherheitsprüfungen für Eigenschaften
      name: product.name || 'Unbekanntes Produkt',
      form: product.form || 'Einheit',
      // Angepasste Werte basierend auf individueller Dosierung
      dosage_per_day: requiredUnitsPerDay,
      days_supply: daysSupply,
      monthly_cost: customMonthlyPrice,
      custom_dosage: dosage.amount,
      custom_stack_id: this.currentStackId || 'basic', // Verwende aktuellen Stack
      custom_notes: dosage.notes || ''
    }
    
    // Check if we're in dashboard mode (authenticated) or demo mode
    if (this.isDashboardMode()) {
      // Dashboard mode: Save to database via AJAX
      console.log('[Dashboard Mode] Saving product to database...')
      this.saveProductToDatabase(customProduct).then((savedProduct) => {
        // Add to display after successful save
        this.products.push(savedProduct)
        console.log('[Dashboard Mode] Product saved to database and added to display')
        
        // Update display
        this.renderStack()
        this.updateStats()
        this.updateNutrientOverview()
      }).catch(error => {
        console.error('Failed to save product:', error)
        this.showMessage('❌ Fehler beim Speichern des Produkts: ' + error.message, 'error')
      })
    } else {
      // Demo mode: Keep existing local storage behavior
      console.log('[Demo Mode] Adding product locally')
      
      // 1. Immer zu this.products hinzufügen (für sofortige Anzeige)
      this.products.push(customProduct)
      console.log('[Demo Modal] Added to this.products, now has', this.products.length, 'products')
      
      // 2. Auch zu currentStack.products hinzufügen (für Persistierung)
      if (this.currentStackId) {
        const currentStack = this.stacks.find(s => s.id == this.currentStackId)
        if (currentStack) {
          console.log('[Demo Modal] Also adding product to stack data:', currentStack.name)
          // Initialisiere products Array falls noch nicht vorhanden
          if (!currentStack.products) {
            currentStack.products = []
          }
          // Prüfe ob Produkt bereits in Stack vorhanden (Duplikate vermeiden)
          const existingProduct = currentStack.products.find(p => 
            (typeof p === 'object' ? p.id : p) == customProduct.id
          )
          if (!existingProduct) {
            currentStack.products.push(customProduct)
          }
          console.log('[Demo Modal] Stack data now has', currentStack.products.length, 'products')
          
          // Save updated stacks to session storage when adding products in demo mode
          if (!this.isDashboardMode()) {
            this.saveDemoStacksToSession()
          }
        } else {
          console.error('[Demo Modal] Current stack not found:', this.currentStackId)
        }
      }
      
      // Stack-Anzeige aktualisieren
      console.log('[Demo Modal] finalizeAddProduct - Updating stack display')
      this.renderStack()
      this.updateStats()
      this.updateNutrientOverview()
    }
    
    // WICHTIG: Modal nicht hier schließen, das macht der Event Handler
    // this.closeAllModals() - ENTFERNT, wird vom Modal-Handler gemacht
    console.log('[Demo Modal] finalizeAddProduct completed, product added to stack')
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

  async createStack(formData) {
    const stackName = formData.get('stack_name')
    const description = formData.get('description') || ''
    
    // Validierung
    if (!stackName || stackName.trim().length === 0) {
      throw new Error('Stack-Name ist erforderlich')
    }
    
    // Prüfen ob Stack-Name bereits existiert
    if (this.stacks.find(s => s.name && s.name.toLowerCase() === stackName.trim().toLowerCase())) {
      throw new Error('Ein Stack mit diesem Namen existiert bereits')
    }
    
    let newStack
    
    if (this.isDashboardMode()) {
      console.log('[Dashboard] Creating stack in database...')
      
      // Dashboard mode: Create stack in database
      try {
        const authToken = localStorage.getItem('auth_token')
        if (!authToken) {
          throw new Error('No authentication token found')
        }
        
        const response = await fetch('/api/protected/stacks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: stackName.trim(),
            description: description.trim(),
            products: []
          })
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }
        
        const responseData = await response.json()
        console.log('[Dashboard] API response:', responseData)
        
        // Extract stack from response - handle nested response format
        if (responseData.stack) {
          newStack = responseData.stack
          console.log('[Dashboard] Extracted stack from nested response:', newStack)
        } else if (responseData.success && responseData.data) {
          newStack = responseData.data
          console.log('[Dashboard] Extracted stack from data property:', newStack)
        } else {
          newStack = responseData
          console.log('[Dashboard] Using response directly as stack:', newStack)
        }
        
        console.log('[Dashboard] Stack created in database:', newStack)
        
        // Validate stack data before adding to lists
        if (!newStack || newStack.id === undefined || newStack.id === null || 
            !newStack.name || newStack.name.trim() === '') {
          console.error('[Dashboard] Invalid stack data received from API:', newStack)
          throw new Error('Server returned invalid stack data')
        }
        
        // In Dashboard mode, don't add to local lists here - 
        // the stack will be loaded from database when initStackSelector() calls refreshStackFromDatabase()
        console.log('[Dashboard] Stack created in database - ID:', newStack.id, 'Name:', newStack.name)
        console.log('[Dashboard] Stack will be loaded from database during selector initialization')
        
      } catch (error) {
        console.error('[Dashboard] Error creating stack:', error)
        throw error
      }
      
    } else {
      console.log('[Demo Modal] Neuer Stack erstellt (Demo)')
      
      // Demo mode: Create stack locally only
      newStack = {
        id: this.stacks.length + 1,
        name: stackName.trim(),
        description: description.trim(),
        products: [],
        total_monthly_cost: 0,
        created_at: new Date().toISOString()
      }
      
      this.stacks.push(newStack)
      
      // Save updated stacks to session storage for demo mode
      this.saveDemoStacksToSession()
    }
    
    // Stack-Selector aktualisieren (mit Error Handling)
    try {
      console.log('[Dashboard] About to update stack selector. Current stacks:', this.stacks.length)
      console.log('[Dashboard] All stack names:', this.stacks.map(s => s.name))
      
      await this.initStackSelector()
      
      // Neuen Stack automatisch auswählen
      const selector = document.getElementById('stack-selector')
      if (selector && newStack && newStack.id) {
        console.log('[Dashboard] Setting selector to new stack ID:', newStack.id)
        selector.value = newStack.id
        await this.loadStack(newStack.id)
      } else {
        console.warn('[Dashboard] Cannot select new stack - selector or newStack invalid:', {
          selector: !!selector,
          newStack: newStack,
          newStackId: newStack?.id
        })
      }
      
      this.updateStats()
    } catch (error) {
      console.warn('[Dashboard] Error updating UI after stack creation:', error)
      // Fehler beim UI-Update sollen Stack-Erstellung nicht verhindern
    }
    
    console.log('Stack erfolgreich erstellt:', newStack)
    return newStack
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
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        try {
          const newStack = await this.createStack(new FormData(form))
          this.showSuccess(`Stack "${newStack.name}" erfolgreich erstellt!`)
          // Modal IMMER schließen nach erfolgreichem Erstellen
          setTimeout(() => modal.remove(), 100)
        } catch (error) {
          console.error('Fehler beim Erstellen des Stacks:', error)
          // Spezifischere Fehlermeldung anzeigen
          this.showError(error.message || 'Fehler beim Erstellen des Stacks')
          // Modal bei Validierungsfehlern NICHT schließen, damit User korrigieren kann
        }
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
        
        <!-- DGE Links und Synonyme -->
        <div class="bg-gray-50 rounded-lg p-4">
          <h4 class="font-medium text-gray-900 mb-2">Weitere Informationen</h4>
          
          ${nutrient.synonyms && nutrient.synonyms.length > 0 ? `
            <div class="mb-3">
              <span class="text-sm text-gray-600">Andere Namen:</span>
              <div class="text-sm text-gray-800">${nutrient.synonyms.join(', ')}</div>
            </div>
          ` : ''}
          
          <div class="flex flex-col space-y-2 text-sm">
            ${nutrient.dge_info_url ? `
              <a href="${nutrient.dge_info_url}" target="_blank" class="text-blue-600 hover:text-blue-800 underline flex items-center">
                <i class="fas fa-external-link-alt mr-1"></i>
                DGE-Referenzwerte für ${nutrient.name}
              </a>
            ` : ''}
            
            ${nutrient.study_url ? `
              <a href="${nutrient.study_url}" target="_blank" class="text-purple-600 hover:text-purple-800 underline flex items-center">
                <i class="fas fa-flask mr-1"></i>
                ${nutrient.study_title || 'Wissenschaftliche Studie'}
              </a>
            ` : ''}
            
            <a href="https://www.dge.de/wissenschaft/referenzwerte/" target="_blank" class="text-gray-600 hover:text-gray-800 underline flex items-center">
              <i class="fas fa-info-circle mr-1"></i>
              Alle DGE-Referenzwerte
            </a>
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
    const product = this.products.find(p => p.id === productId)
    if (!product) return

    this.closeAllModals()

    if (this.isDashboardMode()) {
      // Dashboard mode: Show real edit form
      this.showRealEditModal(product)
    } else {
      // Demo mode: Show demo info
      this.showDemoEditModal(product)
    }
  }
  
  showRealEditModal(product) {
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `
    
    // Get alternative products with the same nutrient
    const alternativeProducts = this.availableProducts.filter(p => 
      p.nutrient_id === product.nutrient_id && p.id !== product.id
    )
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 40rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">
              <i class="fas fa-edit mr-2 text-blue-600"></i>
              Stack-Einstellungen für ${this.getNutrientName(product.nutrient_id)}
            </h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <form id="edit-stack-settings-form" class="space-y-6">
            <!-- Current Product Info -->
            <div class="bg-gray-50 rounded-lg p-4">
              <h3 class="font-semibold text-gray-900 mb-2">Aktuelles Produkt</h3>
              <div class="text-sm text-gray-600">
                <div><strong>${product.name}</strong> von ${product.brand}</div>
                <div>${product.nutrient_amount_per_unit}${this.getNutrientUnit(product.nutrient_id)} pro ${product.form}</div>
                <div>€${product.purchase_price.toFixed(2)} für ${product.quantity} ${this.getPluralForm(product.quantity, product.form)}</div>
              </div>
            </div>
            
            <!-- Dosage Settings -->
            <div class="space-y-4">
              <h3 class="font-semibold text-gray-900">Ihre Einnahme-Einstellungen</h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Tägliche Wirkstoffmenge (${this.getNutrientUnit(product.nutrient_id)})
                  </label>
                  <input type="number" name="daily_nutrient_amount" 
                    value="${(product.dosage_per_day * product.nutrient_amount_per_unit).toFixed(1)}" 
                    step="0.1" min="0.1" 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onchange="window.demoApp.updateDosageFromNutrientAmount()">
                  <div class="text-xs text-gray-500 mt-1">
                    Das entspricht <span id="capsule-equivalent">${product.dosage_per_day.toFixed(1)}</span> ${this.getPluralForm(product.dosage_per_day, product.form)} pro Tag
                  </div>
                  <input type="hidden" name="dosage_per_day" value="${product.dosage_per_day}">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Notizen (optional)</label>
                  <input type="text" name="custom_notes" value="${product.custom_notes || ''}" placeholder="z.B. morgens mit dem Frühstück"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
              </div>
            </div>
            
            <!-- Cost Preview -->
            <div id="cost-preview" class="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 class="font-semibold text-green-900 mb-2">Kostenberechnung</h4>
              <div class="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div class="text-green-600">Vorrat reicht für</div>
                  <div class="font-semibold">${Math.floor(product.quantity / product.dosage_per_day)} Tage</div>
                </div>
                <div>
                  <div class="text-green-600">Kosten pro Monat</div>
                  <div class="font-semibold">€${((product.purchase_price / product.quantity * product.dosage_per_day * 30)).toFixed(2)}</div>
                </div>
                <div>
                  <div class="text-green-600">Kosten pro Jahr</div>
                  <div class="font-semibold">€${((product.purchase_price / product.quantity * product.dosage_per_day * 365)).toFixed(2)}</div>
                </div>
              </div>
            </div>
            
            ${alternativeProducts.length > 0 ? `
            <!-- Product Switch Button -->
            <div class="space-y-4">
              <h3 class="font-semibold text-gray-900">Produkt wechseln</h3>
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <p class="text-blue-800 text-sm">
                  <i class="fas fa-info-circle mr-1"></i>
                  Sie können zu einem anderen ${this.getNutrientName(product.nutrient_id)}-Produkt wechseln. Ihre Wirkstoffmenge bleibt gleich.
                </p>
              </div>
              
              <div class="text-center">
                <button type="button" onclick="window.demoApp.showProductSwitchModal(${product.id}, ${product.nutrient_id})" 
                  class="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium">
                  <i class="fas fa-exchange-alt mr-2"></i>Produkt wechseln
                </button>
              </div>
              
              <input type="hidden" name="selected_product" value="${product.id}" id="selected-product-input">
            </div>
            ` : ''}
            
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p class="text-orange-800 text-sm">
                <i class="fas fa-save mr-1"></i>
                Änderungen werden in Ihrem persönlichen Stack gespeichert.
              </p>
            </div>
          </form>
          
          <div class="mt-6 flex justify-end space-x-3">
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
            <button onclick="window.demoApp.saveStackSettings(${product.id}); this.closest('.modal-overlay').remove()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              <i class="fas fa-save mr-2"></i>Einstellungen speichern
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
  
  showDemoEditModal(product) {
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
  
  async saveStackSettings(currentProductId) {
    console.log('[Dashboard] Saving stack settings for product:', currentProductId)
    
    const form = document.getElementById('edit-stack-settings-form')
    if (!form) {
      console.error('Stack settings form not found')
      return
    }
    
    const formData = new FormData(form)
    const selectedProductId = formData.get('selected_product')
    const newDosage = parseFloat(formData.get('dosage_per_day'))
    const customNotes = formData.get('custom_notes')
    const dailyNutrientAmount = parseFloat(formData.get('daily_nutrient_amount'))
    
    console.log('[Dashboard] Form data:', { selectedProductId, newDosage, customNotes })
    
    if (this.isDashboardMode()) {
      // Dashboard mode: Update stack_products table
      try {
        const authToken = localStorage.getItem('auth_token')
        if (!authToken) {
          throw new Error('No authentication token found')
        }
        
        const updateData = {
          new_product_id: parseInt(selectedProductId),
          dosage_per_day: newDosage,
          custom_notes: customNotes,
          stack_id: this.currentStackId
        }
        
        console.log('[Dashboard] Updating stack settings:', updateData)
        const response = await fetch(`/api/protected/stack-products/${currentProductId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }
        
        const result = await response.json()
        console.log('[Dashboard] Stack settings updated:', result)
        
        // Refresh the current stack to show changes
        await this.refreshStackFromDatabase(this.currentStackId)
        this.renderStack()
        this.updateStats()
        
        this.showMessage('✅ Stack-Einstellungen erfolgreich gespeichert!', 'success')
        
      } catch (error) {
        console.error('[Dashboard] Error updating stack settings:', error)
        this.showMessage('❌ Fehler beim Speichern: ' + error.message, 'error')
      }
    } else {
      // Demo mode: Update local product
      const productIndex = this.products.findIndex(p => p.id === currentProductId)
      if (productIndex !== -1) {
        // If product changed, replace with new product
        if (selectedProductId != currentProductId) {
          const newProduct = this.availableProducts.find(p => p.id == selectedProductId)
          if (newProduct) {
            this.products[productIndex] = { ...newProduct, dosage_per_day: newDosage, custom_notes: customNotes }
          }
        } else {
          // Just update dosage and notes
          this.products[productIndex].dosage_per_day = newDosage
          this.products[productIndex].custom_notes = customNotes
        }
        
        // Recalculate costs
        const product = this.products[productIndex]
        product.days_supply = Math.floor(product.quantity / product.dosage_per_day)
        product.monthly_cost = (product.purchase_price / product.days_supply * 30)
      }
      
      this.renderStack()
      this.updateStats()
      this.showMessage('✅ Stack-Einstellungen aktualisiert (Demo-Modus)', 'success')
    }
  }
  
  updateDosageFromNutrientAmount() {
    const form = document.getElementById('edit-stack-settings-form')
    if (!form) return
    
    const selectedProductId = form.querySelector('input[name="selected_product"]')?.value
    const dailyNutrientAmount = parseFloat(form.querySelector('input[name="daily_nutrient_amount"]').value) || 0
    
    let selectedProduct
    if (selectedProductId) {
      selectedProduct = this.availableProducts.find(p => p.id == selectedProductId) || 
                      this.products.find(p => p.id == selectedProductId)
    }
    
    if (selectedProduct && selectedProduct.nutrient_amount_per_unit > 0) {
      // Calculate how many capsules/tablets needed for desired nutrient amount
      const newDosagePerDay = dailyNutrientAmount / selectedProduct.nutrient_amount_per_unit
      
      // Update hidden dosage field
      const dosageInput = form.querySelector('input[name="dosage_per_day"]')
      if (dosageInput) {
        dosageInput.value = newDosagePerDay.toFixed(2)
      }
      
      // Update display
      const capsuleEquivalent = document.getElementById('capsule-equivalent')
      if (capsuleEquivalent) {
        capsuleEquivalent.textContent = newDosagePerDay.toFixed(1)
      }
      
      // Update cost preview
      this.updateCostPreview(selectedProduct, newDosagePerDay)
    }
  }
  
  updateCostPreview(product = null, dosage = null) {
    const form = document.getElementById('edit-stack-settings-form')
    if (!form) return
    
    const selectedProductId = form.querySelector('input[name="selected_product"]')?.value
    const calculatedDosage = dosage || parseFloat(form.querySelector('input[name="dosage_per_day"]').value) || 1
    
    let selectedProduct = product
    if (!selectedProduct && selectedProductId) {
      selectedProduct = this.availableProducts.find(p => p.id == selectedProductId) || 
                      this.products.find(p => p.id == selectedProductId)
    }
    
    if (selectedProduct) {
      const daysSupply = Math.floor(selectedProduct.quantity / calculatedDosage)
      const monthlyCost = (selectedProduct.purchase_price / selectedProduct.quantity * calculatedDosage * 30)
      const yearlyCost = (selectedProduct.purchase_price / selectedProduct.quantity * calculatedDosage * 365)
      
      const preview = document.getElementById('cost-preview')
      if (preview) {
        preview.innerHTML = `
          <h4 class="font-semibold text-green-900 mb-2">Kostenberechnung</h4>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div class="text-green-600">Vorrat reicht für</div>
              <div class="font-semibold">${daysSupply} Tage</div>
            </div>
            <div>
              <div class="text-green-600">Kosten pro Monat</div>
              <div class="font-semibold">€${monthlyCost.toFixed(2)}</div>
            </div>
            <div>
              <div class="text-green-600">Kosten pro Jahr</div>
              <div class="font-semibold">€${yearlyCost.toFixed(2)}</div>
            </div>
          </div>
        `
      }
    }
  }
  
  showProductSwitchModal(currentProductId, nutrientId) {
    console.log('[Demo Modal] Show product switch modal for nutrient:', nutrientId)
    
    // Get alternative products with the same nutrient
    const alternativeProducts = this.availableProducts.filter(p => 
      p.nutrient_id === nutrientId
    )
    
    const currentProduct = this.products.find(p => p.id === currentProductId)
    if (!currentProduct) return
    
    this.closeAllModals()
    
    const modal = document.createElement('div')
    modal.className = 'modal-overlay product-switch-modal'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5); display: flex;
      align-items: center; justify-content: center;
      z-index: 10000; padding: 16px;
    `
    
    modal.innerHTML = `
      <div class="modal-container" style="background: white; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 48rem; max-height: 95vh; overflow-y: auto;">
        <div class="p-4 sm:p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-900">
              <i class="fas fa-exchange-alt mr-2 text-blue-600"></i>
              ${this.getNutrientName(nutrientId)}-Produkt wählen
            </h2>
            <button class="close-modal p-2 text-gray-400 hover:text-gray-600 touch-target">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="mb-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p class="text-blue-800 text-sm">
                <i class="fas fa-info-circle mr-1"></i>
                Wählen Sie ein ${this.getNutrientName(nutrientId)}-Produkt aus. Ihre gewünschte Wirkstoffmenge bleibt erhalten.
              </p>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto" id="product-selection-grid">
            ${alternativeProducts.map(product => `
              <div class="product-card border rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all" 
                   data-product-id="${product.id}" onclick="window.demoApp.selectProductForSwitch(${product.id})">
                <div class="flex items-center justify-between mb-2">
                  <input type="radio" name="switch_product" value="${product.id}" class="text-blue-600" 
                    ${product.id === currentProductId ? 'checked' : ''}>
                  ${product.id === currentProductId ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Aktuell</span>' : ''}
                </div>
                
                <h4 class="font-semibold text-gray-900 text-sm mb-1">${product.name}</h4>
                <p class="text-xs text-gray-600 mb-2">${product.brand}</p>
                
                <div class="space-y-1 text-xs">
                  <div class="flex justify-between">
                    <span class="text-gray-600">Gehalt:</span>
                    <span class="font-medium">${product.nutrient_amount_per_unit}${this.getNutrientUnit(product.nutrient_id)}/${product.form}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Preis:</span>
                    <span class="font-medium">€${product.purchase_price.toFixed(2)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">Menge:</span>
                    <span class="font-medium">${product.quantity} ${this.getPluralForm(product.quantity, product.form)}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="mt-6 flex justify-end space-x-3">
            <button onclick="this.closest('.modal-overlay').remove()" class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
              Abbrechen
            </button>
            <button onclick="window.demoApp.confirmProductSwitch()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
              <i class="fas fa-check mr-2"></i>Produkt wählen
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
  
  selectProductForSwitch(productId) {
    // Update radio button
    const radio = document.querySelector(`input[name="switch_product"][value="${productId}"]`)
    if (radio) {
      radio.checked = true
    }
    
    // Visual feedback
    document.querySelectorAll('.product-card').forEach(card => {
      card.classList.remove('bg-blue-50', 'border-blue-300')
      card.classList.add('hover:bg-blue-50', 'hover:border-blue-300')
    })
    
    const selectedCard = document.querySelector(`[data-product-id="${productId}"]`)
    if (selectedCard) {
      selectedCard.classList.add('bg-blue-50', 'border-blue-300')
      selectedCard.classList.remove('hover:bg-blue-50', 'hover:border-blue-300')
    }
  }
  
  confirmProductSwitch() {
    const selectedRadio = document.querySelector('input[name="switch_product"]:checked')
    if (!selectedRadio) return
    
    const newProductId = selectedRadio.value
    
    // Update the hidden input in the main form
    const mainForm = document.getElementById('edit-stack-settings-form')
    if (mainForm) {
      const hiddenInput = mainForm.querySelector('input[name="selected_product"]')
      if (hiddenInput) {
        hiddenInput.value = newProductId
      }
      
      // Trigger cost update with new product
      const newProduct = this.availableProducts.find(p => p.id == newProductId)
      if (newProduct) {
        // Recalculate dosage based on current nutrient amount
        const currentNutrientAmount = parseFloat(mainForm.querySelector('input[name="daily_nutrient_amount"]').value) || 0
        const newDosagePerDay = currentNutrientAmount / newProduct.nutrient_amount_per_unit
        
        mainForm.querySelector('input[name="dosage_per_day"]').value = newDosagePerDay.toFixed(2)
        
        // Update capsule equivalent display
        const capsuleEquivalent = document.getElementById('capsule-equivalent')
        if (capsuleEquivalent) {
          capsuleEquivalent.textContent = newDosagePerDay.toFixed(1)
        }
        
        this.updateCostPreview(newProduct, newDosagePerDay)
      }
    }
    
    // Close modal
    document.querySelector('.product-switch-modal').remove()
    
    this.showMessage(`✅ Produkt ausgewählt! Vergessen Sie nicht zu speichern.`, 'success')
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
          
          ${!this.isDashboardMode() ? `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p class="text-yellow-800 text-sm">
              <i class="fas fa-info-circle mr-1"></i>
              In der Demo werden keine Daten dauerhaft gelöscht.
            </p>
          </div>
          ` : `
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p class="text-red-800 text-sm">
              <i class="fas fa-exclamation-triangle mr-1"></i>
              Achtung: Diese Aktion kann nicht rückgängig gemacht werden!
            </p>
          </div>
          `}
          
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

  async confirmDelete(productId) {
    console.log('[Demo Modal] Confirming delete for product:', productId)
    
    if (this.isDashboardMode()) {
      // Dashboard mode: Delete from database
      try {
        const authToken = localStorage.getItem('auth_token')
        if (!authToken) {
          throw new Error('No authentication token found')
        }
        
        console.log('[Dashboard] Deleting product from database:', productId)
        const response = await fetch(`/api/protected/products/${productId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }
        
        // Remove from local display
        this.products = this.products.filter(p => p.id !== productId)
        
        // Update display
        this.renderStack()
        this.updateStats()
        this.updateNutrientOverview()
        
        this.showMessage('✅ Produkt erfolgreich gelöscht!', 'success')
        console.log('[Dashboard] Product successfully deleted from database')
        
      } catch (error) {
        console.error('[Dashboard] Error deleting product:', error)
        this.showMessage('❌ Fehler beim Löschen: ' + error.message, 'error')
      }
    } else {
      // Demo mode: Just remove from local array
      console.log('[Demo Modal] Produkt gelöscht (Demo):', productId)
      this.products = this.products.filter(p => p.id !== productId)
      this.renderStack()
      this.updateStats()
      this.updateNutrientOverview()
      this.showMessage('✅ Produkt gelöscht (Demo-Modus)', 'success')
    }
  }

  addProduct(formData) {
    const newProduct = {
      id: Date.now(), // Temporary ID
      name: formData.get('name'),
      brand: formData.get('brand'),
      form: formData.get('form'),
      purchase_price: parseFloat(formData.get('purchase_price')),
      quantity: parseInt(formData.get('quantity')),
      nutrient_id: parseInt(formData.get('nutrient_id')),
      nutrient_amount_per_unit: parseFloat(formData.get('nutrient_amount_per_unit')),
      dosage_per_day: parseFloat(formData.get('dosage_per_day')),
      category: formData.get('category'),
      description: formData.get('description') || 'Manuell hinzugefügtes Produkt',
      benefits: ['Benutzerdefiniert'],
      warnings: [],
      dosage_recommendation: formData.get('dosage_recommendation') || 'Nach Packungsangabe'
    }
    
    // Berechnungen
    newProduct.price_per_piece = newProduct.purchase_price / newProduct.quantity
    newProduct.days_supply = Math.floor(newProduct.quantity / newProduct.dosage_per_day)
    newProduct.monthly_cost = (newProduct.purchase_price / newProduct.days_supply * 30)

    if (this.isDashboardMode()) {
      // Dashboard mode: Save to database
      console.log('[Dashboard Mode] Saving manually added product to database')
      this.saveProductToDatabase(newProduct).then((savedProduct) => {
        this.products.push(savedProduct)
        this.renderStack()
        this.updateStats()
        this.showMessage('✅ Produkt erfolgreich hinzugefügt und gespeichert!', 'success')
      }).catch(error => {
        console.error('Failed to save manual product:', error)
        this.showMessage('❌ Fehler beim Speichern: ' + error.message, 'error')
      })
    } else {
      // Demo mode: Local storage
      console.log('[Demo Mode] Adding manual product locally')
      this.products.push(newProduct)
      this.renderStack()
      this.updateStats()
      this.showMessage('✅ Produkt hinzugefügt (Demo-Modus)', 'success')
    }
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

  // Check if we're in dashboard mode (authenticated user) or demo mode
  isDashboardMode() {
    // Check if we have auth token and are on dashboard page
    const hasAuthToken = localStorage.getItem('auth_token') !== null
    const isDashboardPage = window.location.pathname.includes('/dashboard')
    
    console.log('[Mode Check] hasAuthToken:', hasAuthToken, 'isDashboardPage:', isDashboardPage)
    return hasAuthToken && isDashboardPage
  }

  // Load dashboard-specific data (user stacks and products)
  async loadDashboardData() {
    try {
      console.log('[Dashboard Data] Loading user-specific stacks and products...')
      
      // Double-check authentication before loading data
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        console.log('[Dashboard Data] No auth token found, redirecting to login')
        window.location.href = '/auth'
        return
      }
      
      // Load user stacks, user products, and available products in parallel
      const [userStacks, userProducts, availableProducts] = await Promise.all([
        this.loadUserStacks(),
        this.loadUserProducts(),
        this.loadAvailableProducts()
      ])
      
      console.log('[Dashboard Data] Loaded:', userStacks.length, 'stacks,', userProducts.length, 'user products, and', availableProducts.length, 'available products')
      
      // Set the data
      this.userStacks = userStacks || []
      this.userProducts = userProducts || []
      
      // Set stacks data
      if (this.userStacks.length === 0) {
        console.log('[Dashboard Data] User has no stacks, creating default stack...')
        try {
          const defaultStack = await this.createDefaultStackInDatabase()
          this.userStacks = [defaultStack]
          this.stacks = this.userStacks
          console.log('[Dashboard Data] Default stack created:', defaultStack)
        } catch (error) {
          console.error('[Dashboard Data] Failed to create default stack, using local fallback:', error)
          this.stacks = this.createDefaultDashboardStack()
        }
      } else {
        console.log('[Dashboard Data] User has', this.userStacks.length, 'stacks, using them directly')
        this.stacks = this.userStacks
        
        // Debug: Log all stack names to identify the naming issue
        this.userStacks.forEach((stack, index) => {
          console.log(`[Dashboard Data] Stack ${index + 1}:`, {
            id: stack.id,
            name: stack.name,
            description: stack.description,
            products: stack.products?.length || 0
          })
        })
      }
      
      // Set available products from API (these are the products users can choose to add)
      this.availableProducts = availableProducts || this.loadDemoProducts()
      console.log('[Dashboard Data] Available products for adding:', this.availableProducts.length)
      
      this.dataLoaded = true
      console.log('[Dashboard Data] Dashboard data loaded successfully')
      
      // Update layer section and nutrient overview after loading data
      this.updateLayerSectionVisibility()
      this.updateNutrientOverview()
      
    } catch (error) {
      console.error('[Dashboard Data] Error loading dashboard data:', error)
      
      // If authentication fails (401), redirect to login
      if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        console.log('[Dashboard Data] Authentication failed, redirecting to login')
        localStorage.removeItem('auth_token')
        window.location.href = '/auth'
        return
      }
      
      // For other errors, show error message but stay on page
      this.stacks = this.createDefaultDashboardStack()
      this.showMessage('⚠️ Fehler beim Laden der Benutzerdaten. Bitte versuchen Sie es erneut.', 'error')
    }
  }

  // Create a default empty stack for new dashboard users (local fallback)
  createDefaultDashboardStack() {
    return [{
      id: 'user-default',
      name: 'Mein Stack',
      description: 'Ihr persönlicher Supplement-Stack',
      products: [],
      total_monthly_cost: 0,
      created_at: new Date().toISOString()
    }]
  }
  
  // Create a default stack in the database for new users
  async createDefaultStackInDatabase() {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('No authentication token found')
      }
      
      console.log('[Database Create] Creating default stack in database...')
      
      const stackData = {
        name: 'Mein Stack',
        description: 'Ihr persönlicher Supplement-Stack',
        products: []
      }
      
      console.log('[Database Create] Sending stack creation request:', stackData)
      
      const response = await fetch('/api/protected/stacks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stackData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }
      
      const stack = await response.json()
      console.log('[Database Create] Default stack created successfully:', stack)
      
      return {
        id: stack.id,
        name: stack.name,
        description: stack.description,
        products: stack.products || [],
        total_monthly_cost: 0,
        created_at: stack.created_at
      }
      
    } catch (error) {
      console.error('[Database Create] Error creating default stack:', error)
      throw error
    }
  }

  // Save product to database via AJAX (Dashboard mode only)
  async saveProductToDatabase(product) {
    try {
      console.log('[Database Save] Sending product to API:', product)
      
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Kein Authentifizierungstoken gefunden')
      }

      const response = await fetch('/api/protected/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: product.name,
          brand: product.brand || 'Unbekannt',
          purchase_price: product.purchase_price || 0,
          monthly_cost: product.monthly_cost || 0,
          shop_url: product.shop_url || '',
          category: product.category || 'Sonstiges',
          form: product.form || 'Einheit',
          dosage_per_day: product.dosage_per_day || 1,
          quantity: product.quantity || 30,
          days_supply: product.days_supply || 30
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('[Database Save] Product saved successfully:', result.product)
      
      // If we have a current stack, add the product to it
      if (this.currentStackId && result.product?.id) {
        console.log('[Database Save] Adding product', result.product.id, 'to current stack', this.currentStackId)
        try {
          await this.addProductToStack(result.product.id, this.currentStackId)
          console.log('[Database Save] Successfully added product to stack')
        } catch (stackError) {
          console.warn('[Database Save] Failed to add product to stack:', stackError)
          // Don't fail the whole operation if adding to stack fails
        }
      } else {
        console.info('[Database Save] Using fallback stack selection - currentStackId:', this.currentStackId, 'productId:', result.product?.id)
        
        // Try to get current stack from selector as fallback
        const stackSelector = document.getElementById('stack-selector')
        if (stackSelector?.value && result.product?.id) {
          const fallbackStackId = parseInt(stackSelector.value)
          console.log('[Database Save] Using fallback stack ID from selector:', fallbackStackId)
          try {
            await this.addProductToStack(result.product.id, fallbackStackId)
            console.log('[Database Save] Successfully added product to fallback stack')
          } catch (stackError) {
            console.warn('[Database Save] Fallback stack addition failed:', stackError)
          }
        } else {
          console.warn('[Database Save] No fallback stack available - selector:', !!stackSelector, 'value:', stackSelector?.value)
        }
      }
      
      this.showMessage('✅ Produkt erfolgreich in der Datenbank gespeichert!', 'success')
      return result.product
      
    } catch (error) {
      console.error('[Database Save] Error saving product:', error)
      throw error
    }
  }

  // Add product to stack via API (Dashboard mode only)
  async addProductToStack(productId, stackId, dosagePerDay = 1) {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('Kein Authentifizierungstoken gefunden')
      }

      const response = await fetch(`/api/protected/stacks/${stackId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          productId: productId,
          dosagePerDay: dosagePerDay
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('[Database Save] Product added to stack successfully')
      return result
      
    } catch (error) {
      console.error('[Database Save] Error adding product to stack:', error)
      throw error
    }
  }

  // Load user's saved stacks from database (Dashboard mode)
  async loadUserStacks() {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('No authentication token found')
      }

      console.log('[Database Load] Loading user stacks with token:', authToken.substring(0, 20) + '...')
      
      const response = await fetch('/api/protected/stacks', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('[Database Load] Stacks API response status:', response.status)

      if (response.status === 401) {
        throw new Error('401 Unauthorized - Invalid or expired token')
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Database Load] Stacks API error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const stacks = await response.json()
      console.log('[Database Load] User stacks loaded successfully:', stacks)
      return stacks
      
    } catch (error) {
      console.error('[Database Load] Error loading stacks:', error)
      throw error // Re-throw to let caller handle it
    }
  }

  // Load user's saved products from database (Dashboard mode)
  async loadUserProducts() {
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('No authentication token found')
      }

      console.log('[Database Load] Loading user products with token:', authToken.substring(0, 20) + '...')
      
      const response = await fetch('/api/protected/products', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('[Database Load] Products API response status:', response.status)

      if (response.status === 401) {
        throw new Error('401 Unauthorized - Invalid or expired token')
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Database Load] Products API error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const products = await response.json()
      console.log('[Database Load] User products loaded successfully:', products)
      return products
      
    } catch (error) {
      console.error('[Database Load] Error loading products:', error)
      throw error // Re-throw to let caller handle it
    }
  }
  // Load available products from API (products that users can choose to add)
  async loadAvailableProducts() {
    try {
      console.log('[Available Products] Loading available products from API...')
      
      const response = await fetch('/api/available-products', {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        console.warn('[Available Products] API not available, using demo products as fallback')
        return this.loadDemoProducts()
      }
      
      const products = await response.json()
      console.log('[Available Products] Loaded', products.length, 'available products from API')
      
      // Transform API products to match demo product format
      return products.map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        form: product.form,
        purchase_price: product.purchase_price,
        quantity: product.quantity,
        price_per_piece: product.price_per_piece,
        dosage_per_day: product.dosage_per_day,
        days_supply: product.days_supply,
        monthly_cost: product.monthly_cost,
        description: product.description,
        benefits: Array.isArray(product.benefits) ? product.benefits : JSON.parse(product.benefits || '[]'),
        warnings: Array.isArray(product.warnings) ? product.warnings : JSON.parse(product.warnings || '[]'),
        dosage_recommendation: product.dosage_recommendation,
        category: product.category,
        main_nutrients: Array.isArray(product.main_nutrients) ? product.main_nutrients : JSON.parse(product.main_nutrients || '[]'),
        secondary_nutrients: Array.isArray(product.secondary_nutrients) ? product.secondary_nutrients : JSON.parse(product.secondary_nutrients || '[]'),
        recommended: !!product.recommended,
        recommendation_rank: product.recommendation_rank || 0,
        product_image: product.product_image,
        shop_url: product.shop_url
      }))
      
    } catch (error) {
      console.error('[Available Products] Error loading available products:', error)
      console.log('[Available Products] Falling back to demo products')
      return this.loadDemoProducts()
    }
  }
  
  // Show demo limitation modal with upgrade information
  showDemoLimitationModal(title, content) {
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
      <div class="modal-container" style="background: white; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 28rem; max-height: 90vh; overflow-y: auto;">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center">
              <i class="fas fa-star text-yellow-500 mr-2"></i>
              ${title}
            </h3>
            <button class="modal-close text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          
          <div class="text-gray-700 leading-relaxed">
            ${content}
          </div>
          
          <div class="flex gap-3 mt-6">
            <button class="modal-close flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
              Demo fortsetzen
            </button>
            <button class="upgrade-button flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              <i class="fas fa-rocket mr-2"></i>Vollversion starten
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Event handlers
    modal.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.removeChild(modal)
      })
    })
    
    modal.querySelector('.upgrade-button').addEventListener('click', () => {
      // Redirect to registration/upgrade page
      window.location.href = '/auth?action=register'
    })
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal)
      }
    })
    
    // Close on escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(modal)
        document.removeEventListener('keydown', escHandler)
      }
    }
    document.addEventListener('keydown', escHandler)
  }
  
  // Force update stack selector DOM to reflect current stacks
  forceUpdateStackSelectorDOM() {
    console.log('[Demo Modal] Force updating stack selector DOM')
    const selector = document.getElementById('stack-selector')
    if (!selector) {
      console.warn('[Demo Modal] Stack selector not found for DOM update')
      return
    }
    
    // Filter valid stacks
    const validStacks = this.stacks.filter(stack => {
      return stack && stack.id !== undefined && stack.name !== undefined && stack.name.trim() !== ''
    })
    
    // Update HTML directly
    const selectorHTML = `
      <option value="">Stack auswählen...</option>
      ${validStacks.map(stack => `
        <option value="${stack.id}">${stack.name}</option>
      `).join('')}
    `
    
    console.log('[Demo Modal] Updating selector with', validStacks.length, 'valid stacks')
    console.log('[Demo Modal] New selector HTML:', selectorHTML)
    
    selector.innerHTML = selectorHTML
    
    // Auto-select first stack if available
    if (validStacks.length > 0) {
      selector.value = validStacks[0].id
      this.currentStackId = validStacks[0].id
      console.log('[Demo Modal] Auto-selected first remaining stack:', validStacks[0].name)
      
      // Trigger change event for button updates
      const changeEvent = new Event('change', { bubbles: true })
      selector.dispatchEvent(changeEvent)
      
      // Load the selected stack
      this.loadStack(validStacks[0].id)
    } else {
      selector.value = ''
      this.currentStackId = null
      this.products = []
      this.renderStack()
      console.log('[Demo Modal] No stacks remaining, cleared selection')
    }
  }
  
  // Synchronize stack data across all app instances
  synchronizeAllAppInstances() {
    console.log('[Demo Modal] Synchronizing all app instances with current stacks')
    
    // In demo mode, also update session storage during synchronization
    if (!this.isDashboardMode()) {
      this.saveDemoStacksToSession()
    }
    
    // Update window.demoApp if it exists and is different from this instance
    if (window.demoApp && window.demoApp !== this) {
      console.log('[Demo Modal] Updating window.demoApp stacks')
      window.demoApp.stacks = [...this.stacks]
      if (window.demoApp.userStacks) {
        window.demoApp.userStacks = [...this.stacks]
      }
    }
    
    // Update window.dashboardApp if it exists
    if (window.dashboardApp && window.dashboardApp !== this) {
      console.log('[Demo Modal] Updating window.dashboardApp stacks')
      window.dashboardApp.stacks = [...this.stacks]
      if (window.dashboardApp.userStacks) {
        window.dashboardApp.userStacks = [...this.stacks]
      }
    }
    
    // Also update this instance to be the primary one
    window.demoApp = this
  }
  
  // Delete stack
  async deleteStack(stackId) {
    if (!this.isDashboardMode()) {
      // Demo mode: Show full version message instead of actual deletion
      console.log('[Demo Modal] Stack deletion requested in demo mode - showing upgrade message')
      
      const stackName = this.stacks.find(s => s.id == stackId)?.name || 'Stack'
      
      // Show informative modal about full version capabilities
      this.showDemoLimitationModal(
        'Stack-Verwaltung in der Vollversion',
        `In der kostenlosen Vollversion können Sie Stacks wie "${stackName}" nach Ihren persönlichen Bedürfnissen löschen und hinzufügen.
        
        <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 class="font-semibold text-blue-900 mb-2">✨ In der Vollversion verfügbar:</h4>
          <ul class="text-blue-800 text-sm space-y-1">
            <li>• Unbegrenzte Stack-Erstellung</li>
            <li>• Stacks nach Bedarf löschen</li>
            <li>• Eigene Produkte hinzufügen</li>
            <li>• Persönliche Datenbank</li>
            <li>• Automatische Synchronisation</li>
          </ul>
        </div>
        
        <p class="mt-3 text-sm text-gray-600">
          <strong>Demo-Modus:</strong> Hier können Sie alle Features testen, aber Änderungen werden nur für die aktuelle Sitzung gespeichert.
        </p>`
      )
      return
    }
    
    try {
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        throw new Error('No authentication token found')
      }
      
      console.log('[Dashboard] Deleting stack:', stackId)
      
      const response = await fetch(`/api/protected/stacks/${stackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }
      
      console.log('[Dashboard] Stack deleted successfully')
      
      // Remove from local lists
      this.stacks = this.stacks.filter(s => s.id !== stackId)
      this.userStacks = this.userStacks.filter(s => s.id !== stackId)
      
      // Update UI
      await this.initStackSelector()
      
      // Update dashboard delete button state if function exists
      if (typeof window.updateDashboardDeleteButtonState === 'function') {
        console.log('[Dashboard] Calling dashboard delete button update function after stack deletion')
        window.updateDashboardDeleteButtonState()
      }
      
      // If no stacks left, create a default one
      if (this.stacks.length === 0) {
        const defaultStack = await this.createDefaultStackInDatabase()
        this.stacks = [defaultStack]
        this.userStacks = [defaultStack]
        await this.initStackSelector()
      }
      
      this.showSuccess('Stack erfolgreich gelöscht!')
      
    } catch (error) {
      console.error('[Dashboard] Error deleting stack:', error)
      this.showError(error.message || 'Fehler beim Löschen des Stacks')
      throw error
    }
  }

  // Helper function to standardize nutrient names for consistency
  standardizeNutrientName(nutrientName) {
    const name = nutrientName.toLowerCase()
    
    // Vitamin standardization: "Vitamin [X] (Chemical Name)"
    const vitaminMappings = {
      // Fettlösliche Vitamine
      'vitamin a': 'Vitamin A (Retinol)',
      'retinol': 'Vitamin A (Retinol)',
      'beta-carotin': 'Vitamin A (Beta-Carotin)',
      
      'vitamin d': 'Vitamin D (Cholecalciferol)',
      'vitamin d3': 'Vitamin D3 (Cholecalciferol)', 
      'vitamin d2': 'Vitamin D2 (Ergocalciferol)',
      'cholecalciferol': 'Vitamin D3 (Cholecalciferol)',
      
      'vitamin e': 'Vitamin E (Tocopherol)',
      'tocopherol': 'Vitamin E (Tocopherol)',
      'alpha-tocopherol': 'Vitamin E (Alpha-Tocopherol)',
      
      'vitamin k': 'Vitamin K (Phylloquinon)',
      'vitamin k1': 'Vitamin K1 (Phylloquinon)',
      'vitamin k2': 'Vitamin K2 (Menaquinon)',
      'phylloquinon': 'Vitamin K1 (Phylloquinon)',
      'menaquinon': 'Vitamin K2 (Menaquinon)',
      'mk-7': 'Vitamin K2 (MK-7)',
      
      // Wasserlösliche Vitamine - B-Komplex
      'vitamin b1': 'Vitamin B1 (Thiamin)',
      'thiamin': 'Vitamin B1 (Thiamin)',
      
      'vitamin b2': 'Vitamin B2 (Riboflavin)',
      'riboflavin': 'Vitamin B2 (Riboflavin)',
      
      'vitamin b3': 'Vitamin B3 (Niacin)',
      'niacin': 'Vitamin B3 (Niacin)',
      'nicotinsäure': 'Vitamin B3 (Niacin)',
      
      'vitamin b5': 'Vitamin B5 (Pantothensäure)',
      'pantothensäure': 'Vitamin B5 (Pantothensäure)',
      
      'vitamin b6': 'Vitamin B6 (Pyridoxin)',
      'pyridoxin': 'Vitamin B6 (Pyridoxin)',
      
      'vitamin b7': 'Vitamin B7 (Biotin)',
      'biotin': 'Vitamin B7 (Biotin)',
      'vitamin h': 'Vitamin B7 (Biotin)',
      
      'vitamin b9': 'Vitamin B9 (Folsäure)',
      'folsäure': 'Vitamin B9 (Folsäure)',
      'folat': 'Vitamin B9 (Folsäure)',
      '5-mthf': 'Vitamin B9 (5-MTHF)',
      
      'vitamin b12': 'Vitamin B12 (Cobalamin)',
      'b12': 'Vitamin B12 (Cobalamin)',
      'cobalamin': 'Vitamin B12 (Cobalamin)',
      'methylcobalamin': 'Vitamin B12 (Methylcobalamin)',
      'cyanocobalamin': 'Vitamin B12 (Cyanocobalamin)',
      
      'vitamin c': 'Vitamin C (Ascorbinsäure)',
      'ascorbinsäure': 'Vitamin C (Ascorbinsäure)',
      'ester-c': 'Vitamin C (Ester-C)'
    }
    
    // Check for exact matches first
    for (const [key, standardName] of Object.entries(vitaminMappings)) {
      if (name === key || name.includes(key)) {
        return standardName
      }
    }
    
    // Mineral and trace element standardization
    const mineralMappings = {
      'magnesium': 'Magnesium',
      'mg': 'Magnesium', 
      'calcium': 'Calcium',
      'ca': 'Calcium',
      'kalium': 'Kalium',
      'potassium': 'Kalium',
      'k': 'Kalium',
      'phosphor': 'Phosphor',
      'natrium': 'Natrium',
      'schwefel': 'Schwefel',
      
      'zink': 'Zink',
      'zinc': 'Zink',
      'zn': 'Zink',
      'eisen': 'Eisen', 
      'iron': 'Eisen',
      'fe': 'Eisen',
      'selen': 'Selen',
      'selenium': 'Selen',
      'se': 'Selen',
      'jod': 'Jod',
      'iodine': 'Jod',
      'i': 'Jod',
      'chrom': 'Chrom',
      'chromium': 'Chrom',
      'cr': 'Chrom',
      'kupfer': 'Kupfer',
      'copper': 'Kupfer',
      'cu': 'Kupfer'
    }
    
    for (const [key, standardName] of Object.entries(mineralMappings)) {
      if (name === key || name.includes(key)) {
        return standardName
      }
    }
    
    // Return original name if no mapping found (with proper capitalization)
    return nutrientName.charAt(0).toUpperCase() + nutrientName.slice(1)
  }

  // Helper function to categorize nutrients with proper hierarchy
  getNutrientCategory(nutrientName) {
    const name = nutrientName.toLowerCase()
    
    // Vitamine (A, B-Komplex, C, D, E, K, etc.)
    if (name.includes('vitamin') || name.includes('folsäure') || name.includes('folat') || 
        name.includes('biotin') || name.includes('niacin') || name.includes('pantothensäure')) {
      return 'Vitamine'
    }
    
    // Mineralstoffe (Makromineralien - größere Mengen benötigt)
    if (name.includes('magnesium') || name.includes('calcium') || name.includes('kalium') || 
        name.includes('phosphor') || name.includes('natrium') || name.includes('schwefel')) {
      return 'Mineralstoffe'
    }
    
    // Spurenelemente (Mikromineralien - kleinere Mengen benötigt)
    if (name.includes('zink') || name.includes('eisen') || name.includes('selen') || 
        name.includes('jod') || name.includes('chrom') || name.includes('kupfer') || 
        name.includes('mangan') || name.includes('molybdän') || name.includes('kobalt') ||
        name.includes('fluor') || name.includes('bor')) {
      return 'Spurenelemente'
    }
    
    // Fettsäuren
    if (name.includes('omega') || name.includes('epa') || name.includes('dha') || 
        name.includes('dpa') || name.includes('fett') || name.includes('linolsäure') ||
        name.includes('alpha-linolensäure')) {
      return 'Fettsäuren'
    }
    
    // Aminosäuren und Proteine
    if (name.includes('carnitin') || name.includes('creatin') || name.includes('protein') || 
        name.includes('amino') || name.includes('lysin') || name.includes('leucin') ||
        name.includes('valin') || name.includes('isoleucin') || name.includes('tryptophan') ||
        name.includes('methionin') || name.includes('cystein') || name.includes('tyrosin')) {
      return 'Aminosäuren'
    }
    
    // Antioxidantien und sekundäre Pflanzenstoffe
    if (name.includes('coenzym') || name.includes('q10') || name.includes('glutathion') || 
        name.includes('resveratrol') || name.includes('curcumin') || name.includes('quercetin') ||
        name.includes('lycopin') || name.includes('anthocyan')) {
      return 'Antioxidantien'
    }
    
    return 'Sonstige'
  }

  // Show or hide the layer section based on whether stacks are available
  updateLayerSectionVisibility() {
    const layerSection = document.getElementById('dashboard-layer-section')
    if (!layerSection) return

    // Show if we have stacks and a current stack is selected
    if (this.stacks && this.stacks.length > 0 && this.currentStackId) {
      layerSection.classList.remove('hidden')
    } else {
      layerSection.classList.add('hidden')
    }
  }

  // Update nutrient overview in the "Transparenter Einblick" section
  updateNutrientOverview() {
    const nutrientOverview = document.getElementById('nutrient-overview')
    if (!nutrientOverview) {
      console.log('[Nutrient Overview] Element not found')
      return
    }

    // Get current stack name for display
    const currentStack = this.stacks.find(s => s.id == this.currentStackId)
    const stackName = currentStack ? currentStack.name : 'Aktueller Stack'
    
    // Use this.products which contains the fully loaded product objects
    if (!this.products || this.products.length === 0) {
      nutrientOverview.innerHTML = `
        <div class="col-span-full text-center py-8">
          <i class="fas fa-info-circle text-gray-400 text-2xl mb-2"></i>
          <p class="text-gray-500">Keine Produkte im aktuellen Stack</p>
          <p class="text-gray-400 text-sm">Fügen Sie Produkte hinzu, um die Nährstoffübersicht zu sehen</p>
        </div>
      `
      return
    }

    console.log('[Nutrient Overview] Calculating nutrients for stack:', stackName, 'with', this.products.length, 'products')

    // Aggregate nutrients from all products in the stack
    const nutrientTotals = {}
    
    this.products.forEach(product => {
      // Handle main_nutrients from database
      if (product.main_nutrients && Array.isArray(product.main_nutrients)) {
        product.main_nutrients.forEach(mainNutrient => {
          // Find nutrient info by ID
          const nutrientInfo = this.nutrients.find(n => n.id === mainNutrient.nutrient_id)
          if (!nutrientInfo) {
            console.warn('[Nutrient Overview] Nutrient not found:', mainNutrient.nutrient_id)
            return
          }
          
          // Apply nutrient name standardization
          const standardizedName = this.standardizeNutrientName(nutrientInfo.name)
          const key = standardizedName
          if (!nutrientTotals[key]) {
            nutrientTotals[key] = {
              name: standardizedName,
              amount: 0,
              unit: nutrientInfo.unit,
              category: this.getNutrientCategory(standardizedName),
              effects: mainNutrient.effects || nutrientInfo.effects || 'Keine Empfehlung'
            }
          }
          
          // Calculate daily amount: nutrient amount per unit * daily dosage
          const dailyAmount = (mainNutrient.amount_per_unit || 0) * (product.dosage_per_day || 1)
          nutrientTotals[key].amount += dailyAmount
        })
      }
      
      // Handle secondary_nutrients as well
      if (product.secondary_nutrients && Array.isArray(product.secondary_nutrients)) {
        product.secondary_nutrients.forEach(secondaryNutrient => {
          const nutrientInfo = this.nutrients.find(n => n.id === secondaryNutrient.nutrient_id)
          if (!nutrientInfo) return
          
          // Apply nutrient name standardization
          const standardizedName = this.standardizeNutrientName(nutrientInfo.name)
          const key = standardizedName
          if (!nutrientTotals[key]) {
            nutrientTotals[key] = {
              name: standardizedName,
              amount: 0,
              unit: nutrientInfo.unit,
              category: this.getNutrientCategory(standardizedName),
              effects: secondaryNutrient.effects || nutrientInfo.effects || 'Keine Empfehlung'
            }
          }
          
          const dailyAmount = (secondaryNutrient.amount_per_unit || 0) * (product.dosage_per_day || 1)
          nutrientTotals[key].amount += dailyAmount
        })
      }
      
      // Fallback: Handle old nutrient structure for backward compatibility
      if (product.nutrients && Array.isArray(product.nutrients)) {
        product.nutrients.forEach(nutrient => {
          // Apply nutrient name standardization for fallback nutrients
          const standardizedName = this.standardizeNutrientName(nutrient.name)
          const key = standardizedName
          if (!nutrientTotals[key]) {
            nutrientTotals[key] = {
              name: standardizedName,
              amount: 0,
              unit: nutrient.unit,
              category: this.getNutrientCategory(standardizedName),
              effects: nutrient.effects || 'Keine Empfehlung'
            }
          }
          
          const dailyAmount = (nutrient.amount || 0) * (product.dosage_per_day || 1)
          nutrientTotals[key].amount += dailyAmount
        })
      }
    })

    // Convert to array and sort by category and name
    const nutrientArray = Object.values(nutrientTotals).sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.name.localeCompare(b.name)
    })

    if (nutrientArray.length === 0) {
      nutrientOverview.innerHTML = `
        <div class="col-span-full text-center py-8">
          <i class="fas fa-flask text-gray-400 text-2xl mb-2"></i>
          <p class="text-gray-500">Keine Nährstoffdaten verfügbar</p>
          <p class="text-gray-400 text-sm">Die Produkte in diesem Stack haben noch keine Nährstoffinformationen</p>
        </div>
      `
      return
    }

    // Group by category
    const categories = {}
    nutrientArray.forEach(nutrient => {
      const category = nutrient.category || 'Sonstige'
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(nutrient)
    })

    // Define category order (hierarchy)
    const categoryOrder = [
      'Vitamine',
      'Mineralstoffe', 
      'Spurenelemente',
      'Fettsäuren',
      'Aminosäuren',
      'Antioxidantien',
      'Sonstige'
    ]

    // Generate HTML in proper order with appropriate icons
    let html = ''
    categoryOrder.forEach(category => {
      if (!categories[category] || categories[category].length === 0) return
      
      // Choose appropriate icon for each category
      let categoryIcon = 'fas fa-circle'
      switch(category) {
        case 'Vitamine': categoryIcon = 'fas fa-sun'; break;
        case 'Mineralstoffe': categoryIcon = 'fas fa-mountain'; break;
        case 'Spurenelemente': categoryIcon = 'fas fa-atom'; break;
        case 'Fettsäuren': categoryIcon = 'fas fa-tint'; break;
        case 'Aminosäuren': categoryIcon = 'fas fa-link'; break;
        case 'Antioxidantien': categoryIcon = 'fas fa-shield-alt'; break;
        case 'Sonstige': categoryIcon = 'fas fa-ellipsis-h'; break;
      }
      
      html += `
        <div class="col-span-full mb-6">
          <h4 class="font-semibold text-gray-800 mb-3 border-b border-gray-200 pb-2">
            <i class="${categoryIcon} text-blue-600 mr-2"></i>
            ${category}
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      `
      
      categories[category].forEach(nutrient => {
        const amount = Math.round(nutrient.amount * 100) / 100 // Round to 2 decimal places
        // Check if nutrient has effects information
        const effectsText = nutrient.effects || 'Keine Empfehlung'
        
        html += `
          <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-blue-50 transition-colors">
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-gray-800 text-sm">${nutrient.name}</span>
              <span class="text-blue-600 font-semibold">${amount} ${nutrient.unit}</span>
            </div>
            <div class="text-xs text-gray-600">
              <strong>Wirkung:</strong> ${effectsText}
            </div>
          </div>
        `
      })
      
      html += `
          </div>
        </div>
      `
    })

    nutrientOverview.innerHTML = html
    console.log('[Nutrient Overview] Updated with', nutrientArray.length, 'nutrients across', Object.keys(categories).length, 'categories')
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