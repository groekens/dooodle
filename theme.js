// Thème clair / sombre. Chargé dans le <head> pour appliquer le choix avant l'affichage (pas de flash).
// "auto" suit le réglage du téléphone ; le choix est mémorisé sur l'appareil seulement.
(function () {
  const KEY = 'dooodle-theme';
  const COLORS = { light: '#ece6ff', dark: '#17112b' };

  function stored() {
    try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function effective(choice) {
    if (choice !== 'auto') return choice;
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function apply(choice) {
    const root = document.documentElement;
    if (choice === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', choice);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = COLORS[effective(choice)];
  }

  apply(stored());
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(stored())); } catch (e) {}

  // Sélecteur Auto / Clair / Sombre du pied de page
  window.renderThemeSwitch = function (el) {
    if (!el) return;
    const tr = typeof t === 'function' ? t() : {};
    const labels = { auto: tr.themeAuto || 'Auto', light: tr.themeLight || 'Clair', dark: tr.themeDark || 'Sombre' };
    const current = stored();
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', tr.themeLabel || 'Thème');
    el.innerHTML = ['auto', 'light', 'dark']
      .map(c => `<button type="button" data-choice="${c}" aria-pressed="${c === current}">${labels[c]}</button>`).join('');
    el.onclick = e => {
      const btn = e.target.closest('button[data-choice]');
      if (!btn) return;
      try { localStorage.setItem(KEY, btn.dataset.choice); } catch (err) {}
      apply(btn.dataset.choice);
      el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === btn));
    };
  };
})();
