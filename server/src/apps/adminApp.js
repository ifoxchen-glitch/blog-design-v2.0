const path = require("node:path");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const devCors = require("../middleware/cors");
const auditLogger = require("../middleware/auditLogger");
const { loginLimiter, generalLimiter } = require("../middleware/rateLimits");
const openWebUIAuth = require("../middleware/openWebUIAuth");
const authRouter = require("./admin/auth/authRouter");
const usersRouter = require("./admin/rbac/usersRouter");
const rolesRouter = require("./admin/rbac/rolesRouter");
const permissionsRouter = require("./admin/rbac/permissionsRouter");
const menusRouter = require("./admin/rbac/menusRouter");
const postsRouter = require("./admin/cms/postsRouter");
const tagsRouter = require("./admin/cms/tagsRouter");
const categoriesRouter = require("./admin/cms/categoriesRouter");
const linksRouter = require("./admin/cms/linksRouter");
const mediaRouter = require("./admin/cms/mediaRouter");
const cmsRouter = require("./admin/cms/cmsRouter");
const opsRouter = require("./admin/ops/opsRouter");
const analyticsRouter = require("./admin/analytics/analyticsRouter");
const kbRouter = require("./admin/kb/kbRouter");
const modelsRouter = require("./admin/kb/modelsRouter");
const conversationsRouter = require("./admin/kb/conversationsRouter");
const tasksRouter = require("./admin/kb/tasksRouter");
const templatesRouter = require("./admin/kb/templatesRouter");
const webSearchRouter = require("./admin/kb/webSearchRouter");
const settingsRouter = require("./admin/settings/settingsRouter");

const app = express();

const OPEN_WEBUI_PORT = parseInt(process.env.OPEN_WEBUI_PORT, 10) || 8080;
const OPEN_WEBUI_HOST = process.env.OPEN_WEBUI_HOST || "127.0.0.1";
const OPEN_WEBUI_URL = process.env.OPEN_WEBUI_URL || `http://${OPEN_WEBUI_HOST}:${OPEN_WEBUI_PORT}`;

// Serve admin SPA (built from admin/dist) at root
const adminDist = path.join(__dirname, "..", "..", "..", "admin", "dist");
app.use(express.static(adminDist));

// Serve uploaded media files (same directory as frontApp)
const SERVER_PUBLIC = path.join(__dirname, "..", "..", "public");
app.use("/admin-static", express.static(SERVER_PUBLIC));

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(devCors());
// T2.15: import 一份完整 export JSON 可达数 MB(中等规模博客 100~500 篇文章 + tags/categories),
//        默认 1mb 会被挡。这里整体放宽到 10mb 以容纳全库导入。
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(auditLogger());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "adminApp" });
});

// Open WebUI 状态检查
app.get("/workbench/health", async (req, res) => {
  const launcher = require("../openwebui/launcher");
  const status = launcher.getStatus();
  res.json({
    ok: status.ready,
    running: status.running,
    port: status.port,
    host: status.host,
  });
});

const v2Router = express.Router();
v2Router.use(generalLimiter);
v2Router.use("/auth", loginLimiter, authRouter);
v2Router.use("/admin/rbac/users", usersRouter);
v2Router.use("/admin/rbac/roles", rolesRouter);
v2Router.use("/admin/rbac/permissions", permissionsRouter);
v2Router.use("/admin/rbac/menus", menusRouter);
v2Router.use("/admin/cms/posts", postsRouter);
v2Router.use("/admin/cms/tags", tagsRouter);
v2Router.use("/admin/cms/categories", categoriesRouter);
v2Router.use("/admin/cms/links", linksRouter);
v2Router.use("/admin/cms", mediaRouter);
v2Router.use("/admin/cms", cmsRouter);
v2Router.use("/admin/ops", opsRouter);
v2Router.use("/admin/analytics", analyticsRouter);
v2Router.use("/admin/kb", kbRouter);
app.use("/api/v2", v2Router);
v2Router.use("/admin/kb/models", modelsRouter);
v2Router.use("/admin/kb/conversations", conversationsRouter);
v2Router.use("/admin/kb/tasks", tasksRouter);
v2Router.use("/admin/kb/templates", templatesRouter);
v2Router.use("/admin/kb/search", webSearchRouter);
v2Router.use("/admin/settings", settingsRouter);

// ---- Open WebUI 代理配置 ----
// 代理 API 请求到 Open WebUI FastAPI 后端
const openWebUIProxy = createProxyMiddleware({
  target: OPEN_WEBUI_URL,
  changeOrigin: true,
  ws: true, // 支持 WebSocket（实时对话）
  pathRewrite: {
    "^/workbench/api": "/api", // /workbench/api/v1/* → /api/v1/*
  },
  onProxyReq: (proxyReq, req) => {
    // 注入 Open WebUI 认证 token
    if (req.openWebUIAuth?.token) {
      proxyReq.setHeader("Authorization", `Bearer ${req.openWebUIAuth.token}`);
    }
  },
  onError: (err, req, res) => {
    console.error("[OpenWebUI Proxy] Error:", err.message);
    if (!res.headersSent) {
      res.status(503).json({
        code: 503,
        message: "Workbench service temporarily unavailable",
      });
    }
  },
});

// 代理静态文件请求到 Open WebUI 前端构建产物
const openWebUIStaticProxy = createProxyMiddleware({
  target: OPEN_WEBUI_URL,
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error("[OpenWebUI Static] Error:", err.message);
    if (!res.headersSent) {
      res.status(503).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Workbench Maintenance</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;">
          <h1>🔧 Workbench Maintenance</h1>
          <p>The AI workbench is currently unavailable.</p>
          <p>Please try again later or contact the administrator.</p>
        </body>
        </html>
      `);
    }
  },
});

// 认证 + 代理路由
app.use("/workbench/api", openWebUIAuth, openWebUIProxy);
app.use("/workbench/ws", openWebUIAuth, openWebUIProxy); // WebSocket
app.use("/workbench", openWebUIAuth, openWebUIStaticProxy);

// SPA catch-all middleware (Express 5: bare * is invalid, use middleware instead)
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/workbench")) return next();
  res.sendFile(path.join(adminDist, "index.html"));
});

module.exports = app;
