// Authenticated Dashboard App - Based on demo-modal.js but connected to database
// Replaces localStorage with real API calls

class AuthenticatedDashboardApp {
  constructor() {
    this.token = localStorage.getItem('auth_token')
    this.products = []
    this.stacks = []
    this.availableProducts = []
    this.nutrients = []
    this.currentStackId = null
    this.init()
  }

  init() {
    console.log('[Auth Dashboard] Initializing authenticated dashboard...')
    
    // Check authentication
    if (!this.token) {
      console.log('[Auth Dashboard] No token found, redirecting to auth')
      window.location.href = '/auth'
      return
    }

    // Set axios defaults
    axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`

    // Add title indicator
    document.title = 'Dashboard - Supplement Stack (Authenticated)'
    
    this.setupEventListeners()
    this.loadInitialData()
  }

  async loadInitialData() {
    try {
      this.showLoading()
      
      console.log('[Auth Dashboard] Loading initial dashboard data...')

      // Load all required data
      const [productsResponse, stacksResponse, nutrientsResponse] = await Promise.all([
        axios.get('/api/protected/products'),
        axios.get('/api/protected/stacks'),  
        axios.get('/api/nutrients')
      ])

      // Process products data
      if (productsResponse.data && productsResponse.data.success) {
        this.products = productsResponse.data.data || []
        this.availableProducts = [...this.products] // Use same products as available pool
        console.log('[Auth Dashboard] Loaded products:', this.products.length)
      }

      // Process stacks data
      if (stacksResponse.data && stacksResponse.data.success) {
        this.stacks = stacksResponse.data.data || []
        console.log('[Auth Dashboard] Loaded stacks:', this.stacks.length)
      }

      // Process nutrients data
      if (nutrientsResponse.data && nutrientsResponse.data.success) {
        this.nutrients = nutrientsResponse.data.data || []
        console.log('[Auth Dashboard] Loaded nutrients:', this.nutrients.length)
      }

      this.hideLoading()
      this.showDashboardContent()
      this.updateStats()
      this.initStackSelector()
      
      // Load first stack if available
      if (this.stacks.length > 0) {
        this.loadStack(this.stacks[0].id)
      }

      console.log('[Auth Dashboard] Initialization completed successfully!')
      
    } catch (error) {
      console.error('[Auth Dashboard] Error loading initial data:', error)
      this.showError('Fehler beim Laden der Dashboard-Daten: ' + (error.response?.data?.error || error.message))
      
      // Check if unauthorized
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth'
      }
    }
  }

  showLoading() {
    const loading = document.getElementById('loading')
    const content = document.getElementById('dashboard-content')
    const errorState = document.getElementById('error-state')
    
    if (loading) loading.classList.remove('hidden')
    if (content) content.classList.add('hidden')
    if (errorState) errorState.classList.add('hidden')
  }

  hideLoading() {
    const loading = document.getElementById('loading')
    if (loading) loading.classList.add('hidden')
  }

  showDashboardContent() {
    const content = document.getElementById('dashboard-content')
    if (content) content.classList.remove('hidden')
  }

  showError(message) {
    const errorState = document.getElementById('error-state')
    const errorMessage = document.getElementById('error-message')
    const loading = document.getElementById('loading')
    const content = document.getElementById('dashboard-content')
    
    if (loading) loading.classList.add('hidden')
    if (content) content.classList.add('hidden')
    if (errorState) errorState.classList.remove('hidden')
    if (errorMessage) errorMessage.textContent = message
  }

  setupEventListeners() {
    // Global app reference
    window.authDashboard = this

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

    // Create stack button
    const createStackBtn = document.getElementById('create-stack-btn')
    if (createStackBtn) {
      createStackBtn.addEventListener('click', () => this.showCreateStackModal())
    }

    // Retry button
    const retryBtn = document.getElementById('retry-btn')
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadInitialData())
    }
  }

  logout() {
    localStorage.removeItem('auth_token')
    delete axios.defaults.headers.common['Authorization']
    window.location.href = '/auth'
  }

  updateStats() {
    // Calculate total monthly cost from current products
    const totalMonthly = this.products.reduce((sum, p) => sum + (p.monthly_cost || 0), 0)
    
    // Update DOM elements
    const productsCount = document.getElementById('products-count')
    const stacksCount = document.getElementById('stacks-count') 
    const monthlyCost = document.getElementById('monthly-cost')
    const wishlistCount = document.getElementById('wishlist-count')
    
    if (productsCount) productsCount.textContent = this.products.length
    if (stacksCount) stacksCount.textContent = this.stacks.length
    if (monthlyCost) monthlyCost.textContent = `€${totalMonthly.toFixed(2)}`
    if (wishlistCount) wishlistCount.textContent = '0' // TODO: Implement wishlist
    
    console.log('[Auth Dashboard] Stats updated:', {
      products: this.products.length,
      stacks: this.stacks.length,
      monthlyTotal: totalMonthly.toFixed(2)
    })
  }

  initStackSelector() {
    const selector = document.getElementById('stack-selector')
    if (!selector) return

    // Clear existing options and populate
    selector.innerHTML = `
      <option value="">Stack auswählen...</option>
      ${this.stacks.map(stack => `
        <option value="${stack.id}">${stack.name}</option>
      `).join('')}
    `

    // Remove existing listeners and add new one
    const newSelector = selector.cloneNode(true)
    selector.parentNode.replaceChild(newSelector, selector)

    newSelector.addEventListener('change', (e) => {
      const stackId = e.target.value ? parseInt(e.target.value) : null
      if (stackId) {
        this.loadStack(stackId)
      } else {
        this.currentStackId = null
        this.renderProducts()
      }
    })

    console.log('[Auth Dashboard] Stack selector initialized with', this.stacks.length, 'stacks')
  }

  async loadStack(stackId) {
    console.log('[Auth Dashboard] Loading stack:', stackId)
    
    try {
      this.currentStackId = stackId
      
      // Get stack details including products
      const response = await axios.get(`/api/protected/stacks/${stackId}`)
      
      if (response.data && response.data.success) {
        const stackData = response.data.data
        console.log('[Auth Dashboard] Stack loaded:', stackData.name)
        
        // Update current products to show only products in this stack
        if (stackData.products && Array.isArray(stackData.products)) {
          this.products = stackData.products
        } else {
          this.products = []
        }
        
        this.renderProducts()
        this.updateStats()
      }
    } catch (error) {
      console.error('[Auth Dashboard] Error loading stack:', error)
      this.showNotification('Fehler beim Laden des Stacks', 'error')
    }
  }

  renderProducts() {
    const productsGrid = document.getElementById('products-grid')
    const productsFallback = document.getElementById('products-fallback')
    
    if (!productsGrid || !productsFallback) return

    if (this.products.length === 0) {
      productsGrid.innerHTML = ''
      productsFallback.style.display = 'block'
      return
    }

    productsFallback.style.display = 'none'
    
    const html = this.products.map(product => this.renderProductCard(product)).join('')
    productsGrid.innerHTML = html

    console.log('[Auth Dashboard] Rendered', this.products.length, 'products')
  }

  renderProductCard(product) {
    const mainNutrient = this.getMainNutrientInfo(product)
    
    return `
      <div class="bg-white border-0 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden">
        <!-- Gradient Overlay -->
        <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500"></div>
        
        <!-- Product Header -->
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center space-x-2">
            ${product.recommended ? `
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200">
                <i class="fas fa-star text-purple-500 mr-1"></i>Top
              </span>
            ` : ''}
          </div>
          <div class="flex items-center space-x-2">
            <button onclick="authDashboard.editProduct(${product.id})" class="text-blue-600 hover:text-blue-700 p-1">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="authDashboard.deleteProduct(${product.id})" class="text-red-600 hover:text-red-700 p-1">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        
        <!-- Product Image and Info -->
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
            <p class="text-xs text-slate-500 mb-2 font-medium">${product.brand || 'Unbekannte Marke'}</p>
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 shadow-sm">
              <i class="fas fa-pills mr-1"></i>${product.form || 'Supplement'}
            </span>
          </div>
        </div>
        
        <!-- Nutrient Info -->
        <div class="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-3 mb-4 border border-emerald-200">
          <div class="flex items-start space-x-2">
            <i class="fas fa-leaf text-emerald-500 mt-0.5 flex-shrink-0"></i>
            <div>
              <div class="text-xs font-semibold text-emerald-700 mb-1">Wirkstoff</div>
              <div class="text-xs text-emerald-600">${mainNutrient.name} - ${mainNutrient.amount}${mainNutrient.unit}</div>
            </div>
          </div>
        </div>
        
        <!-- Prices -->
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
        
        <!-- CTA Button -->
        <button onclick="authDashboard.viewProductDetails(${product.id})" class="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg focus:ring-4 focus:ring-blue-200 focus:outline-none text-sm">
          <i class="fas fa-eye mr-2"></i>Details anzeigen
        </button>
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

  // Modal functions adapted from demo-modal.js
  showAddProductModal() {
    console.log('[Auth Dashboard] Showing add product modal...')
    // TODO: Implement modal similar to demo but with API calls
    this.showNotification('Produkt hinzufügen wird implementiert...', 'info')
  }

  showCreateStackModal() {
    console.log('[Auth Dashboard] Showing create stack modal...')
    // TODO: Implement modal similar to demo but with API calls  
    this.showNotification('Stack erstellen wird implementiert...', 'info')
  }

  async editProduct(productId) {
    console.log('[Auth Dashboard] Edit product:', productId)
    // TODO: Implement edit modal with API integration
    this.showNotification('Produkt bearbeiten wird implementiert...', 'info')
  }

  async deleteProduct(productId) {
    if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) return
    
    try {
      const response = await axios.delete(`/api/protected/products/${productId}`)
      
      if (response.data && response.data.success) {
        this.showNotification('Produkt erfolgreich gelöscht!', 'success')
        
        // Remove from local array and re-render
        this.products = this.products.filter(p => p.id !== productId)
        this.renderProducts()
        this.updateStats()
      }
    } catch (error) {
      console.error('[Auth Dashboard] Error deleting product:', error)
      this.showNotification('Fehler beim Löschen des Produkts', 'error')
    }
  }

  viewProductDetails(productId) {
    console.log('[Auth Dashboard] View product details:', productId)
    // TODO: Implement product details modal
    this.showNotification('Produktdetails werden implementiert...', 'info')
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
function initAuthenticatedDashboard() {
  console.log('[Auth Dashboard] Initializing authenticated dashboard...')
  
  if (window.authDashboard) {
    console.log('[Auth Dashboard] Already initialized, skipping...')
    return
  }
  
  try {
    window.authDashboard = new AuthenticatedDashboardApp()
    console.log('[Auth Dashboard] Successfully initialized!')
  } catch (error) {
    console.error('[Auth Dashboard] Initialization error:', error)
  }
}

// Multiple initialization strategies
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthenticatedDashboard)
} else {
  initAuthenticatedDashboard()
}

// Fallback initializations
setTimeout(initAuthenticatedDashboard, 500)
setTimeout(initAuthenticatedDashboard, 2000)

console.log('[Auth Dashboard] Script loaded')