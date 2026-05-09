import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import { request } from '../api/request'
import type { ApiResponse } from '../api/request'

// ---- Types ----

export type CanvasTool = 'select' | 'pan' | 'note' | 'rect' | 'circle' | 'connect'

export interface CanvasElementData {
  id: string          // local id e.g. 'n-123'
  dbId: number        // backend node id (0 if unsaved)
  type: string
  label: string
  x: number
  y: number
  width: number
  height: number
  color: string
  metadata: Record<string, unknown>
}

export interface ConnectionData {
  id: string
  dbId: number
  fromId: string
  toId: string
  fromDbId: number
  toDbId: number
  label: string
}

export interface CanvasNode {
  id: number
  canvas_id: number
  type: string
  label: string
  content: string
  x: number
  y: number
  width: number
  height: number
  color: string
  metadata: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CanvasEdge {
  id: number
  canvas_id: number
  source_node_id: number
  target_node_id: number
  label: string
  style: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CanvasData {
  id: number
  title: string
  description: string | null
  zoom: number
  pan_x: number
  pan_y: number
  grid_visible: boolean
  node_count: number
  edge_count: number
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  created_at: string
  updated_at: string
}

export interface UseInfiniteCanvasReturn {
  elements: ShallowRef<Map<string, CanvasElementData>>
  connections: ShallowRef<Map<string, ConnectionData>>
  selectedIds: ShallowRef<Set<string>>
  isLoading: Ref<boolean>
  isDirty: Ref<boolean>
  currentTool: Ref<CanvasTool>
  zoom: Ref<number>
  panX: Ref<number>
  panY: Ref<number>
  nodeCount: ComputedRef<number>
  edgeCount: ComputedRef<number>

  // Lifecycle
  init(container: HTMLElement): void
  destroy(): void
  loadFromData(nodes: CanvasNode[], edges: CanvasEdge[], viewport: { zoom: number; panX: number; panY: number }): void

  // Nodes
  addNode(x: number, y: number, type?: string): Promise<string | null>
  addKbDoc(doc: { id: number; title: string; category: string | null; doc_type: string | null; tags: string[]; excerpt: string | null }, x: number, y: number): Promise<string | null>
  updateElement(id: string, updates: Partial<CanvasElementData>): void
  removeSelected(): void

  // Connections
  startConnection(fromId: string): void
  completeConnection(toId: string): Promise<boolean>

  // Viewport
  zoomIn(): void
  zoomOut(): void
  zoomToFit(): void
  resetZoom(): void

  // Layout (no-ops for now)
  layoutGrid?(): void
  layoutCircle?(): void
  layoutForce?(): void
  layoutHierarchical?(): void

  // Persistence
  extractData(): { nodes: CanvasNode[]; edges: CanvasEdge[]; viewport: { zoom: number; panX: number; panY: number } }
  save(): Promise<void>
}

// ---- Helpers ----

const CATEGORY_COLORS: Record<string, string> = {
  'entity': '#8b5cf6',
  'concept': '#6366f1',
  'source': '#0ea5e9',
  'synthesis': '#f59e0b',
}

function getColor(category: string | null | undefined, docType: string | null | undefined): string {
  if (docType && CATEGORY_COLORS[docType]) return CATEGORY_COLORS[docType]
  if (category) {
    let hash = 0
    for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash)
    return ['#6366f1', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#f97316', '#ec4899'][Math.abs(hash) % 8]
  }
  return '#6366f1'
}

// ---- Composable ----

export function useInfiniteCanvas(canvasId: Ref<number>): UseInfiniteCanvasReturn {
  // Container ref (not reactive, just a pointer)
  let containerEl: HTMLElement | null = null

  // Node map: localId -> element data
  const elements = shallowRef<Map<string, CanvasElementData>>(new Map())
  // Connection map: localId -> connection data
  const connections = shallowRef<Map<string, ConnectionData>>(new Map())
  // Selected element ids
  const selectedIds = shallowRef<Set<string>>(new Set())

  const isLoading = ref(false)
  const isDirty = ref(false)
  const currentTool = ref<CanvasTool>('select')
  const zoom = ref(100)
  const panX = ref(0)
  const panY = ref(0)

  // DOM refs for canvas content
  let canvasContent: HTMLElement | null = null

  const nodeCount = computed(() => elements.value.size)
  const edgeCount = computed(() => connections.value.size)

  // Connect mode state
  let connectFromId: string | null = null
  let connectLine: HTMLElement | null = null

  // Local ID sequence
  let _nodeSeq = 1000
  let _edgeSeq = 1000

  // ---- Lifecycle ----

  function init(container: HTMLElement) {
    containerEl = container

    // Create canvas structure
    container.innerHTML = ''
    container.style.position = 'relative'
    container.style.overflow = 'hidden'
    container.style.backgroundColor = '#0f172a'
    container.style.cursor = 'default'

    canvasContent = document.createElement('div')
    canvasContent.style.position = 'absolute'
    canvasContent.style.top = '0'
    canvasContent.style.left = '0'
    canvasContent.style.transformOrigin = '0 0'
    canvasContent.style.pointerEvents = 'none'
    container.appendChild(canvasContent)

    // Connect line element (for connect mode)
    connectLine = document.createElement('div')
    connectLine.style.position = 'fixed'
    connectLine.style.pointerEvents = 'none'
    connectLine.style.zIndex = '9999'
    connectLine.style.background = 'transparent'
    connectLine.style.display = 'none'
    document.body.appendChild(connectLine)

    // Wire up mouse events on container
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('contextmenu', handleContextMenu)
    container.addEventListener('dblclick', handleDblClick)
  }

  function destroy() {
    if (!containerEl) return

    containerEl.removeEventListener('mousedown', handleMouseDown)
    containerEl.removeEventListener('mousemove', handleMouseMove)
    containerEl.removeEventListener('mouseup', handleMouseUp)
    containerEl.removeEventListener('wheel', handleWheel)
    containerEl.removeEventListener('contextmenu', handleContextMenu)
    containerEl.removeEventListener('dblclick', handleDblClick)
    containerEl.innerHTML = ''

    if (connectLine && connectLine.parentNode) {
      connectLine.parentNode.removeChild(connectLine)
    }
    connectLine = null
    containerEl = null
    canvasContent = null

    elements.value = new Map()
    connections.value = new Map()
    selectedIds.value = new Set()
    isDirty.value = false
    connectFromId = null
  }

  // ---- Coordinate conversion ----

  function screenToCanvas(sx: number, sy: number): { x: number; y: number } {
    if (!containerEl) return { x: 0, y: 0 }
    const rect = containerEl.getBoundingClientRect()
    const z = zoom.value / 100
    return {
      x: (sx - rect.left - panX.value) / z,
      y: (sy - rect.top - panY.value) / z,
    }
  }

  function applyTransform() {
    if (!canvasContent) return
    const z = zoom.value / 100
    canvasContent.style.transform = `translate(${panX.value}px, ${panY.value}px) scale(${z})`
  }

  // ---- Mouse handlers ----

  let isDragging = false
  let dragTarget: string | null = null
  let dragOffsetX = 0
  let dragOffsetY = 0
  let isPanning = false
  let panStartX = 0
  let panStartY = 0

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle button or Alt+left = pan
      isPanning = true
      panStartX = e.clientX - panX.value
      panStartY = e.clientY - panY.value
      e.preventDefault()
      return
    }
    if (e.button !== 0) return

    const pos = screenToCanvas(e.clientX, e.clientY)

    if (currentTool.value === 'pan') {
      isPanning = true
      panStartX = e.clientX - panX.value
      panStartY = e.clientY - panY.value
      return
    }

    if (currentTool.value === 'note') {
      addNode(pos.x, pos.y, 'note')
      currentTool.value = 'select'
      return
    }

    // Check if clicking on an element
    const target = (e.target as HTMLElement).closest('[data-element-id]')
    if (target) {
      const id = target.getAttribute('data-element-id')!
      if (currentTool.value === 'connect') {
        if (!connectFromId) {
          connectFromId = id
          renderElement(id)
        } else {
          completeConnection(id)
        }
        return
      }
      // Select
      if (!e.shiftKey) clearSelection()
      selectElement(id)
      // Start drag
      isDragging = true
      dragTarget = id
      const el = elements.value.get(id)
      if (el) {
        dragOffsetX = pos.x - el.x
        dragOffsetY = pos.y - el.y
      }
    } else {
      // Click on empty canvas
      clearSelection()
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning) {
      panX.value = e.clientX - panStartX
      panY.value = e.clientY - panStartY
      applyTransform()
      return
    }

    if (isDragging && dragTarget) {
      const pos = screenToCanvas(e.clientX, e.clientY)
      const newX = pos.x - dragOffsetX
      const newY = pos.y - dragOffsetY
      updateElement(dragTarget, { x: newX, y: newY })
    }
  }

  function handleMouseUp(_e: MouseEvent) {
    if (isPanning) {
      isPanning = false
      return
    }
    if (isDragging) {
      if (dragTarget) {
        isDirty.value = true
      }
      isDragging = false
      dragTarget = null
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -10 : 10
    const newZoom = Math.max(10, Math.min(300, zoom.value + delta))
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const oldZ = zoom.value / 100
      const newZ = newZoom / 100
      panX.value = mouseX - (mouseX - panX.value) * (newZ / oldZ)
      panY.value = mouseY - (mouseY - panY.value) * (newZ / oldZ)
    }
    zoom.value = newZoom
    applyTransform()
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
  }

  function handleDblClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-element-id]')
    if (target) {
      const id = target.getAttribute('data-element-id')!
      const el = elements.value.get(id)
      if (el) {
        const newLabel = window.prompt('编辑标签', el.label)
        if (newLabel !== null && newLabel !== el.label) {
          updateElement(id, { label: newLabel })
        }
      }
    } else if (currentTool.value === 'select') {
      const pos = screenToCanvas(e.clientX, e.clientY)
      addNode(pos.x, pos.y, 'note')
    }
  }

  // ---- Selection ----

  function selectElement(id: string) {
    const s = new Set(selectedIds.value)
    s.add(id)
    selectedIds.value = s
    renderElement(id)
  }

  function clearSelection() {
    const prev = new Set(selectedIds.value)
    selectedIds.value = new Set()
    prev.forEach(id => renderElement(id))
  }

  // ---- Element rendering ----

  function renderElement(id: string) {
    if (!canvasContent) return
    let el = canvasContent.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null

    const data = elements.value.get(id)
    if (!data) {
      if (el) el.remove()
      return
    }

    const isSelected = selectedIds.value.has(id)

    if (!el) {
      el = document.createElement('div')
      el.setAttribute('data-element-id', id)
      el.style.position = 'absolute'
      el.style.borderRadius = '6px'
      el.style.cursor = isSelected ? 'grabbing' : 'grab'
      el.style.userSelect = 'none'
      el.style.fontFamily = 'system-ui, sans-serif'
      el.style.fontSize = '13px'
      el.style.boxSizing = 'border-box'
      canvasContent.appendChild(el)

      el.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation()
        if (currentTool.value === 'connect') {
          if (!connectFromId) {
            connectFromId = id
            renderElement(id)
          } else {
            completeConnection(id)
          }
          return
        }
        if (!e.shiftKey) clearSelection()
        selectElement(id)
        isDragging = true
        dragTarget = id
        const pos = screenToCanvas(e.clientX, e.clientY)
        dragOffsetX = pos.x - data.x
        dragOffsetY = pos.y - data.y
      })

      el.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
      })
    }

    // Style based on type
    const isKbDoc = data.type === 'kb-doc'
    const border = isSelected ? '2px solid #f59e0b' : `2px solid ${data.color}`
    const bgColor = data.color + (isKbDoc ? '18' : '20')

    el.style.left = `${data.x}px`
    el.style.top = `${data.y}px`
    el.style.width = `${data.width}px`
    el.style.height = `${data.height}px`
    el.style.border = border
    el.style.background = bgColor
    el.style.color = isKbDoc ? '#e2e8f0' : '#e2e8f0'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.alignItems = isKbDoc ? 'flex-start' : 'center'
    el.style.justifyContent = 'center'
    el.style.padding = isKbDoc ? '8px 12px' : '4px 8px'
    el.style.pointerEvents = 'auto'

    // Content
    if (isKbDoc) {
      el.innerHTML = `
        <div style="font-size:12px;font-weight:600;line-height:1.4;color:#e2e8f0">${escapeHtml(data.label)}</div>
        ${data.metadata?.doc_category ? `<div style="font-size:10px;color:${data.color};margin-top:4px">${escapeHtml(data.metadata.doc_category as string)}</div>` : ''}
      `
    } else {
      el.innerHTML = `<div style="text-align:center;color:#e2e8f0;font-size:12px">${escapeHtml(data.label || '')}</div>`
    }
  }

  function renderConnection(id: string) {
    if (!canvasContent) return
    let el = canvasContent.querySelector(`[data-connection-id="${id}"]`) as HTMLElement | null
    const data = connections.value.get(id)

    if (!data) {
      if (el) el.remove()
      return
    }

    const fromEl = elements.value.get(data.fromId)
    const toEl = elements.value.get(data.toId)
    if (!fromEl || !toEl) {
      if (el) el.remove()
      return
    }

    const fx = fromEl.x + fromEl.width / 2
    const fy = fromEl.y + fromEl.height / 2
    const tx = toEl.x + toEl.width / 2
    const ty = toEl.y + toEl.height / 2

    if (!el) {
      el = document.createElement('div')
      el.setAttribute('data-connection-id', id)
      el.style.position = 'absolute'
      el.style.pointerEvents = 'none'
      el.style.top = '0'
      el.style.left = '0'
      el.style.zIndex = '-1'
      canvasContent.appendChild(el)
    }

    const angle = Math.atan2(ty - fy, tx - fx)
    const length = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2)
    el.style.transform = `rotate(${angle}rad) translate(0,0)`
    el.style.transformOrigin = '0 50%'
    el.style.width = `${length}px`
    el.style.height = '2px'
    el.style.background = '#94a3b8'
    el.style.position = 'absolute'
    el.style.left = `${fx}px`
    el.style.top = `${fy}px`
  }

  function renderAll() {
    if (!canvasContent) return
    canvasContent.innerHTML = ''
    elements.value.forEach((_, id) => renderElement(id))
    connections.value.forEach((_, id) => renderConnection(id))
  }

  // ---- Node operations ----

  function addNode(x: number, y: number, type = 'note'): Promise<string | null> {
    const id = `n-${_nodeSeq++}`
    const color = type === 'note' ? '#f97316' : '#6366f1'
    const el: CanvasElementData = {
      id,
      dbId: 0,
      type,
      label: type === 'note' ? '便签' : '新节点',
      x: x - 90,
      y: y - 40,
      width: 180,
      height: 80,
      color,
      metadata: {},
    }
    const map = new Map(elements.value)
    map.set(id, el)
    elements.value = map
    renderElement(id)
    isDirty.value = true
    return Promise.resolve(id)
  }

  async function addKbDoc(
    doc: { id: number; title: string; category: string | null; doc_type: string | null; tags: string[]; excerpt: string | null },
    x: number,
    y: number,
  ): Promise<string | null> {
    const id = `n-${_nodeSeq++}`
    const color = getColor(doc.category, doc.doc_type)
    const el: CanvasElementData = {
      id,
      dbId: 0,
      type: 'kb-doc',
      label: doc.title,
      x: x - 110,
      y: y - 38,
      width: 220,
      height: 76,
      color,
      metadata: {
        doc_id: doc.id,
        doc_category: doc.category,
        doc_type: doc.doc_type,
        tags: doc.tags,
        excerpt: doc.excerpt,
      },
    }
    const map = new Map(elements.value)
    map.set(id, el)
    elements.value = map
    renderElement(id)
    isDirty.value = true

    // Persist to backend
    try {
      const res = await request.post<ApiResponse<CanvasNode>>(`/api/v2/admin/kb/canvases/${canvasId.value}/nodes`, {
        type: 'kb-doc',
        label: doc.title,
        x: el.x,
        y: el.y,
        width: 220,
        height: 76,
        color,
        metadata: el.metadata,
      })
      const created: CanvasNode = res.data.data
      const map2 = new Map(elements.value)
      const existing = map2.get(id)
      if (existing) {
        map2.set(id, { ...existing, dbId: created.id })
        elements.value = map2
        renderElement(id)
      }
    } catch { /* ignore */ }

    return id
  }

  function updateElement(id: string, updates: Partial<CanvasElementData>) {
    const map = new Map(elements.value)
    const existing = map.get(id)
    if (!existing) return
    map.set(id, { ...existing, ...updates })
    elements.value = map
    renderElement(id)
    isDirty.value = true
  }

  function removeSelected() {
    const ids = [...selectedIds.value]
    const map = new Map(elements.value)
    const connMap = new Map(connections.value)
    for (const id of ids) {
      map.delete(id)
      // Delete associated connections
      for (const [cid, c] of connMap) {
        if (c.fromId === id || c.toId === id) {
          connMap.delete(cid)
          const connEl = canvasContent?.querySelector(`[data-connection-id="${cid}"]`)
          if (connEl) connEl.remove()
        }
      }
    }
    elements.value = map
    connections.value = connMap
    selectedIds.value = new Set()
    isDirty.value = true
  }

  // ---- Connections ----

  function startConnection(fromId: string) {
    connectFromId = fromId
    // Highlight source
    renderElement(fromId)
  }

  async function completeConnection(toId: string): Promise<boolean> {
    if (!connectFromId || connectFromId === toId) {
      connectFromId = null
      return false
    }
    const fromId = connectFromId
    connectFromId = null

    // Check for duplicate
    for (const c of connections.value.values()) {
      if ((c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)) {
        return false
      }
    }

    const id = `e-${_edgeSeq++}`
    const fromEl = elements.value.get(fromId)
    const toEl = elements.value.get(toId)
    const conn: ConnectionData = {
      id,
      dbId: 0,
      fromId,
      toId,
      fromDbId: fromEl?.dbId ?? 0,
      toDbId: toEl?.dbId ?? 0,
      label: '',
    }
    const map = new Map(connections.value)
    map.set(id, conn)
    connections.value = map
    renderConnection(id)
    isDirty.value = true

    // Persist
    if (conn.fromDbId > 0 && conn.toDbId > 0) {
      try {
        const res = await request.post<ApiResponse<CanvasEdge>>(`/api/v2/admin/kb/canvases/${canvasId.value}/edges`, {
          source_node_id: conn.fromDbId,
          target_node_id: conn.toDbId,
        })
        const created: CanvasEdge = res.data.data
        const map2 = new Map(connections.value)
        const existing = map2.get(id)
        if (existing) {
          map2.set(id, { ...existing, dbId: created.id })
          connections.value = map2
        }
      } catch { /* ignore */ }
    }

    return true
  }

  // ---- Viewport ----

  function zoomIn() {
    zoom.value = Math.min(300, zoom.value + 15)
    applyTransform()
  }

  function zoomOut() {
    zoom.value = Math.max(10, zoom.value - 15)
    applyTransform()
  }

  function zoomToFit() {
    if (!containerEl || elements.value.size === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    elements.value.forEach(el => {
      minX = Math.min(minX, el.x)
      minY = Math.min(minY, el.y)
      maxX = Math.max(maxX, el.x + el.width)
      maxY = Math.max(maxY, el.y + el.height)
    })
    const w = containerEl.clientWidth
    const h = containerEl.clientHeight
    const scale = Math.min(w / (maxX - minX + 80), h / (maxY - minY + 80), 2)
    zoom.value = Math.round(scale * 100)
    panX.value = (w - (maxX - minX) * scale) / 2 - minX * scale
    panY.value = (h - (maxY - minY) * scale) / 2 - minY * scale
    applyTransform()
  }

  function resetZoom() {
    zoom.value = 100
    panX.value = 0
    panY.value = 0
    applyTransform()
  }

  // ---- Load ----

  function loadFromData(nodes: CanvasNode[], edges: CanvasEdge[], viewport: { zoom: number; panX: number; panY: number }) {
    const nodeMap = new Map<string, CanvasElementData>()
    const connMap = new Map<string, ConnectionData>()
    _nodeSeq = 1000
    _edgeSeq = 1000

    for (const n of nodes) {
      const id = `n-${n.id}`
      _nodeSeq = Math.max(_nodeSeq, n.id + 1)
      const meta = n.metadata as Record<string, unknown> || {}
      nodeMap.set(id, {
        id,
        dbId: n.id,
        type: meta.doc_id ? 'kb-doc' : (n.type || 'note'),
        label: n.label || '',
        x: n.x,
        y: n.y,
        width: n.width || 180,
        height: n.height || 80,
        color: n.color || '#6366f1',
        metadata: meta,
      })
    }

    for (const e of edges) {
      const id = `e-${e.id}`
      _edgeSeq = Math.max(_edgeSeq, e.id + 1)
      const fromId = `n-${e.source_node_id}`
      const toId = `n-${e.target_node_id}`
      if (nodeMap.has(fromId) && nodeMap.has(toId)) {
        connMap.set(id, {
          id,
          dbId: e.id,
          fromId,
          toId,
          fromDbId: e.source_node_id,
          toDbId: e.target_node_id,
          label: e.label || '',
        })
      }
    }

    elements.value = nodeMap
    connections.value = connMap
    selectedIds.value = new Set()

    zoom.value = Math.round((viewport.zoom || 1) * 100)
    panX.value = viewport.panX || 0
    panY.value = viewport.panY || 0
    applyTransform()
    renderAll()
    isDirty.value = false
  }

  // ---- Save ----

  function extractData() {
    const nodes: CanvasNode[] = []
    elements.value.forEach(el => {
      nodes.push({
        id: el.dbId,
        canvas_id: canvasId.value,
        type: el.type,
        label: el.label,
        content: '',
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        color: el.color,
        metadata: el.metadata,
        sort_order: 0,
        created_at: '',
        updated_at: '',
      })
    })

    const edges: CanvasEdge[] = []
    connections.value.forEach(c => {
      edges.push({
        id: c.dbId,
        canvas_id: canvasId.value,
        source_node_id: c.fromDbId,
        target_node_id: c.toDbId,
        label: c.label,
        style: {},
        created_at: '',
        updated_at: '',
      })
    })

    return {
      nodes,
      edges,
      viewport: { zoom: zoom.value / 100, panX: panX.value, panY: panY.value },
    }
  }

  async function save(): Promise<void> {
    const data = extractData()

    // Save viewport
    try {
      await request.put(`/api/v2/admin/kb/canvases/${canvasId.value}`, {
        zoom: data.viewport.zoom,
        pan_x: data.viewport.panX,
        pan_y: data.viewport.panY,
      })
    } catch { /* ignore */ }

    // Save nodes
    for (const node of data.nodes) {
      if (node.id > 0) {
        try {
          await request.put(`/api/v2/admin/kb/canvases/${canvasId.value}/nodes/${node.id}`, {
            x: node.x,
            y: node.y,
          })
        } catch { /* ignore */ }
      } else {
        try {
          const res = await request.post<ApiResponse<CanvasNode>>(`/api/v2/admin/kb/canvases/${canvasId.value}/nodes`, {
            type: node.type,
            label: node.label,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            color: node.color,
            metadata: node.metadata,
          })
          const created: CanvasNode = res.data.data
          // Find element with same label and dbId=0, update its dbId
          const elMap = new Map(elements.value)
          for (const [id, el] of elMap) {
            if (el.dbId === 0 && el.label === node.label) {
              elMap.set(id, { ...el, dbId: created.id })
              elements.value = elMap
              renderElement(id)
              break
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Save connections (only new ones)
    for (const edge of data.edges) {
      if (edge.id > 0) continue
      if (edge.source_node_id > 0 && edge.target_node_id > 0) {
        try {
          await request.post(`/api/v2/admin/kb/canvases/${canvasId.value}/edges`, {
            source_node_id: edge.source_node_id,
            target_node_id: edge.target_node_id,
          })
        } catch { /* ignore */ }
      }
    }

    isDirty.value = false
  }

  return {
    elements,
    connections,
    selectedIds,
    isLoading,
    isDirty,
    currentTool,
    zoom,
    panX,
    panY,
    nodeCount,
    edgeCount,
    init,
    destroy,
    loadFromData,
    addNode,
    addKbDoc,
    updateElement,
    removeSelected,
    startConnection,
    completeConnection,
    zoomIn,
    zoomOut,
    zoomToFit,
    resetZoom,
    extractData,
    save,
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}