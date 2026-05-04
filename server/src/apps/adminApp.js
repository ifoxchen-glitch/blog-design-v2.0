const express = require("express");
const devCors = require("../middleware/cors");
const authRouter = require("./admin/auth/authRouter");
const usersRouter = require("./admin/rbac/usersRouter");
const rolesRouter = require("./admin/rbac/rolesRouter");
const permissionsRouter = require("./admin/rbac/permissionsRouter");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(devCors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "adminApp" });
});

const v2Router = express.Router();
v2Router.use("/auth", authRouter);
v2Router.use("/admin/rbac/users", usersRouter);
v2Router.use("/admin/rbac/roles", rolesRouter);
v2Router.use("/admin/rbac/permissions", permissionsRouter);
app.use("/api/v2", v2Router);

module.exports = app;
