/**
 * DivUp PWA - API Module
 * Handles communication with the backend
 */

const API = {
    // Base URL - empty for same-origin (when PWA and API run together)
    // Falls back to OCI server for standalone testing
    BASE_URL: window.location.hostname === 'localhost' && window.location.port === '8080' 
        ? 'http://164.152.197.117:8001' 
        : '',
    
    /**
     * Process a receipt image
     * @param {File} imageFile - The image file to process
     * @returns {Promise<Object>} - The processed receipt data
     */
    // Compression settings: enough resolution to read a receipt,
    // shrinks a 3-8MB phone photo to a few hundred KB.
    MAX_IMAGE_SIDE: 1600,
    JPEG_QUALITY: 0.8,

    /**
     * Downscale and re-encode an image as JPEG before upload.
     * Falls back to the original file if anything fails.
     * @param {File} file
     * @returns {Promise<File>}
     */
    async compressImage(file) {
        const url = URL.createObjectURL(file);
        try {
            // <img> applies EXIF orientation automatically in modern browsers
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = url;
            });

            const scale = Math.min(1, this.MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
            const width = Math.round(img.naturalWidth * scale);
            const height = Math.round(img.naturalHeight * scale);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // PNG transparency -> white
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const blob = await new Promise(resolve =>
                canvas.toBlob(resolve, 'image/jpeg', this.JPEG_QUALITY)
            );
            if (!blob || blob.size >= file.size) return file;

            console.log(`Imagem comprimida: ${Math.round(file.size / 1024)} KB -> ${Math.round(blob.size / 1024)} KB`);
            return new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
        } catch (error) {
            console.warn('Falha ao comprimir imagem, enviando original:', error);
            return file;
        } finally {
            URL.revokeObjectURL(url);
        }
    },

    async processReceipt(imageFile) {
        const uploadFile = await this.compressImage(imageFile);
        const formData = new FormData();
        formData.append('file', uploadFile);  // Backend expects 'file', not 'image'
        
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
