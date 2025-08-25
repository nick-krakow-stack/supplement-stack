/**
 * Dashboard JavaScript für Supplement Stack
 * Cloudflare Pages kompatibel
 */

class SupplementDashboard {
    constructor() {
        this.products = [];
        this.stacks = [];
        this.init();
    }

    async init() {
        await this.loadProducts();
        await this.loadStacks();
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            const data = await response.json();
            
            if (data.success) {
                this.products = data.data || [];
                this.renderProducts();
            } else {
                this.renderError('productsContainer', 'Fehler beim Laden der Produkte');
            }
        } catch (error) {
            console.error('Error loading products:', error);
            this.renderError('productsContainer', 'Verbindungsfehler');
        }
    }

    async loadStacks() {
        try {
            const response = await fetch('/api/stacks');
            const data = await response.json();
            
            if (data.success) {
                this.stacks = data.data || [];
                this.renderStacks();
            } else {
                this.renderError('stacksContainer', 'Fehler beim Laden der Stacks');
            }
        } catch (error) {
            console.error('Error loading stacks:', error);
            this.renderError('stacksContainer', 'Verbindungsfehler');
        }
    }

    renderProducts() {
        const container = document.getElementById('productsContainer');
        
        if (this.products.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-pills text-4xl mb-4"></i>
                    <p>Noch keine Produkte vorhanden</p>
                    <button onclick="showProductModal()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Erstes Produkt hinzufügen
                    </button>
                </div>
            `;
            return;
        }

        const html = `
            <div class="space-y-3">
                ${this.products.map(product => `
                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                            <h4 class="font-semibold">${this.escapeHtml(product.name)}</h4>
                            <p class="text-sm text-gray-600">${this.escapeHtml(product.brand)} • ${product.serving_size}</p>
                            <p class="text-sm text-blue-600">€${product.cost_per_serving}/Portion</p>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="editProduct(${product.id})" class="text-blue-600 hover:text-blue-800">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-800">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = html;
    }

    renderStacks() {
        const container = document.getElementById('stacksContainer');
        
        if (this.stacks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-layer-group text-4xl mb-4"></i>
                    <p>Noch keine Stacks erstellt</p>
                    <button onclick="showStackModal()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Ersten Stack erstellen
                    </button>
                </div>
            `;
            return;
        }

        const html = `
            <div class="space-y-3">
                ${this.stacks.map(stack => `
                    <div class="p-3 bg-gray-50 rounded">
                        <div class="flex justify-between items-start">
                            <div>
                                <h4 class="font-semibold">${this.escapeHtml(stack.name)}</h4>
                                ${stack.description ? `<p class="text-sm text-gray-600 mt-1">${this.escapeHtml(stack.description)}</p>` : ''}
                                <div class="flex items-center space-x-4 mt-2 text-sm">
                                    <span class="text-blue-600">${stack.supplement_count || 0} Supplemente</span>
                                    ${stack.daily_cost ? `<span class="text-green-600">€${parseFloat(stack.daily_cost).toFixed(2)}/Tag</span>` : ''}
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                <button onclick="viewStack(${stack.id})" class="text-blue-600 hover:text-blue-800">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button onclick="editStack(${stack.id})" class="text-green-600 hover:text-green-800">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteStack(${stack.id})" class="text-red-600 hover:text-red-800">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = html;
    }

    renderError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>${message}</p>
                <button onclick="window.location.reload()" class="mt-2 text-blue-600 hover:text-blue-800">
                    Neu laden
                </button>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async createProduct(productData) {
        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadProducts();
                return true;
            } else {
                alert('Fehler beim Erstellen des Produkts: ' + data.error);
                return false;
            }
        } catch (error) {
            console.error('Error creating product:', error);
            alert('Verbindungsfehler beim Erstellen des Produkts');
            return false;
        }
    }

    async createStack(stackData) {
        try {
            const response = await fetch('/api/stacks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(stackData)
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadStacks();
                return true;
            } else {
                alert('Fehler beim Erstellen des Stacks: ' + data.error);
                return false;
            }
        } catch (error) {
            console.error('Error creating stack:', error);
            alert('Verbindungsfehler beim Erstellen des Stacks');
            return false;
        }
    }

    async deleteProduct(id) {
        if (!confirm('Produkt wirklich löschen?')) return;

        try {
            const response = await fetch(`/api/products/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadProducts();
            } else {
                alert('Fehler beim Löschen: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Verbindungsfehler beim Löschen');
        }
    }
}

// Global instance
let dashboard;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new SupplementDashboard();
});

// Global functions for UI interactions
function showProductModal() {
    document.getElementById('productModal').classList.remove('hidden');
}

function hideProductModal() {
    document.getElementById('productModal').classList.add('hidden');
    // Reset form
    document.getElementById('productName').value = '';
    document.getElementById('productBrand').value = '';
    document.getElementById('productServingSize').value = '';
    document.getElementById('productCostPerServing').value = '';
    document.getElementById('productServingsPerContainer').value = '';
    document.getElementById('productCategory').value = '';
}

function showStackModal() {
    document.getElementById('stackModal').classList.remove('hidden');
}

function hideStackModal() {
    document.getElementById('stackModal').classList.add('hidden');
    // Reset form
    document.getElementById('stackName').value = '';
    document.getElementById('stackDescription').value = '';
    document.getElementById('stackGoal').value = '';
}

async function handleProductSubmit(event) {
    event.preventDefault();
    
    const productData = {
        name: document.getElementById('productName').value,
        brand: document.getElementById('productBrand').value,
        serving_size: document.getElementById('productServingSize').value,
        cost_per_serving: parseFloat(document.getElementById('productCostPerServing').value),
        servings_per_container: parseInt(document.getElementById('productServingsPerContainer').value),
        category: document.getElementById('productCategory').value || null
    };
    
    const success = await dashboard.createProduct(productData);
    if (success) {
        hideProductModal();
    }
}

async function handleStackSubmit(event) {
    event.preventDefault();
    
    const stackData = {
        name: document.getElementById('stackName').value,
        description: document.getElementById('stackDescription').value || null,
        goal: document.getElementById('stackGoal').value || null
    };
    
    const success = await dashboard.createStack(stackData);
    if (success) {
        hideStackModal();
    }
}

function editProduct(id) {
    // TODO: Implement edit functionality
    alert('Edit-Funktionalität folgt in der nächsten Version!');
}

function deleteProduct(id) {
    dashboard.deleteProduct(id);
}

function editStack(id) {
    // TODO: Implement edit functionality
    alert('Stack-Bearbeitung folgt in der nächsten Version!');
}

function viewStack(id) {
    // TODO: Implement stack detail view
    alert('Stack-Detailansicht folgt in der nächsten Version!');
}

function deleteStack(id) {
    // TODO: Implement delete functionality
    alert('Stack-Löschen folgt in der nächsten Version!');
}

async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}