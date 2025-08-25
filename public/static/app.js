// Supplement Stack - Frontend JavaScript
// Handles user interactions, API calls, and dynamic content

class SupplementApp {
  constructor() {
    this.token = localStorage.getItem('auth_token')
    this.currentUser = null
    this.init()
  }

  init() {
    this.setupAxiosDefaults()
    this.setupEventListeners()
    this.checkAuthStatus()
  }

  setupAxiosDefaults() {
    // Set default headers for API requests
    if (this.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
    }
    
    // Add response interceptor for token expiration
    axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          this.logout()
        }
        return Promise.reject(error)
      }
    )
  }

  async checkAuthStatus() {
    const currentPath = window.location.pathname
    
    // Allow access to landing page and auth page without token
    if (currentPath === '/' || currentPath === '/auth') {
      return
    }
    
    if (!this.token) {
      this.redirectToLogin()
      return
    }

    try {
      // Verify token is still valid
      const response = await axios.get('/api/health')
      this.loadPageContent()
    } catch (error) {
      if (error.response?.status === 401) {
        this.logout()
      }
    }
  }

  setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('login-form')
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e))
    }

    // Register form
    const registerForm = document.getElementById('register-form')
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e))
    }

    // Toggle between login and register
    const showRegister = document.getElementById('show-register')
    const showLogin = document.getElementById('show-login')
    
    if (showRegister) {
      showRegister.addEventListener('click', (e) => {
        e.preventDefault()
        document.getElementById('login-form').classList.add('hidden')
        document.getElementById('register-form').classList.remove('hidden')
      })
    }

    if (showLogin) {
      showLogin.addEventListener('click', (e) => {
        e.preventDefault()
        document.getElementById('register-form').classList.add('hidden')
        document.getElementById('login-form').classList.remove('hidden')
      })
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn')
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout())
    }

    // Demo link
    const demoLink = document.getElementById('demo-link')
    if (demoLink) {
      demoLink.addEventListener('click', (e) => {
        e.preventDefault()
        this.openDemo()
      })
    }

    // Page-specific event listeners
    this.setupPageSpecificEvents()
  }

  setupPageSpecificEvents() {
    const currentPath = window.location.pathname

    switch (currentPath) {
      case '/dashboard':
        this.setupDashboardEvents()
        break
      case '/products':
        this.setupProductsEvents()
        break
      case '/stacks':
        this.setupStacksEvents()
        break
      case '/admin':
        this.setupAdminEvents()
        break
    }
  }

  async handleLogin(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    this.showLoading('Anmeldung läuft...')
    
    try {
      const response = await axios.post('/api/auth/login', {
        email: formData.get('email'),
        password: formData.get('password')
      })

      if (response.data.token) {
        this.token = response.data.token
        localStorage.setItem('auth_token', this.token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        
        this.currentUser = response.data.user
        this.showSuccess('Erfolgreich angemeldet!')
        this.redirectToDashboard()
      }
    } catch (error) {
      this.showError(error.response?.data?.error || 'Anmeldung fehlgeschlagen')
    } finally {
      this.hideLoading()
    }
  }

  async handleRegister(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    this.showLoading('Registrierung läuft...')
    
    try {
      const response = await axios.post('/api/auth/register', {
        email: formData.get('email'),
        password: formData.get('password'),
        age: formData.get('age') ? parseInt(formData.get('age')) : null,
        weight: formData.get('weight') ? parseFloat(formData.get('weight')) : null,
        diet_type: formData.get('diet_type')
      })

      if (response.data.token) {
        this.token = response.data.token
        localStorage.setItem('auth_token', this.token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        
        this.currentUser = response.data.user
        this.showSuccess('Registrierung erfolgreich!')
        this.redirectToDashboard()
      }
    } catch (error) {
      this.showError(error.response?.data?.error || 'Registrierung fehlgeschlagen')
    } finally {
      this.hideLoading()
    }
  }

  logout() {
    this.token = null
    this.currentUser = null
    localStorage.removeItem('auth_token')
    delete axios.defaults.headers.common['Authorization']
    this.redirectToLogin()
  }

  redirectToLogin() {
    const currentPath = window.location.pathname
    if (currentPath !== '/' && currentPath !== '/auth') {
      window.location.href = '/auth'
    }
  }

  redirectToDashboard() {
    window.location.href = '/dashboard'
  }

  openDemo() {
    const demoUrl = window.location.origin + '/demo'
    const demoWindow = window.open(demoUrl, 'demo', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    
    if (demoWindow) {
      demoWindow.focus()
    } else {
      this.showError('Pop-up blockiert. Bitte erlauben Sie Pop-ups für diese Seite.')
    }
  }

  // Dashboard functionality
  setupDashboardEvents() {
    this.loadDashboardData()
  }

  async loadDashboardData() {
    try {
      this.showLoading('Lade Dashboard...')
      
      const [productsResponse, stacksResponse, wishlistResponse] = await Promise.all([
        axios.get('/api/protected/products'),
        axios.get('/api/protected/stacks'),
        axios.get('/api/protected/wishlist')
      ])

      // Update counters
      const productsCount = document.getElementById('products-count')
      const stacksCount = document.getElementById('stacks-count')
      const wishlistCount = document.getElementById('wishlist-count')
      
      if (productsCount) productsCount.textContent = productsResponse.data.length
      if (stacksCount) stacksCount.textContent = stacksResponse.data.length
      if (wishlistCount) wishlistCount.textContent = wishlistResponse.data.length

      // Calculate monthly costs
      const monthlyCost = this.calculateMonthlyCosts(stacksResponse.data)
      const monthlyCostElement = document.getElementById('monthly-cost')
      if (monthlyCostElement) monthlyCostElement.textContent = `€${monthlyCost.toFixed(2)}`

      // Display recent stacks
      this.displayRecentStacks(stacksResponse.data)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      this.showError('Fehler beim Laden der Dashboard-Daten')
    } finally {
      this.hideLoading()
    }
  }

  calculateMonthlyCosts(stacks) {
    return stacks.reduce((total, stack) => total + (stack.monthly_cost || 0), 0)
  }

  displayRecentStacks(stacks) {
    const container = document.getElementById('recent-stacks')
    if (!container) return

    if (stacks.length === 0) {
      container.innerHTML = '<p class="text-gray-500 text-center py-4">Noch keine Stacks erstellt</p>'
      return
    }

    container.innerHTML = stacks.slice(0, 3).map(stack => `
      <div class="border-b border-gray-200 last:border-b-0 pb-4 last:pb-0 mb-4 last:mb-0">
        <h3 class="font-medium text-gray-900">${this.escapeHtml(stack.name)}</h3>
        <p class="text-sm text-gray-500 mt-1">${this.escapeHtml(stack.description || 'Keine Beschreibung')}</p>
        <div class="flex justify-between items-center mt-2">
          <span class="text-xs text-gray-400">${stack.product_count || 0} Produkte</span>
          <a href="/stacks?id=${stack.id}" class="text-blue-600 hover:text-blue-500 text-sm">Bearbeiten</a>
        </div>
      </div>
    `).join('')
  }

  // Products functionality
  setupProductsEvents() {
    const addProductBtn = document.getElementById('add-product-btn')
    if (addProductBtn) {
      addProductBtn.addEventListener('click', () => this.showAddProductModal())
    }

    const searchInput = document.getElementById('search-products')
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterProducts())
    }

    this.loadProducts()
  }

  async loadProducts() {
    try {
      this.showLoading('Lade Produkte...')
      const response = await axios.get('/api/protected/products')
      this.displayProducts(response.data)
    } catch (error) {
      console.error('Error loading products:', error)
      this.showError('Fehler beim Laden der Produkte')
    } finally {
      this.hideLoading()
    }
  }

  displayProducts(products) {
    const container = document.getElementById('products-grid')
    if (!container) return

    if (products.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-pills text-4xl text-gray-300 mb-4"></i>
          <h3 class="text-lg font-medium text-gray-500 mb-2">Noch keine Produkte hinzugefügt</h3>
          <p class="text-gray-400 mb-6">Fügen Sie Ihr erstes Supplement hinzu, um zu beginnen</p>
          <button onclick="app.showAddProductModal()" class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors">
            <i class="fas fa-plus mr-2"></i>Erstes Produkt hinzufügen
          </button>
        </div>
      `
      return
    }

    container.innerHTML = products.map(product => `
      <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-lg font-semibold text-gray-900">${this.escapeHtml(product.name)}</h3>
          <div class="flex space-x-2">
            <button class="text-blue-600 hover:text-blue-500" onclick="app.editProduct(${product.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-600 hover:text-red-500" onclick="app.deleteProduct(${product.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <p class="text-gray-600 mb-2">${this.escapeHtml(product.brand)} - ${this.escapeHtml(product.form)}</p>
        <div class="space-y-2 mb-4">
          ${(product.nutrients || []).map(nutrient => `
            <div class="flex justify-between text-sm">
              <span>${this.escapeHtml(nutrient.name)}</span>
              <span>${nutrient.amount} ${nutrient.unit}</span>
            </div>
          `).join('')}
        </div>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold text-green-600">€${product.price_per_package}</span>
          <div class="space-x-2">
            <button onclick="app.addToWishlist(${product.id})" class="text-red-600 hover:text-red-500" title="Zur Wunschliste">
              <i class="fas fa-heart"></i>
            </button>
            <a href="${product.shop_url}" target="_blank" class="text-blue-600 hover:text-blue-500 text-sm">
              <i class="fas fa-external-link-alt mr-1"></i>Shop
            </a>
          </div>
        </div>
      </div>
    `).join('')
  }

  // Stacks functionality
  setupStacksEvents() {
    const addStackBtn = document.getElementById('add-stack-btn')
    if (addStackBtn) {
      addStackBtn.addEventListener('click', () => this.showAddStackModal())
    }

    this.loadStacks()
  }

  async loadStacks() {
    try {
      this.showLoading('Lade Stacks...')
      const response = await axios.get('/api/protected/stacks')
      this.displayStacks(response.data)
    } catch (error) {
      console.error('Error loading stacks:', error)
      this.showError('Fehler beim Laden der Stacks')
    } finally {
      this.hideLoading()
    }
  }

  displayStacks(stacks) {
    const container = document.getElementById('stacks-grid')
    if (!container) return

    if (stacks.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-layer-group text-4xl text-gray-300 mb-4"></i>
          <h3 class="text-lg font-medium text-gray-500 mb-2">Noch keine Stacks erstellt</h3>
          <p class="text-gray-400 mb-6">Erstellen Sie Ihren ersten Stack aus Ihren Produkten</p>
          <button onclick="app.showAddStackModal()" class="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors">
            <i class="fas fa-plus mr-2"></i>Ersten Stack erstellen
          </button>
        </div>
      `
      return
    }

    container.innerHTML = stacks.map(stack => `
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-semibold text-gray-900">${this.escapeHtml(stack.name)}</h3>
          <div class="flex space-x-2">
            <button class="text-blue-600 hover:text-blue-500" onclick="app.editStack(${stack.id})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="text-red-600 hover:text-red-500" onclick="app.deleteStack(${stack.id})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <p class="text-gray-600 mb-4">${this.escapeHtml(stack.description || 'Keine Beschreibung')}</p>
        <div class="space-y-2 mb-4">
          ${(stack.products || []).slice(0, 3).map(product => `
            <div class="flex justify-between text-sm">
              <span>${this.escapeHtml(product.product_name)}</span>
              <span>${product.dosage_per_day}x täglich</span>
            </div>
          `).join('')}
          ${stack.products && stack.products.length > 3 ? `<div class="text-sm text-gray-500">+${stack.products.length - 3} weitere</div>` : ''}
        </div>
        <div class="flex justify-between items-center">
          <span class="text-lg font-semibold text-green-600">€${(stack.monthly_cost || 0).toFixed(2)}/Monat</span>
          <button class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" onclick="app.viewStack(${stack.id})">
            Details
          </button>
        </div>
      </div>
    `).join('')
  }

  // Modal functions for adding products and stacks
  showAddProductModal() {
    this.showModal('Neues Produkt hinzufügen', this.getAddProductForm(), this.handleAddProduct.bind(this))
  }

  showAddStackModal() {
    this.showModal('Neuen Stack erstellen', this.getAddStackForm(), this.handleAddStack.bind(this))
  }

  getAddProductForm() {
    return `
      <form id="add-product-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="form-label">Produktname *</label>
            <input type="text" name="name" required class="form-input">
          </div>
          <div>
            <label class="form-label">Marke *</label>
            <input type="text" name="brand" required class="form-input">
          </div>
        </div>
        
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="form-label">Darreichungsform *</label>
            <select name="form" required class="form-select">
              <option value="">Auswählen</option>
              <option value="Kapsel">Kapsel</option>
              <option value="Tablette">Tablette</option>
              <option value="Tropfen">Tropfen</option>
              <option value="Pulver">Pulver</option>
              <option value="Öl">Öl</option>
            </select>
          </div>
          <div>
            <label class="form-label">Preis pro Packung (€) *</label>
            <input type="number" name="price" step="0.01" required class="form-input">
          </div>
          <div>
            <label class="form-label">Portionen pro Packung *</label>
            <input type="number" name="servings" required class="form-input">
          </div>
        </div>
        
        <div>
          <label class="form-label">Shop-URL *</label>
          <input type="url" name="shop_url" required class="form-input">
        </div>
        
        <div>
          <label class="form-label">Bild-URL (optional)</label>
          <input type="url" name="image_url" class="form-input">
        </div>
        
        <div id="nutrients-section">
          <label class="form-label">Wirkstoffe</label>
          <div id="nutrients-list"></div>
          <button type="button" onclick="app.addNutrientField()" class="mt-2 text-blue-600 hover:text-blue-500">
            <i class="fas fa-plus mr-1"></i>Wirkstoff hinzufügen
          </button>
        </div>
      </form>
    `
  }

  getAddStackForm() {
    return `
      <form id="add-stack-form" class="space-y-4">
        <div>
          <label class="form-label">Stack-Name *</label>
          <input type="text" name="name" required class="form-input">
        </div>
        
        <div>
          <label class="form-label">Beschreibung</label>
          <textarea name="description" rows="3" class="form-input"></textarea>
        </div>
        
        <div id="stack-products-section">
          <label class="form-label">Produkte auswählen</label>
          <div id="stack-products-list"></div>
          <button type="button" onclick="app.loadProductsForStack()" class="mt-2 text-blue-600 hover:text-blue-500">
            <i class="fas fa-plus mr-1"></i>Produkt hinzufügen
          </button>
        </div>
      </form>
    `
  }

  async handleAddProduct(formData) {
    try {
      this.showLoading('Produkt wird gespeichert...')
      
      const productData = {
        name: formData.get('name'),
        brand: formData.get('brand'),
        form: formData.get('form'),
        price_per_package: parseFloat(formData.get('price')),
        servings_per_package: parseInt(formData.get('servings')),
        shop_url: formData.get('shop_url'),
        image_url: formData.get('image_url') || null,
        nutrients: [] // Will be populated from form
      }

      const response = await axios.post('/api/protected/products', productData)
      this.showSuccess('Produkt erfolgreich hinzugefügt!')
      this.hideModal()
      this.loadProducts()
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Speichern des Produkts')
    } finally {
      this.hideLoading()
    }
  }

  async handleAddStack(formData) {
    try {
      this.showLoading('Stack wird erstellt...')
      
      const stackData = {
        name: formData.get('name'),
        description: formData.get('description') || null,
        products: [] // Will be populated from selected products
      }

      const response = await axios.post('/api/protected/stacks', stackData)
      this.showSuccess('Stack erfolgreich erstellt!')
      this.hideModal()
      this.loadStacks()
      
    } catch (error) {
      this.showError(error.response?.data?.error || 'Fehler beim Erstellen des Stacks')
    } finally {
      this.hideLoading()
    }
  }

  // Admin functionality
  setupAdminEvents() {
    const adminTabs = document.querySelectorAll('.admin-tab')
    adminTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        adminTabs.forEach(t => t.classList.remove('active', 'border-blue-500', 'text-blue-600'))
        adminTabs.forEach(t => t.classList.add('border-transparent', 'text-gray-500'))
        
        e.target.classList.add('active', 'border-blue-500', 'text-blue-600')
        e.target.classList.remove('border-transparent', 'text-gray-500')
        
        this.loadAdminTab(e.target.dataset.tab)
      })
    })

    this.loadAdminTab('nutrients')
  }

  async loadAdminTab(tabName) {
    const content = document.getElementById('admin-content')
    if (!content) return

    content.innerHTML = '<div class="text-center py-4 text-gray-500">Lade Daten...</div>'

    try {
      switch (tabName) {
        case 'nutrients':
          await this.loadNutrientsAdmin()
          break
        case 'duplicates':
          await this.loadDuplicatesAdmin()
          break
        case 'affiliates':
          await this.loadAffiliatesAdmin()
          break
        case 'statistics':
          await this.loadStatisticsAdmin()
          break
      }
    } catch (error) {
      console.error(`Error loading admin tab ${tabName}:`, error)
      content.innerHTML = '<div class="text-center py-4 text-red-500">Fehler beim Laden der Daten</div>'
    }
  }

  async loadNutrientsAdmin() {
    const response = await axios.get('/api/protected/admin/nutrients')
    const nutrients = response.data
    
    const content = document.getElementById('admin-content')
    content.innerHTML = `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">Nährstoffe verwalten</h3>
          <button onclick="app.showAddNutrientModal()" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            <i class="fas fa-plus mr-2"></i>Nährstoff hinzufügen
          </button>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Einheit</th>
                <th>DGE Empfehlung</th>
                <th>Studien Empfehlung</th>
                <th>Warnschwelle</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${nutrients.map(nutrient => `
                <tr>
                  <td class="font-medium">${this.escapeHtml(nutrient.name)}</td>
                  <td>${this.escapeHtml(nutrient.standard_unit)}</td>
                  <td>${nutrient.dge_recommended || '-'}</td>
                  <td>${nutrient.study_recommended || '-'}</td>
                  <td>${nutrient.warning_threshold || '-'}</td>
                  <td>
                    <button onclick="app.editNutrient(${nutrient.id})" class="text-blue-600 hover:text-blue-500 mr-2">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="app.deleteNutrient(${nutrient.id})" class="text-red-600 hover:text-red-500">
                      <i class="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
  }

  // Utility functions
  showModal(title, content, submitHandler) {
    const modalHtml = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-container">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">${title}</h3>
            <button onclick="app.hideModal()" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="modal-content mb-6">
            ${content}
          </div>
          <div class="flex justify-end space-x-3">
            <button onclick="app.hideModal()" class="btn-secondary">Abbrechen</button>
            <button onclick="app.submitModal()" class="btn-primary">Speichern</button>
          </div>
        </div>
      </div>
    `
    
    document.body.insertAdjacentHTML('beforeend', modalHtml)
    this.currentModalSubmitHandler = submitHandler
  }

  hideModal() {
    const modal = document.getElementById('modal-overlay')
    if (modal) {
      modal.remove()
    }
    this.currentModalSubmitHandler = null
  }

  submitModal() {
    if (this.currentModalSubmitHandler) {
      const form = document.querySelector('#modal-overlay form')
      if (form) {
        const formData = new FormData(form)
        this.currentModalSubmitHandler(formData)
      }
    }
  }

  showLoading(message = 'Lädt...') {
    // Simple loading implementation
    console.log('Loading:', message)
  }

  hideLoading() {
    console.log('Loading finished')
  }

  showError(message) {
    alert(`Fehler: ${message}`)
  }

  showSuccess(message) {
    alert(`Erfolg: ${message}`)
  }

  escapeHtml(text) {
    if (!text) return ''
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  loadPageContent() {
    const path = window.location.pathname
    
    switch (path) {
      case '/dashboard':
        this.loadDashboardData()
        break
      case '/products':
        this.loadProducts()
        break
      case '/stacks':
        this.loadStacks()
        break
    }
  }

  // Placeholder functions for missing functionality
  editProduct(id) { this.showError('Produkt bearbeiten - wird implementiert') }
  deleteProduct(id) { this.showError('Produkt löschen - wird implementiert') }
  addToWishlist(id) { this.showSuccess('Zur Wunschliste hinzugefügt') }
  editStack(id) { this.showError('Stack bearbeiten - wird implementiert') }
  deleteStack(id) { this.showError('Stack löschen - wird implementiert') }
  viewStack(id) { this.showError('Stack Details - wird implementiert') }
  addNutrientField() { this.showError('Nährstoff-Feld hinzufügen - wird implementiert') }
  loadProductsForStack() { this.showError('Produkte für Stack laden - wird implementiert') }
}

// Landing page specific functionality
document.addEventListener('DOMContentLoaded', () => {
  // Initialize app
  window.app = new SupplementApp()

  // Handle demo button on landing page
  const demoBtn = document.getElementById('demo-btn')
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      const featuresSection = document.querySelector('#features')
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' })
      }
    })
  }

  // Smooth scrolling for anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]')
  anchorLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const targetId = link.getAttribute('href').substring(1)
      const targetElement = document.getElementById(targetId)
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' })
      }
    })
  })

  // Ensure all feature cards are visible
  const featureCards = document.querySelectorAll('#features .text-center.p-6')
  featureCards.forEach(card => {
    card.style.opacity = '1'
    card.style.transform = 'translateY(0)'
    card.style.visibility = 'visible'
  })
})