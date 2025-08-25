// Supplement Stack - Frontend JavaScript

class SupplementStack {
  constructor() {
    this.currentUser = null;
    this.cart = [];
    this.init();
  }

  async init() {
    await this.checkAuth();
    this.bindEvents();
    this.updateUI();
  }

  // Authentication
  async checkAuth() {
    try {
      const response = await axios.get('/api/auth/me');
      if (response.data.success) {
        this.currentUser = response.data.data.user;
      }
    } catch (error) {
      // User not authenticated
      this.currentUser = null;
    }
  }

  async login(email, password) {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      if (response.data.success) {
        this.currentUser = response.data.data.user;
        this.updateUI();
        this.showNotification('Erfolgreich angemeldet!', 'success');
        this.hideModal('loginModal');
        return true;
      }
    } catch (error) {
      this.showNotification(error.response?.data?.error || 'Anmeldung fehlgeschlagen', 'error');
      return false;
    }
  }

  async register(userData) {
    try {
      const response = await axios.post('/api/auth/register', userData);
      if (response.data.success) {
        this.showNotification('Registrierung erfolgreich! Sie sind jetzt angemeldet.', 'success');
        this.hideModal('registerModal');
        await this.checkAuth();
        this.updateUI();
        return true;
      }
    } catch (error) {
      this.showNotification(error.response?.data?.error || 'Registrierung fehlgeschlagen', 'error');
      return false;
    }
  }

  async logout() {
    try {
      await axios.post('/api/auth/logout');
      this.currentUser = null;
      this.updateUI();
      this.showNotification('Erfolgreich abgemeldet!', 'success');
    } catch (error) {
      this.showNotification('Fehler beim Abmelden', 'error');
    }
  }

  // UI Management
  updateUI() {
    if (this.currentUser) {
      this.showAuthenticatedUI();
      this.loadUserData();
    } else {
      this.showUnauthenticatedUI();
    }
  }

  showAuthenticatedUI() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (registerBtn) registerBtn.style.display = 'none';

    // Add user menu
    const nav = document.querySelector('nav .flex');
    if (nav && !document.getElementById('userMenu')) {
      const userMenu = this.createUserMenu();
      nav.appendChild(userMenu);
    }

    // Load dashboard
    this.loadDashboard();
  }

  showUnauthenticatedUI() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    if (loginBtn) loginBtn.style.display = 'block';
    if (registerBtn) registerBtn.style.display = 'block';

    // Remove user menu
    const userMenu = document.getElementById('userMenu');
    if (userMenu) userMenu.remove();

    // Show landing page
    this.showLandingPage();
  }

  createUserMenu() {
    const userMenu = document.createElement('div');
    userMenu.id = 'userMenu';
    userMenu.className = 'flex items-center space-x-4';
    userMenu.innerHTML = `
      <span class="text-gray-700">Hallo, ${this.currentUser.name || this.currentUser.email}!</span>
      <button id="dashboardBtn" class="text-gray-600 hover:text-primary">Dashboard</button>
      <button id="logoutBtn" class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Abmelden</button>
    `;
    return userMenu;
  }

  // Dashboard
  async loadDashboard() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p class="text-gray-600">Verwalte deine Supplements und Stacks</p>
        </div>

        <!-- Quick Actions -->
        <div class="grid md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex items-center mb-4">
              <i class="fas fa-plus-circle text-primary text-2xl mr-3"></i>
              <h3 class="text-lg font-semibold">Produkt hinzufügen</h3>
            </div>
            <button id="addProductBtn" class="btn-primary text-white px-4 py-2 rounded w-full">
              Neues Produkt
            </button>
          </div>
          
          <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex items-center mb-4">
              <i class="fas fa-layer-group text-primary text-2xl mr-3"></i>
              <h3 class="text-lg font-semibold">Stack erstellen</h3>
            </div>
            <button id="createStackBtn" class="btn-primary text-white px-4 py-2 rounded w-full">
              Neuer Stack
            </button>
          </div>
          
          <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex items-center mb-4">
              <i class="fas fa-heart text-primary text-2xl mr-3"></i>
              <h3 class="text-lg font-semibold">Wunschliste</h3>
            </div>
            <button id="viewWishlistBtn" class="bg-secondary text-white px-4 py-2 rounded w-full">
              Wunschliste anzeigen
            </button>
          </div>
        </div>

        <!-- Content Tabs -->
        <div class="bg-white rounded-lg shadow-md">
          <div class="border-b">
            <nav class="flex space-x-8 px-6">
              <button class="tab-btn active py-4 border-b-2 border-primary text-primary font-medium" data-tab="products">
                Meine Produkte
              </button>
              <button class="tab-btn py-4 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="stacks">
                Meine Stacks
              </button>
              <button class="tab-btn py-4 border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="public">
                Öffentlich
              </button>
            </nav>
          </div>
          
          <div class="p-6">
            <div id="productsTab" class="tab-content active">
              <div id="productsList" class="loading">
                <div class="flex justify-center">
                  <div class="loading-spinner"></div>
                </div>
              </div>
            </div>
            
            <div id="stacksTab" class="tab-content hidden">
              <div id="stacksList" class="loading">
                <div class="flex justify-center">
                  <div class="loading-spinner"></div>
                </div>
              </div>
            </div>
            
            <div id="publicTab" class="tab-content hidden">
              <div id="publicContent">
                <p class="text-gray-600">Öffentliche Produkte und Stacks anderer Nutzer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindDashboardEvents();
    this.loadProducts();
  }

  bindDashboardEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Action buttons
    document.getElementById('addProductBtn')?.addEventListener('click', () => this.showAddProductModal());
    document.getElementById('createStackBtn')?.addEventListener('click', () => this.showCreateStackModal());
    document.getElementById('viewWishlistBtn')?.addEventListener('click', () => this.showWishlist());
  }

  switchTab(tabName) {
    // Update active tab button
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active', 'border-primary', 'text-primary');
      btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active', 'border-primary', 'text-primary');

    // Show/hide content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
      content.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${tabName}Tab`);
    activeTab.classList.remove('hidden');
    activeTab.classList.add('active');

    // Load content if needed
    if (tabName === 'stacks' && !activeTab.dataset.loaded) {
      this.loadStacks();
      activeTab.dataset.loaded = 'true';
    } else if (tabName === 'public' && !activeTab.dataset.loaded) {
      this.loadPublicContent();
      activeTab.dataset.loaded = 'true';
    }
  }

  // Products
  async loadProducts() {
    try {
      const response = await axios.get('/api/products');
      if (response.data.success) {
        this.renderProducts(response.data.data);
      }
    } catch (error) {
      this.showNotification('Fehler beim Laden der Produkte', 'error');
    }
  }

  renderProducts(products) {
    const container = document.getElementById('productsList');
    
    if (products.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <i class="fas fa-box-open text-gray-400 text-4xl mb-4"></i>
          <p class="text-gray-600">Noch keine Produkte vorhanden</p>
          <button class="btn-primary text-white px-4 py-2 rounded mt-4" onclick="app.showAddProductModal()">
            Erstes Produkt hinzufügen
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${products.map(product => this.renderProductCard(product)).join('')}
      </div>
    `;
  }

  renderProductCard(product) {
    const nutrients = product.nutrients ? JSON.parse(product.nutrients) : [];
    
    return `
      <div class="product-card bg-white border rounded-lg p-4 hover:shadow-md">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="font-semibold text-lg">${product.name}</h3>
            ${product.brand ? `<p class="text-gray-600 text-sm">${product.brand}</p>` : ''}
          </div>
          <div class="flex space-x-2">
            <button onclick="app.editProduct(${product.id})" class="text-blue-600 hover:text-blue-800">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="app.addToWishlist(${product.id})" class="text-red-600 hover:text-red-800">
              <i class="fas fa-heart"></i>
            </button>
          </div>
        </div>
        
        <div class="mb-3">
          <div class="flex flex-wrap gap-1 mb-2">
            ${nutrients.map(n => `<span class="nutrient-badge">${n.name}</span>`).join('')}
          </div>
        </div>
        
        ${product.price_per_package ? `
          <div class="text-sm text-gray-600 mb-3">
            <p>€${product.price_per_package} (${product.servings_per_package} Portionen)</p>
          </div>
        ` : ''}
        
        <div class="flex space-x-2">
          <button onclick="app.addToCart([${product.id}])" class="flex-1 bg-primary text-white px-3 py-2 rounded text-sm hover:bg-secondary">
            <i class="fas fa-shopping-cart mr-1"></i> Kaufen
          </button>
          <button onclick="app.viewProduct(${product.id})" class="flex-1 border border-primary text-primary px-3 py-2 rounded text-sm hover:bg-primary hover:text-white">
            Details
          </button>
        </div>
      </div>
    `;
  }

  // Event Bindings
  bindEvents() {
    // Login/Register buttons
    document.getElementById('loginBtn')?.addEventListener('click', () => this.showLoginModal());
    document.getElementById('registerBtn')?.addEventListener('click', () => this.showRegisterModal());
    document.getElementById('getStartedBtn')?.addEventListener('click', () => {
      if (this.currentUser) {
        this.loadDashboard();
      } else {
        this.showRegisterModal();
      }
    });

    // Dynamic event binding for logout (added after login)
    document.addEventListener('click', (e) => {
      if (e.target.id === 'logoutBtn') {
        this.logout();
      }
    });
  }

  // Modals
  showLoginModal() {
    this.showModal('loginModal', `
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-2xl font-bold mb-4">Anmelden</h2>
        <form id="loginForm">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">E-Mail</label>
            <input type="email" id="loginEmail" class="form-input w-full px-3 py-2 border rounded" required>
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium mb-2">Passwort</label>
            <input type="password" id="loginPassword" class="form-input w-full px-3 py-2 border rounded" required>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" onclick="app.hideModal('loginModal')" class="px-4 py-2 border rounded hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" class="btn-primary text-white px-4 py-2 rounded">
              Anmelden
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      await this.login(email, password);
    });
  }

  showRegisterModal() {
    this.showModal('registerModal', `
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-2xl font-bold mb-4">Registrieren</h2>
        <form id="registerForm">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">E-Mail *</label>
            <input type="email" id="regEmail" class="form-input w-full px-3 py-2 border rounded" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Passwort *</label>
            <input type="password" id="regPassword" class="form-input w-full px-3 py-2 border rounded" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Name (optional)</label>
            <input type="text" id="regName" class="form-input w-full px-3 py-2 border rounded">
          </div>
          <div class="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block text-sm font-medium mb-2">Alter</label>
              <input type="number" id="regAge" class="form-input w-full px-3 py-2 border rounded" min="1" max="120">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Gewicht (kg)</label>
              <input type="number" id="regWeight" class="form-input w-full px-3 py-2 border rounded" min="1" max="300" step="0.1">
            </div>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">Geschlecht</label>
            <select id="regGender" class="form-input w-full px-3 py-2 border rounded">
              <option value="">Bitte wählen</option>
              <option value="male">Männlich</option>
              <option value="female">Weiblich</option>
              <option value="other">Andere</option>
            </select>
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium mb-2">Ernährungsweise</label>
            <select id="regDiet" class="form-input w-full px-3 py-2 border rounded">
              <option value="">Bitte wählen</option>
              <option value="omnivore">Alles</option>
              <option value="vegetarian">Vegetarisch</option>
              <option value="vegan">Vegan</option>
            </select>
          </div>
          <div class="flex justify-end space-x-3">
            <button type="button" onclick="app.hideModal('registerModal')" class="px-4 py-2 border rounded hover:bg-gray-50">
              Abbrechen
            </button>
            <button type="submit" class="btn-primary text-white px-4 py-2 rounded">
              Registrieren
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const userData = {
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        name: document.getElementById('regName').value || null,
        age: document.getElementById('regAge').value ? parseInt(document.getElementById('regAge').value) : null,
        weight: document.getElementById('regWeight').value ? parseFloat(document.getElementById('regWeight').value) : null,
        gender: document.getElementById('regGender').value || null,
        diet_type: document.getElementById('regDiet').value || null
      };
      
      await this.register(userData);
    });
  }

  showModal(id, content) {
    // Remove existing modal
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 modal-backdrop flex items-center justify-center z-50 fade-in';
    modal.innerHTML = `<div class="modal-content">${content}</div>`;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideModal(id);
      }
    });
  }

  hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.remove();
    }
  }

  // Notifications
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 fade-in ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    notification.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} mr-2"></i>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  showLandingPage() {
    // Landing page is already in the HTML, just ensure it's visible
    const app = document.getElementById('app');
    app.innerHTML = '';
  }

  // Placeholder methods for features to be implemented
  async loadUserData() {
    // Load user-specific data like products, stacks, wishlist
  }

  async loadStacks() {
    // Implement stack loading
    document.getElementById('stacksList').innerHTML = '<p class="text-gray-600">Stacks werden geladen...</p>';
  }

  async loadPublicContent() {
    // Implement public content loading
    document.getElementById('publicContent').innerHTML = '<p class="text-gray-600">Öffentliche Inhalte werden geladen...</p>';
  }

  showAddProductModal() {
    this.showNotification('Produkt hinzufügen - Wird implementiert', 'info');
  }

  showCreateStackModal() {
    this.showNotification('Stack erstellen - Wird implementiert', 'info');
  }

  showWishlist() {
    this.showNotification('Wunschliste - Wird implementiert', 'info');
  }

  editProduct(id) {
    this.showNotification(`Produkt ${id} bearbeiten - Wird implementiert`, 'info');
  }

  viewProduct(id) {
    this.showNotification(`Produkt ${id} anzeigen - Wird implementiert`, 'info');
  }

  addToWishlist(id) {
    this.showNotification(`Produkt ${id} zur Wunschliste hinzugefügt`, 'success');
  }

  addToCart(productIds) {
    this.cart = [...this.cart, ...productIds];
    this.showNotification('Zum Warenkorb hinzugefügt', 'success');
  }
}

// Initialize app
const app = new SupplementStack();

// Make app available globally for onclick handlers
window.app = app;