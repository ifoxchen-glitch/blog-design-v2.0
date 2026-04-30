(function () {
  const themes = ['system', 'cyberpunk', 'aurora', 'synthwave', 'neon', 'matrix', 'nord', 'dracula', 'github', 'monokai', 'sunset', 'forest'];
  const darkThemes = ['cyberpunk', 'synthwave', 'neon', 'matrix', 'nord', 'dracula', 'github', 'monokai', 'sunset'];

  function applyTheme(name) {
    const body = document.body;
    if (name === 'system') {
      body.removeAttribute('data-theme');
    } else {
      body.setAttribute('data-theme', name);
    }
  }

  function getCurrentTheme() {
    const saved = localStorage.getItem('theme');
    return saved || 'system';
  }

  function getCurrentMode() {
    const mode = localStorage.getItem('themeMode');
    if (mode) return mode;
    const theme = getCurrentTheme();
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return darkThemes.includes(theme) ? 'dark' : 'light';
  }

  function updateModalModeIcon() {
    const modalModeIconSun = document.getElementById('modal-mode-icon-sun');
    const modalModeIconMoon = document.getElementById('modal-mode-icon-moon');
    const mode = localStorage.getItem('themeMode') || 'dark';
    
    if (modalModeIconSun && modalModeIconMoon) {
      modalModeIconSun.style.display = mode === 'dark' ? 'none' : 'block';
      modalModeIconMoon.style.display = mode === 'dark' ? 'block' : 'none';
    }
  }

  function updateToggleIcon() {
    const iconDark = document.getElementById('theme-toggle-dark');
    const iconLight = document.getElementById('theme-toggle-light');
    if (!iconDark || !iconLight) return;
    const dark = getCurrentMode() === 'dark';
    iconDark.style.display = dark ? 'block' : 'none';
    iconLight.style.display = dark ? 'none' : 'block';
  }

  function applyMode(mode) {
    const body = document.body;
    localStorage.setItem('themeMode', mode);
    body.setAttribute('data-mode', mode);
    updateModalModeIcon();
  }

  function toggleMode() {
    const current = getCurrentMode();
    applyMode(current === 'dark' ? 'light' : 'dark');
    updateToggleIcon();
  }

  function initThemeToggle() {
    const modal = document.getElementById('theme-modal');
    const btn = document.getElementById('theme-btn');
    const close = document.getElementById('theme-close');
    const modeBtn = document.getElementById('mode-toggle-btn');
    const opts = document.querySelectorAll('.theme-option');
    const body = document.body;

    const saved = localStorage.getItem('theme');
    if (saved && (saved === 'system' || themes.includes(saved))) {
      applyTheme(saved);
    }

    const mode = getCurrentMode();
    body.setAttribute('data-mode', mode);

    if (btn) btn.onclick = () => modal.classList.add('open');
    if (close) close.onclick = () => modal.classList.remove('open');
    if (modeBtn) modeBtn.onclick = toggleMode;

    const modalModeBtn = document.getElementById('modal-mode-btn');

    if (modalModeBtn) {
      modalModeBtn.onclick = (e) => {
        e.stopPropagation();
        toggleMode();
        const sun = document.getElementById('modal-mode-icon-sun');
        const moon = document.getElementById('modal-mode-icon-moon');
        const currentMode = getCurrentMode();
        sun.style.display = currentMode === 'dark' ? 'block' : 'none';
        moon.style.display = currentMode === 'dark' ? 'none' : 'block';
        modalModeBtn.classList.add('mode-switching');
        setTimeout(() => modalModeBtn.classList.remove('mode-switching'), 50);
      };
    }

    opts.forEach(o => {
      o.onclick = () => {
        const t = o.dataset.theme;
        applyTheme(t);
        localStorage.setItem('theme', t);
        updateToggleIcon();
      };
    });

    updateToggleIcon();
    updateModalModeIcon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initThemeToggle(); });
  } else {
    initThemeToggle();
  }
})();