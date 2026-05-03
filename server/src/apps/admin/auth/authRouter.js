const express = require("express");
const handlers = require("./authHandlers");

const router = express.Router();

router.post("/login", handlers.login);

module.exports = router;
