/**
 * DivUp PWA - Main Application
 *
 * Telas inteiras só são redesenhadas ao trocar de tela. Dentro da Divisão,
 * cada interação atualiza apenas o card afetado e os totais, para a lista
 * não perder a rolagem nem repetir animações.
 */

const TIP_PRESETS = [0, 10, 15];
const MAX_SPLIT = 12;
const STORAGE = {
    get(key, fallback) {
        try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch { /* storage indisponível */ }
    }
};

const App = {
    state: {
        screen: 'home',          // 'home' | 'loading' | 'receipt' | 'history' | 'error'
        receipt: null,           // { title, date, subtotal, total, items: [{ id, name, quantity, unitPrice, sel, split }] }
        tip: { mode: 'preset', preset: 10, custom: '' },
        editing: false,
        loading: { step: 0, photoUrl: null, controller: null },
        errorMessage: '',
        sheet: null,             // null | { type: 'share' } | { type: 'item', id } | { type: 'account' }
        user: null,              // { email, name, picture } quando logado
        authConfig: null,        // { google_client_id }
        account: { confirmDelete: false, error: '' },
        history: { loading: false, error: '', items: [], pendingDelete: null },
        lastSaved: ''            // evita salvar de novo uma conta sem mudanças
    },

    root: null,

    init() {
        this.root = document.getElementById('app');
        this.root.addEventListener('click', (e) => this.onClick(e));
        this.root.addEventListener('input', (e) => this.onInput(e));
        this.root.addEventListener('change', (e) => this.onChange(e));
        this.root.addEventListener('submit', (e) => this.onSubmit(e));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.sheet) this.closeSheet();
        });
        // Fechou ou trocou de app no meio da divisão: salva no histórico
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.saveToHistory({ keepalive: true });
        });
        this.render();
        this.loadSession();
    },

    // =====================================================
    // Renderização
    // =====================================================
    render() {
        const s = this.state;
        let html = '';
        switch (s.screen) {
            case 'home': html = Components.homeScreen(s.user); break;
            case 'history': html = Components.historyScreen(this.historyView()); break;
            case 'loading': html = Components.loadingScreen(s.loading.photoUrl, s.loading.step); break;
            case 'receipt': html = Components.receiptScreen(this.receiptView()); break;
            case 'error': html = Components.errorScreen(s.errorMessage); break;
        }
        this.root.innerHTML = html;
    },

    go(screen) {
        this.state.screen = screen;
        this.state.sheet = null;
        this.render();
    },

    // =====================================================
    // Cálculos
    // =====================================================
    tipPercent() {
        const t = this.state.tip;
        if (t.mode === 'custom') {
            const n = Fmt.parseNum(t.custom);
            return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
        }
        return t.preset;
    },

    itemShare(it) {
        return it.sel * it.unitPrice / it.split;
    },

    /** Soma de todos os itens (já com desconto de item) e o desconto da conta aplicável. */
    billDiscount() {
        const r = this.state.receipt;
        const itemsSum = (r?.items || []).reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
        const discount = Math.min(r?.discount || 0, itemsSum);
        return { itemsSum, discount, ratio: itemsSum > 0 ? discount / itemsSum : 0 };
    },

    totals() {
        const items = this.state.receipt?.items || [];
        const itemsAmount = items.reduce((sum, it) => sum + this.itemShare(it), 0);
        // Desconto da conta rateado proporcionalmente ao que cada um consumiu
        const myDiscount = itemsAmount * this.billDiscount().ratio;
        const subtotal = itemsAmount - myDiscount;
        const pct = this.tipPercent();
        const tipAmount = subtotal * pct / 100;
        return {
            itemsAmount, myDiscount, subtotal, pct, tipAmount,
            total: subtotal + tipAmount,
            any: items.some(it => it.sel > 0)
        };
    },

    checkView() {
        const r = this.state.receipt;
        if (!r || !r.items.length) return null;
        const bill = this.billDiscount();
        const sum = bill.itemsSum - bill.discount;
        const savings = bill.discount + r.items.reduce((acc, it) => acc + (it.discount || 0), 0);
        const candidates = [r.subtotal, r.total].filter(v => typeof v === 'number' && v > 0);
        if (!candidates.length) return null;
        const ok = candidates.some(v => Math.abs(v - sum) <= 0.05);
        return {
            ok,
            sum: Fmt.brl(sum),
            expected: Fmt.brl(r.total || candidates[0]),
            savings: savings > 0.004 ? Fmt.brl(savings) : ''
        };
    },

    // =====================================================
    // Views (dados prontos para os componentes)
    // =====================================================
    itemView(it) {
        const editing = this.state.editing;
        const selected = it.sel > 0;
        const full = it.quantity * it.unitPrice;
        const partial = selected && (it.sel < it.quantity || it.split > 1);
        return {
            id: it.id,
            name: it.name,
            editing,
            selected: selected && !editing,
            meta: this.itemMeta(it),
            price: Fmt.brl(selected && !editing ? this.itemShare(it) : full),
            priceSub: partial && !editing ? `${it.split > 1 ? `÷ ${it.split} · ` : ''}de ${Fmt.brl(full)}` : '',
            showQty: !editing && selected && it.quantity > 1,
            qtyLabel: `${it.sel} de ${it.quantity}`,
            qtyDecDisabled: it.sel <= 1,
            qtyIncDisabled: it.sel >= it.quantity,
            canSplit: !editing && selected && it.split <= 1,
            isSplit: !editing && selected && it.split > 1,
            splitLabel: `${it.split} pessoas`,
            splitIncDisabled: it.split >= MAX_SPLIT
        };
    },

    itemMeta(it) {
        const qty = it.quantity > 1 ? `${it.quantity} × ` : '';
        if (it.discount > 0) {
            return `${qty}${Fmt.brl(it.listUnitPrice)} · desconto −${Fmt.brl(it.discount)}`;
        }
        return `${qty}${Fmt.brl(it.unitPrice)}`;
    },

    footerView() {
        const t = this.totals();
        const tip = this.state.tip;
        const isCustom = tip.mode === 'custom';
        const tips = TIP_PRESETS.map(v => ({ value: v, label: `${v}%`, on: !isCustom && tip.preset === v }));
        tips.push({ value: 'custom', label: isCustom ? `${Fmt.num(t.pct)}%` : 'Outro', on: isCustom });
        return {
            tips,
            customOn: isCustom,
            customValue: tip.custom,
            total: Fmt.brl(t.total),
            detail: this.totalDetail(t),
            any: t.any
        };
    },

    totalDetail(t) {
        if (!t.any) return 'Toque nos itens que você consumiu';
        const discount = t.myDiscount > 0.004 ? ` − desconto ${Fmt.brl(t.myDiscount)}` : '';
        return `itens ${Fmt.brl(t.itemsAmount)}${discount} + serviço ${Fmt.brl(t.tipAmount)}`;
    },

    receiptView() {
        const r = this.state.receipt;
        const t = this.totals();
        return {
            title: r.title,
            subtitle: this.subtitle(),
            editing: this.state.editing,
            check: this.checkView(),
            bulkLabel: t.any ? 'Limpar' : 'Marcar tudo',
            items: r.items.map(it => this.itemView(it)),
            footer: this.footerView()
        };
    },

    subtitle() {
        const r = this.state.receipt;
        const parts = [];
        if (r.date) parts.push(r.date);
        parts.push(Fmt.plural(r.items.length, 'item', 'itens'));
        return parts.join(' · ');
    },

    // =====================================================
    // Atualizações parciais da Divisão
    // =====================================================
    $(sel) { return this.root.querySelector(sel); },

    findItem(id) {
        return this.state.receipt?.items.find(it => it.id === id);
    },

    refreshItem(id) {
        const it = this.findItem(id);
        const card = this.root.querySelector(`[data-item="${CSS.escape(id)}"]`);
        if (!it || !card) return;
        card.outerHTML = Components.itemCard(this.itemView(it));
    },

    refreshList() {
        const list = this.$('#itemList');
        if (!list) return;
        const scroll = list.scrollTop;
        list.innerHTML = this.state.receipt.items.map(it => Components.itemCard(this.itemView(it))).join('') +
            `<button class="add-item" data-action="add-item">${Icons.plus}Adicionar item que faltou</button>`;
        list.scrollTop = scroll;
    },

    refreshHeader() {
        const editing = this.state.editing;
        this.$('#checkStrip').innerHTML = Components.checkStrip(this.checkView());
        this.$('#receiptSubtitle').textContent = this.subtitle();
        this.$('#btnEdit').textContent = editing ? 'Concluir' : 'Editar';
        this.$('#listHint').textContent = editing ? 'Toque num item para corrigir' : 'Toque no que é seu';
        this.$('#btnBulk').hidden = editing;
    },

    refreshFooter() {
        this.$('#footer').innerHTML = Components.footer(this.footerView());
    },

    /** Atualiza só os números (sem recriar o campo de serviço personalizado). */
    refreshTotals() {
        const t = this.totals();
        this.$('#totalValue').textContent = Fmt.brl(t.total);
        this.$('#totalDetail').textContent = this.totalDetail(t);
        this.$('#btnSend').disabled = !t.any;
        this.$('#btnBulk').textContent = t.any ? 'Limpar' : 'Marcar tudo';
        const customChip = this.root.querySelector('.chip[data-tip="custom"]');
        if (customChip && this.state.tip.mode === 'custom') customChip.textContent = `${Fmt.num(t.pct)}%`;
    },

    // =====================================================
    // Eventos
    // =====================================================
    onClick(e) {
        const el = e.target.closest('[data-action]');
        if (!el || !this.root.contains(el)) return;
        const action = el.dataset.action;
        const id = el.dataset.id;

        // O fundo escurecido fecha o sheet, mas cliques dentro do sheet não.
        if (action === 'close-sheet' && el.classList.contains('sheet-scrim') && e.target !== el) return;

        switch (action) {
            // Início
            case 'camera': this.$('#cameraInput')?.click(); break;
            case 'gallery': this.$('#galleryInput')?.click(); break;

            // Lendo
            case 'cancel-loading': this.cancelLoading(); break;

            // Divisão
            case 'new-receipt': this.newReceipt(); break;
            case 'toggle': this.toggleItem(id); break;
            case 'qty-inc': this.changeQty(id, +1); break;
            case 'qty-dec': this.changeQty(id, -1); break;
            case 'split-start': this.setSplit(id, 2); break;
            case 'split-inc': this.setSplit(id, (this.findItem(id)?.split || 1) + 1); break;
            case 'split-dec': this.setSplit(id, (this.findItem(id)?.split || 1) - 1); break;
            case 'bulk': this.bulkSelect(); break;
            case 'tip': this.pickTip(el.dataset.tip); break;
            case 'toggle-edit': this.toggleEdit(); break;
            case 'edit-item': this.openSheet({ type: 'item', id }); break;
            case 'add-item': this.openSheet({ type: 'item', id: null }); break;
            case 'delete-item': this.deleteItem(id); break;
            case 'open-share': this.saveToHistory(); this.openSheet({ type: 'share' }); break;

            // Sheets
            case 'close-sheet': this.closeSheet(); break;
            case 'share-whatsapp': this.shareWhatsApp(); break;
            case 'share-copy': this.shareCopy(); break;
            case 'share-native': this.shareNative(); break;

            // Erro
            case 'retry': this.go('home'); break;

            // Conta e histórico
            case 'open-account': this.openSheet({ type: 'account' }); break;
            case 'open-history': this.openHistory(); break;
            case 'go-home': this.go('home'); break;
            case 'open-saved': this.openSaved(id); break;
            case 'delete-saved': this.deleteSaved(id); break;
            case 'logout': this.logout(); break;
            case 'delete-account': this.setAccount({ confirmDelete: true, error: '' }); break;
            case 'delete-account-cancel': this.setAccount({ confirmDelete: false, error: '' }); break;
            case 'delete-account-confirm': this.deleteAccount(); break;
        }
    },

    onChange(e) {
        if (e.target.id === 'cameraInput' || e.target.id === 'galleryInput') {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) this.handleImageSelected(file);
        } else if (e.target.id === 'pixToggle') {
            STORAGE.set('divup.pixOn', e.target.checked ? '1' : '0');
            const field = this.$('#pixField');
            if (field) field.hidden = !e.target.checked;
            if (e.target.checked) this.$('#pixKey')?.focus();
        }
    },

    onInput(e) {
        if (e.target.id === 'customTip') {
            const clean = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5);
            if (clean !== e.target.value) e.target.value = clean;
            this.state.tip.custom = clean;
            this.refreshTotals();
        } else if (e.target.id === 'pixKey') {
            STORAGE.set('divup.pixKey', e.target.value.trim());
        }
    },

    onSubmit(e) {
        if (e.target.id === 'itemForm') {
            e.preventDefault();
            this.saveItemForm(e.target);
        }
    },

    // =====================================================
    // Fluxo: foto -> leitura -> divisão
    // =====================================================
    async handleImageSelected(file) {
        // A pré-visualização usa a foto já reduzida: abrir a original aqui
        // dobraria o trabalho de decodificação no celular.
        let photoUrl = null;
        const controller = new AbortController();
        this.state.loading = { step: 0, photoUrl: null, controller };
        this.go('loading');

        try {
            const receipt = await API.processReceipt(file, {
                signal: controller.signal,
                onProgress: (step) => this.setLoadingStep(step),
                onPhoto: (small) => {
                    photoUrl = URL.createObjectURL(small);
                    this.showLoadingPhoto(photoUrl);
                }
            });
            if (controller.signal.aborted) return;

            this.setLoadingStep(2);
            await new Promise(r => setTimeout(r, 300));
            this.setLoadingStep(3);
            await new Promise(r => setTimeout(r, 250));
            if (controller.signal.aborted) return;

            this.state.receipt = receipt;
            this.state.editing = false;
            this.state.tip = { mode: 'preset', preset: 10, custom: this.state.tip.custom };
            this.go('receipt');
        } catch (error) {
            if (error.name === 'AbortError' || controller.signal.aborted) return;
            console.error('Error processing receipt:', error);
            this.state.errorMessage = error.message || 'Tente fotografar de novo, com a nota inteira e bem iluminada.';
            this.go('error');
        } finally {
            if (photoUrl) URL.revokeObjectURL(photoUrl);
        }
    },

    showLoadingPhoto(url) {
        if (this.state.screen !== 'loading') return;
        this.state.loading.photoUrl = url;
        const box = this.$('.loading-photo');
        if (!box || box.querySelector('img')) return;
        const img = document.createElement('img');
        img.alt = '';
        img.src = url;
        box.prepend(img);
    },

    setLoadingStep(step) {
        if (this.state.screen !== 'loading') return;
        this.state.loading.step = step;
        const list = this.$('.steps');
        if (list) list.outerHTML = Components.loadingSteps(step);
    },

    cancelLoading() {
        this.state.loading.controller?.abort();
        this.go('home');
    },

    newReceipt() {
        this.saveToHistory();
        this.state.receipt = null;
        this.state.editing = false;
        this.go('home');
    },

    // =====================================================
    // Seleção, quantidade e divisão
    // =====================================================
    toggleItem(id) {
        const it = this.findItem(id);
        if (!it) return;
        if (it.sel > 0) {
            it.sel = 0;
            it.split = 1;
        } else {
            it.sel = it.quantity;
        }
        this.refreshItem(id);
        this.refreshTotals();
    },

    changeQty(id, delta) {
        const it = this.findItem(id);
        if (!it) return;
        it.sel = Math.min(it.quantity, Math.max(1, it.sel + delta));
        this.refreshItem(id);
        this.refreshTotals();
    },

    setSplit(id, value) {
        const it = this.findItem(id);
        if (!it) return;
        it.split = Math.min(MAX_SPLIT, Math.max(1, value));
        this.refreshItem(id);
        this.refreshTotals();
        // Mantém o foco no controle após o card ser recriado
        const focusTarget = it.split > 1 ? 'split-inc' : 'split-start';
        this.root.querySelector(`[data-item="${CSS.escape(id)}"] [data-action="${focusTarget}"]`)?.focus();
    },

    bulkSelect() {
        const items = this.state.receipt.items;
        const any = items.some(it => it.sel > 0);
        items.forEach(it => {
            it.sel = any ? 0 : it.quantity;
            it.split = 1;
        });
        this.refreshList();
        this.refreshTotals();
    },

    pickTip(value) {
        if (value === 'custom') {
            this.state.tip.mode = 'custom';
            if (!this.state.tip.custom) this.state.tip.custom = '12';
        } else {
            this.state.tip.mode = 'preset';
            this.state.tip.preset = Number(value);
        }
        this.refreshFooter();
        if (value === 'custom') {
            const input = this.$('#customTip');
            input?.focus();
            input?.select();
        }
    },

    // =====================================================
    // Edição de itens
    // =====================================================
    toggleEdit() {
        this.state.editing = !this.state.editing;
        this.refreshHeader();
        this.refreshList();
    },

    saveItemForm(form) {
        const name = form.elements.name.value.trim();
        const qty = parseInt(form.elements.qty.value, 10);
        const price = Fmt.parseNum(form.elements.price.value);
        const errorEl = form.querySelector('#itemFormError');

        let error = '';
        if (!name) error = 'Informe o nome do item.';
        else if (!Number.isInteger(qty) || qty < 1 || qty > 99) error = 'A quantidade deve ser entre 1 e 99.';
        else if (!Number.isFinite(price) || price < 0) error = 'Informe um preço válido, como 12,90.';
        if (error) {
            errorEl.textContent = error;
            errorEl.hidden = false;
            return;
        }

        const id = this.state.sheet?.id;
        if (id) {
            const it = this.findItem(id);
            if (!it) return;
            const wasFull = it.sel > 0 && it.sel === it.quantity;
            const unitDiscount = (it.discount || 0) / it.quantity;
            if (Math.abs(price - it.unitPrice) > 0.004) {
                // Preço corrigido à mão: passa a ser o preço pago, sem desconto separado
                it.unitPrice = Fmt.round2(price);
                it.listUnitPrice = it.unitPrice;
                it.discount = 0;
            } else {
                it.discount = Fmt.round2(unitDiscount * qty);
            }
            it.name = name;
            it.quantity = qty;
            if (wasFull) it.sel = qty;
            it.sel = Math.min(it.sel, qty);
        } else {
            this.state.receipt.items.push({
                id: `local-${Date.now()}`,
                name,
                quantity: qty,
                unitPrice: Fmt.round2(price),
                listUnitPrice: Fmt.round2(price),
                discount: 0,
                sel: 0,
                split: 1
            });
        }

        this.closeSheet();
        this.refreshHeader();
        this.refreshList();
        this.refreshTotals();
        if (!id) {
            const list = this.$('#itemList');
            if (list) list.scrollTop = list.scrollHeight;
        }
    },

    deleteItem(id) {
        const r = this.state.receipt;
        r.items = r.items.filter(it => it.id !== id);
        this.closeSheet();
        this.refreshHeader();
        this.refreshList();
        this.refreshTotals();
    },

    // =====================================================
    // Sheets
    // =====================================================
    openSheet(sheet) {
        this.state.sheet = sheet;
        const root = this.$('#sheetRoot');
        if (!root) return;

        if (sheet.type === 'share') {
            root.innerHTML = Components.shareSheet(this.shareView());
            this.$('[data-action="share-whatsapp"]')?.focus();
        } else if (sheet.type === 'item') {
            const item = sheet.id ? this.findItem(sheet.id) : null;
            root.innerHTML = Components.itemSheet(item);
            this.$('#fName')?.focus();
        } else if (sheet.type === 'account') {
            root.innerHTML = Components.accountSheet(this.accountView());
            if (!this.state.user) this.renderGoogleButton();
        }
    },

    closeSheet() {
        this.state.sheet = null;
        const root = this.$('#sheetRoot');
        if (root) root.innerHTML = '';
    },

    // =====================================================
    // Compartilhar
    // =====================================================
    shareView() {
        const r = this.state.receipt;
        const t = this.totals();
        const lines = r.items.filter(it => it.sel > 0).map(it => {
            const notes = [];
            if (it.quantity > 1 && it.sel < it.quantity) notes.push(`${it.sel} de ${it.quantity}`);
            else if (it.sel > 1) notes.push(`${it.sel}x`);
            if (it.split > 1) notes.push(`÷ ${it.split}`);
            if (it.discount > 0) notes.push('c/ desconto');
            return {
                label: notes.length ? `${it.name} (${notes.join(', ')})` : it.name,
                value: Fmt.brl(this.itemShare(it))
            };
        });
        if (t.myDiscount > 0.004) lines.push({ label: 'Desconto da conta (proporcional)', value: `−${Fmt.brl(t.myDiscount)}` });
        if (t.pct > 0) lines.push({ label: `Serviço ${Fmt.num(t.pct)}%`, value: Fmt.brl(t.tipAmount) });

        return {
            title: r.date ? `${r.title} · ${r.date}` : r.title,
            lines,
            total: Fmt.brl(t.total),
            pixOn: STORAGE.get('divup.pixOn', '0') === '1',
            pixKey: STORAGE.get('divup.pixKey', ''),
            canNativeShare: typeof navigator.share === 'function',
            loggedIn: !!this.state.user
        };
    },

    /**
     * Mensagem no estilo "recibo": bloco monoespaçado com valores alinhados.
     * 28 colunas cabem sem quebrar de linha na maioria dos celulares.
     */
    shareText() {
        const W = 28;
        const r = this.state.receipt;
        const t = this.totals();
        const money = Fmt.money;
        const clean = (s) => String(s).replace(/[`*_~]/g, '').replace(/\s+/g, ' ').trim();
        const fit = (s, max) => (s.length <= max ? s : s.slice(0, Math.max(1, max - 1)).trimEnd() + '…');
        const row = (label, value) => {
            const left = fit(label, W - value.length - 1);
            return left + ' '.repeat(Math.max(1, W - left.length - value.length)) + value;
        };

        const rows = r.items.filter(it => it.sel > 0).map(it => {
            const notes = [];
            if (it.quantity > 1 && it.sel < it.quantity) notes.push(`${it.sel}/${it.quantity}`);
            else if (it.sel > 1) notes.push(`${it.sel}x`);
            if (it.split > 1) notes.push(`÷${it.split}`);
            const note = notes.length ? ' ' + notes.join(' ') : '';
            const value = money(this.itemShare(it));
            // Corta o nome, nunca as anotações (÷2, 2/4)
            const name = fit(Fmt.sentenceCase(clean(it.name)), W - value.length - 1 - note.length);
            return row(name + note, value);
        });
        if (t.myDiscount > 0.004) rows.push(row('Desconto da conta', '-' + money(t.myDiscount)));
        if (t.pct > 0) rows.push(row(`Serviço ${Fmt.num(t.pct)}%`, money(t.tipAmount)));
        rows.push('-'.repeat(W));
        rows.push(row('MINHA PARTE', Fmt.brl(t.total)));

        const title = `🧾 *${Fmt.titleCase(clean(r.title))}*` + (r.date ? ` · ${r.date}` : '');
        let text = `${title}\n\n\`\`\`\n${rows.join('\n')}\n\`\`\``;

        const pixKey = (this.$('#pixKey')?.value ?? STORAGE.get('divup.pixKey', '')).trim();
        const pixOn = this.$('#pixToggle')?.checked ?? STORAGE.get('divup.pixOn', '0') === '1';
        if (pixOn && pixKey) text += `\n\nPix: ${clean(pixKey)}`;
        return text;
    },

    shareWhatsApp() {
        const url = `https://wa.me/?text=${encodeURIComponent(this.shareText())}`;
        window.open(url, '_blank', 'noopener');
    },

    async shareCopy() {
        const text = this.shareText();
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
        this.toast('Texto copiado');
    },

    async shareNative() {
        try {
            await navigator.share({ title: 'Minha parte da conta', text: this.shareText() });
        } catch (err) {
            if (err.name !== 'AbortError') this.toast('Não foi possível compartilhar');
        }
    },

    // =====================================================
    // Conta (login com Google)
    // =====================================================
    async loadSession() {
        try {
            const [me, config] = await Promise.all([API.me(), API.authConfig()]);
            this.state.user = me.user;
            this.state.authConfig = config;
            if (this.state.screen === 'home' && !this.state.sheet) this.render();
        } catch (error) {
            console.warn('Sessão indisponível:', error);
        }
    },

    accountView() {
        return {
            user: this.state.user,
            configured: !!this.state.authConfig?.google_client_id,
            confirmDelete: this.state.account.confirmDelete,
            error: this.state.account.error
        };
    },

    setAccount(patch) {
        Object.assign(this.state.account, patch);
        if (this.state.sheet?.type === 'account') this.openSheet({ type: 'account' });
    },

    loadGis() {
        if (window.google?.accounts?.id) return Promise.resolve();
        if (!this.gisPromise) {
            this.gisPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => { this.gisPromise = null; reject(new Error('gis')); };
                document.head.appendChild(script);
            });
        }
        return this.gisPromise;
    },

    async renderGoogleButton() {
        try {
            if (!this.state.authConfig) this.state.authConfig = await API.authConfig();
            const clientId = this.state.authConfig.google_client_id;
            if (!clientId) return;
            await this.loadGis();
            const el = this.$('#googleButton');
            if (!el) return;
            if (!this.gisReady) {
                google.accounts.id.initialize({
                    client_id: clientId,
                    callback: (response) => this.onGoogleCredential(response.credential),
                    ux_mode: 'popup',
                    context: 'signin',
                    itp_support: true
                });
                this.gisReady = true;
            }
            el.innerHTML = '';
            const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
            google.accounts.id.renderButton(el, {
                type: 'standard',
                theme: dark ? 'filled_black' : 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'pill',
                logo_alignment: 'center',
                width: Math.min(Math.max(el.clientWidth, 240), 400),
                locale: 'pt-BR'
            });
        } catch (error) {
            console.warn('Login do Google indisponível:', error);
            this.setAccount({ error: 'Não foi possível carregar o login do Google. Verifique sua conexão.' });
        }
    },

    async onGoogleCredential(credential) {
        try {
            const { user } = await API.loginGoogle(credential);
            this.state.user = user;
            this.state.account = { confirmDelete: false, error: '' };
            this.closeSheet();
            this.toast(`Olá, ${(user.name || user.email).split(' ')[0]}!`);
            if (this.state.screen === 'home') this.render();
            if (this.state.screen === 'receipt') this.saveToHistory();
        } catch (error) {
            this.setAccount({ error: error.message });
        }
    },

    async logout() {
        try { await API.logout(); } catch { /* sai localmente mesmo assim */ }
        window.google?.accounts?.id?.disableAutoSelect?.();
        this.state.user = null;
        this.state.history = { loading: false, error: '', items: [], pendingDelete: null };
        this.closeSheet();
        if (this.state.screen === 'home' || this.state.screen === 'history') this.go('home');
        this.toast('Você saiu da conta');
    },

    async deleteAccount() {
        try {
            await API.deleteAccount();
            window.google?.accounts?.id?.disableAutoSelect?.();
            this.state.user = null;
            this.state.account = { confirmDelete: false, error: '' };
            this.state.history = { loading: false, error: '', items: [], pendingDelete: null };
            this.go('home');
            this.toast('Conta e histórico excluídos');
        } catch (error) {
            this.setAccount({ error: error.message });
        }
    },

    // =====================================================
    // Histórico
    // =====================================================
    historyEntry() {
        const r = this.state.receipt;
        return {
            id: r.id,
            title: r.title,
            date: r.date || '',
            subtotal: r.subtotal || 0,
            total: r.total || 0,
            discount: r.discount || 0,
            items: r.items.map(it => ({
                id: String(it.id),
                name: it.name,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                listUnitPrice: it.listUnitPrice || it.unitPrice,
                discount: it.discount || 0,
                sel: it.sel,
                split: it.split
            })),
            tip: { ...this.state.tip, custom: String(this.state.tip.custom || '') },
            my_total: Fmt.round2(this.totals().total)
        };
    },

    /** Salva a conta atual se houver login e algo marcado. Silencioso em caso de erro. */
    async saveToHistory({ keepalive = false } = {}) {
        const r = this.state.receipt;
        if (!this.state.user || !r || this.state.screen !== 'receipt') return;
        if (!r.items.some(it => it.sel > 0)) return;
        const entry = this.historyEntry();
        const json = JSON.stringify(entry);
        if (json === this.state.lastSaved) return;
        try {
            await API.saveHistory(entry, { keepalive });
            this.state.lastSaved = json;
        } catch (error) {
            console.warn('Não foi possível salvar no histórico:', error);
            if (error.status === 401) this.state.user = null;
        }
    },

    async openHistory() {
        if (!this.state.user) return this.openSheet({ type: 'account' });
        await this.saveToHistory();
        this.state.history = { loading: true, error: '', items: [], pendingDelete: null };
        this.go('history');
        try {
            const { receipts } = await API.listHistory();
            this.state.history = { loading: false, error: '', items: receipts, pendingDelete: null };
        } catch (error) {
            if (error.status === 401) {
                this.state.user = null;
                return this.go('home');
            }
            this.state.history = { loading: false, error: error.message, items: [], pendingDelete: null };
        }
        if (this.state.screen === 'history') this.render();
    },

    historyView() {
        const h = this.state.history;
        const months = new Map();
        for (const r of h.items) {
            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.date || '');
            const key = m ? `${m[3]}-${m[2]}` : (r.created_at || '').slice(0, 7);
            if (!months.has(key)) months.set(key, []);
            const created = (r.created_at || '').slice(0, 10).split('-').reverse().join('/');
            months.get(key).push({
                id: r.id,
                title: Fmt.titleCase(r.title),
                date: r.date || created,
                total: Fmt.brl(r.my_total),
                amount: r.my_total,
                pending: h.pendingDelete === r.id
            });
        }
        const groups = [...months.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([key, rows]) => {
                const [y, mo] = key.split('-').map(Number);
                let label = key;
                if (y && mo) {
                    label = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    label = label.charAt(0).toUpperCase() + label.slice(1);
                }
                return { label, total: Fmt.brl(rows.reduce((acc, r) => acc + r.amount, 0)), rows };
            });
        return { loading: h.loading, error: h.error, groups };
    },

    async openSaved(id) {
        try {
            const saved = await API.getHistory(id);
            const p = saved.payload;
            this.state.receipt = {
                id: p.id,
                title: p.title,
                date: p.date,
                subtotal: p.subtotal,
                total: p.total,
                discount: p.discount || 0,
                items: p.items.map(it => ({ ...it, listUnitPrice: it.listUnitPrice || it.unitPrice, discount: it.discount || 0 }))
            };
            this.state.tip = { mode: p.tip.mode, preset: p.tip.preset, custom: p.tip.custom || '' };
            this.state.editing = false;
            this.state.lastSaved = JSON.stringify(this.historyEntry());
            this.go('receipt');
        } catch (error) {
            this.toast(error.message || 'Não foi possível abrir essa conta');
        }
    },

    /** Primeiro toque arma ("Apagar"), segundo toque apaga. */
    async deleteSaved(id) {
        const h = this.state.history;
        if (h.pendingDelete !== id) {
            h.pendingDelete = id;
            clearTimeout(this.deleteTimer);
            this.deleteTimer = setTimeout(() => {
                if (h.pendingDelete === id) { h.pendingDelete = null; this.refreshHistoryList(); }
            }, 4000);
            this.refreshHistoryList();
            this.root.querySelector(`.history-delete[data-id="${CSS.escape(id)}"]`)?.focus();
            return;
        }
        h.pendingDelete = null;
        h.items = h.items.filter(r => r.id !== id);
        this.refreshHistoryList();
        try {
            await API.deleteHistory(id);
            this.toast('Conta apagada do histórico');
        } catch (error) {
            this.toast('Não foi possível apagar. Tente de novo.');
            this.openHistory();
        }
    },

    refreshHistoryList() {
        if (this.state.screen !== 'history') return;
        const list = this.$('#historyList');
        if (!list) return;
        const scroll = list.scrollTop;
        const tmp = document.createElement('div');
        tmp.innerHTML = Components.historyScreen(this.historyView());
        list.innerHTML = tmp.querySelector('#historyList').innerHTML;
        list.scrollTop = scroll;
    },

    toast(message) {
        document.querySelector('.toast')?.remove();
        const el = document.createElement('div');
        el.className = 'toast';
        el.setAttribute('role', 'status');
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
