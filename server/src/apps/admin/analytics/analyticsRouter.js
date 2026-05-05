const express = require("express");
const { openDb } = require("../../../db");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

// 所有统计接口需要 analytics:view 权限
router.use(jwtAuth, requirePermission("analytics:view"));

/**
 * GET /api/v2/admin/analytics/dashboard
 * 返回：文章数、标签数、分类数、今日 PV、今日 UV
 */
router.get("/dashboard", (req, res) => {
  const db = openDb();
  const postCount = db.prepare(`SELECT COUNT(*) as c FROM posts`).get()?.c || 0;
  const tagCount = db.prepare(`SELECT COUNT(*) as c FROM tags`).get()?.c || 0;
  const categoryCount = db.prepare(`SELECT COUNT(*) as c FROM categories`).get()?.c || 0;

  const today = new Date().toISOString().slice(0, 10);
  const todayPv = db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ? AND created_at < ?`)
    .get(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)?.c || 0;
  const todayUv = db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM page_views WHERE created_at >= ? AND created_at < ?`)
    .get(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`)?.c || 0;

  res.json({
    code: 200,
    message: "success",
    data: { postCount, tagCount, categoryCount, todayPv, todayUv },
  });
});

/**
 * GET /api/v2/admin/analytics/trend?days=7
 * 返回近 N 天每天的 PV / UV
 */
router.get("/trend", (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
  const db = openDb();

  const labels = [];
  const pv = [];
  const uv = [];

  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const start = `${dateStr}T00:00:00.000Z`;
    const end = `${dateStr}T23:59:59.999Z`;

    const dayPv = db.prepare(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ? AND created_at < ?`)
      .get(start, end)?.c || 0;
    const dayUv = db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM page_views WHERE created_at >= ? AND created_at < ?`)
      .get(start, end)?.c || 0;

    labels.push(dateStr.slice(5)); // MM-DD
    pv.push(dayPv);
    uv.push(dayUv);
  }

  res.json({
    code: 200,
    message: "success",
    data: { labels, pv, uv },
  });
});

/**
 * GET /api/v2/admin/analytics/posts?limit=10
 * 返回阅读量 Top N 的文章
 * 按 page_views.path LIKE '/post/%' 聚合
 */
router.get("/posts", (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const db = openDb();

  // 聚合 page_views 中 /post/ 开头的路径，提取 slug
  const rows = db.prepare(`
    SELECT
      SUBSTR(path, 7) as slug,
      COUNT(*) as viewCount
    FROM page_views
    WHERE path LIKE '/post/%'
    GROUP BY slug
    ORDER BY viewCount DESC
    LIMIT ?
  `).all(limit);

  // 关联 posts 表获取标题
  const items = rows.map((r) => {
    const post = db.prepare(`SELECT title FROM posts WHERE slug = ?`).get(r.slug);
    return {
      title: post?.title || r.slug,
      slug: r.slug,
      viewCount: r.viewCount,
    };
  });

  res.json({
    code: 200,
    message: "success",
    data: { items },
  });
});

/**
 * GET /api/v2/admin/analytics/distribution
 * 返回标签和分类的文章数量分布
 */
router.get("/distribution", (req, res) => {
  const db = openDb();

  const tags = db.prepare(`
    SELECT t.name, COUNT(pt.postId) as count
    FROM tags t
    LEFT JOIN post_tags pt ON pt.tagId = t.id
    GROUP BY t.id
    ORDER BY count DESC
  `).all();

  const categories = db.prepare(`
    SELECT c.name, COUNT(pc.postId) as count
    FROM categories c
    LEFT JOIN post_categories pc ON pc.categoryId = c.id
    GROUP BY c.id
    ORDER BY count DESC
  `).all();

  res.json({
    code: 200,
    message: "success",
    data: { tags, categories },
  });
});

module.exports = router;
