# Generic Dashboard 文档

## 项目概述

通用仪表盘模板，基于 Vue 3 + Vite + Tailwind CSS v4 + DaisyUI v5 + ECharts 6 构建。参考 [Zashboard](https://github.com/Zephyruso/zashboard) 设计风格。

**项目路径**: `C:\Users\chenke\.qclaw\agents\ifoxchen\generic-dashboard\`

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue | 3.5.x |
| 构建 | Vite | 8.x |
| 语言 | TypeScript | - |
| 样式 | Tailwind CSS | 4.x |
| 组件库 | DaisyUI | 5.x |
| 图表 | ECharts | 6.x |
| 包管理 | pnpm | - |

---

## 目录结构

```
generic-dashboard/
├── src/
│   ├── assets/
│   │   └── icons/           # SVG 图标
│   ├── components/
│   │   ├── charts/          # 图表组件
│   │   │   ├── AreaChart.vue
│   │   │   ├── BarChartCard.vue
│   │   │   ├── DonutChart.vue
│   │   │   ├── EChartCard.vue
│   │   │   ├── GaugeChart.vue
│   │   │   ├── Heatmap.vue
│   │   │   ├── LineChart.vue
│   │   │   ├── MiniSparkline.vue
│   │   │   ├── RadarChart.vue
│   │   │   └── SankeyChart.vue
│   │   ├── common/          # 通用组件
│   │   │   ├── Avatar.vue
│   │   │   ├── Button.vue
│   │   │   ├── Card.vue
│   │   │   ├── CollapseCard.vue
│   │   │   ├── ColorPicker.vue
│   │   │   ├── DataList.vue
│   │   │   ├── DataTable.vue
│   │   │   ├── Empty.vue
│   │   │   ├── Input.vue
│   │   │   ├── InputNumber.vue
│   │   │   ├── Loading.vue
│   │   │   ├── MetricGrid.vue
│   │   │   ├── Modal.vue
│   │   │   ├── Pagination.vue
│   │   │   ├── PanelCard.vue
│   │   │   ├── ProgressBarList.vue
│   │   │   ├── SearchPanel.vue
│   │   │   ├── Select.vue
│   │   │   ├── StatusBadge.vue
│   │   │   ├── TabPanel.vue
│   │   │   ├── TagFilter.vue
│   │   │   ├── ToggleList.vue
│   │   │   └── Tooltip.vue
│   │   ├── data/            # 数据相关组件
│   │   │   ├── Cascader.vue
│   │   │   ├── DatePicker.vue
│   │   │   ├── DateRangePicker.vue
│   │   │   └── Tree.vue
│   │   ├── layout/          # 布局组件
│   │   │   ├── Footer.vue
│   │   │   ├── Header.vue
│   │   │   ├── SplitPane.vue
│   │   │   └── ScrollArea.vue
│   │   ├── navigation/     # 导航组件
│   │   │   └── MobileDock.vue
│   │   ├── overview/       # 概览页组件
│   │   │   └── MiniSparkline.vue
│   │   ├── proxies/        # 代理相关组件
│   │   │   └── LatencyTag.vue
│   │   └── sidebar/        # 侧边栏
│   │       └── SideBar.vue
│   ├── styles/
│   │   ├── framework.css   # 主题定义（Zashboard 风格）
│   │   └── components.css  # 组件样式覆盖
│   ├── views/              # 页面
│   │   ├── OverviewPage.vue
│   │   ├── ConnectionsPage.vue
│   │   ├── ProxiesPage.vue
│   │   ├── LogsPage.vue
│   │   ├── RulesPage.vue
│   │   ├── DNSPage.vue
│   │   ├── ProfilesPage.vue
│   │   ├── ConfigPage.vue
│   │   ├── SettingsPage.vue
│   │   ├── TrafficPage.vue
│   │   ├── ComponentsPage.vue
│   │   └── TopologyPage.vue
│   ├── router/
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── docs/
    └── README.md
```

---

## 页面列表

| 页面 | 路径 | 说明 |
|------|------|------|
| Overview | `/` | 系统概览，含指标网格、连接状态图、流量趋势 |
| Connections | `/connections` | 连接管理 |
| Proxies | `/proxies` | 代理节点与延迟 |
| Logs | `/logs` | 日志查看 |
| Rules | `/rules` | 规则管理 |
| DNS | `/dns` | DNS 配置 |
| Profiles | `/profiles` |  profiles 管理 |
| Config | `/config` | 全局配置 |
| Settings | `/settings` | 设置页 |
| Traffic | `/traffic` | 数据流实时模拟 |
| Components | `/components` | 组件展示页 |
| Topology | `/topology` | 桑基图连接拓扑 |

---

## 组件使用示例

### Input

```vue
<Input
  v-model="name"
  label="姓名"
  placeholder="请输入"
  error="输入错误"
/>
```

### Select

```vue
<Select
  v-model="selected"
  :options="[{ label: '选项1', value: 1 }, { label: '选项2', value: 2 }]"
  label="选择"
  placeholder="请选择"
/>
```

### Modal

```vue
<Modal :open="showModal" title="提示" @close="showModal = false">
  <p>内容</p>
  <template #action>
    <button class="btn" @click="showModal = false">取消</button>
    <button class="btn btn-primary">确认</button>
  </template>
</Modal>
```

### DataTable

```vue
<DataTable
  :columns="[
    { key: 'name', label: '名称' },
    { key: 'status', label: '状态', cellClass: 'text-center' },
  ]"
  :data="tableData"
  :showPagination="true"
  :total="100"
  :page="1"
  :pageSize="20"
  @rowClick="onRowClick"
/>
```

### CollapseCard

```vue
<CollapseCard title="基本信息" :defaultOpen="true">
  <p>可折叠的内容</p>
</CollapseCard>
```

---

## 主题

`framework.css` 定义了 5 种主题：

- **light-monet** - 浅色莫奈风
- **dark-monet** - 深色莫奈风
- **light** - 浅色主题
- **dark** - 深色主题
- **dark-daisyui5** - DaisyUI5 深色

---

## 待实现功能

以下功能在开发计划中但尚未完成：

- 主题切换（light/dark 切换）
- i18n 国际化
- 真实 API 集成
- WebSocket 实时数据
- 地理地图可视化
- 流量排行页面
- 延迟对比图表

---

## 已知问题

- `ComponentsPage.vue` 中多个 ECharts 实例可能导致页面冻结
- 端口 5173/5174 有僵尸进程残留

---

## 启动

```bash
cd C:\Users\chenke\.qclaw\agents\ifoxchen\generic-dashboard
pnpm dev
```

开发服务器默认运行在 `http://localhost:5173/`，端口可能被占用时自动递增。