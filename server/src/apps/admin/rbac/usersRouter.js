const express = require("express");
const handlers = require("./userHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("user:list"), handlers.listUsers);
router.get("/:id", jwtAuth, requirePermission("user:list"), handlers.getUser);
router.post("/", jwtAuth, requirePermission("user:create"), handlers.createUser);
router.put("/:id", jwtAuth, requirePermission("user:update"), handlers.updateUser);
router.delete("/:id", jwtAuth, requirePermission("user:delete"), handlers.deleteUser);
router.post("/:id/reset-password", jwtAuth, requirePermission("user:update"), handlers.resetPassword);

module.exports = router;
