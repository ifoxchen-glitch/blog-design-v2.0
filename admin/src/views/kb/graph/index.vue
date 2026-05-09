<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import cytoscape, { type Core } from 'cytoscape'
import {
  NButton,
  NSpin,
  NSelect,
  NTag,
  NEmpty,
  useMessage,
} from 'naive-ui'
import {
  RefreshOutline,
  ExpandOutline,
  OpenOutline,
} from '@vicons/ionicons5'
import {
  apiGetKbGraph,
  apiListKbDocumentCategories,
  type KbGraphNode,
  type KbGraphEdge,
} from '../../../api/kb'

const router = useRouter()
const message = useMessage()

// ---- State ----
const loading = ref(false)
const graphContainer = ref<HTMLDivElement>()
let cy: Core | null = null

const graphData = ref<{ nodes: KbGraphNode[]; edges: KbGraphEdge[] }>({ nodes: [], edges: [] })
const categoryOptions = ref<Array<{ label: string; value: string }>>([])
const selectedCategory = ref('')
const selectedDocType = ref('')
const selectedNode = ref<KbGraphNode | null>(null)

const DOC_TYPE_OPTIONS = [
  { label: '全部类型', value: '' },
  { label: '实体 (entity)', value: 'entity' },
  { label: '概念 (concept)', value: 'concept' },
  { label: '来源 (source)', value: 'source' },
  { label: '综合 (synthesis)', value: 'synthesis' },
]

const TYPE_COLORS: Record<string, string> = {
  entity: '#8b5cf6',
  concept: '#6366f1',
  source: '#0ea5e9',
  synthesis: '#f59e0b',
}

const REVIEW_LABELS: Record<string, string> = {
  mature: '成熟',
  developing: '完善中',
  seed: '草稿',
}
const REVIEW_COLORS: Record<string, string> = {
  mature: 'success',
  developing: 'warning',
  seed: 'info',
}

async function loadCategories() {
  try {
    const cats = await apiListKbDocumentCategories()
    categoryOptions.value = [
      { label: '全部分类', value: '' },
      ...cats.map(c => ({ label: c, value: c })),
    ]
  } catch {
    categoryOptions.value = [{ label: '全部分类', value: '' }]
  }
}

async function loadGraph() {
  loading.value = true
  try {
    graphData.value = await apiGetKbGraph()
    renderGraph()
  } catch {
    message.error('加载关系图失败')
  } finally {
    loading.value = false
  }
}

function filterNodes(): { nodes: KbGraphNode[]; edges: KbGraphEdge[] } {
  const nds = graphData.value.nodes.filter(n => {
    if (selectedCategory.value && n.category !== selectedCategory.value) return false
    if (selectedDocType.value && n.doc_type !== selectedDocType.value) return false
    return true
  })
  const nidSet = new Set(nds.map(n => n.id))
  const eds = graphData.value.edges.filter(e =>
    nidSet.has(e.source) && nidSet.has(e.target)
  )
  return { nodes: nds, edges: eds }
}

function renderGraph() {
  if (!graphContainer.value) return

  // Wait for container to have pixel dimensions before init
  const rect = graphContainer.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    requestAnimationFrame(() => renderGraph())
    return
  }

  if (cy) {
    cy.destroy()
    cy = null
  }

  const { nodes, edges } = filterNodes()

  cy = cytoscape({
    container: graphContainer.value,
    elements: [
      ...nodes.map(n => ({
        data: {
          id: n.id,
          label: n.title.length > 20 ? n.title.slice(0, 20) + '…' : n.title,
          title: n.title,
          category: n.category,
          doc_type: n.doc_type,
          review_status: n.review_status,
          tags: n.tags,
          excerpt: n.excerpt,
          slug: n.slug,
          color: n.color,
        },
      })),
      ...edges.map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          label: e.label,
        },
      })),
    ],
    style: [
      {
        selector: 'node',
        style: {
          'shape': 'round-rectangle',
          'background-color': 'data(color)',
          'label': 'data(label)',
          'width': 100,
          'height': 40,
          'font-size': '11px',
          'color': '#ffffff',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-wrap': 'ellipsis',
          'text-max-width': '90px',
          'border-width': 2,
          'border-color': 'data(color)',
          'border-opacity': 0.7,
          'padding': '8px',
          'min-zoomed-font-size': 6,
        },
      },
      {
        selector: 'node:selected',
        style: { 'border-width': 4, 'border-color': '#f59e0b', 'border-opacity': 1 },
      },
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': '#475569',
          'target-arrow-color': '#475569',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': '9px',
          'color': '#64748b',
          'text-background-color': '#0f172a',
          'text-background-opacity': 1,
          'text-background-padding': '2px',
          'min-zoomed-font-size': 5,
          'opacity': 0.6,
        },
      },
      {
        selector: 'edge:selected',
        style: { 'line-color': '#f59e0b', 'width': 2.5, 'opacity': 1 },
      },
    ],
    layout: { name: 'circle', animate: false },
    wheelSensitivity: 0.3,
    minZoom: 0.1,
    maxZoom: 4,
  })

  cy.on('tap', 'node', (evt) => {
    const n = evt.target
    const d = n.data()
    selectedNode.value = {
      id: d.id,
      title: d.title,
      slug: d.slug,
      category: d.category,
      doc_type: d.doc_type,
      review_status: d.review_status,
      tags: d.tags,
      excerpt: d.excerpt,
      color: d.color,
    }
  })

  // Hover effects via Cytoscape events (CSS :hover selector is invalid)
  cy.on('mouseover', 'node', (evt) => {
    evt.target.style('border-width', 3)
    evt.target.style('border-color', '#f59e0b')
    evt.target.style('border-opacity', 1)
  })
  cy.on('mouseout', 'node', (evt) => {
    evt.target.style('border-width', 2)
    evt.target.style('border-color', 'data(color)')
    evt.target.style('border-opacity', 0.7)
  })

  cy.on('tap', (evt) => {
    if (evt.target === cy) selectedNode.value = null
  })

  cy.fit(undefined, 40)
}

function handleFit() {
  if (cy) cy.fit(undefined, 40)
}

function handleOpenDoc() {
  if (!selectedNode.value) return
  const id = Number(selectedNode.value.id)
  router.push({ name: 'kb-document-edit', params: { id: String(id) } })
}

function handleDocTypeChange() { renderGraph() }
function handleCategoryChange() { renderGraph() }

onMounted(async () => {
  await nextTick()
  loadCategories()
  loadGraph()
})

onBeforeUnmount(() => {
  if (cy) { cy.destroy(); cy = null }
})
</script>

<template>
  <!-- Full viewport height, flex column layout -->
  <div style="height: 100vh; display: flex; flex-direction: column; overflow: hidden">
    <!-- Header row -->
    <div style="padding: 0.75rem 1.5rem; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; background: #fff">
      <div style="display: flex; align-items: center; justify-content: space-between">
        <div>
          <div style="font-size: 1.125rem; font-weight: 600; color: #1e293b">知识图谱</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 2px">文档关系可视化</div>
        </div>
        <NButton size="small" @click="loadGraph">
          <template #icon><RefreshOutline class="w-4 h-4" /></template>
          刷新
        </NButton>
      </div>
    </div>

    <!-- Filter bar -->
    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; background: #fff; flex-shrink: 0">
      <NSelect
        v-model:value="selectedCategory"
        :options="categoryOptions"
        placeholder="分类筛选"
        size="small"
        clearable
        style="width: 150px"
        @update:value="handleCategoryChange"
      />
      <NSelect
        v-model:value="selectedDocType"
        :options="DOC_TYPE_OPTIONS"
        placeholder="类型筛选"
        size="small"
        clearable
        style="width: 150px"
        @update:value="handleDocTypeChange"
      />
      <div style="flex: 1" />
      <span style="font-size: 11px; color: #94a3b8">
        {{ graphData.nodes.length }} 节点 / {{ graphData.edges.length }} 条关系
      </span>
      <NButton size="tiny" @click="handleFit">
        <template #icon><ExpandOutline class="w-4 h-4" /></template>
        适应屏幕
      </NButton>
    </div>

    <!-- Graph + info panel (flex row, fills remaining space) -->
    <div style="display: flex; flex: 1; min-height: 0; overflow: hidden">
      <!-- Graph area -->
      <div style="flex: 1; position: relative; background: #0f172a; overflow: hidden">
        <NSpin :show="loading" style="position: absolute; inset: 0; z-index: 1">
          <div ref="graphContainer" style="width: 100%; height: 100%; background: #0f172a" />
        </NSpin>
        <NEmpty
          v-if="!loading && graphData.nodes.length === 0"
          description="暂无文档数据"
          style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 2"
        />

        <!-- Legend -->
        <div style="position: absolute; bottom: 1rem; left: 1rem; background: rgba(255,255,255,0.95); border-radius: 0.5rem; padding: 0.75rem; border: 1px solid #e5e7eb; font-size: 11px; z-index: 10">
          <div style="font-weight: 500; margin-bottom: 0.5rem; color: #64748b">类型图例</div>
          <div v-for="(color, type) in TYPE_COLORS" :key="type" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem">
            <div style="width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0" :style="{ background: color }" />
            <span style="color: #64748b">{{ type }}</span>
          </div>
        </div>

        <!-- Hint -->
        <div style="position: absolute; top: 1rem; right: 1rem; font-size: 11px; color: #94a3b8; background: rgba(255,255,255,0.9); border-radius: 0.25rem; padding: 0.25rem 0.5rem; z-index: 10">
          点击节点查看详情 · 滚轮缩放 · 拖拽平移
        </div>
      </div>

      <!-- Info panel -->
      <div
        v-if="selectedNode"
        style="width: 18rem; flex-shrink: 0; border-left: 1px solid #e5e7eb; background: #fff; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem"
      >
        <div style="display: flex; align-items: center; justify-content: space-between">
          <span style="font-weight: 600; font-size: 0.875rem; color: #1e293b">文档详情</span>
          <NButton size="tiny" quaternary @click="selectedNode = null">×</NButton>
        </div>

        <!-- Title -->
        <div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px">标题</div>
          <div style="font-size: 0.875rem; font-weight: 600; color: #1e293b; line-height: 1.4">{{ selectedNode.title }}</div>
        </div>

        <!-- Slug -->
        <div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px">Slug</div>
          <div style="font-size: 11px; font-family: monospace; color: #64748b">{{ selectedNode.slug }}</div>
        </div>

        <!-- Tags row -->
        <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center">
          <NTag v-if="selectedNode.category" size="tiny" :bordered="false" type="info">{{ selectedNode.category }}</NTag>
          <NTag v-if="selectedNode.doc_type" size="tiny" :bordered="false" type="warning">{{ selectedNode.doc_type }}</NTag>
          <NTag v-if="selectedNode.review_status" size="tiny" :bordered="false" :type="REVIEW_COLORS[selectedNode.review_status] as any">
            {{ REVIEW_LABELS[selectedNode.review_status] }}
          </NTag>
        </div>

        <!-- Excerpt -->
        <div v-if="selectedNode.excerpt" style="font-size: 11px; color: #64748b; background: #f8fafc; padding: 0.5rem; border-left: 2px solid #3b82f6; border-radius: 2px; line-height: 1.6">
          {{ selectedNode.excerpt }}
        </div>

        <!-- Tags -->
        <div v-if="selectedNode.tags && selectedNode.tags.length > 0">
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 0.5rem">标签</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px">
            <NTag
              v-for="tag in selectedNode.tags"
              :key="tag"
              size="tiny"
              :bordered="false"
              style="background: #eff6ff; color: #3b82f6"
            >
              {{ tag }}
            </NTag>
          </div>
        </div>

        <!-- Edges -->
        <div style="border-top: 1px solid #f1f5f9; padding-top: 0.75rem">
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px">关联节点</div>
          <div style="font-size: 12px; color: #64748b">
            {{ graphData.edges.filter(e => e.source === selectedNode!.id || e.target === selectedNode!.id).length }} 条关系
          </div>
        </div>

        <NButton size="small" type="primary" @click="handleOpenDoc">
          <template #icon><OpenOutline class="w-4 h-4" /></template>
          打开文档
        </NButton>
      </div>
    </div>
  </div>
</template>