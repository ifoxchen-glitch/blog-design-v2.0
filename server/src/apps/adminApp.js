const express = require("express");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "adminApp" });
});

const v2Router = express.Router();
app.use("/api/v2", v2Router);

module.exports = app;
