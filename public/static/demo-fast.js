// Fast Demo App - Optimierte Version der Demo-Funktionalität
// Fokussiert auf Geschwindigkeit und minimale Ressourcennutzung

class FastDemoApp {
  constructor() {
    this.initialized = false
    this.stacks = []
    this.currentStackId = null
    this.products = []
    this.availableProducts = []
    
    // Performance-Einstellungen
    this.renderDebounceTime = 150
    this.cacheTimeout = 300000 // 5 Minuten
    
    // Mode Detection
    this.isDashboardMode = this.detectDashboardMode()
    
    this.init()
  }

  detectDashboardMode() {
    return window.location.pathname === '/dashboard'
  }

  async init() {
    if (this.initialized) return
    
    console.log('[Fast Demo] Initializing...')
    const startTime = performance.now()
    
    try {
      // Minimale Setup-Zeit
      await this.quickSetup()
      
      this.initialized = true
      const loadTime = Math.round(performance.now() - startTime)
      console.log(`[Fast Demo] Initialized in ${loadTime}ms`)
      
      this.showQuickNotification(`Demo geladen in ${loadTime}ms!`, 'success')
      
    } catch (error) {
      console.error('[Fast Demo] Initialization error:', error)
      this.showQuickNotification('Fehler beim Laden der Demo', 'error')
    }
  }

  async quickSetup() {
    // Event Listeners mit minimaler DOM-Manipulation
    this.setupMinimalEvents()
    
    // Daten laden (mit Caching)
    await this.loadDataFast()
    
    // Initial rendering mit Debouncing
    this.scheduleRender('initial')
  }

  setupMinimalEvents() {
    // Einziger Event Listener für alle Demo-Actions
    document.addEventListener('click', this.handleGlobalClick.bind(this), { 
      passive: true, 
      capture: false 
    })
    
    // Stack-Selector
    const stackSelector = document.getElementById('stack-selector')
    if (stackSelector) {
      stackSelector.addEventListener('change', this.handleStackChange.bind(this), {
        passive: true
      })
    }
  }

  handleGlobalClick(e) {
    const target = e.target.closest('button')
    if (!target) return

    const action = target.id || target.dataset.action
    
    // Verhindere mehrfache Klicks
    if (target.disabled) return
    
    switch (true) {
      case action === 'demo-add-product-main':
      case action?.includes('add-product'):
        e.preventDefault()
        this.showAddProductModal()
        break
        
      case action === 'demo-create-stack-main':
      case action?.includes('create-stack'):
        e.preventDefault()
        this.showCreateStackModal()
        break
        
      case action?.includes('delete-stack'):
        e.preventDefault()
        this.handleDeleteStack()
        break

      case action === 'edit-product':
        e.preventDefault()
        const editProductId = target.dataset.productId
        if (editProductId) {
          this.editProduct(editProductId)
        }
        break

      case action === 'delete-product':
        e.preventDefault()
        const deleteProductId = target.dataset.productId
        if (deleteProductId) {
          this.deleteProduct(deleteProductId)
        }
        break
    }
  }

  async handleStackChange(e) {
    const stackId = e.target.value
    if (!stackId || stackId === this.currentStackId) return
    
    this.currentStackId = stackId
    this.scheduleRender('stack-change')
  }

  async loadDataFast() {
    if (this.isDashboardMode) {
      console.log('[Fast App] Loading dashboard data (user stacks)...')
      await this.loadDashboardStacks()
    } else {
      console.log('[Fast App] Loading demo data...')
      await this.loadDemoStacks()
    }
    
    // Ersten Stack setzen wenn keiner ausgewählt
    if (!this.currentStackId && this.stacks.length > 0) {
      this.currentStackId = this.stacks[0].id
    }
    
    // Stack-Selector sofort füllen (nach currentStackId setzen)
    this.updateStackSelector()
  }

  async loadDashboardStacks() {
    try {
      // Authentifizierung prüfen
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        console.log('[Dashboard] No auth token, redirecting...')
        window.location.href = '/auth'
        return
      }

      // Lade sowohl User-Stacks als auch verfügbare Produkte parallel
      const [stacks, availableProducts] = await Promise.all([
        window.performanceCore.fetchWithCache('/api/protected/stacks', {
          headers: { 'Authorization': `Bearer ${authToken}` },
          bypassCache: true // User-Stacks immer frisch laden
        }),
        window.performanceCore.fetchWithCache('/api/available-products', {
          cacheTTL: 600000 // 10 Minuten Cache für verfügbare Produkte
        })
      ])
      
      this.stacks = stacks || []
      this.availableProducts = availableProducts || []
      
      console.log('[Dashboard] Loaded', this.stacks.length, 'user stacks and', this.availableProducts.length, 'available products')

      // Wenn keine Stacks vorhanden, Default-Stack erstellen
      if (this.stacks.length === 0) {
        await this.createDefaultUserStack()
      }

    } catch (error) {
      console.error('[Dashboard] Error loading stacks:', error)
      
      // Bei Auth-Fehler zur Login-Seite
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth'
        return
      }
      
      // Fallback: Lade verfügbare Produkte und erstelle Default-Stack
      try {
        this.availableProducts = await window.performanceCore.fetchWithCache('/api/available-products')
      } catch (e) {
        this.availableProducts = this.getMinimalProducts()
      }
      
      this.stacks = [{
        id: 'user-default',
        name: 'Mein Stack',
        description: 'Ihr persönlicher Supplement-Stack',
        products: []
      }]
    }
  }

  async loadDemoStacks() {
    try {
      console.log('[Demo] Loading stacks from database (same as backend)...')
      
      // Demo verwendet dieselben verfügbaren Produkte aus der Datenbank
      this.availableProducts = await window.performanceCore.fetchWithCache('/api/available-products', {
        cacheTTL: 600000 // 10 Minuten Cache für Demo-Produkte
      })
      
      console.log('[Demo] Loaded', this.availableProducts.length, 'products from database')
      
      // Demo-Stacks basieren auf echten DB-Produkten, aber werden lokal verwaltet
      const sessionData = sessionStorage.getItem('supplement_demo_stacks')
      if (sessionData) {
        this.stacks = JSON.parse(sessionData)
        console.log('[Demo] Using session-stored stacks')
      } else {
        // Erstelle Demo-Stacks basierend auf echten DB-Produkten
        this.stacks = this.createDemoStacksFromDB()
        sessionStorage.setItem('supplement_demo_stacks', JSON.stringify(this.stacks))
        console.log('[Demo] Created demo stacks from DB products')
      }
      
      // Cache für Performance
      window.performanceCore.setCache('demo_stacks', this.stacks)
      
    } catch (error) {
      console.error('[Demo] Error loading from database, using fallback:', error)
      
      // Fallback zu statischen Demo-Daten
      this.stacks = this.getDefaultStacks()
      this.availableProducts = this.getMinimalProducts()
    }
  }

  createDemoStacksFromDB() {
    // Erstelle Demo-Stacks basierend auf echten Produkten aus der DB
    if (!this.availableProducts || this.availableProducts.length === 0) {
      return this.getDefaultStacks() // Fallback
    }

    // Filtere Produkte nach Kategorien für Demo-Stacks
    const vitamins = this.availableProducts.filter(p => 
      p.category === 'Vitamine' || p.name.toLowerCase().includes('vitamin')
    ).slice(0, 3)
    
    const minerals = this.availableProducts.filter(p => 
      p.category === 'Mineralstoffe' || p.name.toLowerCase().includes('magnesium') || p.name.toLowerCase().includes('zink')
    ).slice(0, 2)
    
    const others = this.availableProducts.filter(p => 
      p.category === 'Fettsäuren' || p.name.toLowerCase().includes('omega') || p.name.toLowerCase().includes('kreatin')
    ).slice(0, 2)

    return [
      {
        id: 'demo-basis',
        name: 'Basis Gesundheit',
        description: 'Grundlegende Nährstoffe für den täglichen Bedarf (aus DB)',
        products: vitamins.length > 0 ? vitamins : this.getDefaultStacks()[0].products
      },
      {
        id: 'demo-advanced', 
        name: 'Erweiterte Versorgung',
        description: 'Optimierte Mineralstoff- und Omega-3-Versorgung (aus DB)',
        products: [...minerals, ...others].length > 0 ? [...minerals, ...others] : this.getDefaultStacks()[1].products
      }
    ]
  }

  async createDefaultUserStack() {
    try {
      const authToken = localStorage.getItem('auth_token')
      const response = await axios.post('/api/protected/stacks', {
        name: 'Mein Stack',
        description: 'Ihr persönlicher Supplement-Stack',
        products: []
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })

      if (response.data && response.data.stack) {
        this.stacks = [response.data.stack]
        console.log('[Dashboard] Created default user stack')
      }
    } catch (error) {
      console.error('[Dashboard] Error creating default stack:', error)
    }
  }

  getDefaultStacks() {
    return [
      {
        id: 'demo-basis',
        name: 'Basis Gesundheit',
        description: 'Grundlegende Nährstoffe für den täglichen Bedarf',
        products: [
          { 
            id: 1, 
            name: 'Vitamin D3 4000 IU', 
            brand: 'Sunday Natural', 
            form: 'Kapsel',
            monthly_cost: 11.94,
            purchase_price: 19.90,
            quantity: 50,
            dosage_per_day: 1,
            recommended: true,
            product_image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 2, 
            name: 'B12 Methylcobalamin', 
            brand: 'InnoNature', 
            form: 'Tropfen',
            monthly_cost: 12.45,
            purchase_price: 24.90,
            quantity: 60,
            dosage_per_day: 1,
            recommended: false,
            product_image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 3, 
            name: 'Vitamin C 1000mg', 
            brand: 'Pure Encapsulations', 
            form: 'Kapsel',
            monthly_cost: 18.90,
            purchase_price: 32.90,
            quantity: 60,
            dosage_per_day: 1,
            recommended: false,
            product_image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop&crop=center'
          }
        ]
      },
      {
        id: 'demo-sport',
        name: 'Sport & Energie', 
        description: 'Optimiert für aktive Menschen und Sportler',
        products: [
          { 
            id: 4, 
            name: 'Magnesiumcitrat 400mg', 
            brand: 'Qidosha', 
            form: 'Kapsel',
            monthly_cost: 15.50,
            purchase_price: 22.90,
            quantity: 30,
            dosage_per_day: 2,
            recommended: true,
            product_image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 5, 
            name: 'Kreatin Monohydrat', 
            brand: 'Olimp', 
            form: 'Kapsel',
            monthly_cost: 19.90,
            purchase_price: 29.90,
            quantity: 120,
            dosage_per_day: 4,
            recommended: false,
            product_image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop&crop=center'
          },
          { 
            id: 6, 
            name: 'Omega-3 EPA/DHA', 
            brand: 'Norsan', 
            form: 'Kapsel',
            monthly_cost: 24.90,
            purchase_price: 39.90,
            quantity: 60,
            dosage_per_day: 2,
            recommended: true,
            product_image: 'https://images.unsplash.com/photo-1559662780-33af019fd570?w=400&h=400&fit=crop&crop=center'
          }
        ]
      }
    ]
  }

  getMinimalProducts() {
    return [
      { id: 1, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', category: 'Vitamine', monthly_cost: 11.94 },
      { id: 2, name: 'B12 Methylcobalamin', brand: 'InnoNature', category: 'Vitamine', monthly_cost: 12.45 },
      { id: 3, name: 'Vitamin C 1000mg', brand: 'Pure Encapsulations', category: 'Vitamine', monthly_cost: 18.90 },
      { id: 4, name: 'Magnesiumcitrat 400mg', brand: 'Qidosha', category: 'Mineralstoffe', monthly_cost: 15.50 },
      { id: 5, name: 'Kreatin Monohydrat', brand: 'Olimp', category: 'Sport', monthly_cost: 19.90 },
      { id: 6, name: 'Omega-3 EPA/DHA', brand: 'Norsan', category: 'Fettsäuren', monthly_cost: 24.90 }
    ]
  }

  updateStackSelector() {
    const selector = document.getElementById('stack-selector')
    if (!selector) return
    
    const options = this.stacks.map(stack => 
      `<option value="${stack.id}" ${stack.id === this.currentStackId ? 'selected' : ''}>
        ${stack.name} (${stack.products?.length || 0} Produkte)
      </option>`
    ).join('')
    
    selector.innerHTML = '<option value="">Stack auswählen...</option>' + options
    
    // Ensure the current stack is selected in the dropdown
    if (this.currentStackId) {
      selector.value = this.currentStackId
    }
    
    // Update delete button state
    this.updateDeleteButtonState()
  }

  updateDeleteButtonState() {
    const deleteBtn = document.getElementById('demo-delete-stack-main')
    if (!deleteBtn) return
    
    if (this.currentStackId) {
      deleteBtn.disabled = false
      deleteBtn.className = 'bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm font-medium shadow-sm'
    } else {
      deleteBtn.disabled = true
      deleteBtn.className = 'bg-gray-400 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium shadow-sm cursor-not-allowed'
    }
  }

  scheduleRender(reason) {
    // Aggressive debouncing to prevent multiple rapid renders
    window.performanceCore.debounceRender(
      `demo-render-${reason}`, 
      () => {
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => this.renderStackFast())
      }, 
      this.renderDebounceTime
    )
  }

  renderStackFast() {
    const stackGrid = document.getElementById('demo-stack-grid')
    if (!stackGrid) return
    
    const currentStack = this.stacks.find(s => s.id === this.currentStackId)
    if (!currentStack) {
      stackGrid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">Wählen Sie einen Stack aus</div>'
      return
    }

    const products = currentStack.products || []
    
    // Performance-überwachtes Rendering
    if (window.performanceMonitor) {
      window.performanceMonitor.measureStackRender(() => {
        this.doRenderStack(stackGrid, products, currentStack)
      }, this.currentStackId, products.length)
    } else {
      this.doRenderStack(stackGrid, products, currentStack)
    }
  }

  doRenderStack(stackGrid, products, currentStack) {
    // Optimierte HTML-Generation mit Template-String-Caching
    const productHTML = products.map(product => this.renderProductCard(product)).join('')
    
    stackGrid.innerHTML = productHTML || 
      '<div class="col-span-full text-center py-8 text-gray-500">Keine Produkte im Stack</div>'
    
    console.log(`[Fast Demo] Rendered stack "${currentStack.name}" with ${products.length} products`)
  }

  renderProductCard(product) {
    // Vollständiges Design-Template - funktioniert für DB- und Demo-Produkte
    const intakeTime = this.getProductIntakeTime(product)
    const labelColor = this.getIntakeTimeLabelColor(intakeTime)
    
    // Unterstütze sowohl DB-Produktstruktur als auch Demo-Produktstruktur
    const productData = this.normalizeProductData(product)
    
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
        
        <!-- Action Buttons for Edit/Delete -->
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

  // Modal-Funktionen (vollständig wiederhergestellt)
  showAddProductModal() {
    console.log('[Fast Demo] Zeige Add Product Modal')
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
                Dosierung für <span id="dosage-nutrient-name" class="font-bold">Vitamin D3</span> festlegen
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
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    this.setupAddProductModalHandlers(modal)
  }

  showCreateStackModal() {
    console.log('[Fast Demo] Zeige Create Stack Modal')
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
    
    document.body.appendChild(modal)
    this.setupCreateStackModalHandlers(modal)
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove())
  }

  setupAddProductModalHandlers(modal) {
    // Close modal handlers
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Nutrient search functionality
    const searchInput = modal.querySelector('#nutrient-search')
    const searchResults = modal.querySelector('#nutrient-search-results')
    
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim()
      
      if (searchTerm.length >= 2) {
        // Simulate nutrient search results
        const nutrients = [
          { id: 1, name: 'Vitamin D3', unit: 'IE', dge: 800, study: 2000, description: 'Wichtig für Knochen und Immunsystem' },
          { id: 2, name: 'Vitamin B12', unit: 'µg', dge: 4, study: 250, description: 'Essentiell für Nervensystem und Blutbildung' },
          { id: 3, name: 'Magnesium', unit: 'mg', dge: 400, study: 600, description: 'Unterstützt Muskeln und Energiestoffwechsel' },
          { id: 4, name: 'Omega-3', unit: 'mg', dge: 250, study: 1000, description: 'Wichtig für Herz und Gehirn' }
        ]
        
        const matches = nutrients.filter(n => 
          n.name.toLowerCase().includes(searchTerm) ||
          searchTerm.includes('d3') && n.name.includes('D3') ||
          searchTerm.includes('b12') && n.name.includes('B12')
        )
        
        if (matches.length > 0) {
          searchResults.innerHTML = matches.map(nutrient => `
            <div class="nutrient-result p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors" data-nutrient-id="${nutrient.id}">
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-medium text-gray-900">${nutrient.name}</div>
                  <div class="text-sm text-gray-600">Vitamine • DGE: ${nutrient.dge}${nutrient.unit}</div>
                </div>
                <div class="flex items-center text-green-600">
                  <i class="fas fa-star text-sm mr-1"></i>
                  <span class="text-xs font-medium">Hauptwirkstoff</span>
                </div>
              </div>
            </div>
          `).join('')
          
          searchResults.classList.remove('hidden')
          
          // Handle nutrient selection
          searchResults.querySelectorAll('.nutrient-result').forEach(result => {
            result.addEventListener('click', (e) => {
              const nutrientId = e.currentTarget.dataset.nutrientId
              const selectedNutrient = matches.find(n => n.id == nutrientId)
              this.selectNutrient(modal, selectedNutrient)
            })
          })
        } else {
          searchResults.innerHTML = '<div class="text-gray-500 text-center py-4">Keine Wirkstoffe gefunden</div>'
          searchResults.classList.remove('hidden')
        }
      } else {
        searchResults.classList.add('hidden')
      }
    })

    // Dosage buttons
    modal.querySelector('#use-dge-dosage').addEventListener('click', () => {
      modal.querySelector('#custom-dosage').value = '800'
    })
    
    modal.querySelector('#use-study-dosage').addEventListener('click', () => {
      modal.querySelector('#custom-dosage').value = '2000'
    })

    // Continue to products button
    modal.querySelector('#continue-to-products').addEventListener('click', () => {
      this.showQuickNotification('Produktsuche wird geladen...', 'info')
      setTimeout(() => modal.remove(), 1000)
    })
  }

  selectNutrient(modal, nutrient) {
    // Update dosage step with selected nutrient
    modal.querySelector('#dosage-nutrient-name').textContent = nutrient.name
    modal.querySelector('#dge-recommendation').textContent = `${nutrient.dge}${nutrient.unit}`
    modal.querySelector('#study-recommendation').textContent = `${nutrient.study}${nutrient.unit}`
    modal.querySelector('#dosage-unit').textContent = `(${nutrient.unit})`
    modal.querySelector('#custom-dosage').value = nutrient.dge
    
    // Hide search step, show dosage step
    modal.querySelector('#step-nutrient-search').classList.add('hidden')
    modal.querySelector('#step-dosage-selection').classList.remove('hidden')
    
    // Back button
    modal.querySelector('#back-to-nutrient-search').addEventListener('click', () => {
      modal.querySelector('#step-dosage-selection').classList.add('hidden')
      modal.querySelector('#step-nutrient-search').classList.remove('hidden')
    })
  }

  setupCreateStackModalHandlers(modal) {
    // Close modal handlers
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove())
    })
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Form submission
    const form = modal.querySelector('#create-stack-form')
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      
      const name = modal.querySelector('#stack-name').value.trim()
      const description = modal.querySelector('#stack-description').value.trim()
      
      if (!name) {
        this.showQuickNotification('Bitte geben Sie einen Stack-Namen ein', 'error')
        return
      }
      
      // Create new stack
      const newStack = {
        id: 'stack-' + Date.now(),
        name: name,
        description: description || 'Benutzerdefinierter Stack',
        products: []
      }
      
      this.stacks.push(newStack)
      this.currentStackId = newStack.id
      
      // Update session storage for demo mode
      if (!this.isDashboardMode) {
        sessionStorage.setItem('supplement_demo_stacks', JSON.stringify(this.stacks))
      }
      
      // Update UI
      this.updateStackSelector()
      this.scheduleRender('create-stack')
      
      this.showQuickNotification(`Stack "${name}" erfolgreich erstellt!`, 'success')
      modal.remove()
    })
  }

  editProduct(productId) {
    this.showQuickNotification(`Produkt ${productId} bearbeiten - Feature aktiviert!`, 'info')
  }

  deleteProduct(productId) {
    if (confirm('Produkt wirklich aus dem Stack entfernen?')) {
      // Entferne Produkt aus aktuellen Stack
      const currentStack = this.stacks.find(s => s.id === this.currentStackId)
      if (currentStack && currentStack.products) {
        const originalLength = currentStack.products.length
        currentStack.products = currentStack.products.filter(p => p.id != productId) // Use != for type coercion
        
        if (currentStack.products.length < originalLength) {
          // Update caches only if product was actually removed
          if (!this.isDashboardMode) {
            window.performanceCore.setCache('demo_stacks', this.stacks)
            sessionStorage.setItem('supplement_demo_stacks', JSON.stringify(this.stacks))
          }
          
          // Update stack selector to reflect new product count
          this.updateStackSelector()
          
          // Re-render
          this.scheduleRender('delete-product')
          this.showQuickNotification('Produkt entfernt!', 'success')
        } else {
          this.showQuickNotification('Produkt nicht gefunden!', 'error')
        }
      }
    }
  }

  handleDeleteStack() {
    if (!this.currentStackId) return
    
    const stack = this.stacks.find(s => s.id === this.currentStackId)
    if (!stack) return
    
    if (confirm(`Stack "${stack.name}" wirklich löschen?`)) {
      this.stacks = this.stacks.filter(s => s.id !== this.currentStackId)
      this.currentStackId = null
      
      // Update caches
      window.performanceCore.setCache('demo_stacks', this.stacks)
      sessionStorage.setItem('supplement_demo_stacks', JSON.stringify(this.stacks))
      
      this.updateStackSelector()
      this.scheduleRender('delete-stack')
      
      this.showQuickNotification('Stack gelöscht!', 'success')
    }
  }

  showQuickNotification(message, type = 'info') {
    // Minimal notification ohne schweres DOM-Manipulation
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg text-sm ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`
    notification.textContent = message
    
    document.body.appendChild(notification)
    
    setTimeout(() => notification.remove(), 2000)
  }
}

// Export für globale Verwendung
window.FastDemoApp = FastDemoApp

// Globale Instanz für onclick-Handler
let fastDemoAppInstance = null

// Smart initialization - avoid duplicates
function initializeFastDemoApp() {
  if (!fastDemoAppInstance && !window.fastDemoApp && !window.demoApp) {
    fastDemoAppInstance = new FastDemoApp()
    window.fastDemoApp = fastDemoAppInstance
    window.demoApp = fastDemoAppInstance // Backward compatibility
    return true
  }
  return false
}

// Export initialization function for external use
window.initializeFastDemoApp = initializeFastDemoApp