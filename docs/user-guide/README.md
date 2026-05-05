# 后台管理用户使用手册

本文档面向博客管理员，介绍如何使用新版 Vue 3 后台管理系统（`http://localhost:5173` 或生产域名 `/admin`）。

## 适用版本

- 前端：Vue 3 SPA，Naive UI 组件库
- 后端：Express 5 + SQLite
- 认证方式：JWT（Bearer Token）

## 目录

1. [登录与仪表盘](01-getting-started.md) — 登录流程、Dashboard 概览
2. [用户与权限管理](02-user-management.md) — 用户、角色、权限、菜单
3. [文章管理](03-post-management.md) — 创建、编辑、发布、下架
4. [标签与分类](04-tag-category.md) — 标签和分类的增删改查
5. [友链与媒体库](05-links-media.md) — 友情链接管理和图片上传
6. [数据备份与恢复](06-backup-restore.md) — 全库 JSON 导出/导入
7. [常见问题](07-faq.md) — 登录失败、权限不足、图片不显示等

## 权限速查

| 功能 | 所需权限码 | 说明 |
|---|---|---|
| 文章列表 | `post:list` | 查看文章 |
| 新建文章 | `post:create` | 创建文章草稿 |
| 编辑文章 | `post:update` | 修改已有文章 |
| 删除文章 | `post:delete` | 删除文章 |
| 用户管理 | `user:list` | 查看/管理用户 |
| 角色管理 | `role:assign` | 分配角色和权限 |
| 数据导入导出 | `cms:export` | 导出/导入全库 JSON |
| 审计日志 | `ops:logs` | 查看操作记录（仅超管） |

> 超管（`is_super_admin = true`）拥有所有权限，不受 RBAC 限制。
