const express = require("express");
const devCors = require("../middleware/cors");
const auditLogger = require("../middleware/auditLogger");
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

const app = express();

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

const v2Router = express.Router();
v2Router.use("/auth", authRouter);
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
app.use("/api/v2", v2Router);

module.exports = app;
