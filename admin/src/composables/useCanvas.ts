import { ref, shallowRef, computed, type Ref, type ShallowRef, type ComputedRef } from 'vue'
import cytoscape, { type Core } from 'cytoscape'
import {
  apiGetCanvas,
  apiUpdateCanvas,
  apiAddCanvasNode,
  apiUpdateCanvasNode,
  apiDeleteCanvasNode,
  apiAddCanvasEdge,
  apiDeleteCanvasEdge,
  apiGetKbDocument,
  apiGetKbGraph,
  type CanvasData,
  type CanvasNode,
  type CanvasEdge,
  type KbDocumentListItem,
  type KbGraphNode,
} from '../api/kb'

function dbNodeId(cyId: string): number {
  return Number(cyId.replace('n-', ''))
}

function dbEdgeId(cyId: string): number {
  return Number(cyId.replace('e-', ''))
}

export interface UseCanvasReturn {
  cy: Readonly<ShallowRef<Core | null>>
  isLoading: Ref<boolean>
  isDirty: Ref<boolean>
  selectedNode: Ref<CanvasNode | null>
  selectedEdge: Ref<CanvasEdge | null>
  nodeCount: ComputedRef<number>
  edgeCount: ComputedRef<number>
  currentZoom: Ref<number>
  canvasId: Ref<number>
  connectMode: Ref<boolean>
  init: (container: HTMLElement) => void
  destroy: () => void
  loadCanvas: (id: number) => Promise<void>
  saveCanvas: () => Promise<void>
  fromJson: (data: CanvasData) => void
  toJson: () => CanvasData | null
  addNode: (type: string, x: number, y: number) => Promise<string | null>
  addDocNode: (doc: KbDocumentListItem, x: number, y: number) => Promise<string | null>
  addDocNodeWithConnections: (doc: KbDocumentListItem, x: number, y: number) => Promise<string | null>
  removeSelected: () => Promise<void>
  addEdge: (sourceId: string, targetId: string) => Promise<boolean>
  updateNodeLabel: (nodeId: string, label: string) => Promise<void>
  updateNodeColor: (nodeId: string, color: string) => Promise<void>
  updateNodeMetadata: (nodeId: string, metadata: Record<string, unknown>) => Promise<void>
  runLayout: (name: 'cose-bilkent' | 'circle' | 'concentric' | 'grid' | 'preset') => Promise<void>
  fitToScreen: () => void
  exportPng: () => void
}

export function useCanvas(initialCanvasId: number): UseCanvasReturn {
  const cy: ShallowRef<Core | null> = shallowRef(null)
  const isLoading = ref(false)
  const isDirty = ref(false)
  const selectedNode = ref<CanvasNode | null>(null)
  const selectedEdge = ref<CanvasEdge | null>(null)
  const currentZoom = ref(1)
  const canvasId = ref(initialCanvasId)
  const connectMode = ref(false)

  const nodeCount = computed(() => cy.value ? cy.value.nodes().size() : 0)
  const edgeCount = computed(() => cy.value ? cy.value.edges().size() : 0)

  function init(container: HTMLElement): void {
    if (cy.value) destroy()

    cy.value = cytoscape({
      container,
      style: [
        {
          selector: 'node',
          style: {
            'shape': 'round-rectangle',
            'background-color': 'data(color)',
            'label': 'data(label)',
            'width': 'data(width)',
            'height': 'data(height)',
            'font-size': '13px',
            'color': '#1e293b',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': 'data(width)',
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.6,
            'padding': '10px',
            'min-zoomed-font-size': 8,
          },
        },
        {
          selector: 'node[nodeType="kb-doc"]',
          style: {
            'shape': 'round-rectangle',
            'background-color': 'data(color)',
            'background-opacity': 0.12,
            'label': 'data(label)',
            'width': 220,
            'height': 76,
            'font-size': '11px',
            'color': 'data(color)',
            'text-valign': 'top',
            'text-halign': 'left',
            'text-wrap': 'wrap',
            'text-max-width': '196px',
            'border-width': 3,
            'border-color': 'data(color)',
            'border-opacity': 0.8,
            'padding': '4px',
            'text-margin-y': 3,
            'text-margin-x': 4,
            'min-zoomed-font-size': 7,
          },
        },
        {
          selector: 'node:selected',
          style: { 'border-color': '#f59e0b', 'border-width': 3 },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '11px',
            'color': '#64748b',
            'text-background-color': '#ffffff',
            'text-background-opacity': 1,
            'text-background-padding': '3px',
            'min-zoomed-font-size': 6,
          },
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': '#f59e0b', 'width': 3 },
        },
      ],
      layout: { name: 'preset' },
      // Use default wheel sensitivity to avoid console warning
      minZoom: 0.1,
      maxZoom: 4,
      boxSelectionEnabled: true,
      autoungrabify: false,
      autounselectify: false,
    })

    // Event bridge
    cy.value.on('tap', 'node', (evt) => {
      const node = evt.target
      const data = node.data() as Record<string, unknown>
      selectedEdge.value = null
      selectedNode.value = {
        id: dbNodeId(node.id()),
        canvas_id: canvasId.value!,
        type: data.type as string,
        label: data.label as string,
        content: data.content as string,
        x: node.position().x,
        y: node.position().y,
        width: data.width as number,
        height: data.height as number,
        color: data.color as string,
        metadata: data.metadata as Record<string, unknown>,
        sort_order: data.sort_order as number,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
      }
    })

    cy.value.on('tap', 'edge', (evt) => {
      const edge = evt.target
      const data = edge.data() as Record<string, unknown>
      selectedNode.value = null
      selectedEdge.value = {
        id: dbEdgeId(edge.id()),
        canvas_id: canvasId.value!,
        source_node_id: dbNodeId(data.source as string),
        target_node_id: dbNodeId(data.target as string),
        label: data.label as string,
        style: data.style as Record<string, unknown>,
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
      }
    })

    cy.value.on('tap', (evt) => {
      if (evt.target === cy.value) {
        selectedNode.value = null
        selectedEdge.value = null
      }
    })

    // Track dirty state on changes
    cy.value.on('dragfree', 'node', () => { isDirty.value = true })
    cy.value.on('add remove', () => { isDirty.value = true })

    // Zoom tracking
    cy.value.on('zoom', () => {
      if (cy.value) currentZoom.value = cy.value.zoom()
    })
  }

  function destroy(): void {
    if (cy.value) {
      cy.value.destroy()
      cy.value = null
    }
    selectedNode.value = null
    selectedEdge.value = null
    isDirty.value = false
  }

  async function loadCanvas(id: number): Promise<void> {
    isLoading.value = true
    canvasId.value = id
    try {
      const data = await apiGetCanvas(id)
      fromJson(data)
      if (cy.value) {
        cy.value.zoom(data.zoom)
        cy.value.pan({ x: data.pan_x, y: data.pan_y })
        cy.value.fit(undefined, 50)
      }
      isDirty.value = false
    } finally {
      isLoading.value = false
    }
  }

  function fromJson(data: CanvasData): void {
    if (!cy.value) return

    // Remove all existing elements
    cy.value.elements().remove()

    // Add nodes
    for (const node of data.nodes) {
      const meta = node.metadata as Record<string, unknown> | undefined
      const isDocNode = Boolean(meta?.doc_id)

      // Rebuild card-style label for KB doc nodes
      let label = node.label
      if (isDocNode) {
        const catLabel = (meta?.doc_category as string) || ''
        label = catLabel ? `[${catLabel}]\n${node.label}` : node.label
      }

      cy.value.add({
        group: 'nodes',
        data: {
          id: `n-${node.id}`,
          label,
          nodeType: isDocNode ? 'kb-doc' : undefined,
          type: node.type,
          content: node.content,
          width: isDocNode ? 220 : node.width,
          height: isDocNode ? 76 : node.height,
          color: isDocNode ? getCategoryColor((meta?.doc_category as string) || null) : node.color,
          metadata: node.metadata,
          sort_order: node.sort_order,
          created_at: node.created_at,
          updated_at: node.updated_at,
        },
        position: { x: node.x, y: node.y },
      })
    }

    // Add edges
    for (const edge of data.edges) {
      cy.value.add({
        group: 'edges',
        data: {
          id: `e-${edge.id}`,
          source: `n-${edge.source_node_id}`,
          target: `n-${edge.target_node_id}`,
          label: edge.label,
          style: edge.style,
          created_at: edge.created_at,
          updated_at: edge.updated_at,
        },
      })
    }
  }

  function toJson(): CanvasData | null {
    if (!cy.value || !canvasId.value)return null

    const nodes: CanvasNode[] = cy.value.nodes().map((n) => ({
      id: dbNodeId(n.id()),
      canvas_id: canvasId.value!,
      type: n.data('type') as string,
      label: n.data('label') as string,
      content: n.data('content') as string,
      x: n.position().x,
      y: n.position().y,
      width: n.data('width') as number,
      height: n.data('height') as number,
      color: n.data('color') as string,
      metadata: n.data('metadata') as Record<string, unknown>,
      sort_order: n.data('sort_order') as number,
      created_at: n.data('created_at') as string,
      updated_at: n.data('updated_at') as string,
    }))

    const edges: CanvasEdge[] = cy.value.edges().map((e) => ({
      id: dbEdgeId(e.id()),
      canvas_id: canvasId.value!,
      source_node_id: dbNodeId(e.data('source') as string),
      target_node_id: dbNodeId(e.data('target') as string),
      label: e.data('label') as string,
      style: e.data('style') as Record<string, unknown>,
      created_at: e.data('created_at') as string,
      updated_at: e.data('updated_at') as string,
    }))

    return {
      id: canvasId.value,
      title: '',
      description: null,
      zoom: cy.value.zoom(),
      pan_x: cy.value.pan().x,
      pan_y: cy.value.pan().y,
      grid_visible: true,
      node_count: nodes.length,
      edge_count: edges.length,
      created_at: '',
      updated_at: '',
      nodes,
      edges,
    }
  }

  async function saveCanvas(): Promise<void> {
    if (!cy.value || !canvasId.value)return

    // Save viewport
    await apiUpdateCanvas(canvasId.value, {
      zoom: cy.value.zoom(),
      pan_x: cy.value.pan().x,
      pan_y: cy.value.pan().y,
    })

    // Sync nodes: for each node in cytoscape, update position in backend
    const cyNodes = cy.value.nodes()
    for (const n of cyNodes) {
      const nodeId = dbNodeId(n.id())
      try {
        await apiUpdateCanvasNode(canvasId.value, nodeId, {
          x: n.position().x,
          y: n.position().y,
        })
      } catch {
        // Node may have been deleted — ignore
      }
    }

    isDirty.value = false
  }

  // ---- node operations ----

  async function addNode(type: string, x: number, y: number): Promise<string | null> {
    if (!cy.value || !canvasId.value)return null

    const label = type === 'concept' ? '新概念' : type === 'note' ? '新笔记' : type === 'term' ? '新术语' : type === 'reference' ? '新引用' : '新节点'
    const colors: Record<string, string> = { concept: '#6366f1', note: '#f59e0b', term: '#10b981', reference: '#3b82f6' }
    const color = colors[type] ?? '#6366f1'

    try {
      const created = await apiAddCanvasNode(canvasId.value, {
        type,
        label,
        x,
        y,
        color,
      })

      cy.value.add({
        group: 'nodes',
        data: {
          id: `n-${created.id}`,
          label: created.label,
          type: created.type,
          content: '',
          width: created.width,
          height: created.height,
          color: created.color,
          metadata: {},
          sort_order: created.sort_order,
          created_at: created.created_at,
          updated_at: created.updated_at,
        },
        position: { x, y },
      })

      return `n-${created.id}`
    } catch {
      return null
    }
  }

  const CATEGORY_PALETTE = [
    '#6366f1', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981',
    '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  ]

  function getCategoryColor(category: string | null): string {
    if (!category) return '#6366f1'
    // Hash the category name for consistent color assignment
    let hash = 0
    for (let i = 0; i < category.length; i++) {
      hash = category.charCodeAt(i) + ((hash << 5) - hash)
    }
    return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length]
  }

  async function addDocNode(doc: KbDocumentListItem, x: number, y: number): Promise<string | null> {
    if (!cy.value) { console.warn('[addDocNode] cy not ready'); return null }
    if (!canvasId.value) { console.warn('[addDocNode] canvasId invalid:', canvasId.value); return null }
    if (!doc || !doc.id) { console.warn('[addDocNode] doc invalid:', doc); return null }

    // Color by category (分组)
    const color = getCategoryColor(doc.category)

    // Label: title on first line (top-left, color = border color),
    // category on second line (centered, same color)
    const label = doc.category
      ? `${doc.title}\n[${doc.category}]`
      : doc.title

    const metadata = {
      doc_id: doc.id,
      doc_title: doc.title,
      doc_category: doc.category,
      doc_type: doc.doc_type,
      review_status: doc.review_status,
      tags: doc.tags,
      excerpt: doc.excerpt,
    }

    try {
      const created = await apiAddCanvasNode(canvasId.value, {
        type: doc.doc_type ?? 'concept',
        label: doc.title,
        x,
        y,
        color,
        content: '',
        metadata,
      })

      cy.value.add({
        group: 'nodes',
        data: {
          id: `n-${created.id}`,
          label,
          nodeType: 'kb-doc',
          type: doc.doc_type ?? 'concept',
          content: '',
          width: 220,
          height: 76,
          color,
          metadata,
          sort_order: created.sort_order,
          created_at: created.created_at,
          updated_at: created.updated_at,
        },
        position: { x, y },
      })

      isDirty.value = true
      return `n-${created.id}`
    } catch {
      return null
    }
  }

  /**
   * Add a KB document node AND auto-add + connect its related documents.
   * Fetches the document's connections/sources, finds matching docs in the
   * knowledge graph, creates nodes for them (if not already on canvas), and
   * creates edges between the main document and each connected document.
   */
  async function addDocNodeWithConnections(doc: KbDocumentListItem, x: number, y: number): Promise<string | null> {
    if (!cy.value) { console.warn('[addConn] cy not ready'); return null }
    if (!canvasId.value) { console.warn('[addConn] canvasId invalid:', canvasId.value); return null }
    if (!doc || !doc.id) { console.warn('[addConn] doc invalid:', doc); return null }

    // 1. Add the main document node
    console.log('[addConn] adding doc:', doc.title, 'id:', doc.id, 'at', x, y)
    const mainNodeId = await addDocNode(doc, x, y)
    if (!mainNodeId) {
      console.warn('[addConn] addDocNode returned null for:', doc.title)
      return null
    }
    console.log('[addConn] main node created:', mainNodeId)

    // 2. Fetch document detail to get connections/sources
    let connectedTitles: string[] = []
    try {
      const detail = await apiGetKbDocument(doc.id)
      connectedTitles = [...(detail.connections || []), ...(detail.sources || [])]
    } catch (e) {
      console.warn('[addConn] apiGetKbDocument failed:', doc.id, e)
      // If we can't fetch detail, just return the main node
      return mainNodeId
    }

    if (connectedTitles.length === 0) return mainNodeId

    // 3. Fetch graph data to find connected doc IDs and titles
    let titleToNode = new Map<string, KbGraphNode>()
    try {
      const graphData = await apiGetKbGraph()
      for (const n of graphData.nodes) {
        titleToNode.set(n.title, n)
      }
    } catch {
      return mainNodeId
    }

    // 4. Add connected docs as nodes and create edges
    const existingTitles = new Set(
      cy.value.nodes().map(n => (n.data('metadata') as Record<string, unknown> | undefined)?.['doc_title'] as string).filter(Boolean)
    )
    const addedTitles = new Set<string>([doc.title])

    let offsetRow = 0
    for (const title of connectedTitles) {
      if (addedTitles.has(title)) continue
      addedTitles.add(title)

      const graphNode = titleToNode.get(title)
      if (!graphNode) continue

      // Check if this doc already exists on the canvas (by doc_title in metadata)
      if (existingTitles.has(title)) {
        // Find existing node and create edge to it
        const existingNodes = cy.value.nodes().filter(n => {
          const meta = n.data('metadata') as Record<string, unknown> | undefined
          return meta?.['doc_title'] === title
        })
        if (existingNodes.length > 0) {
          await addEdge(mainNodeId, existingNodes[0].id())
        }
        continue
      }

      offsetRow++
      const dx = (offsetRow % 3) * 220 - 220
      const dy = Math.floor(offsetRow / 3) * 150 + 150

      const connectedDoc: KbDocumentListItem = {
        id: Number(graphNode.id),
        title: graphNode.title,
        slug: graphNode.slug,
        excerpt: graphNode.excerpt,
        source: 'manual' as const,
        tags: graphNode.tags,
        status: 'active' as const,
        category: graphNode.category,
        doc_type: (graphNode.doc_type || 'concept') as KbDocumentListItem['doc_type'],
        doc_date: null,
        review_status: (graphNode.review_status || null) as KbDocumentListItem['review_status'],
        word_count: 0,
        created_at: '',
        updated_at: '',
      }

      const connectedNodeId = await addDocNode(connectedDoc, x + dx, y + dy)
      if (connectedNodeId) {
        existingTitles.add(title)
        await addEdge(mainNodeId, connectedNodeId)
      }
    }

    return mainNodeId
  }

  async function removeSelected(): Promise<void> {
    if (!cy.value || !canvasId.value) return
    const sel = cy.value.$(':selected')
    if (!sel.length) return

    // Remove from backend first
    const nodesToDelete: number[] = []
    const edgesToDelete: number[] = []
    sel.forEach((el: cytoscape.SingularElementArgument) => {
      if (el.isNode()) {
        nodesToDelete.push(dbNodeId(el.id()))
      } else if (el.isEdge()) {
        edgesToDelete.push(dbEdgeId(el.id()))
      }
    })
    for (const nid of nodesToDelete) {
      try { await apiDeleteCanvasNode(canvasId.value, nid) } catch { /* ignore */ }
    }
    for (const eid of edgesToDelete) {
      try { await apiDeleteCanvasEdge(canvasId.value, eid) } catch { /* ignore */ }
    }
    sel.remove()
    selectedNode.value = null
    selectedEdge.value = null
  }

  async function addEdge(sourceId: string, targetId: string): Promise<boolean> {
    if (!cy.value || !canvasId.value)return false

    // Check if edge already exists
    const existing = cy.value.edges().filter((e) => {
      return (e.data('source') === sourceId && e.data('target') === targetId) ||
             (e.data('source') === targetId && e.data('target') === sourceId)
    })
    if (existing.length > 0) return false

    try {
      const created = await apiAddCanvasEdge(canvasId.value, {
        source_node_id: dbNodeId(sourceId),
        target_node_id: dbNodeId(targetId),
      })

      cy.value.add({
        group: 'edges',
        data: {
          id: `e-${created.id}`,
          source: sourceId,
          target: targetId,
          label: '',
          style: {},
          created_at: created.created_at,
          updated_at: created.updated_at,
        },
      })

      return true
    } catch {
      return false
    }
  }

  async function updateNodeLabel(nodeId: string, label: string): Promise<void> {
    if (!cy.value || !canvasId.value)return
    const cyNode = cy.value.getElementById(nodeId)
    if (!cyNode.length) return

    try {
      await apiUpdateCanvasNode(canvasId.value, dbNodeId(nodeId), { label })
      cyNode.data('label', label)
    } catch { /* ignore */ }
  }

  async function updateNodeColor(nodeId: string, color: string): Promise<void> {
    if (!cy.value || !canvasId.value)return
    const cyNode = cy.value.getElementById(nodeId)
    if (!cyNode.length) return

    try {
      await apiUpdateCanvasNode(canvasId.value, dbNodeId(nodeId), { color })
      cyNode.data('color', color)
      cyNode.style({
        'background-color': color,
        'border-color': color,
      })
    } catch { /* ignore */ }
  }

  async function updateNodeMetadata(nodeId: string, metadata: Record<string, unknown>): Promise<void> {
    if (!cy.value || !canvasId.value) return
    const cyNode = cy.value.getElementById(nodeId)
    if (!cyNode.length) return

    try {
      await apiUpdateCanvasNode(canvasId.value, dbNodeId(nodeId), { metadata } as any)
      cyNode.data('metadata', metadata)
      isDirty.value = true
    } catch { /* ignore */ }
  }

  async function runLayout(name: 'cose-bilkent' | 'circle' | 'concentric' | 'grid' | 'preset'): Promise<void> {
    if (!cy.value) return

    const layout = cy.value.layout({
      name: name === 'cose-bilkent' ? 'cose' : name,
      animate: true,
      animationDuration: 500,
      ...(name === 'grid' ? { rows: undefined } : {}),
    } as cytoscape.LayoutOptions)

    layout.run()
    await new Promise<void>((resolve) => {
      layout.one('layoutstop', () => resolve())
    })
    isDirty.value = true
  }

  function fitToScreen(): void {
    if (cy.value) cy.value.fit(undefined, 50)
  }

  function exportPng(): void {
    if (!cy.value) return
    const dataUrl = cy.value.png({
      full: true,
      bg: '#ffffff',
      scale: 2,
    })
    const link = document.createElement('a')
    link.download = `canvas-${canvasId.value}-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }

  return {
    cy,
    isLoading,
    isDirty,
    selectedNode,
    selectedEdge,
    nodeCount,
    edgeCount,
    currentZoom,
    canvasId,
    connectMode,
    init,
    destroy,
    loadCanvas,
    saveCanvas,
    fromJson,
    toJson,
    addNode,
    addDocNode,
    addDocNodeWithConnections,
    removeSelected,
    addEdge,
    updateNodeLabel,
    updateNodeColor,
    updateNodeMetadata,
    runLayout,
    fitToScreen,
    exportPng,
  }
}
