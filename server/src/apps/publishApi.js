const express = require("express");
const requirePublishApiKey = require("../middleware/publishApiKey");
const { publishBlogPost, publishKbDocument } = require("./admin/kb/publishApiHandlers");

const app = express.Router();

app.use(express.json({ limit: "2mb" }));

app.post("/blog", requirePublishApiKey, publishBlogPost);
app.post("/kb", requirePublishApiKey, publishKbDocument);

module.exports = app;