// Authenticated Stacks Page App
// Dedicated stack management interface with full CRUD operations

class AuthenticatedStacksApp {
  constructor() {
    this.token = localStorage.getItem('auth_token')
    this.stacks = []
    this.filteredStacks = []
    this.searchTerm = ''
    this.sortBy = 'name'
    this.init()
  }

  init() {
    console.log('[Auth Stacks] Initializing stacks page...')
    
    // Check authentication
    if (!this.token) {
      console.log('[Auth Stacks] No token found, redirecting to auth')
      window.location.href = '/auth'
      return
    }

    // Set axios defaults
    axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`

    // Add title indicator
    document.title = 'Stacks - Supplement Stack (Authenticated)'
    
    this.setupEventListeners()
    this.loadInitialData()
  }

  async loadInitialData() {
    try {
      this.showLoading()
      
      console.log('[Auth Stacks] Loading stacks data...')

      // Load stacks
      const stacksResponse = await axios.get('/api/protected/stacks')

      // Process stacks data
      if (stacksResponse.data && stacksResponse.data.success) {
        this.stacks = stacksResponse.data.data || []
        console.log('[Auth Stacks] Loaded stacks:', this.stacks.length)
      }

      this.filteredStacks = [...this.stacks]
      
      this.hideLoading()
      this.showStacksContent()
      this.renderStacks()

      console.log('[Auth Stacks] Initialization completed successfully!')
      
    } catch (error) {
      console.error('[Auth Stacks] Error loading data:', error)
      this.showError('Fehler beim Laden der Stacks: ' + (error.response?.data?.error || error.message))
      
      // Check if unauthorized
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token')
        window.location.href = '/auth'
      }
    }
  }

  showLoading() {
    const loading = document.getElementById('loading')
    const content = document.getElementById('stacks-content')
    const errorState = document.getElementById('error-state')
    
    if (loading) loading.classList.remove('hidden')
    if (content) content.classList.add('hidden')
    if (errorState) errorState.classList.add('hidden')
  }

  hideLoading() {
    const loading = document.getElementById('loading')
    if (loading) loading.classList.add('hidden')
  }

  showStacksContent() {
    const content = document.getElementById('stacks-content')
    if (content) content.classList.remove('hidden')
  }

  showError(message) {
    const errorState = document.getElementById('error-state')
    const errorMessage = document.getElementById('error-message')
    const loading = document.getElementById('loading')
    const content = document.getElementById('stacks-content')
    
    if (loading) loading.classList.add('hidden')
    if (content) content.classList.add('hidden')
    if (errorState) errorState.classList.remove('hidden')
    if (errorMessage) errorMessage.textContent = message
  }

  setupEventListeners() {
    // Global app reference
    window.authStacks = this

    // Logout button
    const logoutBtn = document.getElementById('logout-btn')
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout())
    }

    // Create stack button
    const createStackBtn = document.getElementById('create-stack-btn')
    if (createStackBtn) {
      createStackBtn.addEventListener('click', () => this.showCreateStackModal())
    }

    // Stack templates button
    const stackTemplatesBtn = document.getElementById('stack-templates-btn')
    if (stackTemplatesBtn) {
      stackTemplatesBtn.addEventListener('click', () => this.showStackTemplates())
    }

    // Search input
    const searchStacks = document.getElementById('search-stacks')
    if (searchStacks) {
      searchStacks.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase()
        this.applyFilters()
      })
    }

    // Sort select
    const sortStacks = document.getElementById('sort-stacks')
    if (sortStacks) {
      sortStacks.addEventListener('change', (e) => {
        this.sortBy = e.target.value
        this.applyFilters()
      })
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

  applyFilters() {
    // Filter by search term
    this.filteredStacks = this.stacks.filter(stack => {
      return !this.searchTerm || 
        stack.name.toLowerCase().includes(this.searchTerm) ||
        (stack.description && stack.description.toLowerCase().includes(this.searchTerm))
    })
    
    // Sort stacks
    this.filteredStacks.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'date':
          return new Date(b.created_at) - new Date(a.created_at)
        case 'cost':
          return (b.total_monthly_cost || 0) - (a.total_monthly_cost || 0)
        case 'products':
          return (b.products?.length || 0) - (a.products?.length || 0)
        default:
          return 0
      }
    })
    
    this.renderStacks()
    console.log('[Auth Stacks] Applied filters, showing', this.filteredStacks.length, 'stacks')
  }

  renderStacks() {
    const stacksGrid = document.getElementById('stacks-grid')
    const stacksFallback = document.getElementById('stacks-fallback')
    
    if (!stacksGrid || !stacksFallback) return

    if (this.filteredStacks.length === 0) {
      stacksGrid.innerHTML = ''
      stacksFallback.style.display = 'block'
      
      // Update fallback message based on filter state
      if (this.searchTerm) {
        stacksFallback.innerHTML = `
          <div class="text-center py-12 text-gray-500">
            <i class="fas fa-search text-5xl mb-4"></i>
            <h3 class="text-xl font-semibold mb-2">Keine Stacks gefunden</h3>
            <p class="text-gray-400 mb-6">Keine Stacks entsprechen dem Suchbegriff "${this.searchTerm}".</p>
            <button class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors" onclick="authStacks.clearSearch()">
              <i class="fas fa-times mr-2"></i>Suche zurücksetzen
            </button>
          </div>
        `
      }
      return
    }

    stacksFallback.style.display = 'none'
    
    const html = this.filteredStacks.map(stack => this.renderStackCard(stack)).join('')
    stacksGrid.innerHTML = html

    console.log('[Auth Stacks] Rendered', this.filteredStacks.length, 'stacks')
  }

  renderStackCard(stack) {
    const productCount = stack.products?.length || 0
    const totalCost = stack.total_monthly_cost || 0
    const createdDate = new Date(stack.created_at).toLocaleDateString('de-DE')
    
    return `
      <div class="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden">
        <!-- Stack Header -->
        <div class="relative p-6 pb-4 bg-gradient-to-br from-green-50 to-teal-50 border-b border-green-100">
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center space-x-2">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                <i class="fas fa-layer-group text-green-600 mr-1"></i>${productCount} Produkte
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="authStacks.editStack(${stack.id})" class="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-100 transition-colors">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="authStacks.duplicateStack(${stack.id})" class="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-100 transition-colors">
                <i class="fas fa-copy"></i>
              </button>
              <button onclick="authStacks.deleteStack(${stack.id})" class="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-100 transition-colors">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <div class="w-16 h-16 flex-shrink-0 rounded-xl bg-gradient-to-br from-green-100 to-teal-100 border border-green-200 flex items-center justify-center shadow-sm">
              <i class="fas fa-layer-group text-green-500 text-2xl"></i>
            </div>
            
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gray-800 text-lg mb-1 truncate">${stack.name}</h3>
              <p class="text-sm text-gray-600 mb-2 line-clamp-2">${stack.description || 'Keine Beschreibung'}</p>
              <div class="text-xs text-gray-500">Erstellt am ${createdDate}</div>
            </div>
          </div>
        </div>
        
        <!-- Stack Stats -->
        <div class="p-6 pt-4">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <div class="text-xs text-blue-600 font-medium mb-1">Produkte</div>
              <div class="text-lg font-bold text-blue-800">${productCount}</div>
              <div class="text-xs text-blue-500">Supplements</div>
            </div>
            <div class="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
              <div class="text-xs text-yellow-600 font-medium mb-1">Monatlich</div>
              <div class="text-lg font-bold text-yellow-800">€${totalCost.toFixed(2)}</div>
              <div class="text-xs text-yellow-500">Gesamtkosten</div>
            </div>
          </div>
          
          <!-- Products Preview -->
          ${productCount > 0 ? `
            <div class="mb-4">
              <div class="text-sm font-medium text-gray-700 mb-2">Enthaltene Produkte:</div>
              <div class="space-y-1 max-h-20 overflow-y-auto">
                ${(stack.products || []).slice(0, 3).map(product => `
                  <div class="flex items-center space-x-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                    <i class="fas fa-pills text-gray-400"></i>
                    <span class="truncate">${product.name || 'Unbekanntes Produkt'}</span>
                  </div>
                `).join('')}
                ${productCount > 3 ? `
                  <div class="text-xs text-gray-500 px-2">... und ${productCount - 3} weitere</div>
                ` : ''}
              </div>
            </div>
          ` : `
            <div class="mb-4 text-center py-4 bg-gray-50 rounded-lg border">
              <i class="fas fa-plus-circle text-gray-400 text-2xl mb-2"></i>
              <p class="text-sm text-gray-500">Noch keine Produkte</p>
              <p class="text-xs text-gray-400">Fügen Sie Produkte zu diesem Stack hinzu</p>
            </div>
          `}
          
          <!-- Action Buttons -->
          <div class="flex space-x-2">
            <button onclick="authStacks.viewStackDetails(${stack.id})" class="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 text-sm">
              <i class="fas fa-eye mr-2"></i>Details
            </button>
            <button onclick="authStacks.manageProducts(${stack.id})" class="flex-1 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 text-sm">
              <i class="fas fa-cog mr-2"></i>Verwalten
            </button>
          </div>
        </div>
      </div>
    `
  }

  clearSearch() {
    this.searchTerm = ''
    
    // Reset search input
    const searchInput = document.getElementById('search-stacks')
    if (searchInput) searchInput.value = ''
    
    this.applyFilters()
  }

  // Stack CRUD operations
  showCreateStackModal() {
    console.log('[Auth Stacks] Showing create stack modal...')
    // TODO: Implement modal similar to demo but with API calls
    this.showNotification('Stack erstellen wird implementiert...', 'info')
  }

  showStackTemplates() {
    console.log('[Auth Stacks] Showing stack templates...')
    // TODO: Implement stack templates functionality
    this.showNotification('Stack-Vorlagen werden implementiert...', 'info')
  }

  async editStack(stackId) {
    console.log('[Auth Stacks] Edit stack:', stackId)
    // TODO: Implement edit modal with API integration
    this.showNotification('Stack bearbeiten wird implementiert...', 'info')
  }

  async duplicateStack(stackId) {
    try {
      const originalStack = this.stacks.find(s => s.id === stackId)
      if (!originalStack) return
      
      // TODO: Implement API call to duplicate stack
      console.log('[Auth Stacks] Duplicate stack:', stackId)
      this.showNotification('Stack duplizieren wird implementiert...', 'info')
      
    } catch (error) {
      console.error('[Auth Stacks] Error duplicating stack:', error)
      this.showNotification('Fehler beim Duplizieren des Stacks', 'error')
    }
  }

  async deleteStack(stackId) {
    const stack = this.stacks.find(s => s.id === stackId)
    const stackName = stack ? stack.name : 'diesen Stack'
    
    if (!confirm(`Möchten Sie "${stackName}" wirklich löschen?`)) return
    
    try {
      const response = await axios.delete(`/api/protected/stacks/${stackId}`)
      
      if (response.data && response.data.success) {
        this.showNotification('Stack erfolgreich gelöscht!', 'success')
        
        // Remove from local array and re-render
        this.stacks = this.stacks.filter(s => s.id !== stackId)
        this.applyFilters()
      }
    } catch (error) {
      console.error('[Auth Stacks] Error deleting stack:', error)
      this.showNotification('Fehler beim Löschen des Stacks', 'error')
    }
  }

  viewStackDetails(stackId) {
    console.log('[Auth Stacks] View stack details:', stackId)
    // TODO: Implement stack details modal
    this.showNotification('Stack-Details werden implementiert...', 'info')
  }

  manageProducts(stackId) {
    console.log('[Auth Stacks] Manage products for stack:', stackId)
    // Navigate to dashboard with this stack selected
    window.location.href = `/dashboard?stack=${stackId}`
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
function initAuthenticatedStacks() {
  console.log('[Auth Stacks] Initializing stacks page...')
  
  if (window.authStacks) {
    console.log('[Auth Stacks] Already initialized, skipping...')
    return
  }
  
  try {
    window.authStacks = new AuthenticatedStacksApp()
    console.log('[Auth Stacks] Successfully initialized!')
  } catch (error) {
    console.error('[Auth Stacks] Initialization error:', error)
  }
}

// Multiple initialization strategies
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthenticatedStacks)
} else {
  initAuthenticatedStacks()
}

// Fallback initializations
setTimeout(initAuthenticatedStacks, 500)
setTimeout(initAuthenticatedStacks, 2000)

console.log('[Auth Stacks] Script loaded')