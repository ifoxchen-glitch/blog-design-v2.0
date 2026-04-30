const fs = require('fs');

const linksContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>站外链接 - 博客后台</title>
<link rel="stylesheet" href="/css/tokens.css" />
<link rel="stylesheet" href="/css/base.css" />
<link rel="stylesheet" href="/css/components.css" />
<link rel="stylesheet" href="/admin-static/admin.css" />
</head>
<body>
<header class="site-header">
<div class="site-header__inner">
<a class="site-logo" href="/">ifoxchen's blog</a>
<nav class="nav-desktop">
<a href="/admin/posts">文章</a>
<a href="/admin/links">站外链接</a>
<a href="/admin/api">API对接</a>
</nav>
<form method="post" action="/admin/logout">
<button type="submit">退出</button>
</form>
</div>
</header>
<main>
<h1>站外链接管理</h1>
<div id="link-list"></div>
</main>
<script>
fetch('/api/admin/links').then(r=>r.json()).then(d=>{
  document.getElementById('link-list').textContent = JSON.stringify(d,null,2);
});
</script>
</body>
</html>`;

fs.writeFileSync('server/views/links.ejs', linksContent, 'utf8');
console.log('links.ejs written');
