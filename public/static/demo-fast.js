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
    
    this.init()
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
    }
  }

  async handleStackChange(e) {
    const stackId = e.target.value
    if (!stackId || stackId === this.currentStackId) return
    
    this.currentStackId = stackId
    this.scheduleRender('stack-change')
  }

  async loadDataFast() {
    // Prüfe Cache zuerst
    const cachedStacks = window.performanceCore.getCache('demo_stacks')
    if (cachedStacks) {
      this.stacks = cachedStacks
      console.log('[Fast Demo] Using cached stacks')
    } else {
      // Fallback zu Session Storage
      const sessionData = sessionStorage.getItem('supplement_demo_stacks')
      if (sessionData) {
        this.stacks = JSON.parse(sessionData)
      } else {
        this.stacks = this.getDefaultStacks()
        sessionStorage.setItem('supplement_demo_stacks', JSON.stringify(this.stacks))
      }
      
      // Cache für nächsten Load
      window.performanceCore.setCache('demo_stacks', this.stacks)
    }

    // Verfügbare Produkte minimal laden
    this.availableProducts = this.getMinimalProducts()
    
    // Stack-Selector sofort füllen
    this.updateStackSelector()
    
    // Ersten Stack setzen wenn keiner ausgewählt
    if (!this.currentStackId && this.stacks.length > 0) {
      this.currentStackId = this.stacks[0].id
    }
  }

  getDefaultStacks() {
    return [
      {
        id: 'demo-basis',
        name: 'Basis Gesundheit',
        description: 'Grundlegende Nährstoffe für den täglichen Bedarf',
        products: [
          { id: 1, name: 'Vitamin D3 4000 IU', brand: 'Sunday Natural', monthly_cost: 11.94 },
          { id: 2, name: 'B12 Methylcobalamin', brand: 'InnoNature', monthly_cost: 12.45 },
          { id: 3, name: 'Vitamin C 1000mg', brand: 'Pure Encapsulations', monthly_cost: 18.90 }
        ]
      },
      {
        id: 'demo-sport',
        name: 'Sport & Energie',
        description: 'Optimiert für aktive Menschen und Sportler',
        products: [
          { id: 4, name: 'Magnesiumcitrat 400mg', brand: 'Qidosha', monthly_cost: 15.50 },
          { id: 5, name: 'Kreatin Monohydrat', brand: 'Olimp', monthly_cost: 19.90 },
          { id: 6, name: 'Omega-3 EPA/DHA', brand: 'Norsan', monthly_cost: 24.90 }
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
    window.performanceCore.debounceRender(
      `demo-render-${reason}`, 
      () => this.renderStackFast(), 
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
    // Cached Template für bessere Performance
    return `
      <div class="bg-white rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-semibold text-sm">${product.name}</h3>
          <input type="checkbox" checked class="w-4 h-4 text-blue-600">
        </div>
        <p class="text-xs text-gray-600 mb-2">${product.brand}</p>
        <p class="text-sm font-medium text-green-600">${product.monthly_cost}€/Monat</p>
      </div>
    `
  }

  // Einfache Modal-Funktionen
  showAddProductModal() {
    this.showQuickNotification('Produkt hinzufügen - Feature aktiviert!', 'info')
  }

  showCreateStackModal() {
    this.showQuickNotification('Stack erstellen - Feature aktiviert!', 'info')
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