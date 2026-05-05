# Phase 2 §5.2 验收计划

> 本文档配合 `05-implementation-plan.md` §5.2 中的 T2.33 ~ T2.35。
>
> Phase 2 全部代码已合并（§5.1.1~§5.1.5 共 33 个 PR）。本阶段以手工验收 + 文档为主，不产新代码 PR（除非发现阻塞级 bug）。
>
> 预计总工时：5h（3 个任务，可串行）。

---

## 0. Phase 2 完成总览

| 子阶段 | PR 数 | 状态 |
|---|---|---|
| §5.1.1 RBAC 后端 | 6 PR (#127, #32~#37) | ✅ 已合并 |
| §5.1.2 CMS 后端 | 7 PR (#38~#45) | ✅ 已合并 |
| §5.1.3 通用前端组件 | 6 PR (#140~#145) | ✅ 已合并 |
| §5.1.4 RBAC 前端页面 | 4 PR (#146~#149) | ✅ 已合并 |
| §5.1.5 CMS 前端页面 | 7 PR (#150~#156) | ✅ 已合并 |
| **合计** | **30 PR** | **Phase 2 代码全部完成** |

---

## 1. 验收目标

1. **功能完整性**：新后台（Vue SPA @ 5173/3000）能完整替代旧 EJS 后台（`/admin/*` @ 8787）的所有管理操作。
2. **数据一致性**：同一数据库，新旧后台看到的数据完全一致。
3. **权限正确性**：RBAC 角色/权限/菜单过滤在实际使用中按预期生效。
4. **操作可追溯**：所有写操作写入 `audit_logs`。
5. **文档交付**：用户使用手册覆盖 90% 以上日常操作。

---

## 2. T2.33 — 端到端验收（核心流程录屏）

**Issue**: #63 / **估时**: 1.5h / **依赖**: 全部代码已合并

### 2.1 验收场景（按顺序执行）

```
1. 启动双端口服务（npm run dev）
2. 旧 EJS 后台登录（admin@example.com）→ 确认能访问旧后台
3. 新后台登录（同一账号）→ 确认 JWT token 获取成功
4. Dashboard 显示正常（无报错）
5. 用户管理：新建用户 "testeditor" → 分配 content_admin 角色
6. 用 testeditor 登录新后台 → 确认只能看到文章/标签/分类/媒体菜单
7. 文章管理：新建文章 → 保存草稿 → 编辑 → 发布
8. 前台 8787 确认文章已发布（访问对应 slug）
9. 标签管理：新建标签 "验收测试"
10. 分类管理：新建分类 "测试分类"
11. 文章编辑：给刚才的文章打上标签和分类 → 保存
12. 友链管理：新建一条友链
13. 媒体库：上传一张图片
14. 数据备份：导出 JSON → 本地保存
15. 数据恢复：导入刚才导出的 JSON → 确认数据无损
16. 审计日志：检查 audit_logs 表，确认上述操作都有记录
17. 角色管理：新建一个只读角色 → 分配给 testeditor → 验证按钮隐藏
18. 退出登录，关闭浏览器
```

### 2.2 验收通过标准

- [ ] 上述 18 步全部可执行，无 500 错误
- [ ] 录屏保存（GIF 或 MP4），时长控制在 3 分钟以内
- [ ] 发现任何阻塞级 bug 立即建 Issue（label: `bug` + `phase-2` + `priority-high`）

### 2.3 提交检查清单

- [ ] 录屏文件保存到项目根目录 `docs/assets/phase2-acceptance.gif`
- [ ] 验收过程中发现的 bug 列表更新到本文档 §5
- [ ] commit + PR + `Closes #63` + merge（可合到文档更新 PR 里）

---

## 3. T2.34 — 旧后台对照测试

**Issue**: #64 / **估时**: 1.5h / **依赖**: T2.33

### 3.1 对照清单

| 旧 EJS 功能 | 旧路径 | 新 Vue 对应 | 新路径 | 验收结果 |
|---|---|---|---|---|
| 登录页 | `/admin/login` | 登录页 | `/login` | ⬜ |
| 文章列表 | `/admin/posts` | 文章列表 | `/posts` | ⬜ |
| 新建文章 | `/admin/posts/new` | 新建文章 | `/posts/new` | ⬜ |
| 编辑文章 | `/admin/posts/:id/edit` | 编辑文章 | `/posts/:id/edit` | ⬜ |
| 标签管理 | `/admin/tags` (旧版无独立页) | 标签列表 | `/tags` | ⬜ |
| 分类管理 | `/admin/categories` (旧版无独立页) | 分类列表 | `/categories` | ⬜ |
| 友链管理 | `/admin/links` | 友链列表 | `/links` | ⬜ |
| 文件上传 | `/api/admin/upload` | 上传 API | `/api/v2/admin/cms/upload` | ⬜ |
| 数据导出 | `/api/admin/export` | 导出 JSON | `/api/v2/admin/cms/backup/export` | ⬜ |
| 数据导入 | `/api/admin/import` | 导入 JSON | `/api/v2/admin/cms/backup/import` | ⬜ |
| 用户管理 | 旧版无 | 用户列表 | `/users` | ⬜ 新增 |
| 角色管理 | 旧版无 | 角色列表 | `/roles` | ⬜ 新增 |
| 权限管理 | 旧版无 | 权限列表 | `/permissions` | ⬜ 新增 |
| 菜单管理 | 旧版无 | 菜单树 | `/menus` | ⬜ 新增 |
| 审计日志 | 旧版无 | 待 Phase 4 | — | ⬜ 延后 |

### 3.2 数据一致性验证

- [ ] 旧后台文章列表总数 = 新后台文章列表总数
- [ ] 旧后台标签列表 = 新后台标签列表（顺序可能不同，内容一致）
- [ ] 旧后台分类列表 = 新后台分类列表
- [ ] 旧后台友链列表 = 新后台友链列表（含 sortOrder）

### 3.3 提交检查清单

- [ ] 对照清单表格填写完成（本文件 §3.1）
- [ ] 数据一致性验证通过
- [ ] 发现任何不一致立即建 Issue
- [ ] commit + PR + `Closes #64` + merge

---

## 4. T2.35 — 用户使用手册

**Issue**: #65 / **估时**: 2h / **依赖**: T2.33, T2.34

### 4.1 文档结构

```
docs/
└── user-guide/
    ├── README.md           # 手册入口
    ├── 01-getting-started.md  # 登录 + Dashboard
    ├── 02-user-management.md  # 用户/角色/权限
    ├── 03-post-management.md  # 文章生命周期
    ├── 04-tag-category.md     # 标签与分类
    ├── 05-links-media.md      # 友链与媒体库
    ├── 06-backup-restore.md   # 导入导出
    └── 07-faq.md              # 常见问题
```

### 4.2 每节内容模板

```markdown
# XX 管理

## 功能概述
1-2 句话说明本功能做什么。

## 操作步骤
1. 点击侧边栏 "XX"
2. ...

## 截图
（如有）

## 注意事项
- 权限要求：需要 `xx:xx` 权限
- 常见错误：...
```

### 4.3 提交检查清单

- [ ] `docs/user-guide/` 目录及 7 个 md 文件
- [ ] 覆盖登录、用户、角色、文章、标签、分类、友链、媒体、备份
- [ ] 每节含操作步骤和权限要求
- [ ] commit + PR + `Closes #65` + merge

---

## 5. §5.1.5 偏离清单跟进（P1-P13）

| ID | 偏离描述 | 影响 | 处理建议 | 负责阶段 |
|---|---|---|---|---|
| P1 | DataTable `:fetch` 返回 `{list,total}` 而非 `{items,total}` | 设计文档 §0 假设错误 | 已对齐，无需改代码 | — |
| P2 | DataTable `query` reactive 自动刷新 | 设计文档 §5 假设手动 fetch | 已对齐，设计文档已更新 | — |
| P3 | T2.25 菜单 seed 未自动加 `/cms/backup` | 新部署时备份菜单不可见 | 首次部署后手动在菜单管理页添加 | 运维 |
| P4 | App.vue 已包 NMessageProvider + NDialogProvider | 设计文档假设需要手动包 | 已对齐 | — |
| P5 | api 层内部做 snake_case 转换 | 设计文档假设前端直接传 snake_case | 已对齐 | — |
| P6 | 后端无媒体文件列表 API | 媒体库只能上传，无历史列表 | **Phase 3 或按需补充**：后端加 `GET /uploads` 读目录 | Phase 3 |
| P7 | n-cascader 不支持 null，根菜单用 0 sentinel | 设计文档假设 null | 已对齐（提交前转 null） | — |
| P8 | 权限码统一用后端校验的码（如 `role:assign`） | 设计文档假设 `permission:list` | 已对齐 | — |
| P9 | 标签选择器用 tag + filterable（可输入新标签） | 设计文档假设只能选已有标签 | 已对齐（后端自动创建新标签） | — |
| P10 | 友链拖拽 UI 未接 apiReorderLinks | 当前用 NInputNumber 调 sortOrder | **Phase 3 或按需补充**：引入 vuedraggable | Phase 3 |
| P11 | 后端 listPosts 返回 counts 结构需确认 | 设计文档假设 counts 在响应里 | 已验证（counts 在 T2.8 已实现） | — |
| P12 | 批量操作后端未提供 bulk endpoints | 前端逐个调用 delete/update | **可选优化**：后端加 `POST /bulk-delete` 提升效率 | Phase 3 |
| P13 | 菜单管理页手动新增 `/cms/backup` | seed 策略不自动加 | 生产环境首次部署时手动添加 | 运维 |
| P14 | 友链图标字段为纯文本输入（旧 EJS 有图标选择器弹窗） | 新后台编辑友链时需手动粘贴图标 URL | **Phase 3 补充**：引入 dashboard-icons 图标选择器组件（与旧后台等价） | Phase 3 |

---

## 6. §5.2 验收 Checklist（原 `05-implementation-plan.md` §5.2）

- [ ] 通过新后台完成一篇文章的完整生命周期（创建→保存→发布→修改→下架→删除）
- [ ] 创建一个新用户，分配"内容编辑"角色，登录后只能看到文章/标签/分类菜单
- [ ] 创建一个新角色，赋予部分权限，分配给用户验证按钮级权限
- [ ] 上传 5 张图片，在媒体库可见，可复制链接到文章
- [ ] 旧 EJS 后台 `/admin/posts` 与新 `/posts` 数据完全一致
- [ ] 数据导出 → 清空数据库 → 导入还原，数据无损
- [ ] 所有写操作在 `audit_logs` 表能查到记录

---

## 7. 给 Claude Code 的快速接入提示

```
我在做 ifoxchen.com v2 后台 Phase 2 §5.2 验收。完整计划文档在：
11-phase2-acceptance-plan.md

Phase 2 全部代码已合并（30 PR）。本阶段 3 个任务以手工验收 + 文档为主：
T2.33 (端到端录屏验收) → T2.34 (旧后台对照测试) → T2.35 (用户使用手册)

T2.35 需要写 Markdown 文档（docs/user-guide/），请按文档 §4 的结构生成。

注意：
1. 文件引用只用裸文件名，不加 docs/ 前缀
2. 验收过程中发现的 bug 直接在本文件 §5 追加
3. T2.33 录屏文件保存到 docs/assets/phase2-acceptance.gif

Phase 2 §5.2 全部完成后告诉我，回 Cowork 复盘 + 进 Phase 3 规划。
```

---

## 8. 后续衔接（不在本文档范围）

- **Phase 3 数据分析**（T3.1 ~ T3.13）：PV/UV 采集、Dashboard 升级、ECharts 图表
- **Phase 4 运维监控**（T4.1 ~ T4.11）：审计日志查询页、备份管理、系统监控看板

完成 §5.2 后回 Cowork 出 Phase 3 整片设计。

---

**写于**：2026-05-05（Phase 2 §5.1.5 完成后推进 §5.2 验收）
**作者**：Cowork session 出方案
