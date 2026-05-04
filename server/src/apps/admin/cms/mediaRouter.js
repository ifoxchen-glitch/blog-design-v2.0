const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const express = require("express");
const multer = require("multer");

const jwtAuth = require("../../../middleware/jwtAuth");
const requirePermission = require("../../../middleware/rbac");

// 与 legacy frontApp.js 保持一致：上传根目录是 server/public/uploads
const SERVER_PUBLIC = path.join(__dirname, "..", "..", "..", "..", "public");
const UPLOAD_DIR = path.join(SERVER_PUBLIC, "uploads");

// multer 不会自动创建目录，启动期一次性确保。
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}-${name}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB，与 legacy 等价
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_EXT.includes(ext));
  },
});

function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 400, message: "invalid_file" });
  }
  const url = `/admin-static/uploads/${req.file.filename}`;
  return res.status(200).json({
    code: 200,
    message: "success",
    data: {
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    },
  });
}

const router = express.Router();

// 注意中间件顺序：先 jwtAuth + rbac，再 multer 解析 multipart。
router.post(
  "/upload",
  jwtAuth,
  requirePermission("media:upload"),
  upload.single("image"),
  uploadImage,
);

// TODO(T2.13): 没有 magic-byte / mime sniff 校验，仅看扩展名（与 legacy 等价）。后续可加 file-type 库做内容嗅探。
// TODO(T2.13): 上传成功的文件没记 DB，无法做媒体库列表（T2.31 前端要）。后续考虑加 media 表 + 软删除。
// TODO(T2.13): adminApp 端口 3000 未挂 /admin-static 静态目录；前端拿到 URL 后访问 frontApp 端口 8787 或生产同域 /admin-static。保持 legacy 行为。

module.exports = router;
module.exports._uploader = upload; // 单测内部访问 multer 实例（验证 limits / fileFilter）
module.exports._UPLOAD_DIR = UPLOAD_DIR;
module.exports._uploadImage = uploadImage;
