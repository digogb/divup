/* Tema: "auto" (segue o celular), "light" ou "dark".
   Carregado no <head>, antes do CSS, para a página já abrir no tema certo.
   Grava a escolha em localStorage e põe o tema resolvido em <html data-theme>. */
(function () {
    var KEY = 'divup.theme';
    var COLORS = { light: '#F4F4F1', dark: '#111214' };
    var memo = null; // vale quando o localStorage não grava (modo privado)
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function pref() {
        var v = memo;
        try { v = localStorage.getItem(KEY) || memo; } catch (e) { /* sem localStorage */ }
        return v === 'light' || v === 'dark' ? v : 'auto';
    }

    function resolved(p) {
        return p === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : p;
    }

    function apply() {
        var p = pref();
        var t = resolved(p);
        var root = document.documentElement;
        root.setAttribute('data-theme', t);
        root.setAttribute('data-theme-pref', p);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', COLORS[t]);
        try { window.dispatchEvent(new Event('divup-theme')); } catch (e) { /* navegador antigo */ }
    }

    function set(p) {
        memo = p;
        try {
            if (p === 'light' || p === 'dark') localStorage.setItem(KEY, p);
            else localStorage.removeItem(KEY);
        } catch (e) { /* fica só em memo */ }
        apply();
    }

    apply();
    if (mq) {
        var onChange = function () { if (pref() === 'auto') apply(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }
    // Outra aba mudou o tema
    window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });

    window.DivupTheme = {
        get: pref,
        set: set,
        current: function () { return resolved(pref()); }
    };
})();
