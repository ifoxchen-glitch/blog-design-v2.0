import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import { Canvas, Rect, Group, IText, Circle, Path, Shadow, Point, type FabricObject, type TPointerEventInfo } from 'fabric'
import {
  apiAddCanvasNode,
  apiDeleteCanvasNode,
  apiAddCanvasEdge,
  apiDeleteCanvasEdge,
  type KbDocumentListItem,
} from '../api/kb'

// ---- Types ----

export type CanvasTool =
  | 'select'
  | 'pan'
  | 'note'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'connect'

export interface CanvasElementData {
  id: string          // fabric id e.g. 'n-123'
  dbId: number        // backend node id (0 if unsaved)
  type: string        // 'kb-doc' | 'note' | 'rect' | 'circle' | 'triangle'
  label: string
  x: number
  y: number
  width: number
  height: number
  angle: number
  scaleX: number
  scaleY: number
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

export interface UseInfiniteCanvasReturn {
  fabCanvas: Readonly<ShallowRef<Canvas | null>>
  isLoading: Ref<boolean>
  isDirty: Ref<boolean>
  currentTool: Ref<CanvasTool>
  zoom: Ref<number>
  selectedElements: Ref<CanvasElementData[]>
  nodeCount: ComputedRef<number>
  edgeCount: ComputedRef<number>

  init: (el: HTMLCanvasElement) => void
  destroy: () => void
  loadFromData: (nodes: any[], edges: any[], viewport: { zoom: number; panX: number; panY: number }) => void
  extractData: () => { nodes: any[]; edges: any[]; viewport: { zoom: number; panX: number; panY: number } }

  addKbDocElement: (doc: KbDocumentListItem, x: number, y: number) => Promise<string | null>
  addNoteElement: (x: number, y: number, text?: string) => string
  addShapeElement: (shape: 'rect' | 'circle' | 'triangle', x: number, y: number) => string
  removeSelectedElements: () => Promise<void>

  startConnection: (fromId: string) => void
  completeConnection: (toId: string) => Promise<boolean>
  cancelConnection: () => void
  updateConnectionsForElement: (elId: string) => void

  zoomToFit: () => void
  layoutGrid: () => void
  layoutCircle: () => void
  layoutForce: () => void
  layoutHierarchical: () => void
  resetZoom: () => void
  exportPng: () => void

  // Metadata update
  updateElementMetadata: (elId: string, metadata: Record<string, unknown>) => void
  updateDbIds: (nodes: any[], edges: any[]) => void
}

// ---- Constants ----

const CATEGORY_PALETTE = [
  '#6366f1', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981',
  '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
]

function getCategoryColor(category: string | null): string {
  if (!category) return CATEGORY_PALETTE[0]
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length]
}

const SHAPE_COLORS: Record<string, string> = {
  rect: '#3b82f6',
  circle: '#10b981',
  triangle: '#f59e0b',
  note: '#f97316',
}

// ---- Helpers ----

function makeLinePath(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`
}

// ---- ID generators ----

let _nodeSeq = 1000
let _edgeSeq = 1000

// ---- Composable ----

export function useInfiniteCanvas(canvasId: Ref<number>): UseInfiniteCanvasReturn {
  const fabCanvas: ShallowRef<Canvas | null> = shallowRef(null)
  const isLoading = ref(false)
  const isDirty = ref(false)
  const currentTool = ref<CanvasTool>('select')
  const zoom = ref(1)
  const selectedElements = ref<CanvasElementData[]>([])

  const connectSource = ref<string | null>(null)
  const connectLine = ref<Path | null>(null)

  const nodeCount = computed(() => {
    if (!fabCanvas.value) return 0
    return fabCanvas.value.getObjects().filter(o => (o as any).customType && (o as any).customType !== 'connection').length
  })
  const edgeCount = computed(() => {
    if (!fabCanvas.value) return 0
    return fabCanvas.value.getObjects().filter(o => (o as any).customType === 'connection').length
  })

  // ---- Helpers ----

  function markDirty() { isDirty.value = true }

  function toElementData(obj: FabricObject): CanvasElementData {
    const d = (obj as any)
    return {
      id: d.fabricId || '',
      dbId: d.dbId || 0,
      type: d.customType || 'note',
      label: d._label || '',
      x: obj.left || 0,
      y: obj.top || 0,
      width: (obj.width || 180) * (obj.scaleX || 1),
      height: (obj.height || 80) * (obj.scaleY || 1),
      angle: obj.angle || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      color: d._color || '#6366f1',
      metadata: d._metadata || {},
    }
  }

  function updateSelectedList() {
    if (!fabCanvas.value) return
    const active = fabCanvas.value.getActiveObjects()
    selectedElements.value = active.map(toElementData)
  }

  // ---- Init / Destroy ----

  function init(el: HTMLCanvasElement) {
    if (fabCanvas.value) destroy()

    const parent = el.parentElement!
    const w = parent.clientWidth
    const h = parent.clientHeight

    const canvas = new Canvas(el, {
      width: w,
      height: h,
      backgroundColor: '#0f172a',
      selection: true,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true,
    })

    // Infinite pan via middle mouse button
    let isPanning = false
    canvas.on('mouse:down', (opt: TPointerEventInfo) => {
      const evt = opt.e as MouseEvent
      if (evt.button === 1 || (evt.altKey && evt.button === 0)) {
        isPanning = true
        canvas.selection = false
        canvas.defaultCursor = 'grabbing'
      }
    })

    canvas.on('mouse:move', (opt: TPointerEventInfo) => {
      const evt = opt.e as MouseEvent
      if (isPanning) {
        const delta = new Point(evt.movementX, evt.movementY)
        const vpt = canvas.viewportTransform!
        vpt[4] += delta.x
        vpt[5] += delta.y
        canvas.requestRenderAll()
      }
      // Preview connect line
      if (connectSource.value && connectLine.value) {
        const pointer = canvas.getScenePoint(evt)
        const fromObj = canvas.getObjects().find(o => (o as any).fabricId === connectSource.value)
        if (fromObj) {
          const fc = fromObj.getCenterPoint()
          connectLine.value.set({
            path: new Path(makeLinePath(fc.x, fc.y, pointer.x, pointer.y)).path,
          } as any)
          connectLine.value.setCoords()
          canvas.requestRenderAll()
        }
      }
    })

    canvas.on('mouse:up', () => {
      isPanning = false
      canvas.selection = currentTool.value === 'select'
      canvas.defaultCursor = currentTool.value === 'pan' ? 'grab' : 'default'
    })

    // Mouse-wheel zoom centered on cursor
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY
      let z = canvas.getZoom()
      z *= 0.999 ** delta
      z = Math.max(0.05, Math.min(10, z))
      const point = new Point(opt.e.offsetX, opt.e.offsetY)
      canvas.zoomToPoint(point, z)
      zoom.value = Math.round(z * 100)
      opt.e.preventDefault()
      opt.e.stopPropagation()
      markDirty()
    })

    // Tool-based click handling
    canvas.on('mouse:down', (opt: TPointerEventInfo) => {
      const evt = opt.e as MouseEvent
      if (evt.button !== 0) return // only left click
      if (isPanning) return

      const tool = currentTool.value
      const pointer = canvas.getScenePoint(evt)
      const target = opt.target

      if (tool === 'select') {
        // Fabric handles selection natively
        return
      }

      if (target && tool === 'connect') {
        const targetId = (target as any).fabricId
        if (!targetId) return
        if (connectSource.value) {
          // Second click: complete the connection
          if (targetId !== connectSource.value) {
            completeConnection(targetId)
          }
        } else {
          // First click: set the source element
          startConnection(targetId)
        }
        return
      }

      // Placement tools: click on empty space
      if (!target) {
        if (tool === 'note') {
          addNoteElement(pointer.x, pointer.y)
        } else if (tool === 'rect' || tool === 'circle' || tool === 'triangle') {
          addShapeElement(tool, pointer.x, pointer.y)
        }
      }
    })

    // Selection events
    canvas.on('selection:created', updateSelectedList)
    canvas.on('selection:updated', updateSelectedList)
    canvas.on('selection:cleared', () => { selectedElements.value = [] })

    // Dirty tracking on object modification
    canvas.on('object:modified', (opt) => {
      markDirty()
      if (opt.target) {
        updateConnectionsForElement((opt.target as any).fabricId)
      }
    })

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      const pw = parent.clientWidth
      const ph = parent.clientHeight
      if (pw > 0 && ph > 0) {
        canvas.setDimensions({ width: pw, height: ph })
        canvas.requestRenderAll()
      }
    })
    resizeObserver.observe(parent)
    ;(canvas as any)._resizeObserver = resizeObserver

    fabCanvas.value = canvas
  }

  function destroy() {
    if (!fabCanvas.value) return
    const resizeObserver = (fabCanvas.value as any)._resizeObserver
    if (resizeObserver) resizeObserver.disconnect()
    fabCanvas.value.dispose()
    fabCanvas.value = null
    selectedElements.value = []
  }

  // ---- Load / Extract ----

  function loadFromData(
    nodes: any[],
    edges: any[],
    viewport: { zoom: number; panX: number; panY: number },
  ) {
    const canvas = fabCanvas.value
    if (!canvas) return

    try {
      canvas.clear()
      _nodeSeq = 1000
      _edgeSeq = 1000
      for (const node of nodes) {
        const idNum = parseInt(String(node.id).replace(/[^0-9]/g, '')) || 0
        _nodeSeq = Math.max(_nodeSeq, idNum + 1)
      }
      for (const edge of edges) {
        const idNum = parseInt(String(edge.id).replace(/[^0-9]/g, '')) || 0
        _edgeSeq = Math.max(_edgeSeq, idNum + 1)
      }

      canvas.setZoom(viewport.zoom || 1)
      const vpt = canvas.viewportTransform!
      vpt[4] = viewport.panX || 0
      vpt[5] = viewport.panY || 0

      for (const node of nodes) {
        const meta = node.metadata || {}
        const id = `n-${node.id}`

      if (meta.doc_id) {
        // KB doc card
        const color = getCategoryColor((meta.doc_category as string) || null)
        const group = createDocCardGroup(
          (meta.doc_title as string) || node.label,
          (meta.doc_category as string) || '',
          color,
        )
        group.set({
          left: node.x,
          top: node.y,
          angle: meta.angle as number || 0,
          scaleX: meta.scaleX as number || 1,
          scaleY: meta.scaleY as number || 1,
        })
        ;(group as any).fabricId = id
        ;(group as any).dbId = node.id
        ;(group as any).customType = 'kb-doc'
        ;(group as any)._label = node.label
        ;(group as any)._color = color
        ;(group as any)._metadata = meta
        canvas.add(group)
      } else {
        // Generic node
        const color = node.color || '#6366f1'
        const rect = new Rect({
          width: node.width || 180,
          height: node.height || 80,
          rx: 6, ry: 6,
          fill: color + '20',
          stroke: color,
          strokeWidth: 2,
        })
        const text = new IText(node.label || 'Node', {
          fontSize: 13,
          fill: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          left: 10,
          top: 10,
          width: (node.width || 180) - 20,
        })
        const group = new Group([rect, text], {
          left: node.x,
          top: node.y,
          angle: node.angle || 0,
          scaleX: node.scaleX || 1,
          scaleY: node.scaleY || 1,
          subTargetCheck: true,
        })
        ;(group as any).fabricId = id
        ;(group as any).dbId = node.id
        ;(group as any).customType = node.type || 'note'
        ;(group as any)._label = node.label
        ;(group as any)._color = color
        ;(group as any)._metadata = meta
        canvas.add(group)
      }
    }

    // Add edges
    for (const edge of edges) {
      _edgeSeq = Math.max(_edgeSeq, edge.id + 1)

      const fromObj = canvas.getObjects().find(o => (o as any).fabricId === `n-${edge.source_node_id}`)
      const toObj = canvas.getObjects().find(o => (o as any).fabricId === `n-${edge.target_node_id}`)
      if (fromObj && toObj) {
        const path = createConnectionPath(fromObj, toObj)
        ;(path as any).fabricId = `e-${edge.id}`
        ;(path as any).dbId = edge.id
        ;(path as any).customType = 'connection'
        ;(path as any).fromId = `n-${edge.source_node_id}`
        ;(path as any).toId = `n-${edge.target_node_id}`
        ;(path as any).fromDbId = edge.source_node_id
        ;(path as any).toDbId = edge.target_node_id
        ;(path as any)._label = edge.label || ''
        canvas.add(path as unknown as FabricObject)
        canvas.sendObjectToBack(path as unknown as FabricObject)
      }
    }

    canvas.requestRenderAll()
    zoom.value = Math.round((viewport.zoom || 1) * 100)
    isDirty.value = false
    } catch (err) {
      console.error('[canvas-v2] loadFromData error:', err)
      try { canvas.clear() } catch { /* ignore */ }
      canvas.requestRenderAll()
    }
  }

  function extractData(): {
    nodes: any[]
    edges: any[]
    viewport: { zoom: number; panX: number; panY: number }
  } {
    const canvas = fabCanvas.value!
    const vpt = canvas.viewportTransform!

    const nodes: any[] = []
    const edges: any[] = []

    canvas.getObjects().forEach(obj => {
      const d = (obj as any)
      if (d.customType === 'connection') {
        edges.push({
          id: d.dbId || 0,
          canvas_id: canvasId.value,
          source_node_id: d.fromDbId || 0,
          target_node_id: d.toDbId || 0,
          label: d._label || '',
          style: {},
        })
      } else if (d.customType) {
        nodes.push({
          id: d.dbId || 0,
          canvas_id: canvasId.value,
          type: d.customType,
          label: d._label || '',
          content: '',
          x: obj.left || 0,
          y: obj.top || 0,
          width: obj.width || 180,
          height: obj.height || 80,
          color: d._color || '#6366f1',
          metadata: {
            ...(d._metadata || {}),
            angle: obj.angle,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
          },
          sort_order: 0,
        })
      }
    })

    return {
      nodes,
      edges,
      viewport: {
        zoom: canvas.getZoom(),
        panX: vpt[4],
        panY: vpt[5],
      },
    }
  }

  // ---- Element Creation ----

  function createDocCardGroup(title: string, category: string, color: string): Group {
    const w = 220
    const h = 70
    const bg = new Rect({
      width: w, height: h,
      rx: 8, ry: 8,
      fill: color + '18',
      stroke: color,
      strokeWidth: 2,
      shadow: new Shadow({ color: 'rgba(0,0,0,0.4)', blur: 6, offsetX: 0, offsetY: 2 }),
    })
    const titleText = new IText(title.length > 18 ? title.slice(0, 18) + '…' : title, {
      left: 12,
      top: 8,
      fontSize: 13,
      fontWeight: '600',
      fill: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      width: w - 24,
      editable: false,
    })
    const catText = new IText(category ? `[${category}]` : '', {
      left: 12,
      top: 34,
      fontSize: 10,
      fill: color,
      fontFamily: 'system-ui, sans-serif',
      editable: false,
    })
    const group = new Group([bg, titleText, catText], {
      subTargetCheck: true,
    })
    return group
  }

  async function addKbDocElement(doc: KbDocumentListItem, x: number, y: number): Promise<string | null> {
    const canvas = fabCanvas.value
    if (!canvas) return null

    const color = getCategoryColor(doc.category)
    const group = createDocCardGroup(doc.title, doc.category || '', color)

    const id = `n-${_nodeSeq++}`
    group.set({ left: x, top: y })
    ;(group as any).fabricId = id
    ;(group as any).dbId = 0
    ;(group as any).customType = 'kb-doc'
    ;(group as any)._label = doc.title
    ;(group as any)._color = color
    ;(group as any)._metadata = {
      doc_id: doc.id,
      doc_title: doc.title,
      doc_category: doc.category,
      doc_type: doc.doc_type,
      review_status: doc.review_status,
      tags: doc.tags,
      excerpt: doc.excerpt,
    }

    // Persist to backend
    try {
      const created = await apiAddCanvasNode(canvasId.value, {
        type: 'kb-doc',
        label: doc.title,
        x, y,
        color,
        width: 220,
        height: 70,
        metadata: (group as any)._metadata,
      })
      ;(group as any).dbId = created.id
      group.set({ left: x, top: y })
    } catch {
      // Node created locally even if backend fails
    }

    canvas.add(group)
    canvas.requestRenderAll()
    markDirty()
    return id
  }

  function addNoteElement(x: number, y: number, text?: string): string {
    const canvas = fabCanvas.value!
    const color = SHAPE_COLORS.note
    const w = 180, h = 100
    const bg = new Rect({
      width: w, height: h,
      rx: 4, ry: 4,
      fill: color + '20',
      stroke: color,
      strokeWidth: 1.5,
    })
    const itext = new IText(text || '双击编辑...', {
      left: 8, top: 8,
      fontSize: 13,
      fill: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      width: w - 16,
    })
    const id = `n-${_nodeSeq++}`
    const group = new Group([bg, itext], {
      left: x, top: y,
      subTargetCheck: true,
    })
    ;(group as any).fabricId = id
    ;(group as any).dbId = 0
    ;(group as any).customType = 'note'
    ;(group as any)._label = text || ''
    ;(group as any)._color = color
    ;(group as any)._metadata = {}
    canvas.add(group)
    canvas.requestRenderAll()
    markDirty()
    return id
  }

  function addShapeElement(shape: 'rect' | 'circle' | 'triangle', x: number, y: number): string {
    const canvas = fabCanvas.value!
    const color = SHAPE_COLORS[shape] || '#6366f1'
    const size = 100
    const id = `n-${_nodeSeq++}`

    let obj: FabricObject
    if (shape === 'circle') {
      obj = new Circle({
        radius: size / 2,
        fill: color + '30',
        stroke: color,
        strokeWidth: 2,
        left: x - size / 2,
        top: y - size / 2,
      })
    } else if (shape === 'triangle') {
      obj = new Path(
        `M ${size / 2} 0 L ${size} ${size} L 0 ${size} Z`,
        {
          fill: color + '30',
          stroke: color,
          strokeWidth: 2,
          left: x - size / 2,
          top: y - size / 2,
        },
      )
    } else {
      obj = new Rect({
        width: size, height: size,
        rx: 4, ry: 4,
        fill: color + '30',
        stroke: color,
        strokeWidth: 2,
        left: x - size / 2,
        top: y - size / 2,
      })
    }

    ;(obj as any).fabricId = id
    ;(obj as any).dbId = 0
    ;(obj as any).customType = shape
    ;(obj as any)._label = ''
    ;(obj as any)._color = color
    ;(obj as any)._metadata = {}
    canvas.add(obj)
    canvas.requestRenderAll()
    markDirty()
    return id
  }

  async function removeSelectedElements(): Promise<void> {
    const canvas = fabCanvas.value
    if (!canvas) return

    const active = canvas.getActiveObjects()
    for (const obj of active) {
      const d = (obj as any)
      // Delete from backend
      try {
        if (d.customType === 'connection') {
          if (d.dbId > 0) await apiDeleteCanvasEdge(canvasId.value, d.dbId)
        } else {
          if (d.dbId > 0) await apiDeleteCanvasNode(canvasId.value, d.dbId)
        }
      } catch { /* ignore */ }
      canvas.remove(obj)
    }
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    selectedElements.value = []
    markDirty()
  }

  // ---- Connections ----

  function createConnectionPath(fromObj: FabricObject, toObj: FabricObject): Path {
    const fc = fromObj.getCenterPoint()
    const tc = toObj.getCenterPoint()
    const dx = Math.abs(tc.x - fc.x) * 0.4
    const pathStr = `M ${fc.x} ${fc.y} C ${fc.x + dx} ${fc.y}, ${tc.x - dx} ${tc.y}, ${tc.x} ${tc.y}`
    return new Path(pathStr, {
      fill: '',
      stroke: '#94a3b8',
      strokeWidth: 2,
      objectCaching: false,
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      hasControls: false,
      hasBorders: false,
    })
  }

  function startConnection(fromId: string) {
    const canvas = fabCanvas.value
    if (!canvas) return
    connectSource.value = fromId

    const fromObj = canvas.getObjects().find(o => (o as any).fabricId === fromId)
    if (!fromObj) return

    const fc = fromObj.getCenterPoint()
    const linePath = new Path(`M ${fc.x} ${fc.y} L ${fc.x} ${fc.y}`)
    linePath.set({
      stroke: '#f59e0b',
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
      objectCaching: false,
    })
    canvas.add(linePath as unknown as FabricObject)
    connectLine.value = linePath as any
  }

  async function completeConnection(toId: string): Promise<boolean> {
    const canvas = fabCanvas.value
    if (!canvas || !connectSource.value) return false

    // Remove preview line
    if (connectLine.value) {
      canvas.remove(connectLine.value as unknown as FabricObject)
      connectLine.value = null
    }

    const fromObj = canvas.getObjects().find(o => (o as any).fabricId === connectSource.value)
    const toObj = canvas.getObjects().find(o => (o as any).fabricId === toId)
    if (!fromObj || !toObj) {
      connectSource.value = null
      return false
    }

    // Check if connection already exists
    const exists = canvas.getObjects().some(o => {
      const d = (o as any)
      return d.customType === 'connection' &&
        ((d.fromId === connectSource.value && d.toId === toId) ||
         (d.fromId === toId && d.toId === connectSource.value))
    })
    if (exists) {
      connectSource.value = null
      return false
    }

    const path = createConnectionPath(fromObj, toObj)
    const id = `e-${_edgeSeq++}`
    ;(path as any).fabricId = id
    ;(path as any).dbId = 0
    ;(path as any).customType = 'connection'
    ;(path as any).fromId = connectSource.value
    ;(path as any).toId = toId
    ;(path as any).fromDbId = (fromObj as any).dbId || 0
    ;(path as any).toDbId = (toObj as any).dbId || 0
    ;(path as any)._label = ''

    // Persist to backend
    try {
      const created = await apiAddCanvasEdge(canvasId.value, {
        source_node_id: (fromObj as any).dbId || 0,
        target_node_id: (toObj as any).dbId || 0,
      })
      ;(path as any).dbId = created.id
    } catch { /* ignore */ }

    canvas.add(path as unknown as FabricObject)
    canvas.sendObjectToBack(path as unknown as FabricObject)
    canvas.requestRenderAll()
    connectSource.value = null
    markDirty()
    return true
  }

  function cancelConnection() {
    const canvas = fabCanvas.value
    if (!canvas) return
    if (connectLine.value) {
      canvas.remove(connectLine.value as unknown as FabricObject)
      connectLine.value = null
    }
    connectSource.value = null
  }

  function updateConnectionsForElement(elId: string) {
    const canvas = fabCanvas.value
    if (!canvas || !elId) return

    const fromObj = canvas.getObjects().find(o => (o as any).fabricId === elId)
    if (!fromObj) return

    canvas.getObjects().forEach(o => {
      const d = (o as any)
      if (d.customType !== 'connection') return
      if (d.fromId === elId || d.toId === elId) {
        const toObjId = d.fromId === elId ? d.toId : d.fromId
        const toObj = canvas.getObjects().find(x => (x as any).fabricId === toObjId)
        if (toObj) {
          const newPath = createConnectionPath(
            d.fromId === elId ? fromObj : toObj,
            d.fromId === elId ? toObj : fromObj,
          )
          o.set({ path: newPath.path })
          o.setCoords()
        }
      }
    })
  }

  function updateAllConnections() {
    const canvas = fabCanvas.value
    if (!canvas) return
    canvas.getObjects().forEach(o => {
      const d = (o as any)
      if (d.customType !== 'connection') return
      const fromObj = canvas.getObjects().find(x => (x as any).fabricId === d.fromId)
      const toObj = canvas.getObjects().find(x => (x as any).fabricId === d.toId)
      if (fromObj && toObj) {
        const newPath = createConnectionPath(fromObj, toObj)
        o.set({ path: newPath.path })
        o.setCoords()
      }
    })
    canvas.requestRenderAll()
  }

  // ---- Viewport ----

  function zoomToFit() {
    const canvas = fabCanvas.value
    if (!canvas) return
    const objs = canvas.getObjects().filter(o => (o as any).customType !== 'connection')
    if (objs.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    objs.forEach(o => {
      const b = o.getBoundingRect()
      minX = Math.min(minX, b.left)
      minY = Math.min(minY, b.top)
      maxX = Math.max(maxX, b.left + b.width)
      maxY = Math.max(maxY, b.top + b.height)
    })

    const padding = 60
    const objW = maxX - minX + padding * 2
    const objH = maxY - minY + padding * 2
    const scaleX = canvas.width! / objW
    const scaleY = canvas.height! / objH
    const scale = Math.min(scaleX, scaleY, 2)

    canvas.setZoom(scale)
    const vpt = canvas.viewportTransform!
    vpt[4] = -minX * scale + padding * scale + (canvas.width! - objW * scale) / 2
    vpt[5] = -minY * scale + padding * scale + (canvas.height! - objH * scale) / 2
    zoom.value = Math.round(scale * 100)
    canvas.requestRenderAll()
  }

  // ---- Auto-layout ----

  function layoutGrid() {
    const canvas = fabCanvas.value
    if (!canvas) return
    const objs = canvas.getObjects().filter(o => (o as any).customType && (o as any).customType !== 'connection')
    if (objs.length === 0) return
    const cols = Math.ceil(Math.sqrt(objs.length))
    const spacing = 260
    let row = 0, col = 0
    objs.forEach(obj => {
      obj.set({ left: col * spacing, top: row * spacing })
      obj.setCoords()
      col++
      if (col >= cols) { col = 0; row++ }
    })
    canvas.requestRenderAll()
    updateAllConnections()
    zoomToFit()
    markDirty()
  }

  function layoutCircle() {
    const canvas = fabCanvas.value
    if (!canvas) return
    const objs = canvas.getObjects().filter(o => (o as any).customType && (o as any).customType !== 'connection')
    if (objs.length === 0) return
    const radius = Math.max(200, objs.length * 30)
    const cx = canvas.width! / 2
    const cy_ = canvas.height! / 2
    objs.forEach((obj, i) => {
      const angle = (2 * Math.PI * i) / objs.length
      obj.set({
        left: cx + radius * Math.cos(angle) - (obj.width || 100) / 2,
        top: cy_ + radius * Math.sin(angle) - (obj.height || 60) / 2,
      })
      obj.setCoords()
    })
    canvas.requestRenderAll()
    updateAllConnections()
    zoomToFit()
    markDirty()
  }

  function layoutForce() {
    const canvas = fabCanvas.value
    if (!canvas) return
    const objs = canvas.getObjects().filter(o => (o as any).customType && (o as any).customType !== 'connection')
    if (objs.length === 0) return
    // Simple force simulation: spread nodes apart
    const iterations = 50
    const repulsion = 5000
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < objs.length; i++) {
        let fx = 0, fy = 0
        const oi = objs[i]
        const ci = oi.getCenterPoint()
        for (let j = 0; j < objs.length; j++) {
          if (i === j) continue
          const oj = objs[j]
          const cj = oj.getCenterPoint()
          const dx = ci.x - cj.x
          const dy = ci.y - cj.y
          const dist = Math.max(10, Math.sqrt(dx * dx + dy * dy))
          const force = repulsion / (dist * dist)
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }
        // Edge attraction
        canvas.getObjects().forEach(eo => {
          const ed = (eo as any)
          if (ed.customType !== 'connection') return
          if (ed.fromId === (oi as any).fabricId) {
            const target = objs.find(o => (o as any).fabricId === ed.toId)
            if (target) {
              const tc = target.getCenterPoint()
              fx += (tc.x - ci.x) * 0.01
              fy += (tc.y - ci.y) * 0.01
            }
          }
          if (ed.toId === (oi as any).fabricId) {
            const target = objs.find(o => (o as any).fabricId === ed.fromId)
            if (target) {
              const tc = target.getCenterPoint()
              fx += (tc.x - ci.x) * 0.01
              fy += (tc.y - ci.y) * 0.01
            }
          }
        })
        oi.set({ left: oi.left! + fx * 0.01, top: oi.top! + fy * 0.01 })
      }
    }
    objs.forEach(o => o.setCoords())
    canvas.requestRenderAll()
    updateAllConnections()
    zoomToFit()
    markDirty()
  }

  function layoutHierarchical() {
    const canvas = fabCanvas.value
    if (!canvas) return
    const objs = canvas.getObjects().filter(o => (o as any).customType && (o as any).customType !== 'connection')
    if (objs.length === 0) return

    // Find roots: elements with outgoing connections but no incoming
    const incoming = new Set<string>()
    canvas.getObjects().forEach(o => {
      if ((o as any).customType === 'connection') {
        incoming.add((o as any).toId)
      }
    })
    const roots = objs.filter(o => !incoming.has((o as any).fabricId))
    const placed = new Set<string>()
    let y = 0

    function placeLevel(items: FabricObject[], yPos: number) {
      const spacing = 280
      const startX = -(items.length - 1) * spacing / 2
      items.forEach((obj, i) => {
        const id = (obj as any).fabricId
        if (placed.has(id)) return
        placed.add(id)
        obj.set({ left: startX + i * spacing, top: yPos })
        obj.setCoords()
      })
    }

    // Place roots first
    placeLevel(roots as any[], y)
    if (roots.length > 0) y += 180

    // Place children level by level
    while (placed.size < objs.length) {
      const nextLevel: FabricObject[] = []
      canvas.getObjects().forEach(o => {
        if ((o as any).customType === 'connection') {
          const fromIn = placed.has((o as any).fromId)
          const toIn = placed.has((o as any).toId)
          if (fromIn && !toIn) {
            const child = objs.find(x => (x as any).fabricId === (o as any).toId)
            if (child && !placed.has((child as any).fabricId)) {
              nextLevel.push(child)
            }
          }
        }
      })
      if (nextLevel.length === 0) {
        // Place remaining unplaced
        for (const obj of objs) {
          if (!placed.has((obj as any).fabricId)) {
            nextLevel.push(obj)
          }
        }
      }
      if (nextLevel.length === 0) break
      placeLevel(nextLevel, y)
      y += 180
    }

    canvas.requestRenderAll()
    updateAllConnections()
    zoomToFit()
    markDirty()
  }

  function resetZoom() {
    const canvas = fabCanvas.value
    if (!canvas) return
    canvas.setZoom(1)
    const vpt = canvas.viewportTransform!
    vpt[4] = 0
    vpt[5] = 0
    zoom.value = 100
    canvas.requestRenderAll()
  }

  function exportPng() {
    const canvas = fabCanvas.value
    if (!canvas) return
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
    const link = document.createElement('a')
    link.download = `canvas-v2-${canvasId.value}-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }

  // ---- Metadata ----

  function updateElementMetadata(elId: string, metadata: Record<string, unknown>) {
    const canvas = fabCanvas.value
    if (!canvas) return
    const obj = canvas.getObjects().find(o => (o as any).fabricId === elId)
    if (obj) {
      (obj as any)._metadata = metadata
      markDirty()
    }
  }

  // Update Fabric object dbIds after save creates new records
  function updateDbIds(nodes: any[], edges: any[]) {
    const canvas = fabCanvas.value
    if (!canvas) return
    const fabricObjs = canvas.getObjects()
    for (const node of nodes) {
      if (node.id > 0) {
        const fabricId = `n-${node.id}`
        const obj = fabricObjs.find(o => (o as any).fabricId === fabricId)
        if (obj) {
          ;(obj as any).dbId = node.id
        }
      }
    }
    for (const edge of edges) {
      if (edge.id > 0) {
        const fabricId = `e-${edge.id}`
        const obj = fabricObjs.find(o => (o as any).fabricId === fabricId)
        if (obj) {
          ;(obj as any).dbId = edge.id
        }
      }
    }
  }

  return {
    fabCanvas,
    isLoading,
    isDirty,
    currentTool,
    zoom,
    selectedElements,
    nodeCount,
    edgeCount,

    init,
    destroy,
    loadFromData,
    extractData,

    addKbDocElement,
    addNoteElement,
    addShapeElement,
    removeSelectedElements,

    startConnection,
    completeConnection,
    cancelConnection,
    updateConnectionsForElement,

    zoomToFit,
    layoutGrid,
    layoutCircle,
    layoutForce,
    layoutHierarchical,
    resetZoom,
    exportPng,

    updateElementMetadata,
    updateDbIds,
  }
}
