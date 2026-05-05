# 常见问题

## 登录相关

### Q: 提示"邮箱或密码错误"

- 确认使用的是**新后台**（Vue SPA，`http://localhost:5173`），不是旧 EJS 后台（`/admin/login`）
- 新后台使用邮箱登录，旧后台使用用户名登录
- 检查 `.env` 中的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 配置
- 如果修改过密码，需要删除 `server/db/blog.sqlite` 重新运行 `npm run dev` 生成新数据库

### Q: 登录后立刻被踢回登录页

- 检查浏览器控制台是否有 401 错误
- 可能是数据库中的密码哈希与 `.env` 不一致，删除 `blog.sqlite` 重新启动服务
- 确保后端服务（`npm run dev` 在 `server/` 目录）已启动

### Q: 提示"密码至少 6 位"

- 新后台前端校验要求密码不少于 6 位
- 修改 `.env` 中 `ADMIN_PASSWORD` 为至少 6 位，然后重新生成数据库

## 权限相关

### Q: 登录后看不到某些菜单

- 检查当前用户的角色是否有对应权限码
- 超管可以看到所有菜单，普通用户受 RBAC 限制
- 菜单在「权限管理 → 菜单」中配置，每个菜单节点有 `permission` 字段控制可见性

### Q: 提示"权限不足"或 403

- 当前账号没有该操作的权限
- 联系超管在「角色管理」中分配对应权限码

## 数据相关

### Q: 新后台和旧后台数据不一致

- 两个后台共用同一个 SQLite 数据库（`server/db/blog.sqlite`）
- 确认两个服务都已启动（`frontApp` @ 8787 和 `adminApp` @ 3000）
- 如果刚导入数据，刷新页面查看最新结果

### Q: Dashboard 统计全为 0

- 当前 Dashboard 为占位页，统计卡片硬编码为 0
- Phase 3 将接入真实数据统计（文章/标签/分类计数、PV/UV 等）

## 图片相关

### Q: 上传图片后预览显示不了

- 检查浏览器控制台是否有 404 错误
- 确认 `vite.config.ts` 中配置了 `/admin-static` 代理到 `http://localhost:8787`
- 确认 `server/public/uploads/` 目录存在且有图片文件

### Q: 媒体库刷新后图片消失

- 当前版本媒体库为 MVP，仅缓存本次会话内上传的 URL（通过 localStorage）
- Phase 3 将补充后端 media 表，实现真正的历史记录

## 友链相关

### Q: 如何设置友链图标

- 当前版本需在「图标」字段手动粘贴图标 URL
- 支持相对路径（如 `/admin-static/uploads/xxx.png`）或绝对地址（如 `https://example.com/icon.png`）
- Phase 3 将引入图标选择器，支持 dashboard-icons 库搜索

## 备份相关

### Q: 导入提示"invalid_format"

- 备份文件必须是 `version: 2` 的 JSON
- 文件结构需包含 `posts`、`tags`、`categories`、`links` 等字段
- 不支持旧版 v1 备份，如需导入旧备份请联系开发者

### Q: 导出文件很大

- 正常，100 篇文章 + 标签 + 分类的备份约 1~5MB
- 备份文件是纯文本 JSON，可用 gzip 压缩后存储

## 其他

### Q: 审计日志在哪里看

- 侧边栏 → 运维 → 审计日志
- 仅超管或有 `ops:logs` 权限的用户可见
- 记录所有 POST/PUT/DELETE 操作的详情

### Q: 如何修改超管密码

1. 进入「用户管理」
2. 找到自己的账号，点击「重置密码」
3. 输入新密码（至少 6 位）
