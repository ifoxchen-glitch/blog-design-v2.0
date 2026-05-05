# Phase 2 §5.1.3 通用前端组件整片设计

> 本文档配合 [`docs/05-implementation-plan.md`](./05-implementation-plan.md) §5.1.3 中的 T2.16 ~ T2.21。
>
> 给 Claude Code 执行用。每节末有 **"提交检查清单"**——按那个跑就能合 PR、关 Issue。
>
> 技术栈：Vue 3.5 + TypeScript + Naive UI + Pinia 3 + Vue Router 5 + Tailwind CSS 4。
>
> 完成时间：2026-05-05 起，预计 13h（6 个 PR）。

---

## 0. 前置依赖

- **§5.1.1 + §5.1.2 后端全部合并**——所有 v2 API 已可用（RBAC + CMS）。
- **前端已有基础**：`admin/src/api/request.ts`（Axios + Bearer + 401 刷新）、`stores/auth.ts`、`stores/permission.ts`、路由守卫、`AdminLayout.vue`。
- **Naive UI 已全局注册**——组件直接用 `<n-button>`、`<n-data-table>` 等，不需要再 import 注册。
- **Tailwind CSS 已配**——在 `<template>` 里写 `class="flex gap-2"` 等。
- **`v-permission` 指令已注册**——`<n-button v-permission="'post:create'">` 会自动隐藏无权限的 DOM。

---

## 1. 总体节奏 & 依赖图

```
T2.16 PageHeader.vue            (1h)
   ↓
T2.21 useTable.ts               (1.5h)
   ↓
T2.17 DataTable.vue             (4h)  ┐
                                      │ 互不依赖，可并列
T2.18 FormDrawer.vue            (2h)  ┘
   ↓
T2.19 MarkdownEditor.vue        (3h)
   ↓
T2.20 ImageUploader.vue         (1.5h)
```

**建议合并节奏**：每个任务一个 PR，6 PR 全程，各自 `Closes #<n>`。Issue 编号映射：
- T2.16=#46, T2.17=#47, T2.18=#48, T2.19=#49, T2.20=#50, T2.21=#51

---

## 2. T2.16 — PageHeader.vue（页面头部组件）

**Issue**: #46 / **估时**：1h

### 2.1 功能

每个管理页面顶部的标题区：页面标题 + 面包屑 + 右侧操作按钮槽位。

### 2.2 Props

```ts
interface PageHeaderProps {
  title: string;           // 页面标题
  subtitle?: string;       // 副标题/描述
  breadcrumbs?: Array<{ label: string; path?: string }>;  // 面包屑
}
```

### 2.3 默认插槽

右侧操作按钮区：`<slot />`

```vue
<PageHeader title="文章管理" subtitle="共 42 篇文章">
  <template #default>
    <n-button type="primary" v-permission="'post:create'" @click="showCreateDrawer">
      新建文章
    </n-button>
  </template>
</PageHeader>
```

### 2.4 实现要点

- 用 Naive UI 的 `<n-breadcrumb>` 做面包屑
- 面包屑最后一项不带 `path`（当前页不可点）
- `subtitle` 用 `text-gray-500 text-sm`
- 整体下边距 `mb-6`
- 不需要状态，纯展示组件

### 2.5 文件位置

```
admin/src/components/common/PageHeader.vue
```

### 2.6 提交检查清单

- [ ] Props 类型完整（title/subtitle/breadcrumbs）
- [ ] 面包屑正确渲染，最后一项不可点
- [ ] 默认插槽放右侧按钮区
- [ ] 引用页面试跑（Dashboard 或临时 test 页）
- [ ] commit + PR + `Closes #46` + merge

---

## 3. T2.21 — useTable.ts（表格数据获取 hook）

**Issue**: #51 / **估时**：1.5h / **依赖**：T2.16

为什么先做 T2.21 再做 T2.17？因为 DataTable 重度依赖 useTable，hook 先定型表格再跟着稳。

### 3.1 功能

封装分页表格的"查数据 + 分页 + 搜索 + 排序 + 加载态"逻辑。返回 reactive state + action methods，组件只需要绑定到 `<n-data-table>` 和 `<n-pagination>`。

### 3.2 签名

```ts
import { ref, computed } from "vue";

interface UseTableOptions<T, Q = Record<string, any>> {
  api: (params: { page: number; pageSize: number; keyword?: string; sortBy?: string; sortOrder?: string } & Q) => Promise<{ items: T[]; total: number }>;
  initialPageSize?: number;
  initialQuery?: Q;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  debounceMs?: number;
}

interface UseTableReturn<T> {
  items: Ref<T[]>;
  total: Ref<number>;
  page: Ref<number>;
  pageSize: Ref<number>;
  keyword: Ref<string>;
  loading: Ref<boolean>;
  sortBy: Ref<string>;
  sortOrder: Ref<"asc" | "desc">;
  fetch: () => Promise<void>;
  reset: () => void;
}

export function useTable<T, Q = Record<string, any>>(
  options: UseTableOptions<T, Q>
): UseTableReturn<T>;
```

### 3.3 行为

- `fetch()`：调用 api，更新 `items` / `total`，自动处理 `loading` true/false
- `page` / `pageSize` / `keyword` / `sortBy` / `sortOrder` 变化时 **自动触发 fetch**（用 `watch`）
- `keyword` 用 debounce（默认 300ms），避免每敲一个字母都请求
- `reset()`：page=1, keyword="", sortBy=default, sortOrder=default, 然后 fetch
- 错误处理：api 抛错时 `loading=false`，错误吞掉不阻断（由外层 toast 处理，或用 request 拦截器的全局 error handler）

### 3.4 文件位置

```
admin/src/composables/useTable.ts
```

### 3.5 提交检查清单

- [ ] TypeScript 类型完整（泛型 T + query Q）
- [ ] debounce keyword（默认 300ms）
- [ ] page/pageSize/keyword/sort 变化自动 fetch
- [ ] loading 状态正确切换
- [ ] reset 方法恢复初始值
- [ ] 临时测试页验证（可写 admin/src/views/test-table.vue 验证后删掉，或直接在 dashboard 页里测）
- [ ] commit + PR + `Closes #51` + merge

---

## 4. T2.17 — DataTable.vue（通用表格组件）

**Issue**: #47 / **估时**：4h / **依赖**：T2.21

### 4.1 功能

基于 Naive UI `<n-data-table>` 的封装：搜索框 + 表格 + 分页 + 批量选择 + 排序指示。

### 4.2 Props

```ts
interface DataTableProps<T> {
  title?: string;                    // 表格标题（可选，如果不传就不显示标题行）
  columns: DataTableColumns<T>;     // Naive UI 的 columns 配置
  api: (params: any) => Promise<{ items: T[]; total: number }>;  // 数据接口
  initialPageSize?: number;
  searchable?: boolean;              // 是否显示搜索框（默认 true）
  searchPlaceholder?: string;
  batchActions?: Array<{             // 批量操作按钮
    label: string;
    type?: "default" | "primary" | "error";
    permission?: string;             // 按钮权限码，如 'post:delete'
    onClick: (rows: T[]) => void;
  }>;
  rowKey?: string | ((row: T) => string | number);  // 默认 'id'
  showPagination?: boolean;          // 默认 true
}
```

### 4.3 内部实现

内部使用 `useTable`：

```ts
const { items, total, page, pageSize, keyword, loading, sortBy, sortOrder, fetch, reset } = useTable({
  api: props.api,
  initialPageSize: props.initialPageSize,
});
```

### 4.4 模板结构

```vue
<template>
  <div class="space-y-4">
    <!-- 顶部：标题 + 搜索 + 批量操作 -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <n-input
          v-if="searchable"
          v-model:value="keyword"
          :placeholder="searchPlaceholder || '搜索...'"
          clearable
          class="w-64"
        />
        <n-space v-if="selectedRows.length && batchActions?.length">
          <n-button
            v-for="action in visibleBatchActions"
            :key="action.label"
            :type="action.type || 'default'"
            v-permission="action.permission"
            @click="action.onClick(selectedRows)"
          >
            {{ action.label }} ({{ selectedRows.length }})
          </n-button>
        </n-space>
      </div>
      <slot name="extra" />
    </div>

    <!-- 表格 -->
    <n-data-table
      :columns="columns"
      :data="items"
      :loading="loading"
      :row-key="rowKey || 'id'"
      @update:checked-row-keys="handleSelect"
      @update:sorter="handleSort"
      striped
      remote
    />

    <!-- 分页 -->
    <n-pagination
      v-if="showPagination !== false"
      v-model:page="page"
      v-model:page-size="pageSize"
      :item-count="total"
      :page-sizes="[10, 20, 50, 100]"
      show-size-picker
    />
  </div>
</template>
```

### 4.5 批量选择

- `n-data-table` 开启 `checked-row-keys`，选中行存在 `selectedRows` 里
- 批量操作按钮只在 `selectedRows.length > 0` 时显示
- 每个按钮支持 `permission` prop，用 `v-permission` 控制显隐

### 4.6 排序

- `n-data-table` 的 `@update:sorter` 事件返回 `{ columnKey, order }`
- `order` 为 `false` 时 = 取消排序，恢复默认
- 映射到 `sortBy` / `sortOrder`，自动触发 `useTable.fetch()`

### 4.7 文件位置

```
admin/src/components/common/DataTable.vue
```

### 4.8 提交检查清单

- [ ] 搜索框 debounce 工作正常
- [ ] 分页切换正常（page + pageSize）
- [ ] 排序点击正常（单字段排序）
- [ ] 批量选择 + 批量操作按钮显隐
- [ ] 批量操作按钮权限控制（v-permission）
- [ ] loading 状态正确（表格 skeleton）
- [ ] 空数据状态（无数据时显示空提示）
- [ ] 临时测试页验证（用 `/api/v2/admin/rbac/users` 做测试数据）
- [ ] commit + PR + `Closes #47` + merge

---

## 5. T2.18 — FormDrawer.vue（通用抽屉表单）

**Issue**: #48 / **估时**：2h

### 5.1 功能

右侧抽屉（Naive UI `<n-drawer>`），用于创建/编辑。表单内容通过默认插槽注入，提交/取消逻辑通过 props 传入。

### 5.2 Props

```ts
interface FormDrawerProps {
  show: boolean;           // v-model:show
  title: string;           // "新建文章" / "编辑文章"
  width?: number | string; // 默认 480
  submitText?: string;     // 默认 "保存"
  cancelText?: string;     // 默认 "取消"
  loading?: boolean;       // 提交中的 loading
  rules?: FormRules;       // Naive UI 表单校验规则
}

// Emits
// update:show
// submit: (values: Record<string, any>) => void
// close: () => void
```

### 5.3 用法示例

```vue
<FormDrawer
  v-model:show="showDrawer"
  title="新建文章"
  :loading="submitting"
  @submit="handleSubmit"
>
  <n-form-item label="标题" path="title">
    <n-input v-model:value="form.title" />
  </n-form-item>
  <n-form-item label="内容" path="content">
    <n-input v-model:value="form.content" type="textarea" />
  </n-form-item>
</FormDrawer>
```

### 5.4 实现要点

- 内部用 `<n-form>` 包裹默认插槽内容
- 提交时调用 `n-form` 的 `validate()`，通过后再 emit `submit`
- `close` 时 emit `update:show(false)` + `close`
- 关闭按钮在 drawer header 右侧
- `submitText` / `cancelText` 支持自定义

### 5.5 文件位置

```
admin/src/components/common/FormDrawer.vue
```

### 5.6 提交检查清单

- [ ] v-model:show 双向绑定
- [ ] 内部 n-form 自动 validate
- [ ] 提交按钮 loading 状态
- [ ] 关闭按钮 + 取消按钮正确关闭
- [ ] 宽度默认 480，支持自定义
- [ ] 临时测试页验证（如文章新建/编辑抽屉）
- [ ] commit + PR + `Closes #48` + merge

---

## 6. T2.19 — MarkdownEditor.vue（Markdown 编辑器）

**Issue**: #49 / **估时**：3h / **依赖**：T2.13（上传 API 已就绪）

### 6.1 技术选型

选 **Vditor**（不是 Bytemd）。原因：
1. Vditor 对中文支持更好，社区更活跃
2. 内置图片粘贴上传，Bytemd 需要额外插件
3. 支持源码/预览/WYSIWYG 三种模式

安装：`npm install vditor --save`

### 6.2 功能

- 编辑区：Vditor 实例
- 图片粘贴上传：监听粘贴事件，提取图片文件 → 调用 `/api/v2/admin/cms/upload` → 插入 `![alt](url)`
- 预览/源码切换：Vditor 自带
- value 双向绑定：`v-model:value="contentMarkdown"`

### 6.3 Props

```ts
interface MarkdownEditorProps {
  modelValue: string;      // v-model
  placeholder?: string;
  height?: number | string; // 默认 400
}

// Emits: update:modelValue
```

### 6.4 图片粘贴上传实现

```ts
const uploadConfig = {
  url: '/api/v2/admin/cms/upload',
  linkToImgUrl: '/api/v2/admin/cms/upload',
  filename: (name: string) => name.replace(/[^(a-zA-Z0-9一-龥\.)]/g, ""),
  success: (editor: HTMLPreElement, msg: string) => {
    const data = JSON.parse(msg);
    // data.data.url 是上传后的图片 URL
    editor.insertValue(`![${data.data.url}](${data.data.url})`);
  },
};
```

更简单的方案：直接用 Vditor 的 `upload` 配置字段，它已经封装好了图片上传。后端 `/api/v2/admin/cms/upload` 需要返回 `{"url": "..."}` 格式的 JSON（或 Vditor 认的 `{ "data": { "url": "..." } }`）。

**需要确认**：Vditor 期望的上传响应格式是 `{ "data": { "errFiles": [], "succMap": { "filename.png": "url" } } }`。我们的后端 `/api/v2/admin/cms/upload` 返回 `{ code: 200, data: { url: "..." } }`，需要前端在 Vditor 的 `success` 回调里做一层转换。

### 6.5 文件位置

```
admin/src/components/common/MarkdownEditor.vue
```

### 6.6 提交检查清单

- [ ] Vditor 正确安装并初始化
- [ ] v-model 双向绑定（getValue/setValue）
- [ ] 图片粘贴上传 → `/api/v2/admin/cms/upload` → 插入 markdown 图片语法
- [ ] 上传响应格式转换（后端 `{ code, data: { url } }` → Vditor 需要的格式）
- [ ] 高度可配置（默认 400px）
- [ ] 预览/源码/WYSIWYG 三种模式可用
- [ ] 临时测试页验证（新建文章页里嵌入）
- [ ] commit + PR + `Closes #49` + merge

---

## 7. T2.20 — ImageUploader.vue（图片上传组件）

**Issue**: #50 / **估时**：1.5h / **依赖**：T2.13

### 7.1 功能

单图/多图上传，支持：
- 拖拽上传
- 点击上传
- 上传进度条
- 删除已上传图片
- 预览

### 7.2 技术选型

直接用 Naive UI 的 `<n-upload>` 组件，不需要自己写拖拽逻辑。`<n-upload>` 已经封装了拖拽、进度、删除、预览。

### 7.3 Props

```ts
interface ImageUploaderProps {
  modelValue: string | string[];  // 单图传 string，多图传 string[]
  multiple?: boolean;             // 默认 false
  maxSize?: number;               // 单文件最大大小（MB），默认 10
  maxCount?: number;              // 最多几张，默认 9
  accept?: string;                // 默认 "image/*"
}

// Emits: update:modelValue
```

### 7.4 实现要点

- 用 `<n-upload>` + `custom-request` 做上传
- `custom-request` 里用 `api/request.ts` 的 axios 实例，自动带 Bearer token
- 上传地址：`/api/v2/admin/cms/upload`
- 单图模式：只保留最后一张，`modelValue` 是字符串 URL
- 多图模式：`modelValue` 是字符串数组
- 预览用 `<n-image>` 或 Naive UI 的 preview

```ts
const customRequest = async ({ file, onProgress, onFinish, onError }: UploadCustomRequestOptions) => {
  const formData = new FormData();
  formData.append("image", file.file!);
  try {
    const res = await apiUpload(formData, {
      onUploadProgress: (e) => {
        onProgress?.({ percent: Math.floor((e.loaded / e.total!) * 100) });
      },
    });
    onFinish?.();
    // 更新 modelValue
  } catch (err) {
    onError?.();
  }
};
```

### 7.5 文件位置

```
admin/src/components/common/ImageUploader.vue
```

### 7.6 提交检查清单

- [ ] 单图/多图模式切换
- [ ] 拖拽上传
- [ ] 上传进度条
- [ ] 删除已上传图片
- [ ] 预览（n-image）
- [ ] maxSize / maxCount 限制
- [ ] 临时测试页验证
- [ ] commit + PR + `Closes #50` + merge

---

## 8. 共用约定

### 8.1 组件目录结构

```
admin/src/components/
├── common/           ← 通用组件（PageHeader, DataTable, FormDrawer, MarkdownEditor, ImageUploader）
├── layout/           ← 布局组件（AdminLayout）
└── [feature]/        ← 业务组件（后续 §5.1.4/§5.1.5 再加）
```

### 8.2 Composables 目录

```
admin/src/composables/
├── useTable.ts       ← T2.21
└── [future].ts       ← 后续加 useForm、usePermission 等
```

### 8.3 命名规范

- 组件文件名：PascalCase（`DataTable.vue`）
- composable 文件名：camelCase（`useTable.ts`）
- 组件内 `<script setup lang="ts">`，不用 options API
- Props 用 `withDefaults(defineProps<...>(), { ... })`
- Emits 用 `defineEmits<...>()`

### 8.4 API 调用

所有后端 API 调用走 `admin/src/api/request.ts` 的 axios 实例，不要自己新建 axios。上传文件时传 `{ headers: { 'Content-Type': 'multipart/form-data' } }`。

### 8.5 权限控制

- 按钮级权限用 `v-permission="'post:create'"`
- 批量操作按钮的权限在 `batchActions` 里配 `permission` 字段，组件内部用 `v-if="!action.permission || hasPermission(action.permission)"` 控制
- `hasPermission` 从 `stores/permission.ts` 里取

---

## 9. 给 Claude Code 的快速接入提示

把下面整段贴到 Claude Code 的第一条消息：

```
我在做 ifoxchen.com v2 后台 Phase 2 §5.1.3 通用前端组件整片。完整设计文档在：
docs/08-phase2-frontend-components-plan.md

按文档的"总体节奏"顺序推进：
T2.16 (PageHeader) → T2.21 (useTable) → T2.17 (DataTable) → T2.18 (FormDrawer) → T2.19 (MarkdownEditor) → T2.20 (ImageUploader)

每个任务完成步骤：
- 写代码（按文档的"文件改动"清单）
- 跑冒烟（admin 目录 npm run dev，在浏览器里验证组件）
- commit message 末行 Closes #<issue>
- gh pr create + gh pr merge --merge --delete-branch

技术栈：Vue 3.5 + TypeScript + Naive UI + Tailwind CSS 4。admin/src/api/request.ts 已配好 axios，stores/permission.ts 已配好 hasPermission。

不用每步问我。常用 npm / git / gh 全自动。只有 push --force / 改 main / 装新 npm 包才停下来。

目标：6 个 PR 跑完。中途如果遇到文档里没写到的边界情况，按现有风格选最不破坏现状的方案，提个 TODO 注释，PR 里说明就行。

Phase 2 §5.1.3 全部合并后告诉我，回 Cowork 复盘 + 进 §5.1.4 RBAC 前端页面规划。
```

---

## 10. 后续衔接（不在本文档范围）

- **§5.1.4 RBAC 前端**（T2.22 ~ T2.25）：用户/角色/权限/菜单 4 个管理页，预计 12h
- **§5.1.5 CMS 前端**（T2.26 ~ T2.32）：文章/标签/分类/友链/媒体库/导入导出 7 个页面，预计 17h
- **§5.2 验收**（T2.33 ~ T2.35）：3 个任务，预计 5h

完成 §5.1.3 后回 Cowork 出 §5.1.4 整片设计。

---

**写于**：2026-05-05（Phase 2 §5.1.2 完成后立刻推进 §5.1.3）
**作者**：Cowork session 出方案 + Claude Code session 落地
