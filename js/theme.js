(function () {
  const themes = ['system', 'cyberpunk', 'aurora', 'synthwave', 'neon', 'matrix', 'nord', 'dracula', 'github', 'monokai', 'sunset', 'forest'];
  const darkThemes = ['cyberpunk', 'synthwave', 'neon', 'matrix', 'nord', 'dracula', 'github', 'monokai', 'sunset'];

  const MODAL_HTML = `
    <div class="theme-modal" id="theme-modal">
      <div class="theme-modal__content">
        <div class="theme-modal__header">
          <h3 class="theme-modal__title">选择主题</h3>
          <button class="theme-modal__mode-btn" id="modal-mode-btn" aria-label="切换深浅模式">
            <svg id="modal-mode-icon-sun" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:none"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm20-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 20v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>
            <svg id="modal-mode-icon-moon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
        <div class="theme-grid">
          <button class="theme-option" data-theme="cyberpunk" style="--preview:#00c8ff">赛博朋克</button>
          <button class="theme-option" data-theme="aurora" style="--preview:#22d3ee">极光蓝</button>
          <button class="theme-option" data-theme="synthwave" style="--preview:#f472b6">合成波</button>
          <button class="theme-option" data-theme="neon" style="--preview:#39ff14">霓虹绿</button>
          <button class="theme-option" data-theme="matrix" style="--preview:#00ff00">黑客帝国</button>
          <button class="theme-option" data-theme="nord" style="--preview:#88c0d0">北境</button>
          <button class="theme-option" data-theme="dracula" style="--preview:#ff79c6">德古拉</button>
          <button class="theme-option" data-theme="github" style="--preview:#58a6ff">GitHub</button>
          <button class="theme-option" data-theme="monokai" style="--preview:#f92672">暮光</button>
          <button class="theme-option" data-theme="sunset" style="--preview:#ff7b54">日落</button>
          <button class="theme-option" data-theme="forest" style="--preview:#7fcc7f">森林</button>
        </div>
        <button class="theme-modal__close" id="theme-close">关闭</button>
      </div>
    </div>`;

  function ensureModal() {
    if (!document.getElementById('theme-modal')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = MODAL_HTML.trim();
      document.body.appendChild(wrap.firstElementChild);
    }
  }

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
    ensureModal();
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