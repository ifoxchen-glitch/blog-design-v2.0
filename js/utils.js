// Shared frontend utilities. Exposed on window.BlogUtils so that both
// js/blog.js (IIFE) and inline page scripts (links.html) can reuse them.

(function () {
  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(s, allowDataImage) {
    const v = String(s ?? "").trim();
    if (!v) return "";
    if (v.startsWith("/") || /^https?:\/\//i.test(v)) return v;
    if (allowDataImage && /^data:image\/(png|jpeg|jpg|gif|webp);/i.test(v)) return v;
    return "";
  }

  function renderLinkCards(links) {
    if (!Array.isArray(links) || links.length === 0) {
      return '<p style="color:var(--color-text-muted);text-align:center;grid-column:1/-1">暂无链接</p>';
    }
    return links
      .map((link) => {
        const sizeClass = "link-" + (link.iconSize || "1x1");
        const safeHref = safeUrl(link.url);
        const safeIcon = safeUrl(link.icon, true);
        const iconHtml = safeIcon
          ? `<img src="${escapeHtml(safeIcon)}" alt="${escapeHtml(link.title)}" class="link-icon-img" />`
          : `<span class="link-icon-text">${escapeHtml(String(link.title || "").charAt(0))}</span>`;
        return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer" class="link-card ${sizeClass}">${iconHtml}<span class="link-title">${escapeHtml(link.title)}</span></a>`;
      })
      .join("");
  }

  window.BlogUtils = { escapeHtml, safeUrl, renderLinkCards };
})();
