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
    
    // Compressão: resolução suficiente para ler a nota; uma foto de 3-8 MB vira ~200 KB.
    MAX_IMAGE_SIDE: 1600,
    JPEG_QUALITY: 0.8,
    // Fotos JPEG já pequenas vão direto (o servidor reduz se precisar).
    SKIP_BELOW_BYTES: 400 * 1024,
    // Se o aparelho demorar mais que isso para comprimir, envia a original.
    COMPRESS_TIMEOUT_MS: 3000,

    /**
     * Reduz e recomprime a foto antes do upload.
     * Nunca falha: em erro ou demora, devolve o arquivo original.
     * @returns {Promise<{file: File, info: Object}>}
     */
    async compressImage(file) {
        const t0 = performance.now();
        const info = { kb_in: Math.round(file.size / 1024), type: file.type || '?', method: 'skip' };
        const done = (out) => {
            info.ms = Math.round(performance.now() - t0);
            info.kb_out = Math.round(out.size / 1024);
            return { file: out, info };
        };

        if (file.type === 'image/jpeg' && file.size <= this.SKIP_BELOW_BYTES) return done(file);

        const timeout = new Promise(resolve => setTimeout(() => resolve(null), this.COMPRESS_TIMEOUT_MS));
        try {
            const blob = await Promise.race([this.resizeToJpeg(file, info), timeout]);
            if (!blob) {
                info.method += '+timeout';
                return done(file);
            }
            if (blob.size >= file.size) return done(file);
            return done(new File([blob], 'receipt.jpg', { type: 'image/jpeg' }));
        } catch (error) {
            console.warn('Falha ao comprimir imagem, enviando original:', error);
            info.method += '+erro';
            return done(file);
        }
    },

    /** Decodifica (fora da thread principal quando possível), reduz e gera JPEG. */
    async resizeToJpeg(file, info) {
        let source = null;
        let width, height;

        // createImageBitmap decodifica em segundo plano e não trava a tela
        if (typeof createImageBitmap === 'function') {
            try {
                source = await createImageBitmap(file, { imageOrientation: 'from-image' });
                width = source.width;
                height = source.height;
                info.method = 'bitmap';
            } catch { source = null; }
        }

        let url = null;
        if (!source) {
            url = URL.createObjectURL(file);
            source = await new Promise((resolve, reject) => {
                const el = new Image();
                el.decoding = 'async';
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = url;
            });
            width = source.naturalWidth;
            height = source.naturalHeight;
            info.method = 'img';
        }

        try {
            info.px = `${width}x${height}`;
            const scale = Math.min(1, this.MAX_IMAGE_SIDE / Math.max(width, height));
            const w = Math.round(width * scale);
            const h = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff'; // transparência de PNG -> branco
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(source, 0, 0, w, h);
            return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', this.JPEG_QUALITY));
        } finally {
            source.close?.();
            if (url) URL.revokeObjectURL(url);
        }
    },

    /**
     * Envia a foto e devolve a nota no formato do app.
     * @param {File} imageFile
     * @param {{signal?: AbortSignal, onProgress?: (step: number) => void, onPhoto?: (file: File) => void}} options
     *        onProgress(1): foto otimizada, upload começando.
     *        onPhoto(file): arquivo leve para a pré-visualização.
     */
    async processReceipt(imageFile, { signal, onProgress, onPhoto } = {}) {
        const { file: uploadFile, info } = await this.compressImage(imageFile);
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        onPhoto?.(uploadFile);
        onProgress?.(1);

        // Diagnóstico de desempenho no log do servidor (sem dados pessoais)
        info.ua = navigator.userAgent.slice(0, 160);

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('client_info', JSON.stringify(info));

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
            const discount = Math.max(0, Number(item.discount) || 0);
            let listUnitPrice = Number(item.unit_price) || 0;
            const paid = Number.isFinite(Number(item.total_price)) && item.total_price !== null
                ? Number(item.total_price)
                : quantity * listUnitPrice - discount;
            if (!listUnitPrice) listUnitPrice = (paid + discount) / quantity;
            return {
                id: item.id || `item-${i}`,
                name: String(item.name || 'Item').trim(),
                quantity,
                unitPrice: Math.max(0, paid) / quantity, // preço pago por unidade (já com desconto)
                listUnitPrice,                            // preço de tabela
                discount,                                 // desconto do item (todas as unidades)
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
            discount: Math.max(0, Number(dto.discount) || 0), // desconto da conta, rateado
            items
        };
    }
};

// Make API available globally
window.API = API;
