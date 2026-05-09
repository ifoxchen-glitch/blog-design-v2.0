<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
import PageHeader from '../../../components/common/PageHeader.vue'
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
        selector: 'node:hover',
        style: { 'border-width': 3, 'border-color': '#f59e0b', 'border-opacity': 1 },
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
    layout: { name: 'cose', animate: false, nodeRepulsion: 8000, idealEdgeLength: 120 },
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

  cy.on('tap', (evt) => {
    if (evt.target === cy) selectedNode.value = null
  })
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

onMounted(() => {
  loadCategories()
  loadGraph()
})

onBeforeUnmount(() => {
  if (cy) { cy.destroy(); cy = null }
})
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)]">
    <PageHeader title="知识图谱" subtitle="文档关系可视化">
      <NButton quaternary size="small" @click="loadGraph">
        <template #icon><RefreshOutline class="w-4 h-4" /></template>
        刷新
      </NButton>
    </PageHeader>

    <!-- Filter bar -->
    <div class="flex items-center gap-3 px-4 py-2 bg-base-100 border-b border-base-content/5">
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
      <div class="flex-1" />
      <div class="text-[11px] text-base-content/30">
        {{ graphData.nodes.length }} 节点 / {{ graphData.edges.length }} 条关系
      </div>
      <NButton size="tiny" quaternary @click="handleFit">
        <template #icon><ExpandOutline class="w-4 h-4" /></template>
        适应屏幕
      </NButton>
    </div>

    <!-- Graph + info panel -->
    <div class="flex flex-1 min-h-0">
      <!-- Graph area -->
      <div class="flex-1 relative">
        <NSpin :show="loading" class="absolute inset-0 z-0">
          <div ref="graphContainer" class="w-full h-full bg-[#0f172a]" />
        </NSpin>
        <NEmpty
          v-if="!loading && graphData.nodes.length === 0"
          description="暂无文档数据"
          class="absolute inset-0 flex items-center justify-center"
        />

        <!-- Legend -->
        <div class="absolute bottom-4 left-4 bg-base-100/90 rounded-lg border border-base-content/10 p-3 text-xs space-y-1.5 z-10">
          <div class="font-medium text-base-content/60 mb-1">类型图例</div>
          <div v-for="(color, type) in TYPE_COLORS" :key="type" class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-sm shrink-0" :style="{ backgroundColor: color }" />
            <span class="text-base-content/60">{{ type }}</span>
          </div>
        </div>

        <!-- Hint -->
        <div class="absolute top-4 right-4 text-[11px] text-base-content/30 bg-base-100/80 rounded px-2 py-1 z-10">
          点击节点查看详情 · 滚轮缩放 · 拖拽平移
        </div>
      </div>

      <!-- Info panel -->
      <div
        v-if="selectedNode"
        class="w-72 shrink-0 border-l border-base-content/10 bg-base-100 overflow-y-auto"
      >
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-medium text-sm">文档详情</h3>
            <NButton size="tiny" quaternary @click="selectedNode = null">×</NButton>
          </div>

          <div class="flex flex-col gap-3">
            <!-- Title -->
            <div>
              <div class="text-[11px] text-base-content/40 mb-1">标题</div>
              <div class="text-sm font-medium text-base-content leading-snug">{{ selectedNode.title }}</div>
            </div>

            <!-- Slug -->
            <div>
              <div class="text-[11px] text-base-content/40 mb-1">Slug</div>
              <div class="text-xs text-base-content/60 font-mono">{{ selectedNode.slug }}</div>
            </div>

            <!-- Meta tags -->
            <div class="flex flex-wrap gap-1.5">
              <NTag v-if="selectedNode.category" size="tiny" :bordered="false" type="info">{{ selectedNode.category }}</NTag>
              <NTag v-if="selectedNode.doc_type" size="tiny" :bordered="false" type="warning">{{ selectedNode.doc_type }}</NTag>
              <NTag v-if="selectedNode.review_status" size="tiny" :bordered="false" :type="REVIEW_COLORS[selectedNode.review_status] as any">
                {{ REVIEW_LABELS[selectedNode.review_status] }}
              </NTag>
            </div>

            <!-- Excerpt -->
            <div v-if="selectedNode.excerpt" class="text-xs text-base-content/50 bg-base-200/50 rounded p-2 border-l-2 border-primary leading-relaxed">
              {{ selectedNode.excerpt }}
            </div>

            <!-- Tags -->
            <div v-if="selectedNode.tags && selectedNode.tags.length > 0">
              <div class="text-[11px] text-base-content/40 mb-1.5">标签</div>
              <div class="flex flex-wrap gap-1">
                <NTag
                  v-for="tag in selectedNode.tags"
                  :key="tag"
                  size="tiny"
                  :bordered="false"
                  class="bg-primary/10 text-primary"
                >
                  {{ tag }}
                </NTag>
              </div>
            </div>

            <!-- Edges info -->
            <div class="border-t border-base-content/5 pt-3">
              <div class="text-[11px] text-base-content/40 mb-1.5">
                关联节点
              </div>
              <div class="text-xs text-base-content/40">
                {{ graphData.edges.filter(e => e.source === selectedNode!.id || e.target === selectedNode!.id).length }} 条关系
              </div>
            </div>

            <!-- Open button -->
            <NButton size="small" type="primary" block @click="handleOpenDoc">
              <template #icon><OpenOutline class="w-4 h-4" /></template>
              打开文档
            </NButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>