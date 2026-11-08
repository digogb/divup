/**
 * DivUp PWA - UI Components
 * Funções puras que devolvem HTML. Todo texto vindo da nota passa por esc().
 */

const Fmt = {
    esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    round2(n) {
        return Math.round((n + Number.EPSILON) * 100) / 100;
    },
    /** 1919.9 -> "1.919,90" (sem depender do suporte a locale do aparelho) */
    money(n) {
        const [int, dec] = Math.abs(Fmt.round2(n)).toFixed(2).split('.');
        return (n < 0 ? '-' : '') + int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
    },
    brl(n) {
        return 'R$ ' + Fmt.money(n);
    },
    num(n) {
        return String(Fmt.round2(n)).replace('.', ',');
    },
    /** Aceita "12,5", "12.5" e "1.234,56". Retorna NaN se inválido. */
    parseNum(text) {
        let s = String(text ?? '').trim().replace(/\s|R\$/g, '');
        if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
        if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
        return parseFloat(s);
    },
    /** "PICANHA NA CHAPA P/ 2" -> "Picanha na chapa p/ 2" */
    sentenceCase(text) {
        const s = String(text ?? '').toLowerCase();
        return s.charAt(0).toUpperCase() + s.slice(1);
    },
    /** "WMB SUPERMERCADOS DO BRASIL" -> "WMB Supermercados do Brasil" */
    titleCase(text) {
        const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no']);
        return String(text ?? '').split(' ').map((w, i) => {
            if (/^[A-Z]{2,4}$/.test(w) && !/[AEIOU]/.test(w)) return w; // siglas: WMB, LTD
            const lw = w.toLowerCase();
            if (i > 0 && small.has(lw)) return lw;
            return lw.charAt(0).toUpperCase() + lw.slice(1);
        }).join(' ');
    },
    plural(n, one, many) {
        return `${n} ${n === 1 ? one : many}`;
    }
};

const Icons = {
    logo: `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M12.6 2a12 12 0 0 0 0 24z" fill="currentColor"/>
        <path d="M15.4 2a12 12 0 0 1 0 24z" style="fill: var(--accent)"/>
    </svg>`,
    camera: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
    gallery: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/></svg>`,
    back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m11 6-6 6 6 6"/></svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
    checkSmall: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
    checkCircle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" style="fill: var(--accent)"/><path d="m7.5 12.5 3 3 6-6.5" style="stroke: var(--on-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    stepDone: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" style="fill: var(--accent)"/><path d="m7.5 12.5 3 3 6-6.5" style="stroke: var(--on-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    alert: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 16.5h.01"/></svg>`,
    alertLarge: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 16.5h.01"/></svg>`,
    minus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
    plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
    people: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></svg>`,
    send: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    pencil: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
    chat: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.5 8.5 0 1 1 21 11.5z"/></svg>`,
    copy: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`,
    more: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>`
};

const Components = {

    // ========================
    // Início
    // ========================
    homeScreen() {
        return `
            <main class="screen home">
                <div class="brand">${Icons.logo}<span class="brand-name">divup</span></div>

                <div class="home-hero" aria-hidden="true">
                    <div class="mini-receipt">
                        <div class="mini-receipt-title">SUA CONTA</div>
                        <div class="mini-row on"><span>${Icons.checkSmall}Entrada (÷ 2)</span><span>24,50</span></div>
                        <div class="mini-row"><span>Prato do dia</span><span>42,00</span></div>
                        <div class="mini-row on"><span>${Icons.checkSmall}Suco (1 de 2)</span><span>11,00</span></div>
                        <div class="mini-row"><span>Sobremesa</span><span>16,00</span></div>
                        <div class="mini-row on"><span>${Icons.checkSmall}Café</span><span>7,50</span></div>
                        <div class="mini-total"><span>Sua parte</span><strong>R$ 47,30</strong></div>
                    </div>
                </div>

                <div class="home-copy">
                    <h1>Cada um paga o que consumiu.</h1>
                    <p>Fotografe a conta, toque nos seus itens e mande sua parte no grupo.</p>
                </div>

                <div class="home-actions">
                    <input type="file" id="cameraInput" class="file-input" accept="image/*" capture="environment">
                    <input type="file" id="galleryInput" class="file-input" accept="image/*">
                    <button class="btn btn-primary" data-action="camera">${Icons.camera}Fotografar conta</button>
                    <button class="btn btn-secondary" data-action="gallery">${Icons.gallery}Escolher da galeria</button>
                </div>
            </main>
        `;
    },

    // ========================
    // Lendo a nota
    // ========================
    loadingSteps(step) {
        const labels = ['Otimizando a foto', 'Lendo itens e preços', 'Conferindo com o total da nota'];
        const steps = labels.map((label, i) => {
            const cls = i < step ? 'done' : i === step ? 'active' : '';
            const icon = i < step ? Icons.stepDone : i === step ? '<span class="ring"></span>' : '<span class="step-dot"></span>';
            return `<li class="step ${cls}"><span class="step-icon">${icon}</span><span>${label}</span></li>`;
        }).join('');
        return `<ol class="steps" aria-live="polite">${steps}</ol>`;
    },

    loadingScreen(photoUrl, step) {
        return `
            <main class="screen loading" aria-busy="true">
                <div><button class="btn-text" data-action="cancel-loading">Cancelar</button></div>
                <div class="loading-photo-wrap">
                    <div class="loading-photo">
                        ${photoUrl ? `<img src="${Fmt.esc(photoUrl)}" alt="">` : ''}
                        <div class="scanline"></div>
                    </div>
                </div>
                <div>
                    <h1>Lendo a nota…</h1>
                    ${this.loadingSteps(step)}
                </div>
            </main>
        `;
    },

    // ========================
    // Divisão
    // ========================
    receiptScreen(view) {
        return `
            <main class="screen receipt">
                <header class="receipt-top">
                    <button class="icon-btn" data-action="new-receipt" aria-label="Nova nota">${Icons.back}</button>
                    <div class="receipt-title">
                        <strong>${Fmt.esc(view.title)}</strong>
                        <span id="receiptSubtitle">${Fmt.esc(view.subtitle)}</span>
                    </div>
                    <button class="btn-text" data-action="toggle-edit" id="btnEdit">${view.editing ? 'Concluir' : 'Editar'}</button>
                </header>

                <div id="checkStrip">${this.checkStrip(view.check)}</div>

                <div class="list-head">
                    <span id="listHint">${view.editing ? 'Toque num item para corrigir' : 'Toque no que é seu'}</span>
                    <button class="btn-text" data-action="bulk" id="btnBulk" ${view.editing ? 'hidden' : ''}>${view.bulkLabel}</button>
                </div>

                <div class="item-list" id="itemList">
                    ${view.items.map(it => this.itemCard(it)).join('')}
                    <button class="add-item" data-action="add-item">${Icons.plus}Adicionar item que faltou</button>
                </div>

                <footer class="footer" id="footer">${this.footer(view.footer)}</footer>
            </main>
            <div id="sheetRoot"></div>
        `;
    },

    checkStrip(check) {
        if (!check) return '';
        const savings = check.savings ? ` (já com <strong>${check.savings}</strong> de desconto)` : '';
        if (check.ok) {
            return `<div class="check-strip">${Icons.checkCircle}<span>Os itens somam <strong>${check.sum}</strong>${savings} — bate com o total da nota.</span></div>`;
        }
        return `<div class="check-strip warn" role="status">${Icons.alert}<span>Os itens somam <strong>${check.sum}</strong>, mas a nota indica <strong>${check.expected}</strong>. Confira se faltou algum item.</span></div>`;
    },

    itemCard(it) {
        const cls = ['item', it.selected ? 'is-selected' : '', it.editing ? 'is-editing' : ''].join(' ');
        const action = it.editing ? 'edit-item' : 'toggle';
        const label = it.editing ? `Editar ${Fmt.esc(it.name)}` : '';

        return `
            <div class="${cls}" data-item="${Fmt.esc(it.id)}">
                <button class="item-main" data-action="${action}" data-id="${Fmt.esc(it.id)}"
                        ${it.editing ? `aria-label="${label}"` : `aria-pressed="${it.selected}"`}>
                    <span class="check">${it.editing ? Icons.pencil : Icons.check}</span>
                    <span class="item-text">
                        <span class="item-name">${Fmt.esc(it.name)}</span>
                        <span class="item-meta">${it.meta}</span>
                    </span>
                    <span class="item-price">
                        <span class="price">${it.price}</span>
                        ${it.priceSub ? `<span class="price-sub">${it.priceSub}</span>` : ''}
                    </span>
                </button>
                ${it.showQty ? `
                    <div class="item-row">
                        <span class="item-row-label">Quantas são suas?</span>
                        <div class="stepper">
                            <button class="step-btn" data-action="qty-dec" data-id="${Fmt.esc(it.id)}" aria-label="Diminuir quantidade" ${it.qtyDecDisabled ? 'disabled' : ''}>${Icons.minus}</button>
                            <span class="stepper-value">${it.qtyLabel}</span>
                            <button class="step-btn plus" data-action="qty-inc" data-id="${Fmt.esc(it.id)}" aria-label="Aumentar quantidade" ${it.qtyIncDisabled ? 'disabled' : ''}>${Icons.plus}</button>
                        </div>
                    </div>` : ''}
                ${it.canSplit ? `
                    <div class="item-split">
                        <button class="btn-text" data-action="split-start" data-id="${Fmt.esc(it.id)}">${Icons.people}Dividir com outras pessoas</button>
                    </div>` : ''}
                ${it.isSplit ? `
                    <div class="item-row">
                        <span class="item-row-label">Dividido entre</span>
                        <div class="stepper">
                            <button class="step-btn" data-action="split-dec" data-id="${Fmt.esc(it.id)}" aria-label="Menos pessoas">${Icons.minus}</button>
                            <span class="stepper-value wide">${it.splitLabel}</span>
                            <button class="step-btn plus" data-action="split-inc" data-id="${Fmt.esc(it.id)}" aria-label="Mais pessoas" ${it.splitIncDisabled ? 'disabled' : ''}>${Icons.plus}</button>
                        </div>
                    </div>` : ''}
            </div>
        `;
    },

    footer(f) {
        const chips = f.tips.map(tp => `
            <button class="chip" data-action="tip" data-tip="${tp.value}" aria-pressed="${tp.on}">${tp.label}</button>
        `).join('');

        return `
            <div class="footer-row">
                <span class="label" id="tipLabel">Serviço</span>
                <div class="chips" role="group" aria-labelledby="tipLabel">${chips}</div>
            </div>
            ${f.customOn ? `
                <label class="custom-tip">
                    <span>Outro valor de serviço</span>
                    <span class="custom-tip-field">
                        <input id="customTip" type="text" inputmode="decimal" autocomplete="off" value="${Fmt.esc(f.customValue)}" aria-label="Percentual de serviço">
                        %
                    </span>
                </label>` : ''}
            <div class="footer-row">
                <div class="total-block" aria-live="polite">
                    <span class="label">Sua parte</span>
                    <span class="total-value" id="totalValue">${f.total}</span>
                    <span class="total-detail" id="totalDetail">${f.detail}</span>
                </div>
                <button class="btn btn-primary" data-action="open-share" id="btnSend" ${f.any ? '' : 'disabled'}>${Icons.send}Enviar</button>
            </div>
        `;
    },

    // ========================
    // Sheet: enviar
    // ========================
    shareSheet(s) {
        const lines = s.lines.map(l => `
            <div class="share-line"><span>${Fmt.esc(l.label)}</span><span>${l.value}</span></div>
        `).join('');

        return `
            <div class="sheet-scrim" data-action="close-sheet">
                <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
                    <div class="sheet-handle"></div>
                    <div class="sheet-head">
                        <h2 id="shareTitle">Enviar sua parte</h2>
                        <button class="icon-btn" data-action="close-sheet" aria-label="Fechar">${Icons.close}</button>
                    </div>

                    <div class="share-preview">
                        <div class="title">${Fmt.esc(s.title)}</div>
                        ${lines}
                        <div class="share-total"><span>Minha parte</span><strong>${s.total}</strong></div>
                    </div>

                    <label class="check-row">
                        <input type="checkbox" id="pixToggle" ${s.pixOn ? 'checked' : ''}>
                        <span>Incluir minha chave Pix</span>
                    </label>
                    <div class="field" id="pixField" ${s.pixOn ? '' : 'hidden'}>
                        <label for="pixKey">Chave Pix (fica salva só neste aparelho)</label>
                        <input id="pixKey" type="text" autocomplete="off" value="${Fmt.esc(s.pixKey)}" placeholder="CPF, e-mail, telefone ou chave aleatória">
                    </div>

                    <div class="sheet-actions">
                        <button class="btn btn-primary" data-action="share-whatsapp">${Icons.chat}Enviar no WhatsApp</button>
                        <button class="btn btn-secondary" data-action="share-copy">${Icons.copy}Copiar texto</button>
                        ${s.canNativeShare ? `<button class="btn btn-secondary" data-action="share-native">${Icons.more}Outros apps</button>` : ''}
                    </div>
                </section>
            </div>
        `;
    },

    // ========================
    // Sheet: editar / adicionar item
    // ========================
    itemSheet(item) {
        const isNew = !item;
        const name = item ? item.name : '';
        const qty = item ? item.quantity : 1;
        const price = item ? Fmt.round2(item.unitPrice).toFixed(2).replace('.', ',') : '';

        return `
            <div class="sheet-scrim" data-action="close-sheet">
                <form class="sheet" id="itemForm" role="dialog" aria-modal="true" aria-labelledby="itemSheetTitle" novalidate>
                    <div class="sheet-handle"></div>
                    <div class="sheet-head">
                        <h2 id="itemSheetTitle">${isNew ? 'Adicionar item' : 'Corrigir item'}</h2>
                        <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Fechar">${Icons.close}</button>
                    </div>

                    <div class="field">
                        <label for="fName">Nome</label>
                        <input id="fName" name="name" type="text" autocomplete="off" value="${Fmt.esc(name)}" required>
                    </div>
                    <div class="field-row">
                        <div class="field">
                            <label for="fQty">Quantidade</label>
                            <input id="fQty" name="qty" type="number" inputmode="numeric" min="1" max="99" step="1" value="${qty}" required>
                        </div>
                        <div class="field">
                            <label for="fPrice">Preço pago por unidade (R$)</label>
                            <input id="fPrice" name="price" type="text" inputmode="decimal" autocomplete="off" value="${price}" placeholder="0,00" required>
                        </div>
                    </div>
                    <p class="field-error" id="itemFormError" hidden></p>

                    <div class="sheet-actions">
                        <button type="submit" class="btn btn-primary">${isNew ? 'Adicionar' : 'Salvar'}</button>
                        ${isNew ? '' : `<button type="button" class="btn btn-secondary btn-danger" data-action="delete-item" data-id="${Fmt.esc(item.id)}">Remover item</button>`}
                    </div>
                </form>
            </div>
        `;
    },

    // ========================
    // Erro
    // ========================
    errorScreen(message) {
        return `
            <main class="screen error">
                <div class="error-icon">${Icons.alertLarge}</div>
                <h1>Não deu para ler a nota</h1>
                <p>${Fmt.esc(message)}</p>
                <button class="btn btn-primary" data-action="retry">Tentar de novo</button>
            </main>
        `;
    }
};

window.Fmt = Fmt;
window.Icons = Icons;
window.Components = Components;
