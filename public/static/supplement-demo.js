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

  async loadDemoData() {
    try {
      console.log('[Demo] Loading data from database...')
      
      // Lade verfügbare Produkte aus der Datenbank
      this.availableProducts = await window.supplementFunctions.loadAvailableProducts(600000)
      
      console.log('[Demo] Loaded', this.availableProducts.length, 'products from database')
      
      // Demo-Stacks basieren auf echten DB-Produkten, aber werden lokal verwaltet
      const sessionStacks = window.supplementFunctions.loadDemoStacksFromSession()
      if (sessionStacks && sessionStacks.length > 0) {
        this.stacks = sessionStacks
        console.log('[Demo] Using session-stored stacks')
      } else {
        // Erstelle Demo-Stacks basierend auf echten DB-Produkten
        this.stacks = window.supplementFunctions.createDemoStacksFromDB(this.availableProducts)
        window.supplementFunctions.saveDemoStacksToSession(this.stacks)
        console.log('[Demo] Created demo stacks from DB products')
      }
      
      // Cache für Performance
      if (window.performanceCore) {
        window.performanceCore.setCache('demo_stacks', this.stacks)
      }
      
    } catch (error) {
      console.error('[Demo] Error loading from database, using fallback:', error)
      
      // Fallback zu statischen Demo-Daten
      this.stacks = window.supplementFunctions.getDefaultStacks()
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

    // Continue button
    modal.querySelector('#continue-to-products').addEventListener('click', () => {
      window.supplementUI.showQuickNotification('Produktsuche wird geladen...', 'info')
      setTimeout(() => modal.remove(), 1000)
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

  showCreateStackModal() {
    console.log('[Demo] Showing Create Stack Modal')
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
        // Create stack locally in demo mode
        const newStack = await window.supplementFunctions.createUserStack({
          name: name,
          description: description
        })
        
        this.stacks.push(newStack)
        this.currentStackId = newStack.id
        
        // Update session storage
        window.supplementFunctions.saveDemoStacksToSession(this.stacks)
        
        // Update UI
        this.updateStackSelector()
        this.scheduleRender('create-stack')
        
        window.supplementUI.showQuickNotification(`Stack "${name}" erfolgreich erstellt!`, 'success')
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
          // Update session storage
          window.supplementFunctions.saveDemoStacksToSession(this.stacks)
          if (window.performanceCore) {
            window.performanceCore.setCache('demo_stacks', this.stacks)
          }
          
          // Update UI
          this.updateStackSelector()
          this.scheduleRender('delete-product')
          
          window.supplementUI.showQuickNotification('Produkt entfernt!', 'success')
        } else {
          window.supplementUI.showQuickNotification('Produkt nicht gefunden!', 'error')
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
      
      // Update session storage
      window.supplementFunctions.saveDemoStacksToSession(this.stacks)
      if (window.performanceCore) {
        window.performanceCore.setCache('demo_stacks', this.stacks)
      }
      
      this.updateStackSelector()
      this.scheduleRender('delete-stack')
      
      window.supplementUI.showQuickNotification('Stack gelöscht!', 'success')
    }
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