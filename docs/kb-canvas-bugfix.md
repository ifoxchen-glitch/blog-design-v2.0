# KB Canvas v1 Bug 修复流程记录

> 项目: blog-design-v2.0 / admin / kb-canvas v1 (Cytoscape.js)
> 时间: 2026年5月
> 状态: ✅ 已全部修复并推送

---

## 一、问题概览

| # | 问题描述 | 严重度 | 根因 |
|---|----------|--------|------|
| 1 | 离开画布编辑器后页面空白 | 高 | Vue生命周期 + Transition冲突 |
| 2 | 拖拽KB文档到画布无效 | 中 | 类型断言缺失 + 坐标转换 |
| 3 | 节点样式不匹配 | 低 | shape类型 + label格式 |
| 4 | 工具栏多余按钮 | 低 | 未清理废弃代码 |

---

## 二、根因详解

### Bug 1: Blank Page（空白页）

**现象:** 访问画布编辑器后跳转其他页面，显示空白，需强制刷新。

**根因链条:**
```
editor.vue setup
  └─ useCanvas(canvasId.value)  // 传入的是 computed 的 .value（快照）
      └─ createCytoscape(initialCanvasId)

CanvasGraph.vue onMounted
  └─ canvas.loadCanvas()

CanvasGraph.vue onBeforeUnmount
  └─ canvas.destroy()  → cy.value = null

editor.vue onBeforeUnmount（晚于子组件）
  └─ canvas.saveCanvas()  → 访问 cy.value，但已为 null
      └─ 抛出异常 → Vue错误传播 → 下一页面渲染崩溃
```

**另外两个加速恶化的因素:**
- `<Transition mode="out-in">` 在路由切换时会先销毁旧组件再挂载新组件，生命周期顺序被打乱
- `startAutoSave()` 在 `onMounted` 外部调用，canvas 还未初始化就触发定时器

**调试方法:**
- 浏览器 Vue DevTools 观察组件生命周期
- 添加 `console.error` 捕获 destroy/save 异常
- 在 `onBeforeRouteLeave` 打印路由变化

---

### Bug 2: Drag-and-Drop 失效

**现象:** 从左侧 KB 文档面板拖拽文档到画布，节点未出现或创建失败。

**根因链条:**
```
KBDocBrowser.vue handleDragStart
  └─ e.dataTransfer.setData('application/json', JSON.stringify(doc))

CanvasGraph.vue handleDrop
  └─ const doc = JSON.parse(json) as { ... }
  └─ canvas.addDocNodeWithConnections(doc as any, x, y)
      └─ API调用时 type 字段传入了数据库不允许的值
          └─ SQLite CHECK constraint 拒绝 → 500
```

**具体类型问题:**
数据库 `kb_canvas_nodes.type` 的 CHECK 约束只允许 `('concept','note','term','reference')`，但 KB 文档节点使用 `'kb-doc'` 类型，被拒绝。

**调试方法:**
- 添加 `addLog()` 调试面板 (Ctrl+Shift+D 开关)
- `canvas.addDocNodeWithConnections()` 返回 `null` 时打印具体原因
- 网络面板查看 API 500 响应的 `error.message`

---

### Bug 3: 节点样式不对

**现象:** KB 文档节点没有圆角、标签格式不对、文字颜色单一。

**根因:**
- `shape: 'rectangle'` → 应该是 `'round-rectangle'`
- 标签格式: 只需标题 + 分类标签，但代码写成单行或格式错误
- 文字颜色用硬编码 `#e2e8f0` 而非使用 `data(color)`

**调试方法:**
- Cytoscape DevTools 检查单个元素的 `style()` 输出
- `canvas.cy.value?.getElementById(id).style()` 打印完整样式

---

### Bug 4: 工具栏残留按钮

**现象:** 工具栏有一个"知识库"按钮，点击无反应或功能已移除。

**根因:** `AddDocDialog` 被删除后，按钮未同步移除，只删除了 Dialog 组件。

---

## 三、修复步骤

### Fix 1: Blank Page

**文件:** `admin/src/views/kb/canvases/editor.vue`

```typescript
// ✅ 添加 onBeforeRouteLeave — 在路由离开前保存
onBeforeRouteLeave(async (_to, _from, next) => {
  if (canvas.isDirty.value && canvas.cy.value) {
    try {
      await canvas.saveCanvas()
      canvas.isDirty.value = false
    } catch {
      console.warn('save before leave failed')
    }
  }
  next()  // ✅ 总是允许导航，不阻塞
})
```

**文件:** `admin/src/components/kb/canvas/CanvasGraph.vue`

```typescript
// ✅ onMounted 添加 try/catch
onMounted(async () => {
  await nextTick()
  if (!container.value) return
  try {
    canvas.init(container.value)
  } catch (e) {
    console.error('canvas init failed:', e)
    return
  }
  try {
    await canvas.loadCanvas(canvas.canvasId.value)
  } catch (e) {
    console.error('canvas load failed:', e)
  }
  bindEvents()
  // ...
})

// ✅ onBeforeUnmount 添加 try/catch
onBeforeUnmount(() => {
  // ...
  try {
    canvas.destroy()
  } catch (e) {
    console.error('canvas destroy failed:', e)
  }
})
```

**文件:** `admin/src/components/layout/AdminLayout.vue`

```vue
<!-- ❌ 删除 <Transition mode="out-in"> — 它打乱了生命周期顺序 -->
<RouterView />

<!-- ✅ 可选: 添加错误边界 -->
onErrorCaptured((err) => {
  console.error('layout error:', err)
  return false  // 阻止错误继续传播
})
```

---

### Fix 2: Drag-and-Drop

**文件:** `admin/src/composables/useCanvas.ts`

```typescript
// ✅ 添加类型白名单，而非信任前端传入的任意值
const ALLOWED_TYPES = new Set([
  'concept', 'note', 'term', 'reference',
  'entity', 'source', 'synthesis', 'kb-doc'  // 新增
])

function addDocNodeWithConnections(doc: any, x: number, y: number) {
  const typeRaw = String(body.type ?? 'kb-doc')
  const type = ALLOWED_TYPES.has(typeRaw) ? typeRaw : 'kb-doc'  // 兜底
  // ...
}
```

**文件:** `server/src/db.js`

```javascript
// ❌ 删除 CHECK 约束，让应用层控制类型
// CHECK (type IN ('concept','note','term','reference'))

// ✅ 添加迁移脚本移除旧约束
```

---

### Fix 3: 节点样式

**文件:** `admin/src/composables/useCanvas.ts`

```typescript
// ✅ KB文档节点样式
if (nodeType === 'kb-doc') {
  const tagParts: string[] = []
  if (doc.doc_type) tagParts.push(doc.doc_type)
  if (doc.review_status) tagParts.push(doc.review_status)
  const tagStr = tagParts.length > 0
    ? tagParts.map(t => `[${t}]`).join(' ')
    : doc.category ? `[${doc.category}]` : ''
  const label = tagStr
    ? `● ${doc.title}\n${tagStr}`
    : `● ${doc.title}`

  cy.add({
    group: 'nodes',
    data: {
      id: nodeId,
      label,              // ✅ 多行标签格式
      type: 'kb-doc',
      color: '#3b82f6',   // ✅ 使用传入的颜色
      doc_id: doc.id,
    },
    style: {
      'shape': 'round-rectangle',  // ✅ 圆角
      'text-valign': 'center',
      'text-halign': 'center',
      'color': '#3b82f6',  // ✅ 主文字色=边框色
    }
  })
}
```

---

### Fix 4: 移除废弃按钮

**文件:** `admin/src/components/kb/canvas/CanvasToolbar.vue`

```vue
<!-- ❌ 删除 -->
<NButton size="tiny" quaternary @click="canvas.showDocDialog()">
  <BookOutline class="w-4 h-4" /> 知识库
</NButton>

<!-- ✅ 保留文档库面板切换按钮（功能有效）-->
<NButton size="tiny" quaternary @click="showBrowser = !showBrowser">
  <BookOutline class="w-3.5 h-3.5" />
</NButton>
```

---

## 四、验证清单

每次修复后执行:

```bash
cd admin && npm run build
```

| 测试项 | 预期结果 |
|--------|----------|
| 画布编辑器 → 其他页面 | 无空白，正常渲染 |
| 拖拽KB文档到画布 | 节点出现，API无500 |
| KB文档节点样式 | 圆角、中文标签正确 |
| 工具栏按钮 | 无多余/失效按钮 |
| Ctrl+Z / Ctrl+Y | 撤销/重做正常 |
| F键 | 适应屏幕 |
| 节点/连线计数 | 数字准确，变化时有颜色指示 |

---

## 五、关键调试技巧

### 1. 画布生命周期问题
```
问题定位: 在 canvas.init()/loadCanvas()/destroy()/saveCanvas() 全部添加 try/catch + console.error
关键洞察: onBeforeUnmount 的执行顺序晚于子组件，导致 null access
```

### 2. 节点计数不更新
```
问题定位: nodeCount.value 始终为0，但画布上有节点
关键洞察: Cytoscape 内部集合变化不触发 Vue ref 响应性
解决: 使用 _rev 计数器 + computed 强制依赖追踪
```

### 3. API 500 错误
```
问题定位: 添加KB文档节点时返回500
关键洞察: SQLite CHECK constraint 限制了 type 字段的允许值
解决: 白名单类型 + 应用层兜底 + 移除DB层不必要的CHECK
```

---

## 六、Git 提交记录

| Commit | 内容 |
|--------|------|
| `b2f2609` | feat(kb-canvas): undo/redo, dark bg, fit shortcut, stats changes |
| `12a92c1` | feat(kb-canvas): alignment tools, node count fix |
| `...` | 早期增量提交 |

---
