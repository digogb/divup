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

    /**
     * Envia a foto e devolve a nota no formato do app.
     * @param {File} imageFile
     * @param {{signal?: AbortSignal, onProgress?: (step: number) => void}} options
     *        onProgress(1) quando a foto já foi otimizada e o upload começou.
     */
    async processReceipt(imageFile, { signal, onProgress } = {}) {
        const uploadFile = await this.compressImage(imageFile);
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        onProgress?.(1);

        const formData = new FormData();
        formData.append('file', uploadFile);

        let response;
        try {
            response = await fetch(`${this.BASE_URL}/api/v1/receipt/process`, {
                method: 'POST',
                body: formData,
                signal
            });
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            // Chrome: "Failed to fetch"; Safari: "Load failed" — ambos TypeError
            throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `O servidor respondeu com erro (${response.status}).`);
        }

        const data = await response.json();
        if (!data.success) {
            console.error('API Error:', data.error);
            throw new Error('Não consegui ler essa nota. Tente outra foto, com a nota inteira e bem iluminada.');
        }

        const receipt = this.transformReceiptData(data.receipt);
        if (!receipt.items.length) {
            throw new Error('Não encontrei itens nessa foto. Confira se a nota aparece inteira e legível.');
        }
        return receipt;
    },

    /**
     * Converte a resposta do backend para o formato usado pelo app.
     */
    transformReceiptData(dto) {
        const items = (dto.items || []).map((item, i) => {
            const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
            let unitPrice = Number(item.unit_price) || 0;
            if (!unitPrice && item.total_price) unitPrice = Number(item.total_price) / quantity;
            return {
                id: item.id || `item-${i}`,
                name: String(item.name || 'Item').trim(),
                quantity,
                unitPrice,
                sel: 0,      // unidades que são "minhas"
                split: 1     // com quantas pessoas divido
            };
        });

        return {
            id: dto.id,
            title: dto.establishment_name || 'Sua conta',
            date: dto.date || '',
            subtotal: Number(dto.subtotal) || 0,
            total: Number(dto.total) || 0,
            items
        };
    }
};

// Make API available globally
window.API = API;
