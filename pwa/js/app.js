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
        screen: 'home',          // 'home' | 'loading' | 'receipt' | 'error'
        receipt: null,           // { title, date, subtotal, total, items: [{ id, name, quantity, unitPrice, sel, split }] }
        tip: { mode: 'preset', preset: 10, custom: '' },
        editing: false,
        loading: { step: 0, photoUrl: null, controller: null },
        errorMessage: '',
        sheet: null              // null | { type: 'share' } | { type: 'item', id: string|null }
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
        this.render();
    },

    // =====================================================
    // Renderização
    // =====================================================
    render() {
        const s = this.state;
        let html = '';
        switch (s.screen) {
            case 'home': html = Components.homeScreen(); break;
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

    totals() {
        const items = this.state.receipt?.items || [];
        const subtotal = items.reduce((sum, it) => sum + this.itemShare(it), 0);
        const pct = this.tipPercent();
        const tipAmount = subtotal * pct / 100;
        return { subtotal, pct, tipAmount, total: subtotal + tipAmount, any: items.some(it => it.sel > 0) };
    },

    checkView() {
        const r = this.state.receipt;
        if (!r) return null;
        const sum = r.items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
        const candidates = [r.subtotal, r.total].filter(v => typeof v === 'number' && v > 0);
        if (!candidates.length || !r.items.length) return null;
        const ok = candidates.some(v => Math.abs(v - sum) <= 0.05);
        return { ok, sum: Fmt.brl(sum), expected: Fmt.brl(candidates[0]) };
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
            meta: it.quantity > 1 ? `${it.quantity} × ${Fmt.brl(it.unitPrice)}` : Fmt.brl(it.unitPrice),
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
        return `itens ${Fmt.brl(t.subtotal)} + serviço ${Fmt.brl(t.tipAmount)}`;
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
            case 'open-share': this.openSheet({ type: 'share' }); break;

            // Sheets
            case 'close-sheet': this.closeSheet(); break;
            case 'share-whatsapp': this.shareWhatsApp(); break;
            case 'share-copy': this.shareCopy(); break;
            case 'share-native': this.shareNative(); break;

            // Erro
            case 'retry': this.go('home'); break;
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
        const photoUrl = URL.createObjectURL(file);
        const controller = new AbortController();
        this.state.loading = { step: 0, photoUrl, controller };
        this.go('loading');

        try {
            const receipt = await API.processReceipt(file, {
                signal: controller.signal,
                onProgress: (step) => this.setLoadingStep(step)
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
            URL.revokeObjectURL(photoUrl);
        }
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
            it.name = name;
            it.quantity = qty;
            it.unitPrice = Fmt.round2(price);
            if (wasFull) it.sel = qty;
            it.sel = Math.min(it.sel, qty);
        } else {
            this.state.receipt.items.push({
                id: `local-${Date.now()}`,
                name,
                quantity: qty,
                unitPrice: Fmt.round2(price),
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
            return {
                label: notes.length ? `${it.name} (${notes.join(', ')})` : it.name,
                value: Fmt.brl(this.itemShare(it))
            };
        });
        if (t.pct > 0) lines.push({ label: `Serviço ${Fmt.num(t.pct)}%`, value: Fmt.brl(t.tipAmount) });

        return {
            title: r.date ? `${r.title} · ${r.date}` : r.title,
            lines,
            total: Fmt.brl(t.total),
            pixOn: STORAGE.get('divup.pixOn', '0') === '1',
            pixKey: STORAGE.get('divup.pixKey', ''),
            canNativeShare: typeof navigator.share === 'function'
        };
    },

    shareText() {
        const v = this.shareView();
        let text = `*${v.title}*\n`;
        v.lines.forEach(l => { text += `${l.label} — ${l.value}\n`; });
        text += `\n*Minha parte: ${v.total}*`;
        const pixKey = (this.$('#pixKey')?.value ?? v.pixKey).trim();
        const pixOn = this.$('#pixToggle')?.checked ?? v.pixOn;
        if (pixOn && pixKey) text += `\nPix: ${pixKey}`;
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
