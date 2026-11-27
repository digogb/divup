/**
 * DivUp — Área de admin (celular)
 *
 * Quatro áreas na barra inferior: Resumo, Bares, Visitar e Limites.
 * Reaproveita API (api.js), Fmt e Icons (components.js) e o visual "Recibo".
 */

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const AdminIcons = {
    summary: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
    bars: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-4h4v4"/></svg>`,
    visit: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
    limits: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/></svg>`,
    download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`
};

const TABS = [
    { id: 'summary', label: 'Resumo', icon: AdminIcons.summary },
    { id: 'casas', label: 'Bares', icon: AdminIcons.bars },
    { id: 'leads', label: 'Visitar', icon: AdminIcons.visit },
    { id: 'limits', label: 'Limites', icon: AdminIcons.limits }
];

const LIMIT_FIELDS = [
    { key: 'monthly_budget_brl', label: 'Teto do mês (R$)', hint: 'Atingido, só os bares parceiros continuam lendo.', step: '0.01' },
    { key: 'hard_budget_brl', label: 'Teto rígido (R$)', hint: 'Atingido, nenhuma leitura. Precisa ser maior ou igual ao teto.', step: '0.01' },
    { key: 'free_reads_per_month', label: 'Leituras grátis por pessoa/mês', hint: 'Fora dos bares parceiros, contadas por aparelho.', step: '1' },
    { key: 'casa_reads_per_month', label: 'Leituras por bar/mês', hint: 'Passou disso, a leitura conta como fora de parceiro.', step: '1' },
    { key: 'ip_reads_per_hour', label: 'Tentativas por IP/hora', hint: 'Proteção contra abuso, vale para todos.', step: '1' }
];

const Admin = {
    state: {
        gate: 'loading',        // 'loading' | 'login' | 'forbidden' | 'ok'
        tab: 'summary',
        month: '',              // 'AAAA-MM'
        currentMonth: '',
        loading: false,
        error: '',
        summary: null,
        usage: null,            // painel de uso do mês (/admin/usage)
        day: null,              // dia tocado no gráfico (AAAA-MM-DD)
        casas: null,
        leads: null,
        limits: null,
        sheet: null             // null | { type: 'new', name } | { type: 'casa', slug }
    },

    root: null,

    async init() {
        this.root = document.getElementById('app');
        this.root.addEventListener('click', (e) => this.onClick(e));
        this.root.addEventListener('submit', (e) => this.onSubmit(e));
        this.root.addEventListener('change', (e) => this.onChange(e));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.state.sheet) this.closeSheet(); });

        const now = new Date();
        this.state.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        this.state.month = this.state.currentMonth;
        this.render();

        try {
            const { user } = await API.me();
            this.state.gate = !user ? 'login' : user.is_admin ? 'ok' : 'forbidden';
        } catch {
            this.state.gate = 'login';
        }
        this.render();
        if (this.state.gate === 'ok') this.load();
    },

    $(sel) { return this.root.querySelector(sel); },

    // =====================================================
    // Dados
    // =====================================================
    async load() {
        const { tab, month } = this.state;
        this.state.loading = true;
        this.state.error = '';
        this.renderBody();
        try {
            if (tab === 'summary') {
                [this.state.summary, this.state.usage] = await Promise.all([
                    API.request('GET', `/admin/summary?mes=${month}`),
                    API.request('GET', `/admin/usage?mes=${month}`)
                ]);
                this.state.day = null;
            }
            if (tab === 'casas') this.state.casas = (await API.request('GET', `/admin/casas?mes=${month}`)).casas;
            if (tab === 'leads') this.state.leads = (await API.request('GET', `/admin/leads?mes=${month}`)).leads;
            if (tab === 'limits') this.state.limits = await API.request('GET', '/admin/limits');
        } catch (error) {
            if (error.status === 401) { this.state.gate = 'login'; this.render(); return; }
            if (error.status === 403) { this.state.gate = 'forbidden'; this.render(); return; }
            this.state.error = error.message || 'Não foi possível carregar.';
        }
        this.state.loading = false;
        this.renderBody();
    },

    // =====================================================
    // Renderização
    // =====================================================
    render() {
        const s = this.state;
        if (s.gate !== 'ok') {
            this.root.innerHTML = `<main class="admin">${this.gateView()}</main>`;
            return;
        }
        this.root.innerHTML = `
            <main class="admin">
                <header class="admin-top">
                    <div class="brand">${Icons.logo}<span class="brand-name">divup</span><span class="admin-tag">admin</span></div>
                    <a class="btn-text" href="/">Abrir o app</a>
                </header>
                <div class="admin-body" id="adminBody"></div>
                <nav class="admin-nav" aria-label="Áreas do admin">
                    ${TABS.map(t => `
                        <button type="button" data-action="tab" data-tab="${t.id}" ${t.id === s.tab ? 'aria-current="page"' : ''}>
                            ${t.icon}<span>${t.label}</span>
                        </button>`).join('')}
                </nav>
            </main>
            <div id="sheetRoot"></div>
        `;
        this.renderBody();
    },

    renderBody() {
        const body = this.$('#adminBody');
        if (!body) return;
        const s = this.state;
        const views = { summary: () => this.summaryView(), casas: () => this.casasView(), leads: () => this.leadsView(), limits: () => this.limitsView() };
        let content;
        if (s.error) content = `<div class="a-empty"><strong>Algo deu errado</strong>${Fmt.esc(s.error)}</div>
            <button class="btn btn-secondary" data-action="reload">Tentar de novo</button>`;
        else content = views[s.tab]();
        body.innerHTML = (s.tab === 'limits' ? '' : this.monthPicker()) + content;
        body.setAttribute('aria-busy', s.loading ? 'true' : 'false');
    },

    gateView() {
        const s = this.state.gate;
        if (s === 'loading') return `<div class="admin-gate"><p>Carregando…</p></div>`;
        if (s === 'forbidden') return `
            <div class="admin-gate">
                <h1>Sem acesso</h1>
                <p>Esta conta Google não tem acesso à área de admin.</p>
                <a class="btn btn-secondary" href="/">Voltar ao app</a>
            </div>`;
        return `
            <div class="admin-gate">
                <h1>Área de admin</h1>
                <p>Entre no app com a sua conta Google (toque em “Entrar”, no alto da tela) e volte para cá.</p>
                <a class="btn btn-primary" href="/">Entrar pelo app</a>
            </div>`;
    },

    monthLabel(month) {
        const [y, m] = month.split('-').map(Number);
        return `${MONTHS[m - 1].charAt(0).toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
    },

    monthPicker() {
        const { month, currentMonth } = this.state;
        return `
            <div class="admin-month">
                <button class="icon-btn" data-action="month" data-step="-1" aria-label="Mês anterior">${Icons.back}</button>
                <strong>${this.monthLabel(month)}</strong>
                <button class="icon-btn" data-action="month" data-step="1" aria-label="Próximo mês" ${month >= currentMonth ? 'disabled' : ''}><span class="icon-flip">${Icons.back}</span></button>
            </div>`;
    },

    loadingView() { return `<p class="a-empty">Carregando…</p>`; },

    // ---------- Resumo: Portão 1, gasto e painel de uso ----------
    summaryView() {
        const d = this.state.summary;
        const u = this.state.usage;
        if (!d || d.month !== this.state.month || !u || u.month !== this.state.month) return this.loadingView();
        const pct = d.budget_brl ? Math.min(100, (d.spent_brl / d.budget_brl) * 100) : 0;
        const returnPct = d.devices_prev_month ? Math.round((d.devices_returning / d.devices_prev_month) * 100) : null;
        const activePct = Math.min(100, (d.devices / u.gate.active_target) * 100);
        return `
            <section class="a-card" aria-label="Portão 1">
                <span class="a-label">Portão 1 · pessoas que leram uma conta no mês</span>
                <span class="a-value">${this.num(d.devices)} <small>de ${this.num(u.gate.active_target)}</small></span>
                <div class="a-bar" role="progressbar" aria-valuenow="${Math.round(activePct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Meta de aparelhos ativos"><span style="width:${activePct}%"></span></div>
                <span class="a-note">${returnPct === null
                    ? 'Voltaram do mês anterior: sem dados ainda.'
                    : `Voltaram do mês anterior: <strong>${returnPct}%</strong> (${d.devices_returning} de ${d.devices_prev_month}) · meta ${u.gate.return_target_pct}%`}</span>
            </section>

            <section class="a-card" aria-label="Gasto com IA">
                <span class="a-label">Gasto com IA</span>
                <span class="a-value">${Fmt.brl(d.spent_brl)} <small>de ${Fmt.brl(d.budget_brl)}</small></span>
                <div class="a-bar ${pct >= 80 ? 'is-warn' : ''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Uso do teto"><span style="width:${pct}%"></span></div>
                <span class="a-note">${d.projected_brl !== null ? `Projeção do mês: ${Fmt.brl(d.projected_brl)} · ` : ''}teto rígido ${Fmt.brl(d.hard_budget_brl)} · R$ ${d.avg_cost_brl.toFixed(4).replace('.', ',')} por leitura</span>
            </section>

            ${this.dailyChart(u.daily)}

            <div class="a-grid">
                ${this.kpi('Contas lidas', d.reads_ok)}
                ${this.kpi('Em bares parceiros', d.reads_partner)}
                ${this.kpi('Fora de parceiros', d.reads_outside)}
                ${this.kpi('Leituras com falha', d.reads_failed)}
            </div>

            ${this.funnelView(u.funnel)}
            ${this.qualityView(u)}
            ${this.distributionView(u)}
            ${this.originView(u)}
        `;
    },

    num(n) { return Number(n || 0).toLocaleString('pt-BR'); },

    /** Contas lidas por dia; tocar numa barra mostra o dia completo. */
    dailyChart(days) {
        const max = Math.max(1, ...days.map(x => x.reads_ok));
        const withData = [...days].reverse().find(x => x.reads_ok || x.opens || x.blocked);
        const sel = days.find(x => x.day === this.state.day) || withData || days[days.length - 1];
        const label = (day) => `${day.slice(8)}/${day.slice(5, 7)}`;
        const ticks = days.filter((_, i) => i % 7 === 0);
        return `
            <section class="a-card" aria-label="Dia a dia">
                <span class="a-label">Contas lidas por dia</span>
                <p class="a-day" aria-live="polite">${sel ? `<strong>${label(sel.day)}</strong> · ${this.plural(sel.reads_ok, 'conta lida', 'contas lidas')} · ${this.plural(sel.opens, 'pessoa abriu', 'pessoas abriram')} o app${sel.reads_failed ? ` · ${this.plural(sel.reads_failed, 'falha', 'falhas')}` : ''}${sel.blocked ? ` · ${this.plural(sel.blocked, 'barrada', 'barradas')} pelo limite` : ''}` : 'Sem dados no mês.'}</p>
                <div class="a-chart">
                    <span class="a-chart-max">${this.num(max)}</span>
                    <div class="a-cols" style="--n:${days.length}">
                        ${days.map(x => `<button class="a-col ${sel && x.day === sel.day ? 'is-on' : ''}" data-action="day" data-day="${x.day}"
                            aria-label="${label(x.day)}: ${this.plural(x.reads_ok, 'conta lida', 'contas lidas')}" aria-pressed="${sel && x.day === sel.day}">
                            <span style="height:${x.reads_ok ? Math.max(3, (x.reads_ok / max) * 100) : 0}%"></span></button>`).join('')}
                    </div>
                    <div class="a-ticks" style="--n:${days.length}">${ticks.map(x => `<span style="grid-column:${days.indexOf(x) + 1}">${Number(x.day.slice(8))}</span>`).join('')}</div>
                </div>
            </section>
        `;
    },

    /** Do abrir o app até mandar a parte no grupo, em aparelhos no mês. */
    funnelView(f) {
        const steps = [
            ['Abriram o app', f.opened],
            ['Fotografaram uma conta', f.tried],
            ['Tiveram a conta lida', f.read_ok],
            ['Enviaram a parte', f.shared]
        ];
        const top = Math.max(1, f.opened, f.tried);
        return `
            <section class="a-card" aria-label="Funil do mês">
                <span class="a-label">Do abrir ao enviar · pessoas no mês</span>
                <div class="a-funnel">${steps.map(([name, n], i) => `
                    <div class="a-step">
                        <div class="a-step-text"><span>${name}</span><strong>${this.num(n)}${i && top ? ` <small>${Math.round((n / top) * 100)}%</small>` : ''}</strong></div>
                        <div class="a-track"><span style="width:${(n / top) * 100}%"></span></div>
                    </div>`).join('')}
                </div>
                <span class="a-note">Contado desde que o registro de eventos entrou no ar.</span>
            </section>
        `;
    },

    qualityView(u) {
        const q = u.quality;
        const reasons = { personal: 'cota pessoal', budget: 'teto do mês', hard: 'teto rígido', hourly: 'limite por hora' };
        const blockedTotal = Object.values(u.blocked).reduce((a, b) => a + b, 0);
        const shares = Object.values(u.shares).reduce((a, b) => a + b, 0);
        const byChannel = { whatsapp: 0, copy: 0, native: 0 };
        Object.entries(u.shares).forEach(([k, n]) => { const c = k.split('-')[0]; if (c in byChannel) byChannel[c] += n; });
        const blockedNote = blockedTotal
            ? Object.entries(u.blocked).map(([k, n]) => `${n} ${reasons[k] || k}`).join(' · ')
            : 'ninguém esbarrou no limite';
        return `
            <div class="a-grid">
                ${this.kpi('Leituras certas', q.success_pct === null ? '—' : `${q.success_pct}%`, `${this.num(q.ok)} de ${this.num(q.attempts)}`)}
                ${this.kpi('Tempo típico', q.p50_s === null ? '—' : `${String(q.p50_s).replace('.', ',')} s`, q.p90_s === null ? '' : `9 em 10 em até ${String(q.p90_s).replace('.', ',')} s`)}
                ${this.kpi('Barradas pelo limite', blockedTotal, blockedNote)}
                ${this.kpi('Envios da parte', shares, `WhatsApp ${byChannel.whatsapp} · copiar ${byChannel.copy} · outros ${byChannel.native}`)}
            </div>
        `;
    },

    /** Quantas leituras cada aparelho fez: quem passa de 3 é quem pagaria por mais. */
    distributionView(u) {
        const max = Math.max(1, ...u.distribution.map(b => b.devices));
        return `
            <section class="a-card" aria-label="Leituras por pessoa">
                <span class="a-label">Leituras por pessoa no mês</span>
                <div class="a-dist">${u.distribution.map(b => `
                    <div class="a-dist-col" aria-label="${b.label} leitura(s): ${this.plural(b.devices, 'pessoa', 'pessoas')}">
                        <strong>${this.num(b.devices)}</strong>
                        <div class="a-dist-bar"><span style="height:${b.devices ? Math.max(4, (b.devices / max) * 100) : 0}%"></span></div>
                        <span>${b.label}</span>
                    </div>`).join('')}
                </div>
                <span class="a-note"><strong>${this.plural(u.over_3, 'pessoa passou', 'pessoas passaram')} de 3 leituras.</strong> São as candidatas a um plano pago.</span>
            </section>
        `;
    },

    originView(u) {
        const i = u.install;
        const names = { conta: 'texto da divisão', indicacao: 'indicação', meta: 'anúncio Meta', instagram: 'Instagram', whatsapp: 'WhatsApp' };
        const sources = Object.entries(u.sources || {});
        const fromLinks = sources.reduce((a, [, n]) => a + n, 0);
        const sourcesNote = sources.length
            ? sources.slice(0, 4).map(([k, n]) => `${Fmt.esc(names[k] || k)} ${this.num(n)}`).join(' · ')
            : 'nenhum link com origem ainda';
        const accepted = (i.accepted || 0) + (i.ios_ok || 0);
        return `
            <div class="a-grid">
                ${this.kpi('Vieram do QR de um bar', u.opened_from_qr, 'pessoas que abriram pelo QR')}
                ${this.kpi('Vieram de um link', fromLinks, sourcesNote)}
                ${this.kpi('Indicaram o app', u.invited || 0, `${this.num((u.sources || {}).indicacao || 0)} chegaram pela indicação`)}
                ${this.kpi('Usam o app instalado', u.opened_installed, 'abriram pela tela inicial')}
                ${this.kpi('Convite de instalar', i.shown || 0, `${accepted} aceitaram · ${(i.closed || 0) + (i.refused || 0)} recusaram`)}
                ${this.kpi('Novas contas Google', u.accounts.new_users, `${this.num(u.accounts.users)} no total · ${this.plural(u.accounts.saved, 'conta salva', 'contas salvas')} no histórico`)}
            </div>
        `;
    },

    kpi(label, value, note = '') {
        return `<div class="a-card"><span class="a-label">${label}</span><span class="a-value">${typeof value === 'number' ? this.num(value) : value}</span>${note ? `<span class="a-note">${note}</span>` : ''}</div>`;
    },

    // ---------- Bares ----------
    casasView() {
        const list = this.state.casas;
        const header = `<button class="btn btn-primary" data-action="new-casa">${Icons.plus}Cadastrar bar</button>`;
        if (!list) return header + this.loadingView();
        if (!list.length) return header + `<div class="a-empty"><strong>Nenhum bar ainda</strong>Cadastre o primeiro e leve o QR Code para as mesas.</div>`;
        return header + `<div class="a-list">${list.map(c => `
            <button class="a-row" data-action="open-casa" data-slug="${Fmt.esc(c.slug)}">
                <span class="a-row-text">
                    <span class="a-row-title">${Fmt.esc(c.name)}</span>
                    <span class="a-row-meta">${this.plural(c.reads, 'conta lida', 'contas lidas')} · ${this.plural(c.devices, 'pessoa', 'pessoas')}</span>
                </span>
                ${c.active ? '' : '<span class="a-badge">Inativo</span>'}
                ${Icons.chevron}
            </button>`).join('')}</div>`;
    },

    // ---------- Visitar ----------
    leadsView() {
        const list = this.state.leads;
        const intro = `<p class="admin-lead">Lugares onde o DivUp foi usado sem o QR Code de um bar parceiro. Leve esses números ao dono.</p>`;
        if (!list) return intro + this.loadingView();
        if (!list.length) return intro + `<div class="a-empty"><strong>Nada por aqui</strong>Quando alguém ler uma conta fora dos bares parceiros, o lugar aparece aqui.</div>`;
        return intro + `<div class="a-list">${list.map(l => `
            <div class="a-row">
                <span class="a-row-text">
                    <span class="a-row-title">${Fmt.esc(l.name)}</span>
                    <span class="a-row-meta">${this.plural(l.reads, 'conta', 'contas')} · ${this.plural(l.devices, 'pessoa', 'pessoas')} · última em ${this.shortDate(l.last_read)}</span>
                </span>
                <button class="btn-text" data-action="new-casa" data-name="${Fmt.esc(l.name)}">Cadastrar</button>
            </div>`).join('')}</div>`;
    },

    // ---------- Limites ----------
    limitsView() {
        const l = this.state.limits;
        if (!l) return this.loadingView();
        return `
            <h1>Limites</h1>
            <p class="admin-lead">Valem na hora, sem novo deploy.</p>
            <form id="limitsForm" class="a-list" novalidate>
                ${LIMIT_FIELDS.map(f => `
                    <div class="field">
                        <label for="l-${f.key}">${f.label}</label>
                        <input id="l-${f.key}" name="${f.key}" type="number" inputmode="decimal" min="0" step="${f.step}" value="${l[f.key]}" required>
                        <span class="field-hint">${f.hint}</span>
                    </div>`).join('')}
                <p class="field-error" id="limitsError" role="alert" hidden></p>
                <button type="submit" class="btn btn-primary">Salvar limites</button>
            </form>`;
    },

    // ---------- Folhas ----------
    openSheet(sheet) {
        this.state.sheet = sheet;
        const root = this.$('#sheetRoot');
        if (!root) return;
        if (sheet.type === 'new') {
            root.innerHTML = this.newCasaSheet(sheet.name || '');
            this.$('#cName')?.focus();
        } else if (sheet.type === 'casa') {
            const casa = this.state.casas?.find(c => c.slug === sheet.slug);
            if (!casa) return this.closeSheet();
            root.innerHTML = this.casaSheet(casa);
        }
    },

    closeSheet() {
        this.state.sheet = null;
        const root = this.$('#sheetRoot');
        if (root) root.innerHTML = '';
    },

    newCasaSheet(name) {
        return `
            <div class="sheet-scrim" data-action="close-sheet">
                <form class="sheet" id="casaForm" role="dialog" aria-modal="true" aria-labelledby="casaTitle" novalidate>
                    <div class="sheet-handle"></div>
                    <div class="sheet-head">
                        <h2 id="casaTitle">Cadastrar bar</h2>
                        <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Fechar">${Icons.close}</button>
                    </div>
                    <div class="field">
                        <label for="cName">Nome do bar</label>
                        <input id="cName" name="name" type="text" autocomplete="off" maxlength="80" value="${Fmt.esc(name)}" required>
                    </div>
                    <div class="field">
                        <label for="cSlug">Código no QR Code (opcional)</label>
                        <input id="cSlug" name="slug" type="text" autocomplete="off" autocapitalize="none" maxlength="40" placeholder="gerado pelo nome" pattern="[a-z0-9-]+">
                        <span class="field-hint">Só letras minúsculas, números e hífen. Ex.: bar-do-ze</span>
                    </div>
                    <p class="field-error" id="casaError" role="alert" hidden></p>
                    <div class="sheet-actions">
                        <button type="submit" class="btn btn-primary">Cadastrar e gerar QR Code</button>
                    </div>
                </form>
            </div>`;
    },

    casaSheet(c) {
        return `
            <div class="sheet-scrim" data-action="close-sheet">
                <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="casaTitle">
                    <div class="sheet-handle"></div>
                    <div class="sheet-head">
                        <h2 id="casaTitle">${Fmt.esc(c.name)}</h2>
                        <button type="button" class="icon-btn" data-action="close-sheet" aria-label="Fechar">${Icons.close}</button>
                    </div>
                    <div class="a-stats">
                        <div><div class="a-value">${c.reads}</div><div class="a-label">contas em ${MONTHS[Number(this.state.month.slice(5)) - 1]}</div></div>
                        <div><div class="a-value">${c.devices}</div><div class="a-label">pessoas</div></div>
                        <div><div class="a-value">${Fmt.brl(c.cost_brl)}</div><div class="a-label">custo de IA</div></div>
                    </div>
                    <img class="a-qr" src="${this.qrUrl(c.slug)}" alt="QR Code para as mesas do ${Fmt.esc(c.name)}" width="280" height="350">
                    <p class="a-link">${Fmt.esc(c.url)}</p>
                    <div class="sheet-actions">
                        <button class="btn btn-primary" data-action="share-casa" data-slug="${Fmt.esc(c.slug)}">${Icons.send}Enviar ao dono</button>
                        <a class="btn btn-secondary" href="${this.qrUrl(c.slug)}" download="divup-${Fmt.esc(c.slug)}.png">${AdminIcons.download}Baixar QR Code</a>
                        <label class="check-row">
                            <input type="checkbox" data-action="toggle-casa" data-slug="${Fmt.esc(c.slug)}" ${c.active ? 'checked' : ''}>
                            Ativo (leituras grátis por este QR)
                        </label>
                    </div>
                </section>
            </div>`;
    },

    qrUrl(slug) { return `/api/v1/admin/casas/${encodeURIComponent(slug)}/qr.png`; },

    // =====================================================
    // Eventos
    // =====================================================
    onClick(e) {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        // Toque no fundo escuro fecha; dentro da folha não
        if (el.dataset.action === 'close-sheet' && el.classList.contains('sheet-scrim') && e.target !== el) return;
        const { action } = el.dataset;
        switch (action) {
            case 'tab':
                if (this.state.tab === el.dataset.tab) return;
                this.state.tab = el.dataset.tab;
                this.render();
                this.load();
                break;
            case 'month': {
                const [y, m] = this.state.month.split('-').map(Number);
                const d = new Date(y, m - 1 + Number(el.dataset.step), 1);
                const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (next > this.state.currentMonth) return;
                this.state.month = next;
                this.load();
                break;
            }
            case 'reload': this.load(); break;
            case 'day': this.state.day = el.dataset.day; this.renderBody(); break;
            case 'new-casa': this.openSheet({ type: 'new', name: el.dataset.name || '' }); break;
            case 'open-casa': this.openSheet({ type: 'casa', slug: el.dataset.slug }); break;
            case 'close-sheet': this.closeSheet(); break;
            case 'share-casa': this.shareCasa(el.dataset.slug); break;
        }
    },

    onChange(e) {
        const el = e.target;
        if (el.dataset.action === 'toggle-casa') this.toggleCasa(el.dataset.slug, el.checked, el);
    },

    onSubmit(e) {
        e.preventDefault();
        if (e.target.id === 'casaForm') this.createCasa(e.target);
        if (e.target.id === 'limitsForm') this.saveLimits(e.target);
    },

    showFormError(id, message) {
        const el = this.$(`#${id}`);
        if (!el) return;
        el.textContent = message;
        el.hidden = !message;
    },

    async createCasa(form) {
        const name = form.name.value.trim();
        const slug = form.slug.value.trim().toLowerCase();
        if (name.length < 2) return this.showFormError('casaError', 'Escreva o nome do bar.');
        if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(slug)) {
            return this.showFormError('casaError', 'O código aceita só letras minúsculas, números e hífen (sem hífen no começo ou no fim).');
        }
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const casa = await API.request('POST', '/admin/casas', slug ? { name, slug } : { name });
            this.state.tab = 'casas';
            this.state.month = this.state.currentMonth;
            this.state.casas = [casa, ...(this.state.casas || []).filter(c => c.slug !== casa.slug)];
            this.render();
            this.openSheet({ type: 'casa', slug: casa.slug });
            this.toast('Bar cadastrado');
        } catch (error) {
            button.disabled = false;
            this.showFormError('casaError', error.message);
        }
    },

    async toggleCasa(slug, active, input) {
        try {
            const casa = await API.request('PATCH', `/admin/casas/${encodeURIComponent(slug)}`, { active });
            const list = this.state.casas || [];
            const i = list.findIndex(c => c.slug === slug);
            if (i >= 0) list[i] = { ...list[i], active: casa.active };
            this.renderBody();
            this.toast(active ? 'Bar ativado' : 'Bar desativado: o QR Code deixa de dar leitura grátis');
        } catch (error) {
            input.checked = !active;
            this.toast(error.message || 'Não foi possível salvar');
        }
    },

    async shareCasa(slug) {
        const c = this.state.casas?.find(x => x.slug === slug);
        if (!c) return;
        const month = MONTHS[Number(this.state.month.slice(5)) - 1];
        const text = c.reads
            ? `Em ${month}, ${this.plural(c.reads, 'conta foi dividida', 'contas foram divididas')} pelo DivUp no ${c.name}, por ${this.plural(c.devices, 'pessoa', 'pessoas')}. QR Code das mesas: ${c.url}`
            : `QR Code do DivUp para as mesas do ${c.name}: ${c.url}`;
        try {
            const blob = await (await fetch(this.qrUrl(slug), { credentials: 'same-origin' })).blob();
            const file = new File([blob], `divup-${slug}.png`, { type: 'image/png' });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text });
                return;
            }
            if (navigator.share) {
                await navigator.share({ text });
                return;
            }
            await navigator.clipboard.writeText(text);
            this.toast('Texto copiado. Baixe o QR Code para enviar a imagem.');
        } catch (error) {
            if (error.name !== 'AbortError') this.toast('Não foi possível compartilhar');
        }
    },

    async saveLimits(form) {
        const values = {};
        for (const f of LIMIT_FIELDS) {
            const raw = form[f.key].value.replace(',', '.');
            const n = Number(raw);
            if (raw === '' || !Number.isFinite(n) || n < 0) return this.showFormError('limitsError', `Confira “${f.label}”.`);
            values[f.key] = f.step === '1' ? Math.round(n) : n;
        }
        if (values.monthly_budget_brl <= 0) return this.showFormError('limitsError', 'O teto do mês precisa ser maior que zero.');
        if (values.hard_budget_brl < values.monthly_budget_brl) return this.showFormError('limitsError', 'O teto rígido precisa ser maior ou igual ao teto do mês.');
        if (values.ip_reads_per_hour < 1) return this.showFormError('limitsError', 'Permita ao menos 1 tentativa por IP/hora.');
        this.showFormError('limitsError', '');
        const button = form.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            this.state.limits = await API.request('PUT', '/admin/limits', values);
            this.toast('Limites salvos');
        } catch (error) {
            this.showFormError('limitsError', error.message);
        }
        button.disabled = false;
    },

    // =====================================================
    // Utilidades
    // =====================================================
    plural(n, one, many) { return `${Number(n).toLocaleString('pt-BR')} ${n === 1 ? one : many}`; },

    shortDate(iso) {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    toast(message) {
        document.querySelector('.toast')?.remove();
        const el = document.createElement('div');
        el.className = 'toast';
        el.setAttribute('role', 'status');
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
