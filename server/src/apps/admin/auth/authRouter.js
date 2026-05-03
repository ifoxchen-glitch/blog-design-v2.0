const express = require("express");
const handlers = require("./authHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");

const router = express.Router();

router.post("/login", handlers.login);
router.post("/refresh", handlers.refresh);
router.post("/logout", jwtAuth, handlers.logout);
router.get("/me", jwtAuth, handlers.me);
router.get("/menus", jwtAuth, handlers.menus);

module.exports = router;
