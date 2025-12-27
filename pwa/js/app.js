/**
 * DivUp PWA - Main Application
 * State management and screen routing
 */

const App = {
    // Application state
    state: {
        currentScreen: 'camera', // 'camera', 'loading', 'receipt', 'error'
        receipt: null,
        tipPercentage: 10,
        errorMessage: ''
    },
    
    // DOM reference
    appElement: null,
    
    /**
     * Initialize the application
     */
    init() {
        this.appElement = document.getElementById('app');
        this.render();
        console.log('DivUp PWA initialized');
    },
    
    /**
     * Render the current screen
     */
    render() {
        let html = '';
        
        switch (this.state.currentScreen) {
            case 'camera':
                html = Components.cameraScreen();
                break;
            case 'loading':
                html = Components.loadingScreen();
                break;
            case 'receipt':
                const billSplit = this.calculateBillSplit();
                html = Components.receiptScreen(this.state.receipt, billSplit, this.state.tipPercentage);
                break;
            case 'error':
                html = Components.errorScreen(this.state.errorMessage);
                break;
        }
        
        this.appElement.innerHTML = html;
        this.attachEventListeners();
    },
    
    /**
     * Attach event listeners based on current screen
     */
    attachEventListeners() {
        switch (this.state.currentScreen) {
            case 'camera':
                this.attachCameraListeners();
                break;
            case 'receipt':
                this.attachReceiptListeners();
                break;
            case 'error':
                this.attachErrorListeners();
                break;
        }
    },
    
    // ========================
    // Camera Screen Handlers
    // ========================
    attachCameraListeners() {
        const btnCapture = document.getElementById('btnCapture');
        const btnGallery = document.getElementById('btnGallery');
        const cameraInput = document.getElementById('cameraInput');
        const galleryInput = document.getElementById('galleryInput');
        
        // Capture button - opens camera
        btnCapture?.addEventListener('click', () => {
            cameraInput?.click();
        });
        
        // Gallery button - opens photo picker
        btnGallery?.addEventListener('click', () => {
            galleryInput?.click();
        });
        
        // Handle camera capture
        cameraInput?.addEventListener('change', (e) => {
            this.handleImageSelected(e.target.files[0]);
        });
        
        // Handle gallery selection
        galleryInput?.addEventListener('change', (e) => {
            this.handleImageSelected(e.target.files[0]);
        });
    },
    
    /**
     * Process selected image
     * @param {File} file - The image file
     */
    async handleImageSelected(file) {
        if (!file) return;
        
        // Show loading screen
        this.state.currentScreen = 'loading';
        this.render();
        
        try {
            // Send to API
            const receipt = await API.processReceipt(file);
            
            // Store receipt and show result
            this.state.receipt = receipt;
            this.state.currentScreen = 'receipt';
            this.render();
        } catch (error) {
            console.error('Error processing receipt:', error);
            this.state.errorMessage = error.message || 'Erro ao processar a nota. Tente novamente.';
            this.state.currentScreen = 'error';
            this.render();
        }
    },
    
    // ========================
    // Receipt Screen Handlers
    // ========================
    attachReceiptListeners() {
        // Item cards - toggle selection
        document.querySelectorAll('.item-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't toggle if clicking quantity buttons
                if (e.target.closest('.quantity-btn')) return;
                
                const itemId = card.dataset.itemId;
                this.toggleItemSelection(itemId);
            });
        });
        
        // Quantity buttons
        document.querySelectorAll('.quantity-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.itemId;
                const action = btn.dataset.action;
                this.updateItemQuantity(itemId, action);
            });
        });
        
        // Select All button
        document.getElementById('btnSelectAll')?.addEventListener('click', () => {
            this.selectAll();
        });
        
        // Clear Selection button
        document.getElementById('btnClearSelection')?.addEventListener('click', () => {
            this.clearSelection();
        });
        
        // Tip chips
        document.querySelectorAll('.tip-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const tip = chip.dataset.tip;
                if (tip === 'custom') {
                    this.showTipModal();
                } else {
                    this.state.tipPercentage = parseInt(tip);
                    this.render();
                }
            });
        });
        
        // Tip modal
        document.getElementById('btnCancelTip')?.addEventListener('click', () => {
            this.hideTipModal();
        });
        
        document.getElementById('btnConfirmTip')?.addEventListener('click', () => {
            const input = document.getElementById('tipInput');
            const value = parseFloat(input.value) || 0;
            this.state.tipPercentage = Math.min(100, Math.max(0, value));
            this.hideTipModal();
            this.render();
        });
        
        // Share button
        document.getElementById('btnShare')?.addEventListener('click', () => {
            this.shareReceipt();
        });
    },
    
    /**
     * Toggle item selection (select all units or deselect)
     * @param {string} itemId - Item ID
     */
    toggleItemSelection(itemId) {
        const item = this.state.receipt.items.find(i => i.id === itemId);
        if (!item) return;
        
        // If not selected, select all. If selected, deselect.
        item.selectedQuantity = item.selectedQuantity > 0 ? 0 : item.quantity;
        this.render();
    },
    
    /**
     * Update item quantity
     * @param {string} itemId - Item ID
     * @param {string} action - 'increase' or 'decrease'
     */
    updateItemQuantity(itemId, action) {
        const item = this.state.receipt.items.find(i => i.id === itemId);
        if (!item) return;
        
        if (action === 'increase' && item.selectedQuantity < item.quantity) {
            item.selectedQuantity++;
        } else if (action === 'decrease' && item.selectedQuantity > 0) {
            item.selectedQuantity--;
        }
        
        this.render();
    },
    
    /**
     * Select all items (full quantity)
     */
    selectAll() {
        this.state.receipt.items.forEach(item => {
            item.selectedQuantity = item.quantity;
        });
        this.render();
    },
    
    /**
     * Clear all selections
     */
    clearSelection() {
        this.state.receipt.items.forEach(item => {
            item.selectedQuantity = 0;
        });
        this.render();
    },
    
    /**
     * Calculate bill split based on selected items
     * @returns {Object} - Bill split data
     */
    calculateBillSplit() {
        const items = this.state.receipt?.items || [];
        const selectedItems = items.filter(item => item.selectedQuantity > 0);
        
        // Calculate subtotal based on selected quantities
        const itemsSubtotal = selectedItems.reduce((sum, item) => {
            return sum + (item.unitPrice * item.selectedQuantity);
        }, 0);
        
        const tipAmount = itemsSubtotal * (this.state.tipPercentage / 100);
        const total = itemsSubtotal + tipAmount;
        
        return {
            selectedItems,
            itemsSubtotal,
            tipPercentage: this.state.tipPercentage,
            tipAmount,
            total
        };
    },
    
    /**
     * Show custom tip modal
     */
    showTipModal() {
        const modal = document.getElementById('tipModal');
        const input = document.getElementById('tipInput');
        modal?.classList.add('active');
        input?.focus();
    },
    
    /**
     * Hide custom tip modal
     */
    hideTipModal() {
        const modal = document.getElementById('tipModal');
        modal?.classList.remove('active');
    },
    
    /**
     * Share receipt summary using Web Share API
     */
    async shareReceipt() {
        const billSplit = this.calculateBillSplit();
        const receipt = this.state.receipt;
        
        // Build share text
        let text = '🧾 *DivUp - Divisão de Conta*\n\n';
        
        if (receipt.establishmentName) {
            text += `📍 ${receipt.establishmentName}\n`;
        }
        if (receipt.date) {
            text += `📅 ${receipt.date}\n`;
        }
        text += '\n';
        
        text += '*Meus itens:*\n';
        billSplit.selectedItems.forEach(item => {
            const qty = item.selectedQuantity;
            const price = item.unitPrice * qty;
            text += `• ${item.name}`;
            if (qty > 1 || qty < item.quantity) {
                text += ` (${qty}x)`;
            }
            text += ` - R$ ${price.toFixed(2)}\n`;
        });
        
        text += '\n';
        text += `💵 Subtotal: R$ ${billSplit.itemsSubtotal.toFixed(2)}\n`;
        text += `🎁 Gorjeta (${Math.round(billSplit.tipPercentage)}%): R$ ${billSplit.tipAmount.toFixed(2)}\n`;
        text += `\n✨ *TOTAL: R$ ${billSplit.total.toFixed(2)}*`;
        
        // Try Web Share API
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'DivUp - Minha Conta',
                    text: text
                });
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Share failed:', err);
                    this.fallbackShare(text);
                }
            }
        } else {
            this.fallbackShare(text);
        }
    },
    
    /**
     * Fallback: copy to clipboard
     * @param {string} text - Text to copy
     */
    async fallbackShare(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('Resumo copiado para a área de transferência!');
        } catch (err) {
            console.error('Clipboard failed:', err);
            alert('Não foi possível compartilhar. Tente novamente.');
        }
    },
    
    // ========================
    // Error Screen Handlers
    // ========================
    attachErrorListeners() {
        document.getElementById('btnRetry')?.addEventListener('click', () => {
            this.state.currentScreen = 'camera';
            this.state.errorMessage = '';
            this.render();
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Make App available globally for debugging
window.App = App;
