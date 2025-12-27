/**
 * DivUp PWA - UI Components
 * Reusable HTML components matching Android design
 */

const Components = {
    
    // ========================
    // Icons (SVG)
    // ========================
    icons: {
        camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
        </svg>`,
        
        gallery: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>`,
        
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>`,
        
        checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>`,
        
        clear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`,
        
        share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>`,
        
        minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>`,
        
        plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>`,
        
        back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
        </svg>`
    },
    
    // ========================
    // Camera Screen
    // ========================
    cameraScreen() {
        return `
            <div class="screen-camera fade-in">
                <div class="camera-header">
                    <h1>📝 DivUp</h1>
                    <p>Fotografe a conta</p>
                </div>
                
                <div class="camera-preview">
                    <div class="camera-frame">
                        <span class="camera-hint">Centralize a conta no quadro</span>
                    </div>
                </div>
                
                <div class="camera-controls">
                    <input type="file" id="galleryInput" class="file-input" accept="image/*">
                    <input type="file" id="cameraInput" class="file-input" accept="image/*" capture="environment">
                    
                    <button class="btn-gallery" id="btnGallery">
                        ${this.icons.gallery}
                        <span>Galeria</span>
                    </button>
                    
                    <button class="btn-capture" id="btnCapture">
                        <div class="btn-capture-inner">
                            ${this.icons.camera}
                        </div>
                    </button>
                </div>
            </div>
        `;
    },
    
    // ========================
    // Loading Screen
    // ========================
    loadingScreen() {
        return `
            <div class="screen-loading fade-in">
                <div class="spinner"></div>
                <p class="loading-text">Analisando conta...</p>
                <p class="loading-powered">Powered by Gemini AI ✨</p>
            </div>
        `;
    },
    
    // ========================
    // Receipt Screen
    // ========================
    receiptScreen(receipt, billSplit, tipPercentage) {
        const hasSelection = receipt.items.some(item => item.selectedQuantity > 0);
        
        return `
            <div class="screen-receipt fade-in">
                <div class="receipt-header">
                    <h1>Divisão de Conta</h1>
                    ${hasSelection ? `
                        <button class="btn btn-icon" id="btnShare" title="Compartilhar">
                            ${this.icons.share}
                        </button>
                    ` : ''}
                </div>
                
                <div class="receipt-content">
                    ${this.receiptInfo(receipt)}
                    ${this.selectionButtons()}
                    ${this.itemsCounter(receipt)}
                    ${this.itemsList(receipt)}
                </div>
                
                ${this.bottomBar(billSplit, tipPercentage)}
            </div>
            
            ${this.tipModal()}
        `;
    },
    
    receiptInfo(receipt) {
        if (!receipt.establishmentName && !receipt.date) return '';
        
        return `
            <div class="receipt-info slide-up">
                <div class="receipt-establishment">${receipt.establishmentName || 'Estabelecimento'}</div>
                ${receipt.date ? `<div class="receipt-date">${receipt.date}</div>` : ''}
            </div>
        `;
    },
    
    selectionButtons() {
        return `
            <div class="selection-buttons">
                <button class="btn btn-primary" id="btnSelectAll">
                    ${this.icons.checkCircle}
                    <span>Selecionar Tudo</span>
                </button>
                <button class="btn btn-secondary" id="btnClearSelection">
                    ${this.icons.clear}
                    <span>Limpar</span>
                </button>
            </div>
        `;
    },
    
    itemsCounter(receipt) {
        const totalItems = receipt.items.length;
        const selectedCount = receipt.items.filter(item => item.selectedQuantity > 0).length;
        
        return `
            <div class="items-counter">
                <span>${totalItems} itens na conta</span>
                ${selectedCount > 0 ? `<span class="selected-badge">${selectedCount} selecionados</span>` : ''}
            </div>
        `;
    },
    
    itemsList(receipt) {
        return receipt.items.map((item, index) => this.itemCard(item, index)).join('');
    },
    
    itemCard(item, index) {
        const isSelected = item.selectedQuantity > 0;
        const hasMultipleQuantity = item.quantity > 1;
        
        return `
            <div class="item-card ${isSelected ? 'selected' : ''} slide-up" 
                 data-item-id="${item.id}" 
                 style="animation-delay: ${index * 50}ms">
                <div class="item-header">
                    <div class="item-checkbox">
                        ${this.icons.check}
                    </div>
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-quantity">${item.quantity}x R$ ${item.unitPrice.toFixed(2)}</div>
                    </div>
                    <div class="item-price">R$ ${item.totalPrice.toFixed(2)}</div>
                </div>
                
                ${hasMultipleQuantity ? this.quantitySelector(item) : ''}
            </div>
        `;
    },
    
    quantitySelector(item) {
        const showPartial = item.selectedQuantity > 0 && item.selectedQuantity < item.quantity;
        
        return `
            <div class="quantity-selector">
                <div class="quantity-label">Quantos você consumiu?</div>
                <div class="quantity-controls">
                    <button class="quantity-btn quantity-btn-minus" 
                            data-item-id="${item.id}" 
                            data-action="decrease"
                            ${item.selectedQuantity === 0 ? 'disabled' : ''}>
                        ${this.icons.minus}
                    </button>
                    <div class="quantity-value">${item.selectedQuantity} / ${item.quantity}</div>
                    <button class="quantity-btn quantity-btn-plus" 
                            data-item-id="${item.id}" 
                            data-action="increase"
                            ${item.selectedQuantity === item.quantity ? 'disabled' : ''}>
                        ${this.icons.plus}
                    </button>
                </div>
                ${showPartial ? `
                    <div class="quantity-partial">Sua parte: R$ ${(item.unitPrice * item.selectedQuantity).toFixed(2)}</div>
                ` : ''}
            </div>
        `;
    },
    
    bottomBar(billSplit, tipPercentage) {
        return `
            <div class="bottom-bar">
                ${this.tipSelector(tipPercentage)}
                ${this.summaryCard(billSplit)}
            </div>
        `;
    },
    
    tipSelector(tipPercentage) {
        const isCustom = tipPercentage !== 0 && tipPercentage !== 10;
        
        return `
            <div class="tip-section">
                <div class="tip-title">Gorjeta</div>
                <div class="tip-chips">
                    <button class="tip-chip ${tipPercentage === 0 ? 'active' : ''}" data-tip="0">0%</button>
                    <button class="tip-chip ${tipPercentage === 10 ? 'active' : ''}" data-tip="10">10%</button>
                    <button class="tip-chip ${isCustom ? 'active' : ''}" data-tip="custom" id="btnCustomTip">
                        ${isCustom ? `${Math.round(tipPercentage)}%` : 'Outro'}
                    </button>
                </div>
            </div>
        `;
    },
    
    summaryCard(billSplit) {
        return `
            <div class="summary-card">
                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>R$ ${billSplit.itemsSubtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Gorjeta (${Math.round(billSplit.tipPercentage)}%)</span>
                    <span>R$ ${billSplit.tipAmount.toFixed(2)}</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-total">
                    <span class="summary-total-label">TOTAL</span>
                    <span class="summary-total-value">R$ ${billSplit.total.toFixed(2)}</span>
                </div>
            </div>
        `;
    },
    
    tipModal() {
        return `
            <div class="modal-overlay" id="tipModal">
                <div class="modal">
                    <div class="modal-title">Gorjeta Personalizada</div>
                    <input type="number" class="modal-input" id="tipInput" placeholder="Porcentagem (%)" min="0" max="100">
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-cancel" id="btnCancelTip">Cancelar</button>
                        <button class="modal-btn modal-btn-confirm" id="btnConfirmTip">OK</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // ========================
    // Error Screen
    // ========================
    errorScreen(message) {
        return `
            <div class="screen-error fade-in">
                <div class="error-emoji">😕</div>
                <div class="error-title">Ops! Algo deu errado</div>
                <div class="error-message">${message}</div>
                <button class="btn btn-primary btn-large" id="btnRetry">
                    Tentar Novamente
                </button>
            </div>
        `;
    }
};

// Make Components available globally
window.Components = Components;
