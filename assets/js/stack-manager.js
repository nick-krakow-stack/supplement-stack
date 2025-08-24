/**
 * Supplement Stack Manager JavaScript
 * AJAX-basierte Kommunikation mit PHP Backend
 * All-Inkl Webserver kompatibel
 * 
 * @author Nick's Supplement Stack System
 * @version 1.0
 * @created 2025-08-24
 */

class SupplementStackManager {
    constructor() {
        this.apiBase = '/api';
        this.currentUser = null;
        this.csrfToken = null;
        
        // Event Listeners initialisieren
        this.initializeEventListeners();
        this.loadCSRFToken();
        
        // Loading-Overlay erstellen
        this.createLoadingOverlay();
    }

    /**
     * CSRF Token laden
     */
    async loadCSRFToken() {
        try {
            const response = await fetch(`${this.apiBase}/csrf-token.php`);
            const data = await response.json();
            if (data.success) {
                this.csrfToken = data.token;
            }
        } catch (error) {
            console.error('Error loading CSRF token:', error);
        }
    }

    /**
     * Event Listeners initialisieren
     */
    initializeEventListeners() {
        // Produkt-Formulare
        document.addEventListener('submit', (e) => {
            if (e.target.matches('#productForm')) {
                e.preventDefault();
                this.handleProductSubmit(e.target);
            }
        });

        // Stack-Formulare
        document.addEventListener('submit', (e) => {
            if (e.target.matches('#stackForm')) {
                e.preventDefault();
                this.handleStackSubmit(e.target);
            }
        });

        // Delete-Buttons
        document.addEventListener('click', (e) => {
            if (e.target.matches('.delete-product-btn')) {
                e.preventDefault();
                const productId = e.target.dataset.productId;
                this.deleteProduct(productId);
            }

            if (e.target.matches('.delete-stack-btn')) {
                e.preventDefault();
                const stackId = e.target.dataset.stackId;
                this.deleteStack(stackId);
            }

            if (e.target.matches('.edit-product-btn')) {
                e.preventDefault();
                const productId = e.target.dataset.productId;
                this.loadProductForEdit(productId);
            }
        });

        // Stack Item Management
        document.addEventListener('change', (e) => {
            if (e.target.matches('.stack-item-checkbox')) {
                const stackId = e.target.dataset.stackId;
                const productId = e.target.dataset.productId;
                const isChecked = e.target.checked;
                
                if (isChecked) {
                    this.addProductToStack(stackId, productId);
                } else {
                    this.removeProductFromStack(stackId, productId);
                }
            }

            if (e.target.matches('.dosage-input')) {
                const stackItemId = e.target.dataset.stackItemId;
                const dosage = e.target.value;
                this.updateStackItemDosage(stackItemId, dosage);
            }
        });

        // Cost Calculator
        document.addEventListener('change', (e) => {
            if (e.target.matches('.cost-checkbox')) {
                this.updateCostCalculation();
            }
        });

        // Search and Filter
        document.addEventListener('input', (e) => {
            if (e.target.matches('#productSearch')) {
                this.searchProducts(e.target.value);
            }

            if (e.target.matches('#stackSearch')) {
                this.searchStacks(e.target.value);
            }
        });
    }

    /**
     * Loading Overlay erstellen
     */
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center hidden';
        overlay.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-lg text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-gray-700">Laden...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Loading anzeigen/verstecken
     */
    showLoading() {
        document.getElementById('loadingOverlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }

    /**
     * HTTP Request Helper
     */
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.csrfToken
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };
        
        if (mergedOptions.body && typeof mergedOptions.body === 'object') {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }

        try {
            const response = await fetch(url, mergedOptions);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('Request error:', error);
            this.showError(error.message);
            throw error;
        }
    }

    /**
     * Produkt-Formular verarbeiten
     */
    async handleProductSubmit(form) {
        this.showLoading();
        
        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Ingredients als Array verarbeiten
            const ingredients = [];
            const ingredientRows = form.querySelectorAll('.ingredient-row');
            
            ingredientRows.forEach(row => {
                const ingredientId = row.querySelector('select[name="ingredients[]"]').value;
                const amount = row.querySelector('input[name="amounts[]"]').value;
                const unit = row.querySelector('input[name="units[]"]').value;
                
                if (ingredientId && amount) {
                    ingredients.push({
                        ingredient_id: ingredientId,
                        amount: parseFloat(amount),
                        unit: unit || 'mg'
                    });
                }
            });
            
            data.ingredients = ingredients;
            
            const url = data.product_id ? 
                `${this.apiBase}/products.php?id=${data.product_id}` : 
                `${this.apiBase}/products.php`;
                
            const method = data.product_id ? 'PUT' : 'POST';
            
            const result = await this.makeRequest(url, {
                method: method,
                body: data
            });
            
            this.showSuccess(data.product_id ? 'Produkt aktualisiert!' : 'Produkt erstellt!');
            
            // Form reset und UI update
            form.reset();
            this.loadProducts();
            
            // Modal schließen falls vorhanden
            const modal = form.closest('.modal');
            if (modal) {
                this.closeModal(modal);
            }
            
        } catch (error) {
            console.error('Error submitting product:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Stack-Formular verarbeiten
     */
    async handleStackSubmit(form) {
        this.showLoading();
        
        try {
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            const url = data.stack_id ? 
                `${this.apiBase}/stacks.php?id=${data.stack_id}` : 
                `${this.apiBase}/stacks.php`;
                
            const method = data.stack_id ? 'PUT' : 'POST';
            
            const result = await this.makeRequest(url, {
                method: method,
                body: data
            });
            
            this.showSuccess(data.stack_id ? 'Stack aktualisiert!' : 'Stack erstellt!');
            
            // Form reset und UI update
            form.reset();
            this.loadStacks();
            
        } catch (error) {
            console.error('Error submitting stack:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Produkt löschen
     */
    async deleteProduct(productId) {
        if (!confirm('Möchten Sie dieses Produkt wirklich löschen?')) {
            return;
        }

        this.showLoading();
        
        try {
            await this.makeRequest(`${this.apiBase}/products.php?id=${productId}`, {
                method: 'DELETE'
            });
            
            this.showSuccess('Produkt gelöscht!');
            this.loadProducts();
            
        } catch (error) {
            console.error('Error deleting product:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Stack löschen
     */
    async deleteStack(stackId) {
        if (!confirm('Möchten Sie diesen Stack wirklich löschen?')) {
            return;
        }

        this.showLoading();
        
        try {
            await this.makeRequest(`${this.apiBase}/stacks.php?id=${stackId}`, {
                method: 'DELETE'
            });
            
            this.showSuccess('Stack gelöscht!');
            this.loadStacks();
            
        } catch (error) {
            console.error('Error deleting stack:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Produkt zu Stack hinzufügen
     */
    async addProductToStack(stackId, productId) {
        this.showLoading();
        
        try {
            await this.makeRequest(`${this.apiBase}/stack-items.php`, {
                method: 'POST',
                body: {
                    stack_id: stackId,
                    product_id: productId,
                    dosage: 1.0,
                    frequency_per_day: 1
                }
            });
            
            this.updateCostCalculation();
            
        } catch (error) {
            console.error('Error adding product to stack:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Produkt aus Stack entfernen
     */
    async removeProductFromStack(stackId, productId) {
        this.showLoading();
        
        try {
            await this.makeRequest(`${this.apiBase}/stack-items.php?stack_id=${stackId}&product_id=${productId}`, {
                method: 'DELETE'
            });
            
            this.updateCostCalculation();
            
        } catch (error) {
            console.error('Error removing product from stack:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Stack Item Dosierung aktualisieren
     */
    async updateStackItemDosage(stackItemId, dosage) {
        this.showLoading();
        
        try {
            await this.makeRequest(`${this.apiBase}/stack-items.php?id=${stackItemId}`, {
                method: 'PUT',
                body: {
                    dosage: parseFloat(dosage)
                }
            });
            
            this.updateCostCalculation();
            
        } catch (error) {
            console.error('Error updating dosage:', error);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Kostenberechnung aktualisieren
     */
    async updateCostCalculation() {
        const checkedProducts = document.querySelectorAll('.cost-checkbox:checked');
        const productIds = Array.from(checkedProducts).map(cb => cb.value);
        
        if (productIds.length === 0) {
            this.displayCostCalculation({
                daily_cost: 0,
                weekly_cost: 0,
                monthly_cost: 0,
                yearly_cost: 0,
                products: []
            });
            return;
        }

        try {
            const result = await this.makeRequest(`${this.apiBase}/cost-calculator.php`, {
                method: 'POST',
                body: {
                    product_ids: productIds
                }
            });
            
            this.displayCostCalculation(result.data);
            
        } catch (error) {
            console.error('Error calculating costs:', error);
        }
    }

    /**
     * Kostenberechnung anzeigen
     */
    displayCostCalculation(costs) {
        const container = document.getElementById('costCalculationResult');
        if (!container) return;
        
        container.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">
                    <i class="fas fa-calculator mr-2 text-blue-600"></i>
                    Kostenübersicht
                </h3>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div class="text-center">
                        <p class="text-2xl font-bold text-blue-600">${this.formatPrice(costs.daily_cost)}</p>
                        <p class="text-sm text-gray-500">Täglich</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-green-600">${this.formatPrice(costs.weekly_cost)}</p>
                        <p class="text-sm text-gray-500">Wöchentlich</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-purple-600">${this.formatPrice(costs.monthly_cost)}</p>
                        <p class="text-sm text-gray-500">Monatlich</p>
                    </div>
                    <div class="text-center">
                        <p class="text-2xl font-bold text-red-600">${this.formatPrice(costs.yearly_cost)}</p>
                        <p class="text-sm text-gray-500">Jährlich</p>
                    </div>
                </div>
                
                ${costs.products && costs.products.length > 0 ? `
                    <div class="border-t pt-4">
                        <h4 class="font-medium text-gray-900 mb-2">Aufschlüsselung:</h4>
                        <div class="space-y-2">
                            ${costs.products.map(product => `
                                <div class="flex justify-between items-center text-sm">
                                    <span>${product.name} ${product.brand ? `(${product.brand})` : ''}</span>
                                    <span class="font-medium">${this.formatPrice(product.daily_cost)}/Tag</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Produkte suchen
     */
    async searchProducts(query) {
        try {
            const result = await this.makeRequest(`${this.apiBase}/products.php?search=${encodeURIComponent(query)}`);
            this.displayProducts(result.data);
        } catch (error) {
            console.error('Error searching products:', error);
        }
    }

    /**
     * Stacks suchen
     */
    async searchStacks(query) {
        try {
            const result = await this.makeRequest(`${this.apiBase}/stacks.php?search=${encodeURIComponent(query)}`);
            this.displayStacks(result.data);
        } catch (error) {
            console.error('Error searching stacks:', error);
        }
    }

    /**
     * Produkte laden und anzeigen
     */
    async loadProducts() {
        try {
            const result = await this.makeRequest(`${this.apiBase}/products.php`);
            this.displayProducts(result.data);
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    /**
     * Stacks laden und anzeigen
     */
    async loadStacks() {
        try {
            const result = await this.makeRequest(`${this.apiBase}/stacks.php`);
            this.displayStacks(result.data);
        } catch (error) {
            console.error('Error loading stacks:', error);
        }
    }

    /**
     * Produkt zum Bearbeiten laden
     */
    async loadProductForEdit(productId) {
        try {
            const result = await this.makeRequest(`${this.apiBase}/products.php?id=${productId}`);
            this.populateProductForm(result.data);
        } catch (error) {
            console.error('Error loading product for edit:', error);
        }
    }

    /**
     * Produkt-Formular ausfüllen
     */
    populateProductForm(product) {
        const form = document.getElementById('productForm');
        if (!form) return;
        
        // Basis-Felder ausfüllen
        Object.keys(product).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input && product[key] !== null) {
                input.value = product[key];
            }
        });
        
        // Ingredients laden
        if (product.ingredients && product.ingredients.length > 0) {
            this.populateIngredients(product.ingredients);
        }
    }

    /**
     * Success-Nachricht anzeigen
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * Error-Nachricht anzeigen
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * Notification anzeigen
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
            type === 'success' ? 'bg-green-500 text-white' : 
            type === 'error' ? 'bg-red-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        
        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'} mr-2"></i>
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove nach 5 Sekunden
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Preis formatieren
     */
    formatPrice(price) {
        return new Intl.NumberFormat('de-DE', { 
            style: 'currency', 
            currency: 'EUR' 
        }).format(price || 0);
    }

    /**
     * Modal schließen
     */
    closeModal(modal) {
        modal.classList.add('hidden');
    }

    /**
     * Modal öffnen
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
}

// Stack Manager initialisieren wenn DOM geladen ist
document.addEventListener('DOMContentLoaded', function() {
    window.stackManager = new SupplementStackManager();
});

// Globale Hilfsfunktionen
function addIngredientRow() {
    if (window.stackManager) {
        window.stackManager.addIngredientRow();
    }
}

function removeIngredientRow(button) {
    const row = button.closest('.ingredient-row');
    if (row) {
        row.remove();
    }
}

function updateCostCalculation() {
    if (window.stackManager) {
        window.stackManager.updateCostCalculation();
    }
}