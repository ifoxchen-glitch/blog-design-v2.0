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

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(devCors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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
app.use("/api/v2", v2Router);

module.exports = app;
