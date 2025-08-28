// Sofort funktionierende Demo ohne komplexe Klassen
console.log('[Demo Fix] Lade einfache Demo...')

// Demo-Daten
const demoProducts = [
  {
    id: 1,
    name: 'Vitamin D3 4000 IU',
    brand: 'Sunday Natural',
    form: 'Kapsel',
    price: '19.90',
    monthly: '11.94',
    nutrient: 'Vitamin D3',
    amount: '100µg'
  },
  {
    id: 2,
    name: 'B12 Methylcobalamin',
    brand: 'InnoNature',
    form: 'Tropfen',
    price: '24.90',
    monthly: '6.23',
    nutrient: 'Vitamin B12',
    amount: '200µg'
  },
  {
    id: 3,
    name: 'Magnesium Glycinat',
    brand: 'Biomenta',
    form: 'Kapsel',
    price: '16.90',
    monthly: '8.45',
    nutrient: 'Magnesium',
    amount: '400mg'
  },
  {
    id: 4,
    name: 'Omega-3 Algenöl',
    brand: 'Norsan',
    form: 'Öl',
    price: '29.90',
    monthly: '8.97',
    nutrient: 'EPA',
    amount: '1000mg'
  },
  {
    id: 5,
    name: 'Zink Bisglycinat',
    brand: 'Pure Encapsulations',
    form: 'Kapsel',
    price: '22.50',
    monthly: '11.25',
    nutrient: 'Zink',
    amount: '15mg'
  },
  {
    id: 6,
    name: 'Vitamin C Ester',
    brand: 'Life Extension',
    form: 'Kapsel',
    price: '18.90',
    monthly: '6.30',
    nutrient: 'Vitamin C',
    amount: '1000mg'
  }
]

function renderProducts() {
  const grid = document.getElementById('demo-products-grid')
  if (!grid) {
    console.error('[Demo Fix] Grid nicht gefunden!')
    return
  }
  
  const html = demoProducts.map(product => `
    <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      <div class="p-4">
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-gray-900 text-sm sm:text-base flex-1 pr-2">${product.name}</h3>
          <div class="flex space-x-1">
            <button onclick="showProductDetails(${product.id})" class="p-1 text-gray-400 hover:text-blue-600 touch-target" title="Details">
              <i class="fas fa-eye text-sm"></i>
            </button>
            <button onclick="editProduct(${product.id})" class="p-1 text-gray-400 hover:text-blue-600 touch-target" title="Bearbeiten">
              <i class="fas fa-edit text-sm"></i>
            </button>
            <button onclick="deleteProduct(${product.id})" class="p-1 text-gray-400 hover:text-red-600 touch-target" title="Löschen">
              <i class="fas fa-trash text-sm"></i>
            </button>
          </div>
        </div>
        
        <p class="text-xs sm:text-sm text-gray-600 mb-3">${product.brand} • ${product.form}</p>
        
        <div class="bg-blue-50 rounded-lg p-3 mb-3">
          <div class="text-sm font-medium text-blue-800 mb-1">🧬 ${product.nutrient}</div>
          <div class="text-xs text-blue-600">${product.amount} pro ${product.form}</div>
        </div>
        
        <div class="bg-gray-50 rounded-lg p-3 mb-3">
          <div class="grid grid-cols-2 gap-2 text-xs sm:text-sm">
            <div>
              <span class="text-gray-500">Kaufpreis:</span>
              <div class="font-semibold text-gray-900">€${product.price}</div>
            </div>
            <div>
              <span class="text-gray-500">Pro Monat:</span>
              <div class="font-semibold text-green-600">€${product.monthly}</div>
            </div>
          </div>
        </div>
        
        <div class="flex justify-between items-center">
          <button onclick="showProductDetails(${product.id})" class="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
            <i class="fas fa-eye mr-1"></i>Details
          </button>
          <div class="text-xs text-gray-500">
            <i class="fas fa-flask mr-1"></i>Nährstoffbasiert
          </div>
        </div>
      </div>
    </div>
  `).join('')
  
  grid.innerHTML = html
  console.log('[Demo Fix] Produkte gerendert:', demoProducts.length)
}

// Einfache Modal-Funktionen
function showProductDetails(id) {
  const product = demoProducts.find(p => p.id === id)
  alert(`📋 ${product.name} - Details\\n\\n🏢 Marke: ${product.brand}\\n💊 Form: ${product.form}\\n🧬 Nährstoff: ${product.nutrient} (${product.amount})\\n💰 Preis: €${product.price}\\n📅 Monatlich: €${product.monthly}\\n\\nIn der Vollversion: Tab-basierte Details mit Nährstoff-Analyse, Dosierungsempfehlungen und Kostenaufschlüsselung.`)
}

function editProduct(id) {
  const product = demoProducts.find(p => p.id === id)
  alert(`✏️ ${product.name} bearbeiten\\n\\nIn der Vollversion können Sie hier:\\n\\n🧬 Nährstoff zuordnen (${product.nutrient})\\n💊 Gehalt pro Einheit ändern (${product.amount})\\n💰 Preise anpassen\\n📊 Live-Berechnungen sehen\\n\\nKostenlos registrieren für alle Funktionen!`)
}

function deleteProduct(id) {
  const product = demoProducts.find(p => p.id === id)
  if (confirm(`Möchten Sie "${product.name}" wirklich löschen?`)) {
    alert(`🗑️ ${product.name} gelöscht!\\n\\n(In der Demo werden keine Änderungen gespeichert)`)
  }
}

function showAddProductModal() {
  alert(`➕ Produkt hinzufügen\\n\\nIn der Vollversion können Sie hier:\\n\\n1️⃣ Wirkstoff auswählen (Vitamin D3, Magnesium, etc.)\\n2️⃣ Produktinformationen eingeben\\n3️⃣ Nährstoffgehalt pro Einheit definieren\\n4️⃣ Automatische Berechnung sehen\\n\\n🧮 Live-Berechnungen:\\n- Tägliche Nährstoffaufnahme\\n- DGE-Abdeckung\\n- Packungsdauer\\n- Kosten pro Monat\\n\\nJetzt kostenlos registrieren!`)
}

function showNutrientStackModal() {
  alert(`🧬 Nährstoff-Stack erstellen\\n\\nIntelligenter Workflow:\\n\\n1️⃣ Nährstoff wählen (z.B. Magnesium)\\n2️⃣ Gewünschte Menge (DGE: 375mg, Studien: 400mg)\\n3️⃣ Automatische Produktauswahl\\n4️⃣ Dosierungsberechnung\\n\\n💡 Beispiel:\\nMagnesium 1200mg gewünscht\\n+ Produkt mit 760mg/Kapsel\\n= 2 Kapseln täglich\\n\\nVollversion für komplette Funktionen!`)
}

// Button Event-Listener
function setupButtons() {
  // Alle Add-Product Buttons
  const addButtons = document.querySelectorAll('[id*="add-product"]')
  addButtons.forEach(btn => {
    btn.onclick = showAddProductModal
  })
  
  // Alle Create-Stack Buttons  
  const stackButtons = document.querySelectorAll('[id*="create-stack"]')
  stackButtons.forEach(btn => {
    btn.onclick = showNutrientStackModal
  })
  
  console.log('[Demo Fix] Buttons konfiguriert:', addButtons.length + stackButtons.length)
}

// Initialisierung
function initDemo() {
  console.log('[Demo Fix] Initialisiere Demo...')
  renderProducts()
  setupButtons()
  console.log('[Demo Fix] Demo bereit!')
}

// Mehrfache Initialisierung sicherstellen
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDemo)
} else {
  initDemo()
}

// Zusätzlicher Fallback
setTimeout(initDemo, 1000)