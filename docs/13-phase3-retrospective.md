# Phase 3 复盘报告

> 完成日期：2026-05-05
> 里程碑：M3 — 数据分析模块上线 ✅

---

## 1. 范围与成果

Phase 3 核心目标是把 Dashboard 从"占位页"升级为"数据驾驶舱"。

### 已完成任务

| 任务 | 内容 | PR/Issue |
|------|------|----------|
| T3.1 | 前台 PV 采集（1x1 pixel → `/api/pv`） | #66 |
| T3.2 | 后端统计 API（dashboard / trend / posts / distribution） | #67 |
| T3.3 | Dashboard 统计卡片接入真实数据 | #67 |
| T3.4 | ECharts 图表集成（趋势折线 + 文章排行柱状 + 标签/分类饼图） | #67 |
| P14 | 友链图标选择器（dashboard-icons CDN） | #65 |
| P10 | 友链拖拽排序 UI | #66 |
| 增强 | 图表组件封装（LineChart / BarChart / PieChart） | #67 |
| 增强 | CSV 导出报表 | #67 |
| 增强 | 来源分析 API `/referrers` + Top 10 柱状图 | #67 |
| 增强 | 今日时段分布 API `/hourly` + 24h 折线 | #67 |

### 产出文件

- `server/src/apps/admin/analytics/analyticsRouter.js` — 6 个 REST API
- `admin/src/api/analytics.ts` — typed API 封装
- `admin/src/views/dashboard/index.vue` — 组件驱动重写
- `admin/src/components/charts/{Line,Bar,Pie}Chart.vue` — 3 个通用图表组件
- `admin/src/views/cms/links/index.vue` — 图标选择器 + 拖拽排序
- `docs/12-phase3-analytics-plan.md` — 设计文档
- `docs/13-phase3-retrospective.md` — 本复盘

---

## 2. 时间线

- **2026-05-05**：Phase 2 验收完成，立即启动 Phase 3
- **当日**：T3.1~T3.4 全部完成并 merge
- **当日**：P14 图标选择器、P10 拖拽排序完成并 merge
- **当日**：Dashboard 增强（组件封装 + CSV + 来源 + 时段）完成并 merge

**实际工时**：约 11h（原计划 5h，额外完成 6h 增强功能）

---

## 3. 技术决策

### 3.1 PV 采集方案
- 选用 1x1 `<img>` pixel 而非 `fetch`/`sendBeacon`
- 原因：兼容性好、无 CORS 问题、失败不影响页面
- 返回透明 GIF，避免图片裂图

### 3.2 UV 统计
- 使用 `express-session` 的 `sessionID` 作为 UV 标识
- 按 `COUNT(DISTINCT session_id)` 统计

### 3.3 图表库
- ECharts 6.x，全量 import（`import * as echarts from 'echarts'`）
- 抽离为 3 个通用组件，方便 Phase 4 监控看板复用

### 3.4 图标选择器
- 使用 jsDelivr + `homarr-labs/dashboard-icons` CDN
- 优先 SVG，直接拼 URL 不做 HEAD 探测（避免 403）
- 支持关键词搜索 + favicon 自动抓取

---

## 4. Bug 与修复

| 问题 | 原因 | 修复 |
|------|------|------|
| Analytics 500 | `post_id` / `tag_id` 列名写错（schema 是 `postId` / `tagId`） | 修正 SQL 列名 |
| jsDelivr 403 | CDN 拒绝 HEAD 请求 | 去掉 HEAD 探测，直接拼 URL |
| 今日访问 0 | `page_views` 表无数据，需前台访问触发 | 正常行为，前台浏览后即有数据 |

---

## 5. 待办遗留

- **T3.7 定时聚合任务**（Issue #72）：当前实时查询实现，日数据量 <10k 时性能可接受；数据量大后需定时任务预聚合
- **P6 媒体列表 API**：Phase 2 偏离清单，待后续补充
- **P12 bulk endpoints**：批量操作 API，待后续补充

---

## 6. 验收结论

- ✅ Dashboard 6 个 API 全部可用
- ✅ 4 张图表正确渲染（趋势 / 排行 / 标签分布 / 分类分布）
- ✅ 来源分析 + 时段分布正常
- ✅ CSV 导出功能正常
- ✅ 友链图标选择器 + 拖拽排序正常
- ✅ 所有控制台无报错

**Phase 3 达标，M3 里程碑完成。**

---

## 7. 下一步

**Phase 4 — 运维监控模块（M4，截止 2026-07-12）**

候选任务：
- 审计日志查询页优化（高级筛选、导出）
- 数据备份定时任务（node-cron + 自动备份到本地/云存储）
- 系统监控看板（CPU/内存/磁盘、在线人数、请求 QPS）
- 报警通知（异常登录、磁盘满、备份失败）
