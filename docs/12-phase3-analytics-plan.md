# Phase 3 数据分析与 Dashboard 升级计划

> 承接 Phase 2 验收完成后的增强方向。核心目标：让 Dashboard 从"占位页"变成"数据驾驶舱"。
>
> **预计总工时**：8h（3 个子阶段，可并行）。

---

## 0. Phase 3 范围

| 模块 | 内容 | 优先级 |
|---|---|---|
| Dashboard 统计 | 文章/标签/分类/今日访问真实数字 | P0 |
| 访问趋势图表 | 近 7/30 天 PV/UV 折线图 | P0 |
| 文章排行 | 阅读量 Top 10 柱状图 | P1 |
| 标签/分类分布 | 文章数量饼图 | P1 |
| 前台 PV 采集 | 1x1 pixel 或 fetch 上报 | P0 |
| 数据导出 | 统计报表 CSV 导出（可选） | P2 |

---

## 1. 数据库与采集层

### 1.1 page_views 采集

前台每页加载时发送一次 PV 请求：

```html
<!-- index.html / post.html / archive.html 等所有前台页面底部 -->
<img src="/api/pv?path=<当前路径>&ref=<document.referrer>" width="1" height="1" style="display:none" />
```

后端 `frontApp` 新增：

```
GET /api/pv?path=&ref=
```

- 写入 `page_views` 表（path, referrer, ip, user_agent, session_id, created_at）
- session_id 用 `req.sessionID`（express-session）或 Cookie 中的 `sid`
- UV = 按 session_id + DATE(created_at) 去重统计
- 返回 1x1 transparent gif（避免 img 标签报错）

### 1.2 统计聚合 API（adminApp）

新增 `server/src/apps/admin/analytics/`：

```
GET /api/v2/admin/analytics/dashboard
```

返回：

```json
{
  "code": 200,
  "data": {
    "postCount": 42,
    "tagCount": 15,
    "categoryCount": 8,
    "todayPv": 128,
    "todayUv": 56
  }
}
```

```
GET /api/v2/admin/analytics/trend?days=7
```

返回：

```json
{
  "code": 200,
  "data": {
    "labels": ["05-01", "05-02", ...],
    "pv": [120, 135, ...],
    "uv": [45, 52, ...]
  }
}
```

```
GET /api/v2/admin/analytics/posts?limit=10
```

返回阅读量 Top N 文章（需要先给 posts 表加 `view_count` 字段，或在 page_views 中按 path 聚合 `/post/:slug`）：

```json
{
  "code": 200,
  "data": {
    "items": [
      { "title": "xxx", "slug": "xxx", "viewCount": 1200 }
    ]
  }
}
```

```
GET /api/v2/admin/analytics/distribution
```

返回标签/分类文章分布：

```json
{
  "code": 200,
  "data": {
    "tags": [{ "name": "Vue", "count": 8 }, ...],
    "categories": [{ "name": "前端", "count": 12 }, ...]
  }
}
```

---

## 2. 前端设计

### 2.1 Dashboard 升级

`admin/src/views/dashboard/index.vue` 改造：

- 4 个统计卡片接入真实 API（`apiGetDashboardStats`）
- 新增 2 行图表区：
  - 第一行：访问趋势（折线图，占 2/3 宽度）+ 文章 Top 5（柱状图，占 1/3）
  - 第二行：标签分布（饼图，占 1/2）+ 分类分布（饼图，占 1/2）

图表库：ECharts（通过 `echarts` npm 包引入）

```typescript
import * as echarts from 'echarts'
```

### 2.2 图表组件封装

新建 `admin/src/components/charts/`：

- `LineChart.vue` — 折线图（通用：传入 labels + series 数据）
- `BarChart.vue` — 柱状图
- `PieChart.vue` — 饼图

### 2.3 API 层

`admin/src/api/analytics.ts`：

```typescript
export async function apiGetDashboardStats(): Promise<DashboardStats>
export async function apiGetTrend(days: number): Promise<TrendData>
export async function apiGetTopPosts(limit: number): Promise<TopPostsData>
export async function apiGetDistribution(): Promise<DistributionData>
```

---

## 3. 任务拆分

### T3.1 — 前台 PV 采集（1h）

- `frontApp.js` 新增 `/api/pv` 路由
- 所有前台 HTML 页面底部插入 1x1 pixel
- 写入 `page_views` 表

### T3.2 — 后端统计 API（1.5h）

- 新建 `server/src/apps/admin/analytics/analyticsRouter.js`
- 实现 dashboard / trend / topPosts / distribution 四个接口
- `adminApp.js` 挂载 `/api/v2/admin/analytics`

### T3.3 — Dashboard 统计卡片真实化（0.5h）

- 前端调用 `apiGetDashboardStats`
- 替换硬编码 0

### T3.4 — ECharts 图表接入（2h）

- 安装 `echarts`：`cd admin && npm install echarts`
- 封装 LineChart / BarChart / PieChart 组件
- Dashboard 接入趋势、排行、分布三个图表

### T3.5 — 数据一致性验证（0.5h）

- 前台访问几次，确认 `page_views` 有记录
- Dashboard 数字与数据库 count 一致
- 图表数据与 API 返回一致

---

## 4. 验收标准

- [ ] Dashboard 统计卡片显示真实数字（文章/标签/分类/今日访问）
- [ ] 访问趋势图展示近 7 天 PV/UV 折线
- [ ] 文章阅读量 Top 10 柱状图正确渲染
- [ ] 标签/分类分布饼图正确渲染
- [ ] 前台每页刷新都会写入 `page_views` 记录
- [ ] 所有图表支持响应式（窗口 resize 自适应）

---

## 5. 后续衔接

- **Phase 4 运维监控**：审计日志查询页优化、备份定时任务、系统监控看板
- **可选增强**：热力图（访问时段分布）、来源分析（referrer 聚合）、文章转化率漏斗

---

**写于**：2026-05-05（Phase 2 完成后立即推进）
**作者**：Cowork session 出方案
