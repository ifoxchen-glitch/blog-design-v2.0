const express = require("express");
const handlers = require("./tasksHandlers");
const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

const router = express.Router();

router.get("/", jwtAuth, requirePermission("kb:list"), handlers.listTasks);
router.post("/", jwtAuth, requirePermission("kb:create"), handlers.createTask);
router.put("/:id", jwtAuth, requirePermission("kb:update"), handlers.updateTask);
router.delete("/:id", jwtAuth, requirePermission("kb:delete"), handlers.deleteTask);

module.exports = router;
