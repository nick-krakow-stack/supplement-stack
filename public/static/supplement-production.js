// Supplement Stack - Production Mode
// Production-spezifische Implementierung mit vollständigen Berechtigungen
// Verwendet gemeinsame UI-Komponenten und Funktionen mit Datenbankintegration

class SupplementProduction {
  constructor() {
    this.initialized = false
    this.stacks = []
    this.currentStackId = null
    this.availableProducts = []
    this.authToken = localStorage.getItem('auth_token')
    
    // Performance-Einstellungen
    this.renderDebounceTime = 100
    this.cacheTimeout = 300000 // 5 Minuten
    
    this.init()
  }

  async init() {
    if (this.initialized) return
    
    console.log('[Production] Initializing production mode...')
    const startTime = performance.now()
    
    // Authentication check
    if (!this.authToken) {
      console.log('[Production] No authentication token, redirecting to auth')
      window.location.href = '/auth'
      return
    }

    try {
      await this.setupProduction()
      
      this.initialized = true
      const loadTime = Math.round(performance.now() - startTime)
      console.log(`[Production] Initialized in ${loadTime}ms`)
      
      window.supplementUI.showQuickNotification(`Dashboard geladen in ${loadTime}ms!`, 'success')
      
    } catch (error) {
      console.error('[Production] Initialization error:', error)
      
      // Check for auth errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth'
        return
      }
      
      window.supplementUI.showQuickNotification('Fehler beim Laden des Dashboards', 'error')
    }
  }

  async setupProduction() {
    // Set axios defaults for authentication
    if (window.axios) {
      window.axios.defaults.headers.common['Authorization'] = `Bearer ${this.authToken}`
    }

    // Event Listeners
    this.setupEventListeners()
    
    // Load data from database
    await this.loadProductionData()
    
    // Initial rendering
    this.scheduleRender('initial')
    
    // Update page title
    document.title = 'Dashboard - Supplement Stack (Vollversion)'
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

    // Add keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this))
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

      case action === 'export-stack':
        e.preventDefault()
        this.exportCurrentStack()
        break

      case action === 'import-stack':
        e.preventDefault()
        this.showImportStackModal()
        break
    }
  }

  handleKeyboardShortcuts(e) {
    // Keyboard shortcuts for power users
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'n':
          e.preventDefault()
          this.showCreateStackModal()
          break
        case 'p':
          e.preventDefault()
          this.showAddProductModal()
          break
        case 'e':
          e.preventDefault()
          if (this.currentStackId) {
            this.exportCurrentStack()
          }
          break
      }
    }
  }

  async handleStackChange(e) {
    const stackId = e.target.value
    if (!stackId || stackId === this.currentStackId) return
    
    this.currentStackId = stackId
    await this.loadStackProducts(stackId)
    this.scheduleRender('stack-change')
  }

  async loadProductionData() {
    try {
      console.log('[Production] Loading production data from database...')
      
      // Load available products with enhanced caching
      this.availableProducts = await window.supplementFunctions.loadAvailableProducts(this.cacheTimeout)
      
      // Load user stacks
      this.stacks = await window.supplementFunctions.loadUserStacks()
      
      console.log('[Production] Loaded', this.availableProducts.length, 'products and', this.stacks.length, 'stacks')
      
      // Set first stack if available
      if (!this.currentStackId && this.stacks.length > 0) {
        this.currentStackId = this.stacks[0].id
        await this.loadStackProducts(this.currentStackId)
      }
      
      // Update UI elements
      this.updateStackSelector()
      this.updateStats()
      
    } catch (error) {
      console.error('[Production] Error loading production data:', error)
      throw error
    }
  }

  async loadStackProducts(stackId) {
    if (!stackId) return
    
    try {
      const response = await window.supplementFunctions.fetchWithCache(`/api/protected/stacks/${stackId}/products`, {
        headers: { 'Authorization': `Bearer ${this.authToken}` },
        bypassCache: true
      })
      
      const stack = this.stacks.find(s => s.id == stackId)
      if (stack) {
        stack.products = response || []
        console.log('[Production] Loaded', stack.products.length, 'products for stack', stack.name)
      }
      
    } catch (error) {
      console.error('[Production] Error loading stack products:', error)
      window.supplementUI.showQuickNotification('Fehler beim Laden der Stack-Produkte', 'error')
    }
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
    
    if (this.currentStackId) {
      selector.value = this.currentStackId
    }
    
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

  updateStats() {
    const currentStack = this.stacks.find(s => s.id === this.currentStackId)
    if (!currentStack) return

    const products = currentStack.products || []
    const stats = window.supplementFunctions.calculateStackStats(products)
    
    // Update stats display
    const totalProducts = document.getElementById('total-products')
    const monthlyTotal = document.getElementById('monthly-total')
    const dailyTotal = document.getElementById('daily-total')
    
    if (totalProducts) totalProducts.textContent = stats.totalProducts
    if (monthlyTotal) monthlyTotal.textContent = `€${stats.monthlyTotal}`
    if (dailyTotal) dailyTotal.textContent = `€${stats.dailyTotal}`
  }

  scheduleRender(reason) {
    if (window.performanceCore) {
      window.performanceCore.debounceRender(
        `production-render-${reason}`, 
        () => {
          requestAnimationFrame(() => this.renderStack())
        }, 
        this.renderDebounceTime
      )
    } else {
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
    
    // Performance monitoring
    if (window.performanceMonitor) {
      window.performanceMonitor.measureStackRender(() => {
        this.doRenderStack(stackGrid, products, currentStack)
      }, this.currentStackId, products.length)
    } else {
      this.doRenderStack(stackGrid, products, currentStack)
    }
    
    // Update stats after rendering
    this.updateStats()
  }

  doRenderStack(stackGrid, products, currentStack) {
    // Use shared UI components but with full permissions
    const productHTML = products.map(product => 
      window.supplementUI.renderProductCard(product, { editAllowed: true, deleteAllowed: true })
    ).join('')
    
    stackGrid.innerHTML = productHTML || 
      '<div class="col-span-full text-center py-8 text-gray-500">Keine Produkte im Stack</div>'
    
    console.log(`[Production] Rendered stack "${currentStack.name}" with ${products.length} products`)
  }

  // === MODAL FUNCTIONS ===

  showAddProductModal() {
    console.log('[Production] Showing Add Product Modal (Full Version)')
    window.supplementUI.closeAllModals()

    const modalHTML = window.supplementUI.createAddProductModal(this.stacks, false) // false = not demo
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

    // Enhanced nutrient search with database integration
    const searchInput = modal.querySelector('#nutrient-search')
    const searchResults = modal.querySelector('#nutrient-search-results')
    
    let searchTimeout
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout)
      const searchTerm = e.target.value.toLowerCase().trim()
      
      if (searchTerm.length >= 2) {
        searchTimeout = setTimeout(async () => {
          try {
            // Search both local nutrients and database products
            const nutrients = window.supplementFunctions.searchNutrients(searchTerm)
            const productMatches = window.supplementFunctions.searchProducts(this.availableProducts, searchTerm)
            
            if (nutrients.length > 0 || productMatches.recommended.length > 0) {
              let resultsHTML = ''
              
              // Add nutrient results
              resultsHTML += nutrients.map(nutrient => `
                <div class="nutrient-result p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors" data-nutrient-id="${nutrient.id}">
                  <div class="flex justify-between items-center">
                    <div>
                      <div class="font-medium text-gray-900">${nutrient.name}</div>
                      <div class="text-sm text-gray-600">${nutrient.description}</div>
                      <div class="text-xs text-gray-500">DGE: ${nutrient.dge}${nutrient.unit} • Studien: ${nutrient.study}${nutrient.unit}</div>
                    </div>
                    <div class="flex items-center text-green-600">
                      <i class="fas fa-star text-sm mr-1"></i>
                      <span class="text-xs font-medium">Nährstoff</span>
                    </div>
                  </div>
                </div>
              `).join('')
              
              // Add direct product matches
              resultsHTML += productMatches.recommended.slice(0, 3).map(product => `
                <div class="product-result p-3 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors" data-product-id="${product.id}">
                  <div class="flex justify-between items-center">
                    <div>
                      <div class="font-medium text-gray-900">${product.name}</div>
                      <div class="text-sm text-gray-600">${product.brand} • ${product.form}</div>
                      <div class="text-xs text-green-600">€${product.monthly_cost}/Monat</div>
                    </div>
                    <div class="flex items-center text-blue-600">
                      <i class="fas fa-plus text-sm mr-1"></i>
                      <span class="text-xs font-medium">Direkt hinzufügen</span>
                    </div>
                  </div>
                </div>
              `).join('')
              
              searchResults.innerHTML = resultsHTML
              searchResults.classList.remove('hidden')
              
              // Handle selections
              searchResults.querySelectorAll('.nutrient-result').forEach(result => {
                result.addEventListener('click', (e) => {
                  const nutrientId = e.currentTarget.dataset.nutrientId
                  const selectedNutrient = nutrients.find(n => n.id == nutrientId)
                  this.selectNutrient(modal, selectedNutrient)
                })
              })

              // Handle direct product additions
              searchResults.querySelectorAll('.product-result').forEach(result => {
                result.addEventListener('click', async (e) => {
                  const productId = e.currentTarget.dataset.productId
                  const product = this.availableProducts.find(p => p.id == productId)
                  if (product) {
                    await this.addProductToCurrentStack(product)
                    modal.remove()
                  }
                })
              })
              
            } else {
              searchResults.innerHTML = '<div class="text-gray-500 text-center py-4">Keine Wirkstoffe oder Produkte gefunden</div>'
              searchResults.classList.remove('hidden')
            }
          } catch (error) {
            console.error('[Production] Search error:', error)
            searchResults.innerHTML = '<div class="text-red-500 text-center py-4">Fehler bei der Suche</div>'
            searchResults.classList.remove('hidden')
          }
        }, 300)
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

    // Continue button with product search
    modal.querySelector('#continue-to-products').addEventListener('click', () => {
      this.showProductSelectionStep(modal)
    })
  }

  selectNutrient(modal, nutrient) {
    // Update dosage step
    modal.querySelector('#dosage-nutrient-name').textContent = nutrient.name
    modal.querySelector('#dge-recommendation').textContent = `${nutrient.dge}${nutrient.unit}`
    modal.querySelector('#study-recommendation').textContent = `${nutrient.study}${nutrient.unit}`
    modal.querySelector('#dosage-unit').textContent = `(${nutrient.unit})`
    modal.querySelector('#custom-dosage').value = nutrient.study // Default to study dosage
    
    // Add dosage validation
    const dosageInput = modal.querySelector('#custom-dosage')
    dosageInput.addEventListener('input', (e) => {
      const dosage = parseInt(e.target.value)
      const validation = window.supplementFunctions.validateDosage(nutrient.name, dosage)
      
      const validationDisplay = modal.querySelector('#dosage-validation')
      if (validationDisplay) {
        validationDisplay.innerHTML = `
          <div class="text-${validation.color}-600 text-sm">
            <i class="fas fa-info-circle mr-1"></i>
            ${validation.message}: ${validation.description}
          </div>
        `
      }
    })
    
    // Switch steps
    modal.querySelector('#step-nutrient-search').classList.add('hidden')
    modal.querySelector('#step-dosage-selection').classList.remove('hidden')
    
    // Back button
    modal.querySelector('#back-to-nutrient-search').addEventListener('click', () => {
      modal.querySelector('#step-dosage-selection').classList.add('hidden')
      modal.querySelector('#step-nutrient-search').classList.remove('hidden')
    })
  }

  showProductSelectionStep(modal) {
    // This would show available products for the selected nutrient
    // Implementation would include database product filtering
    window.supplementUI.showQuickNotification('Produktauswahl wird implementiert...', 'info')
    setTimeout(() => modal.remove(), 1500)
  }

  async addProductToCurrentStack(product) {
    if (!this.currentStackId) {
      window.supplementUI.showQuickNotification('Bitte wählen Sie zuerst einen Stack aus', 'error')
      return
    }

    try {
      const response = await fetch(`/api/protected/stacks/${this.currentStackId}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product_id: product.id })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Update local state
      const currentStack = this.stacks.find(s => s.id === this.currentStackId)
      if (currentStack) {
        if (!currentStack.products) currentStack.products = []
        currentStack.products.push(product)
      }
      
      // Update UI
      this.updateStackSelector()
      this.scheduleRender('add-product')
      
      window.supplementUI.showQuickNotification(`${product.name} wurde zu Ihrem Stack hinzugefügt!`, 'success')
      
    } catch (error) {
      console.error('[Production] Error adding product to stack:', error)
      window.supplementUI.showQuickNotification('Fehler beim Hinzufügen des Produkts', 'error')
    }
  }

  showCreateStackModal() {
    console.log('[Production] Showing Create Stack Modal (Full Version)')
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

    // Form submission with database persistence
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
        // Create stack in database
        const newStack = await window.supplementFunctions.createUserStack({
          name: name,
          description: description
        })
        
        // Update local state
        newStack.products = []
        this.stacks.push(newStack)
        this.currentStackId = newStack.id
        
        // Update UI
        this.updateStackSelector()
        this.scheduleRender('create-stack')
        
        window.supplementUI.showQuickNotification(`Stack "${name}" erfolgreich erstellt!`, 'success')
        modal.remove()
        
      } catch (error) {
        console.error('[Production] Error creating stack:', error)
        window.supplementUI.showQuickNotification('Fehler beim Erstellen des Stacks: ' + error.message, 'error')
      }
    })
  }

  // === PRODUCT FUNCTIONS ===

  editProduct(productId) {
    console.log('[Production] Edit product:', productId)
    
    const currentStack = this.stacks.find(s => s.id === this.currentStackId)
    const product = currentStack?.products?.find(p => p.id == productId)
    
    if (!product) {
      window.supplementUI.showQuickNotification('Produkt nicht gefunden', 'error')
      return
    }

    // Show full edit modal for production
    window.supplementUI.closeAllModals()
    
    const modalHTML = window.supplementUI.createEditProductModal(product, false) // false = not demo
    const modal = window.supplementUI.createModalOverlay(modalHTML)
    
    document.body.appendChild(modal)
    this.setupEditProductModalHandlers(modal, product)
  }

  setupEditProductModalHandlers(modal, product) {
    // Close handlers
    modal.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => modal.remove())
    })
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove()
    })
    
    // Form submission for editing
    const form = modal.querySelector('#edit-product-form')
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        
        const formData = new FormData(form)
        const updatedData = {
          dosage_per_day: parseInt(formData.get('dosage_per_day')) || product.dosage_per_day,
          notes: formData.get('notes') || product.notes || ''
        }
        
        try {
          await this.updateProductInStack(product.id, updatedData)
          modal.remove()
        } catch (error) {
          console.error('[Production] Error updating product:', error)
          window.supplementUI.showQuickNotification('Fehler beim Aktualisieren des Produkts', 'error')
        }
      })
    }
  }

  async updateProductInStack(productId, updatedData) {
    if (!this.currentStackId) return

    try {
      const response = await fetch(`/api/protected/stacks/${this.currentStackId}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Update local state
      const currentStack = this.stacks.find(s => s.id === this.currentStackId)
      if (currentStack && currentStack.products) {
        const productIndex = currentStack.products.findIndex(p => p.id == productId)
        if (productIndex !== -1) {
          Object.assign(currentStack.products[productIndex], updatedData)
        }
      }
      
      // Update UI
      this.scheduleRender('edit-product')
      
      window.supplementUI.showQuickNotification('Produkt erfolgreich aktualisiert!', 'success')
      
    } catch (error) {
      console.error('[Production] Error updating product:', error)
      throw error
    }
  }

  async deleteProduct(productId) {
    if (confirm('Produkt wirklich aus dem Stack entfernen?')) {
      try {
        const response = await fetch(`/api/protected/stacks/${this.currentStackId}/products/${productId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        // Update local state
        const currentStack = this.stacks.find(s => s.id === this.currentStackId)
        if (currentStack && currentStack.products) {
          const originalLength = currentStack.products.length
          currentStack.products = currentStack.products.filter(p => p.id != productId)
          
          if (currentStack.products.length < originalLength) {
            // Update UI
            this.updateStackSelector()
            this.scheduleRender('delete-product')
            
            window.supplementUI.showQuickNotification('Produkt erfolgreich entfernt!', 'success')
          }
        }
        
      } catch (error) {
        console.error('[Production] Error deleting product:', error)
        window.supplementUI.showQuickNotification('Fehler beim Entfernen des Produkts', 'error')
      }
    }
  }

  async handleDeleteStack() {
    if (!this.currentStackId) return
    
    const stack = this.stacks.find(s => s.id === this.currentStackId)
    if (!stack) return
    
    if (confirm(`Stack "${stack.name}" wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await window.supplementFunctions.deleteUserStack(this.currentStackId)
        
        // Update local state
        this.stacks = this.stacks.filter(s => s.id !== this.currentStackId)
        this.currentStackId = null
        
        // Update UI
        this.updateStackSelector()
        this.scheduleRender('delete-stack')
        
        window.supplementUI.showQuickNotification('Stack erfolgreich gelöscht!', 'success')
        
      } catch (error) {
        console.error('[Production] Error deleting stack:', error)
        window.supplementUI.showQuickNotification('Fehler beim Löschen des Stacks', 'error')
      }
    }
  }

  // === ADDITIONAL PRODUCTION FEATURES ===

  async exportCurrentStack() {
    if (!this.currentStackId) {
      window.supplementUI.showQuickNotification('Bitte wählen Sie zuerst einen Stack aus', 'error')
      return
    }

    const currentStack = this.stacks.find(s => s.id === this.currentStackId)
    if (!currentStack) return

    try {
      const exportData = {
        stack: currentStack,
        exported_at: new Date().toISOString(),
        version: '1.0'
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stack-${currentStack.name.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      
      URL.revokeObjectURL(url)
      
      window.supplementUI.showQuickNotification('Stack erfolgreich exportiert!', 'success')
      
    } catch (error) {
      console.error('[Production] Export error:', error)
      window.supplementUI.showQuickNotification('Fehler beim Export', 'error')
    }
  }

  showImportStackModal() {
    window.supplementUI.showQuickNotification('Import-Funktion wird in Kürze verfügbar sein', 'info')
  }
}

// Smart initialization for production mode
function initializeProductionApp() {
  if (!window.productionApp && window.location.pathname === '/dashboard') {
    window.productionApp = new SupplementProduction()
    return true
  }
  return false
}

// Global verfügbar machen
window.SupplementProduction = SupplementProduction
window.initializeProductionApp = initializeProductionApp

// Auto-initialize for dashboard
if (window.location.pathname === '/dashboard' && document.readyState !== 'loading') {
  initializeProductionApp()
} else if (window.location.pathname === '/dashboard') {
  document.addEventListener('DOMContentLoaded', initializeProductionApp)
}