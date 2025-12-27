/**
 * DivUp PWA - API Module
 * Handles communication with the backend
 */

const API = {
    // Backend URL from Android app configuration
    BASE_URL: 'http://164.152.197.117:8001',
    
    /**
     * Process a receipt image
     * @param {File} imageFile - The image file to process
     * @returns {Promise<Object>} - The processed receipt data
     */
    async processReceipt(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        try {
            const response = await fetch(`${this.BASE_URL}/api/v1/receipt/process`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Erro ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Erro ao processar a nota');
            }
            
            return this.transformReceiptData(data.receipt);
        } catch (error) {
            console.error('API Error:', error);
            
            // Check for network errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
            }
            
            throw error;
        }
    },
    
    /**
     * Transform backend receipt data to app format
     * @param {Object} receiptDto - Raw receipt data from API
     * @returns {Object} - Transformed receipt data
     */
    transformReceiptData(receiptDto) {
        return {
            id: receiptDto.id,
            establishmentName: receiptDto.establishment_name || null,
            date: receiptDto.date || null,
            items: receiptDto.items.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalPrice: item.total_price,
                selectedQuantity: 0 // Not selected initially
            })),
            subtotal: receiptDto.subtotal,
            total: receiptDto.total,
            confidenceScore: receiptDto.confidence_score
        };
    }
};

// Make API available globally
window.API = API;
