(function () {
  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(d);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slugifyForId(text) {
    const s = String(text ?? "")
      .trim()
      .toLowerCase()
      .replace(/[\s]+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]/g, "")
      .replace(/-+/g, "-");
    return s || "section";
  }

  function buildPostCard(post, opts) {
    const headingTag = opts?.headingTag || "h3";
    const title = escapeHtml(post.title);
    const excerpt = escapeHtml(post.excerpt || "");
    const href = `post.html?slug=${encodeURIComponent(post.slug)}`;
    const timeText = formatDate(post.publishedAt || post.createdAt);
    const timeAttr = (post.publishedAt || post.createdAt || "").slice(0, 10);
    const firstCat = post.categories && post.categories.length ? post.categories[0].name : "";
    const firstTag = post.tags && post.tags.length ? post.tags[0].name : "";

    const hasCover = Boolean(post.coverImageUrl);
    const coverHtml = hasCover
      ? `<img class="post-card__media" src="${escapeHtml(post.coverImageUrl)}" width="640" height="360" alt="" loading="lazy" />`
      : "";
    const textOnlyClass = hasCover ? "" : " post-card--text-only";

    return `
      <a class="post-card${textOnlyClass}" href="${href}">
        ${coverHtml}
        <div class="post-card__body">
          <${headingTag} class="post-card__title">${title}</${headingTag}>
          ${excerpt ? `<p class="post-card__excerpt">${excerpt}</p>` : ""}
          <div class="meta-row">
            ${timeText ? `<time datetime="${escapeHtml(timeAttr)}">${escapeHtml(timeText)}</time>` : ""}
            ${firstCat ? `<span class="pill">${escapeHtml(firstCat)}</span>` : ""}
            ${firstTag ? `<span class="pill">${escapeHtml(firstTag)}</span>` : ""}
          </div>
        </div>
      </a>
    `;
  }

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  }

  async function hydrateIndex() {
    const grid = document.querySelector(".card-grid");
    if (!grid) return;
    try {
      const { posts } = await fetchJson("/api/posts?limit=12");
      grid.innerHTML = posts.map((p) => buildPostCard(p, { headingTag: "h3" })).join("");
    } catch (e) {
      // keep prototype fallback
      console.warn(e);
    }
  }

  async function hydrateArchive() {
    const grid = document.querySelector(".card-grid");
    if (!grid) return;

    const qs = new URLSearchParams(location.search);
    const type = qs.get("type") || "";
    const tag = qs.get("tag") || "";
    const category = qs.get("category") || "";
    const offset = Math.max(0, parseInt(qs.get("offset")) || 0);
    const limit = 9;

    try {
      const titleEl = document.querySelector(".page-title");
      let apiUrl = `/api/posts?limit=${limit}&offset=${offset}`;
      let descHtml = "";

      if (type === "category") {
        if (titleEl) titleEl.textContent = "全部分类";
        const { categories } = await fetchJson("/api/categories");
        const pills = categories.slice(0, 12).map((c) => {
          const active = c.slug === category;
          const href = c.slug === category ? "archive.html?type=category" : `archive.html?type=category&category=${encodeURIComponent(c.slug)}`;
          const countLabel = c.postCount ? ` (${c.postCount})` : "";
          return `<a class="pill" href="${href}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(c.name)}${countLabel}</a>`;
        }).join(" ");
        if (!category) {
          descHtml = `<a class="pill" href="archive.html?type=category">清除筛选</a> 筛选：${pills || "（暂无分类）"}`;
          grid.innerHTML = '<p class="empty-state">请选择一个分类查看文章</p>';
          const pagination = document.querySelector(".pagination");
          if (pagination) pagination.innerHTML = "";
          const desc = document.querySelector(".page-desc");
          if (desc) desc.innerHTML = descHtml;
          return;
        }
        descHtml = `<a class="pill" href="archive.html?type=category">返回分类</a> ${pills || "（暂无分类）"}`;
        apiUrl += `&category=${encodeURIComponent(category)}`;
} else if (type === "tag") {
        if (titleEl) titleEl.textContent = "全部标签";
        const { tags } = await fetchJson("/api/tags");
        const pills = tags.slice(0, 12).map((t) => {
          const active = t.slug === tag;
          const href = t.slug === tag ? "archive.html?type=tag" : `archive.html?type=tag&tag=${encodeURIComponent(t.slug)}`;
          const countLabel = t.postCount ? ` (${t.postCount})` : "";
          return `<a class="pill" href="${href}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(t.name)}${countLabel}</a>`;
        }).join(" ");
        if (!tag) {
          descHtml = `<a class="pill" href="archive.html">全部文章</a> 筛选：${pills || "（暂无标签）"}`;
          grid.innerHTML = '<p class="empty-state">请选择一个标签查看文章</p>';
          const pagination = document.querySelector(".pagination");
          if (pagination) pagination.innerHTML = "";
          const desc = document.querySelector(".page-desc");
          if (desc) desc.innerHTML = descHtml;
          return;
        }
        descHtml = `<a class="pill" href="archive.html?type=tag">返回标签</a> ${pills || "（暂无标签）"}`;
        apiUrl += `&tag=${encodeURIComponent(tag)}`;
} else {
        if (titleEl) titleEl.textContent = "全部文章";
        if (tag) {
          apiUrl += `&tag=${encodeURIComponent(tag)}`;
        }
        if (category) {
          apiUrl += `&category=${encodeURIComponent(category)}`;
        }
        const { tags } = await fetchJson("/api/tags");
        const pills = tags.slice(0, 12).map((t) => {
          const active = t.slug === tag;
          const href = t.slug === tag ? "archive.html" : `archive.html?tag=${encodeURIComponent(t.slug)}`;
          const countLabel = t.postCount ? ` (${t.postCount})` : "";
          return `<a class="pill" href="${href}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(t.name)}${countLabel}</a>`;
        }).join(" ");
        const { categories } = await fetchJson("/api/categories");
        const catPills = categories.slice(0, 8).map((c) => {
          const active = c.slug === category;
          const href = c.slug === category ? "archive.html" : `archive.html?category=${encodeURIComponent(c.slug)}`;
          const countLabel = c.postCount ? ` (${c.postCount})` : "";
          return `<a class="pill" href="${href}" ${active ? 'aria-current="page"' : ""}>${escapeHtml(c.name)}${countLabel}</a>`;
        }).join(" ");
        descHtml = `分类：${catPills || "（暂无）"} · 标签：${pills || "（暂无）"}`;
      }

      const { posts, total } = await fetchJson(apiUrl);
      grid.innerHTML = posts.map((p) => buildPostCard(p, { headingTag: "h2" })).join("");

      const currentPage = Math.floor(offset / limit) + 1;
      const totalPages = Math.max(1, Math.ceil(total / limit));

      const pagination = document.querySelector(".pagination");
      if (pagination) {
        if (total <= 0) {
          pagination.innerHTML = "";
        } else {
          const params = new URLSearchParams();
          if (type) params.set("type", type);
          if (category) params.set("category", category);
          if (tag) params.set("tag", tag);

          const buildUrl = (offset) => {
            const p = new URLSearchParams(params.toString());
            if (offset > 0) p.set("offset", String(offset));
            return "archive.html" + (p.toString() ? "?" + p.toString() : "");
          };

          let paginationHtml = "";
          if (offset > 0) {
            paginationHtml += `<a href="${buildUrl(offset - limit)}">上一页</a>`;
          } else {
            paginationHtml += `<span aria-disabled="true">上一页</span>`;
          }
          paginationHtml += `<span>${currentPage} / ${totalPages}</span>`;
          if (offset + limit < total) {
            paginationHtml += `<a href="${buildUrl(offset + limit)}">下一页</a>`;
          } else {
            paginationHtml += `<span aria-disabled="true">下一页</span>`;
          }
          pagination.innerHTML = paginationHtml;
        }
      }

      const desc = document.querySelector(".page-desc");
      if (desc) desc.innerHTML = descHtml;
    } catch (e) {
      console.warn(e);
    }
  }

  function buildTocFromProse(proseEl, tocEl) {
    const list = tocEl?.querySelector("ul");
    if (!proseEl || !list) return;
    const headings = proseEl.querySelectorAll("h2, h3");
    const items = [];
    const used = new Map();
    for (const h of headings) {
      const text = h.textContent?.trim();
      if (!text) continue;
      let id = h.getAttribute("id") || slugifyForId(text);
      const n = (used.get(id) || 0) + 1;
      used.set(id, n);
      if (n > 1) id = `${id}-${n}`;
      h.setAttribute("id", id);
      items.push({ level: h.tagName.toLowerCase(), text, id });
    }
    list.innerHTML = items
      .map((it) => `<li class="${it.level === "h3" ? "toc-h3" : ""}"><a href="#${escapeHtml(it.id)}">${escapeHtml(it.text)}</a></li>`)
      .join("");
  }

  async function hydratePost() {
    const qs = new URLSearchParams(location.search);
    const slug = qs.get("slug");
    if (!slug) return;

    try {
      const { post } = await fetchJson(`/api/posts/${encodeURIComponent(slug)}`);

      if (post?.title) document.title = `${post.title} · ifoxchen's blog`;

      const h1 = document.querySelector(".article-header h1");
      if (h1) h1.textContent = post.title || "";

      const meta = document.querySelector(".article-header .meta-row");
      if (meta) {
        const dateText = formatDate(post.publishedAt || post.createdAt);
        const dateAttr = (post.publishedAt || post.createdAt || "").slice(0, 10);
        const catLinks = (post.categories || [])
          .slice(0, 4)
          .map((c) => `<a class="pill" href="archive.html?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a>`)
          .join("");
        const tagLinks = (post.tags || [])
          .slice(0, 6)
          .map((t) => `<a class="pill" href="archive.html?tag=${encodeURIComponent(t.slug)}">${escapeHtml(t.name)}</a>`)
          .join("");
        meta.innerHTML = `
          ${dateText ? `<time datetime="${escapeHtml(dateAttr)}">${escapeHtml(dateText)}</time>` : ""}
          <span>作者：管理员</span>
          ${catLinks}
          ${tagLinks}
        `;
      }

      const cover = document.querySelector(".article-cover");
      if (cover) {
        if (post.coverImageUrl) {
          cover.setAttribute("src", post.coverImageUrl);
          cover.removeAttribute("hidden");
        } else {
          cover.setAttribute("hidden", "hidden");
        }
      }

      const prose = document.querySelector(".prose");
      if (prose) prose.innerHTML = post.contentHtml || "";

      const toc = document.querySelector(".toc");
      buildTocFromProse(prose, toc);
    } catch (e) {
      console.warn(e);
    }
  }

  async function loadNavLinks() {
    const menu = document.getElementById("nav-links-menu");
    if (!menu) return;
    try {
      const { links } = await fetchJson("/api/links");
      if (!links || links.length === 0) return;
      const items = links.map(
        (l) => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.title)}</a></li>`
      );
      items.push('<li class="nav-dropdown__separator"></li>');
      items.push('<li><a href="links.html">查看全部</a></li>');
      menu.innerHTML = items.join("");
    } catch (e) {
      console.warn(e);
    }
  }

  loadNavLinks();

  const page = document.title || "";
  if (location.pathname.endsWith("/index.html") || location.pathname.endsWith("/")) hydrateIndex();
  if (location.pathname.endsWith("/archive.html")) hydrateArchive();
  if (location.pathname.endsWith("/post.html")) hydratePost();

  // PV 采集：发送一次页面访问记录
  (function sendPv() {
    const path = location.pathname + location.search;
    const ref = document.referrer || "";
    const img = new Image();
    img.src = `/api/pv?path=${encodeURIComponent(path)}&ref=${encodeURIComponent(ref)}`;
    img.style.display = "none";
    document.body.appendChild(img);
  })();
})();

