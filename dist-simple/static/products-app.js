// Authenticated Products Page App
// Dedicated product management interface with full CRUD operations

class AuthenticatedProductsApp {
  constructor() {
    this.token = localStorage.getItem('auth_token')
    this.products = []
    this.nutrients = []
    this.filteredProducts = []
    this.searchTerm = ''
    this.categoryFilter = ''
    this.init()
  }

  init() {
    console.log('[Auth Products] Initializing products page...')
    
    // Check authentication
    if (!this.token) {
      console.log('[Auth Products] No token found, redirecting to auth')
      window.location.href = '/auth'
      return
    }

    // Set axios defaults
    axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`

    // Add title indicator
    document.title = 'Produkte - Supplement Stack (Authenticated)'
    
    this.setupEventListeners()
    this.loadInitialData()
  }

  async loadInitialData() {
    try {
      this.showLoading()
      
      console.log('[Auth Products] Loading products data...')

      // Load products and nutrients
      const [productsResponse, nutrientsResponse] = await Promise.all([
        axios.get('/api/protected/products'),
        axios.get('/api/nutrients')
      ])

      // Process products data
      if (productsResponse.data && productsResponse.data.success) {
        this.products = productsResponse.data.data || []
        console.log('[Auth Products] Loaded products:', this.products.length)
      }

      // Process nutrients data
      if (nutrientsResponse.data && nutrientsResponse.data.success) {
        this.nutrients = nutrientsResponse.data.data || []
        console.log('[Auth Products] Loaded nutrients:', this.nutrients.length)
      }

      this.filteredProducts = [...this.products]
      
      this.hideLoading()
      this.showProductsContent()
      this.renderProducts()

      console.log('[Auth Products] Initialization completed successfully!')
      
    } catch (error) {
      console.error('[Auth Products] Error loading data:', error)
      this.showError('Fehler beim Laden der Produkte: ' + (error.response?.data?.error || error.message))
      
      // Check if unauthorized
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth'
      }
    }
  }

  showLoading() {
    const loading = document.getElementById('loading')
    const content = document.getElementById('products-content')
    const errorState = document.getElementById('error-state')
    
    if (loading) loading.classList.remove('hidden')
    if (content) content.classList.add('hidden')
    if (errorState) errorState.classList.add('hidden')
  }

  hideLoading() {
    const loading = document.getElementById('loading')
    if (loading) loading.classList.add('hidden')
  }

  showProductsContent() {
    const content = document.getElementById('products-content')
    if (content) content.classList.remove('hidden')
  }

  showError(message) {
    const errorState = document.getElementById('error-state')
    const errorMessage = document.getElementById('error-message')
    const loading = document.getElementById('loading')
    const content = document.getElementById('products-content')
    
    if (loading) loading.classList.add('hidden')
    if (content) content.classList.add('hidden')
    if (errorState) errorState.classList.remove('hidden')
    if (errorMessage) errorMessage.textContent = message
  }

  setupEventListeners() {
    // Global app reference
    window.authProducts = this

    // Logout button
    const logoutBtn = document.getElementById('logout-btn')
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout())
    }

    // Add product button
    const addProductBtn = document.getElementById('add-product-btn')
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => this.showAddProductModal())
    }

    // Search input
    const searchProducts = document.getElementById('search-products')
    if (searchProducts) {
      searchProducts.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase()
        this.applyFilters()
      })
    }

    // Category filter
    const filterCategory = document.getElementById('filter-category')
    if (filterCategory) {
      filterCategory.addEventListener('change', (e) => {
        this.categoryFilter = e.target.value
        this.applyFilters()
      })
    }

    // Retry button
    const retryBtn = document.getElementById('retry-btn')
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadInitialData())
    }

    // Bulk actions button
    const bulkActionsBtn = document.getElementById('bulk-actions-btn')
    if (bulkActionsBtn) {
      bulkActionsBtn.addEventListener('click', () => this.toggleBulkMode())
    }
  }

  logout() {
    localStorage.removeItem('auth_token')
    delete axios.defaults.headers.common['Authorization']
    window.location.href = '/auth'
  }

  applyFilters() {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm) ||
        (product.brand && product.brand.toLowerCase().includes(this.searchTerm))
      
      const matchesCategory = !this.categoryFilter || product.category === this.categoryFilter
      
      return matchesSearch && matchesCategory
    })
    
    this.renderProducts()
    console.log('[Auth Products] Applied filters, showing', this.filteredProducts.length, 'products')
  }

  renderProducts() {
    const productsGrid = document.getElementById('products-grid')
    const productsFallback = document.getElementById('products-fallback')
    
    if (!productsGrid || !productsFallback) return

    if (this.filteredProducts.length === 0) {
      productsGrid.innerHTML = ''
      productsFallback.style.display = 'block'
      
      // Update fallback message based on filter state
      if (this.searchTerm || this.categoryFilter) {
        productsFallback.innerHTML = `
          <div class="text-center py-12 text-gray-500">
            <i class="fas fa-search text-5xl mb-4"></i>
            <h3 class="text-xl font-semibold mb-2">Keine Produkte gefunden</h3>
            <p class="text-gray-400 mb-6">Keine Produkte entsprechen den aktuellen Suchkriterien.</p>
            <button class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors" onclick="authProducts.clearFilters()">
              <i class="fas fa-times mr-2"></i>Filter zurücksetzen
            </button>
          </div>
        `
      }
      return
    }

    productsFallback.style.display = 'none'
    
    const html = this.filteredProducts.map(product => this.renderProductCard(product)).join('')
    productsGrid.innerHTML = html

    console.log('[Auth Products] Rendered', this.filteredProducts.length, 'products')
  }

  renderProductCard(product) {
    const mainNutrient = this.getMainNutrientInfo(product)
    
    return `
      <div class="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
        <!-- Product Header -->
        <div class="relative p-6 pb-4 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-2">
              ${product.recommended ? `
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                  <i class="fas fa-star text-purple-500 mr-1"></i>Empfohlen
                </span>
              ` : ''}
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="authProducts.editProduct(${product.id})" class="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-100 transition-colors">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="authProducts.duplicateProduct(${product.id})" class="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-100 transition-colors">
                <i class="fas fa-copy"></i>
              </button>
              <button onclick="authProducts.deleteProduct(${product.id})" class="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-100 transition-colors">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <!-- Product Image and Basic Info -->
          <div class="flex items-center space-x-4">
            ${product.product_image ? `
              <div class="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-white border shadow-sm">
                <img src="${product.product_image}" alt="${product.name}" class="w-full h-full object-cover">
              </div>
            ` : `
              <div class="w-16 h-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center shadow-sm">
                <i class="fas fa-pills text-blue-500 text-xl"></i>
              </div>
            `}
            
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gray-800 text-lg mb-1 truncate">${product.name}</h3>
              <p class="text-sm text-gray-600 mb-2">${product.brand || 'Unbekannte Marke'}</p>
              <div class="flex items-center space-x-2">
                <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-white text-blue-700 border border-blue-200">
                  <i class="fas fa-pills mr-1"></i>${product.form || 'Supplement'}
                </span>
                ${product.category ? `
                  <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700">
                    ${product.category}
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Product Details -->
        <div class="p-6 pt-4">
          <!-- Nutrient Information -->
          <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-200">
            <div class="flex items-start space-x-3">
              <i class="fas fa-leaf text-green-500 mt-1 flex-shrink-0"></i>
              <div class="flex-1">
                <div class="text-sm font-semibold text-green-700 mb-1">Hauptwirkstoff</div>
                <div class="text-sm text-green-600">${mainNutrient.name}</div>
                <div class="text-xs text-green-500">${mainNutrient.amount}${mainNutrient.unit} pro ${product.form || 'Einheit'}</div>
              </div>
            </div>
          </div>
          
          <!-- Dosage and Supply -->
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-gray-50 rounded-xl p-3 border">
              <div class="text-xs text-gray-600 font-medium mb-1">Dosierung</div>
              <div class="text-sm font-bold text-gray-800">${product.dosage_per_day || 1} ${product.form || 'Einheit'}/Tag</div>
              <div class="text-xs text-gray-500">Empfohlen</div>
            </div>
            <div class="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <div class="text-xs text-blue-600 font-medium mb-1">Vorrat</div>
              <div class="text-sm font-bold text-blue-800">${product.days_supply || 30}</div>
              <div class="text-xs text-blue-500">Tage</div>
            </div>
          </div>
          
          <!-- Pricing -->
          <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="text-center bg-gray-50 rounded-xl p-4 border">
              <div class="text-xs text-gray-600 font-medium mb-1">Kaufpreis</div>
              <div class="text-xl font-bold text-gray-800">€${(product.purchase_price || 0).toFixed(2)}</div>
            </div>
            <div class="text-center bg-green-50 rounded-xl p-4 border border-green-200">
              <div class="text-xs text-green-600 font-medium mb-1">Pro Monat</div>
              <div class="text-xl font-bold text-green-700">€${(product.monthly_cost || 0).toFixed(2)}</div>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex space-x-2">
            <button onclick="authProducts.viewProductDetails(${product.id})" class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 text-sm">
              <i class="fas fa-eye mr-2"></i>Details
            </button>
            <button onclick="authProducts.addToStack(${product.id})" class="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 text-sm">
              <i class="fas fa-plus mr-2"></i>Zu Stack
            </button>
          </div>
        </div>
      </div>
    `
  }

  getMainNutrientInfo(product) {
    // Try to get nutrient info from product
    let nutrientId, amount
    
    if (product.main_nutrients && product.main_nutrients.length > 0) {
      // New structure
      const mainNutrient = product.main_nutrients[0]
      nutrientId = mainNutrient.nutrient_id
      amount = mainNutrient.amount_per_unit
    } else {
      // Old structure fallback
      nutrientId = product.nutrient_id
      amount = product.nutrient_amount_per_unit || 0
    }
    
    const nutrient = this.nutrients.find(n => n.id === nutrientId)
    
    return {
      name: nutrient ? nutrient.name : 'Unbekannt',
      unit: nutrient ? nutrient.unit : '',
      amount: amount || 0
    }
  }

  clearFilters() {
    this.searchTerm = ''
    this.categoryFilter = ''
    
    // Reset form inputs
    const searchInput = document.getElementById('search-products')
    const categorySelect = document.getElementById('filter-category')
    
    if (searchInput) searchInput.value = ''
    if (categorySelect) categorySelect.value = ''
    
    this.applyFilters()
  }

  toggleBulkMode() {
    // TODO: Implement bulk selection mode
    this.showNotification('Bulk-Modus wird implementiert...', 'info')
  }

  // Product CRUD operations
  showAddProductModal() {
    console.log('[Auth Products] Showing add product modal...')
    // TODO: Implement modal similar to demo but with API calls
    this.showNotification('Produkt hinzufügen wird implementiert...', 'info')
  }

  async editProduct(productId) {
    console.log('[Auth Products] Edit product:', productId)
    // TODO: Implement edit modal with API integration
    this.showNotification('Produkt bearbeiten wird implementiert...', 'info')
  }

  async duplicateProduct(productId) {
    try {
      const originalProduct = this.products.find(p => p.id === productId)
      if (!originalProduct) return
      
      // TODO: Implement API call to duplicate product
      console.log('[Auth Products] Duplicate product:', productId)
      this.showNotification('Produkt duplizieren wird implementiert...', 'info')
      
    } catch (error) {
      console.error('[Auth Products] Error duplicating product:', error)
      this.showNotification('Fehler beim Duplizieren des Produkts', 'error')
    }
  }

  async deleteProduct(productId) {
    if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) return
    
    try {
      const response = await axios.delete(`/api/protected/products/${productId}`)
      
      if (response.data && response.data.success) {
        this.showNotification('Produkt erfolgreich gelöscht!', 'success')
        
        // Remove from local arrays and re-render
        this.products = this.products.filter(p => p.id !== productId)
        this.applyFilters()
      }
    } catch (error) {
      console.error('[Auth Products] Error deleting product:', error)
      this.showNotification('Fehler beim Löschen des Produkts', 'error')
    }
  }

  viewProductDetails(productId) {
    console.log('[Auth Products] View product details:', productId)
    // TODO: Implement product details modal
    this.showNotification('Produktdetails werden implementiert...', 'info')
  }

  addToStack(productId) {
    console.log('[Auth Products] Add to stack:', productId)
    // TODO: Implement add to stack functionality
    this.showNotification('Zu Stack hinzufügen wird implementiert...', 'info')
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
}

// Initialize when DOM is ready
function initAuthenticatedProducts() {
  console.log('[Auth Products] Initializing products page...')
  
  if (window.authProducts) {
    console.log('[Auth Products] Already initialized, skipping...')
    return
  }
  
  try {
    window.authProducts = new AuthenticatedProductsApp()
    console.log('[Auth Products] Successfully initialized!')
  } catch (error) {
    console.error('[Auth Products] Initialization error:', error)
  }
}

// Multiple initialization strategies
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthenticatedProducts)
} else {
  initAuthenticatedProducts()
}

// Fallback initializations
setTimeout(initAuthenticatedProducts, 500)
setTimeout(initAuthenticatedProducts, 2000)

console.log('[Auth Products] Script loaded')