import { ref } from 'vue'
import {
  apiGetCanvas,
  apiUpdateCanvas,
  apiAddCanvasNode,
  apiUpdateCanvasNode,
  apiAddCanvasEdge,
  apiUpdateCanvasEdge,
  apiCreateCanvas,
  apiListCanvases,
  apiDeleteCanvas,
  type CanvasData,
  type CanvasListItem,
} from '../api/kb'

export function useCanvasPersistence() {
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)

  async function loadCanvas(id: number): Promise<CanvasData> {
    return await apiGetCanvas(id)
  }

  async function saveCanvas(
    id: number,
    data: { nodes: any[]; edges: any[]; viewport: { zoom: number; panX: number; panY: number } },
    updateFabricIds?: (nodes: any[], edges: any[]) => void,
  ): Promise<void> {
    isSaving.value = true
    try {
      await apiUpdateCanvas(id, {
        zoom: data.viewport.zoom,
        pan_x: data.viewport.panX,
        pan_y: data.viewport.panY,
      })

      for (const node of data.nodes) {
        const payload: any = { x: Number(node.x) || 0, y: Number(node.y) || 0 }
        if (node.metadata) payload.metadata = node.metadata
        if (node.id > 0) {
          await apiUpdateCanvasNode(id, node.id, payload).catch(() => {})
        } else {
          const created = await apiAddCanvasNode(id, {
            type: node.type || 'note',
            label: node.label || '',
            x: Number(node.x) || 0,
            y: Number(node.y) || 0,
            width: Number(node.width) || 180,
            height: Number(node.height) || 80,
            color: node.color || '#6366f1',
            metadata: node.metadata || {},
          }).catch(() => null)
          if (created) {
            node.id = created.id
          }
        }
      }

      for (const edge of data.edges) {
        const srcId = edge.source_node_id || 0
        const tgtId = edge.target_node_id || 0
        if (edge.id > 0) {
          await apiUpdateCanvasEdge(id, edge.id, { label: edge.label || '', style: edge.style || {} }).catch(() => {})
        } else if (srcId > 0 && tgtId > 0) {
          const created = await apiAddCanvasEdge(id, {
            source_node_id: srcId,
            target_node_id: tgtId,
            label: edge.label || '',
          }).catch(() => null)
          if (created) edge.id = created.id
        }
      }

      // Update Fabric object dbIds
      if (updateFabricIds) updateFabricIds(data.nodes, data.edges)

      lastSaved.value = new Date()
    } finally {
      isSaving.value = false
    }
  }

  async function listCanvases(): Promise<CanvasListItem[]> {
    const res = await apiListCanvases()
    return res.items
  }

  async function createCanvas(title: string): Promise<CanvasListItem> {
    return await apiCreateCanvas({ title })
  }

  async function deleteCanvas(id: number): Promise<void> {
    await apiDeleteCanvas(id)
  }

  return {
    isSaving,
    lastSaved,
    loadCanvas,
    saveCanvas,
    listCanvases,
    createCanvas,
    deleteCanvas,
  }
}
