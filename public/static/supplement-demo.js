// Supplement Stack - Demo Mode
// Demo-spezifische Implementierung mit eingeschränkten Berechtigungen
// Verwendet gemeinsame UI-Komponenten und Funktionen

class SupplementDemo {
  constructor() {
    this.initialized = false
    this.stacks = []
    this.currentStackId = null
    this.availableProducts = []
    
    // Performance-Einstellungen
    this.renderDebounceTime = 150
    
    // Demo-spezifische Einstellungen
    this.isTestMode = true // Alle Funktionen funktionieren, aber resettet bei Neuladen
    this.originalStacks = [] // Ur-Zustand für Reset
    
    this.init()
  }

  async init() {
    if (this.initialized) return
    
    console.log('[Demo] Initializing...')
    const startTime = performance.now()
    
    try {
      await this.quickSetup()
      
      this.initialized = true
      const loadTime = Math.round(performance.now() - startTime)
      console.log(`[Demo] Initialized in ${loadTime}ms`)
      
      window.supplementUI.showQuickNotification(`Demo geladen in ${loadTime}ms!`, 'success')
      
      // Zeige Demo-Info nach kurzer Verzögerung
      setTimeout(() => this.showDemoInfo(), 2000)
      
    } catch (error) {
      console.error('[Demo] Initialization error:', error)
      window.supplementUI.showQuickNotification('Fehler beim Laden der Demo', 'error')
    }
  }

  async quickSetup() {
    // Event Listeners
    this.setupEventListeners()
    
    // Daten laden
    await this.loadDemoData()
    
    // Initial rendering
    this.scheduleRender('initial')
  }

  setupEventListeners() {
    // Global click handler
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
        this.showCreateStackModal() // Direkt zur Funktion, kein Upgrade-Modal
        break
        
      case action?.includes('delete-stack'):
        e.preventDefault()
        this.handleDeleteStack() // Direkt zur Funktion, kein Upgrade-Modal
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

  async loadDemoData() {
    try {
      console.log('[Demo] Loading data from database...')
      
      // Lade verfügbare Produkte aus der Datenbank
      this.availableProducts = await window.supplementFunctions.loadAvailableProducts(600000)
      
      console.log('[Demo] Loaded', this.availableProducts.length, 'products from database')
      
      // Demo-Stacks: Verwende IMMER den ursprünglichen Zustand (nicht localStorage!)
      // Das sorgt dafür, dass nach Reload alles wieder im Ursprungszustand ist
      this.originalStacks = window.supplementFunctions.createDemoStacksFromDB(this.availableProducts)
      
      // Prüfe ob es Session-Änderungen gibt (nur für aktuelle Session, nicht persistent)
      const sessionStacks = this.loadSessionChanges()
      if (sessionStacks && sessionStacks.length > 0) {
        this.stacks = sessionStacks
        console.log('[Demo] Using session-modified stacks (temporary changes - reset after reload)')
      } else {
        // Verwende ursprüngliche Stacks (Deep Copy für Isolation)
        this.stacks = JSON.parse(JSON.stringify(this.originalStacks))
        console.log('[Demo] Using original demo stacks (clean state)')
        
        // Zeige Info über Demo-Modus
        setTimeout(() => {
          window.supplementUI?.showQuickNotification('🎮 Demo-Modus: Alle Änderungen werden nach Neuladen zurückgesetzt', 'info', 4000)
        }, 2000)
      }
      
      // Cache für Performance
      if (window.performanceCore) {
        window.performanceCore.setCache('demo_stacks', this.stacks)
      }
      
    } catch (error) {
      console.error('[Demo] Error loading from database, using fallback:', error)
      
      // Fallback zu statischen Demo-Daten
      this.originalStacks = window.supplementFunctions.getDefaultStacks()
      this.stacks = JSON.parse(JSON.stringify(this.originalStacks))
      this.availableProducts = window.supplementFunctions.getMinimalProducts()
    }
    
    // Ersten Stack setzen wenn keiner ausgewählt
    if (!this.currentStackId && this.stacks.length > 0) {
      this.currentStackId = this.stacks[0].id
    }
    
    // Stack-Selector füllen
    this.updateStackSelector()
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
    
    // Ensure the current stack is selected
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
    if (window.performanceCore) {
      window.performanceCore.debounceRender(
        `demo-render-${reason}`, 
        () => {
          requestAnimationFrame(() => this.renderStack())
        }, 
        this.renderDebounceTime
      )
    } else {
      // Fallback ohne performance core
      setTimeout(() => this.renderStack(), this.renderDebounceTime)
    }
  }

  renderStack() {
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
    const productHTML = products.map(product => 
      window.supplementUI.renderProductCard(product)
    ).join('')
    
    stackGrid.innerHTML = productHTML || 
      '<div class="col-span-full text-center py-8 text-gray-500">Keine Produkte im Stack</div>'
    
    console.log(`[Demo] Rendered stack "${currentStack.name}" with ${products.length} products`)
  }

  // === SESSION MANAGEMENT ===

  loadSessionChanges() {
    try {
      const sessionData = sessionStorage.getItem('supplement_demo_session_stacks')
      return sessionData ? JSON.parse(sessionData) : null
    } catch (error) {
      console.error('[Demo] Error loading session changes:', error)
      return null
    }
  }

  saveSessionChanges() {
    try {
      sessionStorage.setItem('supplement_demo_session_stacks', JSON.stringify(this.stacks))
      console.log('[Demo] Saved session changes (temporary until reload)')
    } catch (error) {
      console.error('[Demo] Error saving session changes:', error)
    }
  }

  showUpgradeModal(actionName, callback = null) {
    console.log('[Demo] Showing upgrade modal for:', actionName)
    window.supplementUI.closeAllModals()

    const modalHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg mx-auto p-8 relative overflow-hidden">
        <!-- Gradient Background -->
        <div class="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50"></div>
        
        <!-- Content -->
        <div class="relative z-10">
          <!-- Header -->
          <div class="text-center mb-6">
            <div class="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-rocket text-white text-2xl"></i>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Vollversion freischalten</h2>
            <p class="text-gray-600">Nutzen Sie alle Funktionen kostenlos!</p>
          </div>

          <!-- Feature Info -->
          <div class="bg-white/80 backdrop-blur-sm rounded-xl p-6 mb-6 border border-gray-100">
            <div class="flex items-start space-x-3 mb-4">
              <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i class="fas fa-info-circle text-yellow-600"></i>
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 mb-1">Demo-Modus aktiv</h3>
                <p class="text-sm text-gray-600">Sie können alle Funktionen testen, aber Änderungen werden nach dem Neuladen zurückgesetzt.</p>
              </div>
            </div>
            
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
              <h4 class="font-medium text-green-900 mb-2 flex items-center">
                <i class="fas fa-crown text-yellow-500 mr-2"></i>
                In der Vollversion verfügbar:
              </h4>
              <ul class="text-sm text-green-800 space-y-1">
                <li class="flex items-center"><i class="fas fa-check w-4 text-green-600 mr-2"></i>Permanente Speicherung aller Daten</li>
                <li class="flex items-center"><i class="fas fa-check w-4 text-green-600 mr-2"></i>Unbegrenzte Stacks und Produkte</li>
                <li class="flex items-center"><i class="fas fa-check w-4 text-green-600 mr-2"></i>Erweiterte Analyse-Funktionen</li>
                <li class="flex items-center"><i class="fas fa-check w-4 text-green-600 mr-2"></i>Export und Backup Ihrer Daten</li>
              </ul>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3">
            ${callback ? `
            <button id="demo-continue-anyway" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors">
              <i class="fas fa-play mr-2"></i>Demo fortsetzen
            </button>
            ` : ''}
            <button id="upgrade-to-full" class="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg">
              <i class="fas fa-rocket mr-2"></i>Kostenlos registrieren
            </button>
          </div>
          
          <!-- Close Button -->
          <button class="close-modal absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors">
            <i class="fas fa-times text-sm"></i>
          </button>
        </div>
      </div>
    `

    const modal = window.supplementUI.createModalOverlay(modalHTML)
    document.body.appendChild(modal)

    // Setup handlers
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove())
    })
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Upgrade button
    const upgradeBtn = modal.querySelector('#upgrade-to-full')
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        modal.remove()
        window.location.href = '/auth'
      })
    }

    // Continue demo button (if callback provided)
    const continueBtn = modal.querySelector('#demo-continue-anyway')
    if (continueBtn && callback) {
      continueBtn.addEventListener('click', () => {
        modal.remove()
        callback()
      })
    }
  }

  // === MODAL FUNCTIONS ===

  showAddProductModal() {
    console.log('[Demo] Showing Add Product Modal')
    window.supplementUI.closeAllModals()

    const modalHTML = window.supplementUI.createAddProductModal(this.stacks, true)
    const modal = window.supplementUI.createModalOverlay(modalHTML)
    
    document.body.appendChild(modal)
    this.setupAddProductModalHandlers(modal)
  }

  setupAddProductModalHandlers(modal) {
    // Close handlers
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Nutrient search
    const searchInput = modal.querySelector('#nutrient-search')
    const searchResults = modal.querySelector('#nutrient-search-results')
    
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim()
      
      if (searchTerm.length >= 2) {
        const matches = window.supplementFunctions.searchNutrients(searchTerm)
        
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
          
          // Handle selection
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
      modal.querySelector('#custom-dosage').value = modal.querySelector('#dge-recommendation').textContent.replace(/\D/g, '')
    })
    
    modal.querySelector('#use-study-dosage').addEventListener('click', () => {
      modal.querySelector('#custom-dosage').value = modal.querySelector('#study-recommendation').textContent.replace(/\D/g, '')
    })

    // Continue button - erweitert für Demo-Produktauswahl
    modal.querySelector('#continue-to-products').addEventListener('click', () => {
      const dosageAmount = parseInt(modal.querySelector('#custom-dosage').value) || 0
      const selectedNutrientName = modal.querySelector('#dosage-nutrient-name').textContent
      
      if (!selectedNutrientName || selectedNutrientName.trim() === '') {
        window.supplementUI.showQuickNotification('Bitte wählen Sie zuerst einen Wirkstoff aus', 'warning')
        return
      }
      
      console.log('[Demo] Switching to product selection for:', selectedNutrientName, dosageAmount)
      
      // Zeige Loading-Nachricht
      window.supplementUI.showQuickNotification('Lade passende Produkte...', 'info')
      
      // Schließe das aktuelle Modal und öffne die Produktauswahl
      modal.remove()
      
      // Kurze Verzögerung für bessere UX
      setTimeout(() => {
        this.showProductSelection(selectedNutrientName, dosageAmount)
      }, 300)
    })
  }

  selectNutrient(modal, nutrient) {
    // Update dosage step
    modal.querySelector('#dosage-nutrient-name').textContent = nutrient.name
    modal.querySelector('#dge-recommendation').textContent = `${nutrient.dge}${nutrient.unit}`
    modal.querySelector('#study-recommendation').textContent = `${nutrient.study}${nutrient.unit}`
    modal.querySelector('#dosage-unit').textContent = `(${nutrient.unit})`
    modal.querySelector('#custom-dosage').value = nutrient.dge
    
    // Switch steps
    modal.querySelector('#step-nutrient-search').classList.add('hidden')
    modal.querySelector('#step-dosage-selection').classList.remove('hidden')
    
    // Back button
    modal.querySelector('#back-to-nutrient-search').addEventListener('click', () => {
      modal.querySelector('#step-dosage-selection').classList.add('hidden')
      modal.querySelector('#step-nutrient-search').classList.remove('hidden')
    })
  }

  // Entfernt - Upgrade-Modal für Stack erstellen nicht mehr nötig

  showCreateStackModal() {
    console.log('[Demo] Showing Create Stack Modal (Demo Mode)')
    window.supplementUI.closeAllModals()

    const modalHTML = window.supplementUI.createCreateStackModal()
    const modal = window.supplementUI.createModalOverlay(modalHTML)
    
    document.body.appendChild(modal)
    this.setupCreateStackModalHandlers(modal)
  }

  setupCreateStackModalHandlers(modal) {
    // Close handlers
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove())
    })
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Form submission
    const form = modal.querySelector('#create-stack-form')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      
      const name = modal.querySelector('#stack-name').value.trim()
      const description = modal.querySelector('#stack-description').value.trim()
      
      if (!name) {
        window.supplementUI.showQuickNotification('Bitte geben Sie einen Stack-Namen ein', 'error')
        return
      }
      
      try {
        // Create stack locally in demo mode (session-only)
        const newStack = await window.supplementFunctions.createUserStack({
          name: name,
          description: description
        })
        
        // Add to current stacks
        this.stacks.push(newStack)
        this.currentStackId = newStack.id
        
        // Save to session (temporary until reload)
        this.saveSessionChanges()
        
        // Update UI
        this.updateStackSelector()
        this.scheduleRender('create-stack')
        
        window.supplementUI.showQuickNotification(`Stack "${name}" erstellt! (Demo - wird nach Reload zurückgesetzt)`, 'success')
        modal.remove()
        
      } catch (error) {
        console.error('[Demo] Error creating stack:', error)
        window.supplementUI.showQuickNotification('Fehler beim Erstellen des Stacks', 'error')
      }
    })
  }

  // === PRODUCT FUNCTIONS ===

  editProduct(productId) {
    console.log('[Demo] Edit product:', productId)
    
    const currentStack = this.stacks.find(s => s.id === this.currentStackId)
    const product = currentStack?.products?.find(p => p.id == productId)
    
    if (!product) {
      window.supplementUI.showQuickNotification('Produkt nicht gefunden', 'error')
      return
    }

    // Show demo limitation modal
    window.supplementUI.closeAllModals()
    
    const modalHTML = window.supplementUI.createEditProductModal(product, true)
    const modal = window.supplementUI.createModalOverlay(modalHTML)
    
    document.body.appendChild(modal)
    
    // Setup handlers
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove())
    })
    
    // Upgrade button
    const upgradeBtn = modal.querySelector('#upgrade-to-full')
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        modal.remove()
        if (confirm('Zur kostenlosen Registrierung wechseln?')) {
          window.location.href = '/auth'
        }
      })
    }
  }

  deleteProduct(productId) {
    if (confirm('Produkt wirklich aus dem Stack entfernen?')) {
      const currentStack = this.stacks.find(s => s.id === this.currentStackId)
      if (currentStack && currentStack.products) {
        const originalLength = currentStack.products.length
        currentStack.products = currentStack.products.filter(p => p.id != productId)
        
        if (currentStack.products.length < originalLength) {
          // Save to session (temporary until reload)
          this.saveSessionChanges()
          
          if (window.performanceCore) {
            window.performanceCore.setCache('demo_stacks', this.stacks)
          }
          
          // Update UI
          this.updateStackSelector()
          this.scheduleRender('delete-product')
          
          window.supplementUI.showQuickNotification('Produkt entfernt! (Demo - wird nach Reload zurückgesetzt)', 'success')
        } else {
          window.supplementUI.showQuickNotification('Produkt nicht gefunden!', 'error')
        }
      }
    }
  }

  // Entfernt - Upgrade-Modal für Stack löschen nicht mehr nötig

  handleDeleteStack() {
    if (!this.currentStackId) return
    
    const stack = this.stacks.find(s => s.id === this.currentStackId)
    if (!stack) return
    
    if (confirm(`Stack "${stack.name}" wirklich löschen?\n\n💡 Demo-Modus: Wird nach Seitenneuladung wieder hergestellt.`)) {
      this.stacks = this.stacks.filter(s => s.id !== this.currentStackId)
      this.currentStackId = null
      
      // Save to session (temporary until reload)
      this.saveSessionChanges()
      
      if (window.performanceCore) {
        window.performanceCore.setCache('demo_stacks', this.stacks)
      }
      
      this.updateStackSelector()
      this.scheduleRender('delete-stack')
      
      window.supplementUI.showQuickNotification('Stack gelöscht! (Demo - wird nach Reload zurückgesetzt)', 'success')
    }
  }

  // === PRODUCT MANAGEMENT ===

  async addProductToCurrentStack(product) {
    if (!this.currentStackId) {
      window.supplementUI.showQuickNotification('Bitte wählen Sie zuerst einen Stack aus', 'error')
      return
    }

    try {
      const currentStack = this.stacks.find(s => s.id === this.currentStackId)
      if (currentStack) {
        if (!currentStack.products) currentStack.products = []
        
        // Check if product already exists in stack
        const existingProduct = currentStack.products.find(p => p.id === product.id)
        if (existingProduct) {
          window.supplementUI.showQuickNotification('Produkt bereits im Stack vorhanden', 'info')
          return
        }
        
        // Add product to stack
        currentStack.products.push(product)
        
        // Save to session (temporary until reload)
        this.saveSessionChanges()
        
        // Update UI
        this.updateStackSelector()
        this.scheduleRender('add-product')
        
        window.supplementUI.showQuickNotification(`${product.name} hinzugefügt! (Session-Demo)`, 'success')
      }
      
    } catch (error) {
      console.error('[Demo] Error adding product to stack:', error)
      window.supplementUI.showQuickNotification('Fehler beim Hinzufügen des Produkts', 'error')
    }
  }

  // Reset function (for testing purposes)
  resetToOriginalState() {
    console.log('[Demo] Resetting to original state...')
    
    // Clear session storage
    sessionStorage.removeItem('supplement_demo_session_stacks')
    
    // Reset stacks to original
    this.stacks = JSON.parse(JSON.stringify(this.originalStacks))
    this.currentStackId = this.stacks.length > 0 ? this.stacks[0].id : null
    
    // Update UI
    this.updateStackSelector()
    this.scheduleRender('reset')
    
    window.supplementUI.showQuickNotification('Demo auf Ursprungszustand zurückgesetzt!', 'success')
  }

  showProductSelection(nutrientName, targetDosage) {
    console.log('[Demo] Showing product selection for:', nutrientName, targetDosage)
    
    // Filter verfügbare Produkte nach dem gewählten Nährstoff
    const matchingProducts = this.availableProducts.filter(product => {
      const productName = product.name.toLowerCase()
      const nutrientLower = nutrientName.toLowerCase()
      
      return productName.includes(nutrientLower) ||
        (nutrientLower.includes('vitamin d') && productName.includes('vitamin d')) ||
        (nutrientLower.includes('b12') && productName.includes('b12')) ||
        (nutrientLower.includes('magnesium') && productName.includes('magnesium')) ||
        (nutrientLower.includes('omega') && productName.includes('omega'))
    })

    if (matchingProducts.length === 0) {
      window.supplementUI.showQuickNotification(`Keine Produkte für ${nutrientName} gefunden`, 'info')
      return
    }

    const modalHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-2xl mx-auto p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Produkt wählen</h2>
            <p class="text-gray-600">Für ${nutrientName} (Ziel: ${targetDosage})</p>
          </div>
          <button class="close-modal w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
            <i class="fas fa-times text-gray-600"></i>
          </button>
        </div>

        <div class="grid gap-4">
          ${matchingProducts.map(product => `
            <div class="product-option border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer" data-product-id="${product.id}">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <h3 class="font-semibold text-gray-900">${product.name}</h3>
                  <p class="text-sm text-gray-600">${product.brand} • ${product.form}</p>
                  <div class="mt-2 flex items-center space-x-4 text-sm">
                    <span class="text-green-600 font-medium">€${product.monthly_cost}/Monat</span>
                    ${product.recommended ? '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">Empfohlen</span>' : ''}
                  </div>
                </div>
                <button class="add-product-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-product-id="${product.id}">
                  <i class="fas fa-plus mr-1"></i>Hinzufügen
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `

    const modal = window.supplementUI.createModalOverlay(modalHTML)
    document.body.appendChild(modal)

    // Setup handlers
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Add product handlers
    modal.querySelectorAll('.add-product-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation()
        const productId = btn.dataset.productId
        const product = matchingProducts.find(p => p.id == productId)
        
        if (product) {
          await this.addProductToCurrentStack(product)
          modal.remove()
        }
      })
    })

    // Click on product option also adds it
    modal.querySelectorAll('.product-option').forEach(option => {
      option.addEventListener('click', async (e) => {
        if (e.target.closest('.add-product-btn')) return // Don't double-trigger
        
        const productId = option.dataset.productId
        const product = matchingProducts.find(p => p.id == productId)
        
        if (product) {
          await this.addProductToCurrentStack(product)
          modal.remove()
        }
      })
    })
  }

  showDemoInfo() {
    // Nur anzeigen wenn noch keine Session-Änderungen vorhanden sind
    const hasSessionChanges = sessionStorage.getItem('supplement_demo_session_stacks')
    if (hasSessionChanges) return

    // Check if demo info was already shown in this session
    const infoShown = sessionStorage.getItem('demo_info_shown')
    if (infoShown) return

    const infoHTML = `
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mx-4 mb-4 shadow-sm">
        <div class="flex items-start space-x-3">
          <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i class="fas fa-info-circle text-blue-600 text-sm"></i>
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-blue-900 mb-1">🎮 Demo-Modus aktiv</h3>
            <p class="text-blue-800 text-sm mb-2">
              Sie können alle Funktionen vollständig testen! Alle Änderungen bleiben während Ihrer Session erhalten, 
              werden aber nach dem Neuladen der Seite zurückgesetzt.
            </p>
            <div class="flex flex-wrap gap-2 text-xs mb-3">
              <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">✅ Stacks erstellen & löschen</span>
              <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">✅ Produkte hinzufügen & entfernen</span>
              <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded">🔄 Reset nach Reload</span>
            </div>
            <button class="demo-reset-btn bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded font-medium transition-colors">
              <i class="fas fa-undo mr-1"></i>Demo zurücksetzen
            </button>
          </div>
          <button class="demo-info-close text-blue-400 hover:text-blue-600 ml-2">
            <i class="fas fa-times text-sm"></i>
          </button>
        </div>
      </div>
    `

    // Insert info banner at the top of the page
    const container = document.querySelector('.max-w-7xl.mx-auto.px-4')
    if (container) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = infoHTML
      const infoBanner = tempDiv.firstElementChild
      
      container.insertBefore(infoBanner, container.firstElementChild)

      // Close button handler
      infoBanner.querySelector('.demo-info-close').addEventListener('click', () => {
        infoBanner.remove()
        sessionStorage.setItem('demo_info_shown', 'true')
      })

      // Reset button handler
      infoBanner.querySelector('.demo-reset-btn').addEventListener('click', () => {
        this.resetToOriginalState()
        infoBanner.remove()
      })

      // Auto-hide after 10 seconds
      setTimeout(() => {
        if (infoBanner.parentNode) {
          infoBanner.remove()
          sessionStorage.setItem('demo_info_shown', 'true')
        }
      }, 10000)
    }
  }
  // === PRODUKT-AUSWAHL FUNKTIONEN ===

  showProductSelection(nutrientName, dosageAmount) {
    console.log('[Demo] Showing product selection for:', nutrientName, 'dosage:', dosageAmount)
    console.log('[Demo] Available products:', this.availableProducts.length)
    
    if (!this.availableProducts || this.availableProducts.length === 0) {
      window.supplementUI.showQuickNotification('Keine Produkte verfügbar. Lade Daten...', 'error')
      return
    }
    
    // Finde passende Produkte für den Nährstoff (erweiterte Suche)
    const nutrientLower = nutrientName.toLowerCase()
    const matchingProducts = this.availableProducts.filter(product => {
      const productNameLower = product.name.toLowerCase()
      
      return (
        productNameLower.includes(nutrientLower) ||
        (nutrientLower.includes('d3') && (productNameLower.includes('vitamin d') || productNameLower.includes('d3'))) ||
        (nutrientLower.includes('vitamin d') && (productNameLower.includes('vitamin d') || productNameLower.includes('d3'))) ||
        (nutrientLower.includes('b12') && productNameLower.includes('b12')) ||
        (nutrientLower.includes('vitamin b12') && productNameLower.includes('b12')) ||
        (nutrientLower.includes('vitamin c') && productNameLower.includes('vitamin c')) ||
        (nutrientLower.includes('magnesium') && productNameLower.includes('magnesium')) ||
        (nutrientLower.includes('omega') && productNameLower.includes('omega')) ||
        (nutrientLower.includes('zink') && productNameLower.includes('zink'))
      )
    })

    console.log('[Demo] Found matching products:', matchingProducts.length, 'for nutrient:', nutrientName)

    if (matchingProducts.length === 0) {
      window.supplementUI.showQuickNotification(`Keine spezifischen Produkte für ${nutrientName} gefunden. Zeige alle verfügbaren Produkte.`, 'info')
      this.showAllProductSelection()
      return
    }

    // Zeige spezifische Produktauswahl
    this.showProductSelectionModal(matchingProducts, nutrientName, dosageAmount)
  }

  showAllProductSelection() {
    console.log('[Demo] Showing all products selection:', this.availableProducts.length, 'products')
    this.showProductSelectionModal(this.availableProducts, 'Alle verfügbaren Produkte', null)
  }

  showProductSelectionModal(products, nutrientName, dosageAmount) {
    console.log('[Demo] Creating product selection modal with', products.length, 'products')
    window.supplementUI.closeAllModals()

    const modalHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-4xl mx-auto p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <div class="flex justify-between items-center mb-6 pb-4 border-b">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Produkt auswählen</h2>
            <p class="text-gray-600 mt-1">${nutrientName}${dosageAmount ? ` • ${dosageAmount} Einheiten` : ''}</p>
          </div>
          <button class="close-modal w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${products.map(product => `
              <div class="product-option border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all" data-product-id="${product.id}">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 mb-1">${product.name}</h3>
                    <p class="text-sm text-gray-600">${product.brand || 'Unbekannt'}</p>
                    <p class="text-xs text-gray-500 mt-1">${product.form || 'Kapsel'}</p>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-green-600">€${(product.monthly_cost || 15.99).toFixed(2)}</div>
                    <div class="text-xs text-gray-500">pro Monat</div>
                  </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-3">
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-600">Dosierung:</span>
                    <span class="font-medium">${product.dosage_per_day || 1}x täglich</span>
                  </div>
                  <div class="flex justify-between text-sm mt-1">
                    <span class="text-gray-600">Packung:</span>
                    <span class="font-medium">${product.quantity || 30} Stück</span>
                  </div>
                </div>
                
                <div class="mt-3 flex justify-end">
                  <button class="add-product-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    <i class="fas fa-plus mr-2"></i>Hinzufügen
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${products.length === 0 ? `
          <div class="text-center py-12 text-gray-500">
            <i class="fas fa-search text-4xl mb-4"></i>
            <p class="text-lg">Keine Produkte gefunden</p>
            <p class="text-sm">Versuchen Sie einen anderen Suchbegriff</p>
          </div>
          ` : ''}
        </div>

        <div class="mt-6 pt-4 border-t text-center">
          <p class="text-sm text-gray-600">
            <i class="fas fa-info-circle mr-1"></i>
            Demo-Modus: Änderungen werden nach Neuladen zurückgesetzt
          </p>
        </div>
      </div>
    `

    const modal = window.supplementUI.createModalOverlay(modalHTML)
    document.body.appendChild(modal)

    // Setup handlers
    modal.querySelector('.close-modal').addEventListener('click', () => modal.remove())
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })

    // Product selection handlers
    modal.querySelectorAll('.product-option').forEach(option => {
      option.addEventListener('click', (e) => {
        if (!e.target.closest('.add-product-btn')) {
          // Click on product card (not button) - highlight selection
          modal.querySelectorAll('.product-option').forEach(opt => opt.classList.remove('ring-2', 'ring-blue-500'))
          option.classList.add('ring-2', 'ring-blue-500')
        }
      })
      
      const addBtn = option.querySelector('.add-product-btn')
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        const productId = option.dataset.productId
        const selectedProduct = products.find(p => p.id == productId)
        if (selectedProduct) {
          this.addProductToCurrentStack(selectedProduct)
          modal.remove()
        }
      })
    })
  }

  addProductToCurrentStack(product) {
    if (!this.currentStackId) {
      window.supplementUI.showQuickNotification('Bitte wählen Sie zuerst einen Stack aus', 'error')
      return
    }

    const currentStack = this.stacks.find(s => s.id === this.currentStackId)
    if (!currentStack) {
      window.supplementUI.showQuickNotification('Stack nicht gefunden', 'error')
      return
    }

    // Prüfe ob Produkt bereits im Stack ist
    const existingProduct = currentStack.products?.find(p => p.id == product.id)
    if (existingProduct) {
      window.supplementUI.showQuickNotification(`${product.name} ist bereits im Stack vorhanden`, 'warning')
      return
    }

    // Füge Produkt hinzu
    if (!currentStack.products) currentStack.products = []
    currentStack.products.push({...product}) // Deep copy

    // Save to session (temporary until reload)
    this.saveSessionChanges()

    // Update UI
    this.updateStackSelector()
    this.scheduleRender('add-product')

    window.supplementUI.showQuickNotification(`${product.name} zum Stack hinzugefügt! (Demo - wird nach Reload zurückgesetzt)`, 'success')
  }
}

// Smart initialization
function initializeDemoApp() {
  if (!window.demoApp && !window.fastDemoApp) {
    window.demoApp = new SupplementDemo()
    window.fastDemoApp = window.demoApp // Backward compatibility
    return true
  }
  return false
}

// Export functions
window.SupplementDemo = SupplementDemo
window.initializeDemoApp = initializeDemoApp

// Auto-initialize if needed
if (window.location.pathname.includes('demo') && document.readyState !== 'loading') {
  initializeDemoApp()
} else if (window.location.pathname.includes('demo')) {
  document.addEventListener('DOMContentLoaded', initializeDemoApp)
}