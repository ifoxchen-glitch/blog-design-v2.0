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
  ): Promise<void> {
    isSaving.value = true
    try {
      // Update viewport
      await apiUpdateCanvas(id, {
        zoom: data.viewport.zoom,
        pan_x: data.viewport.panX,
        pan_y: data.viewport.panY,
      })

      // Save node positions
      for (const node of data.nodes) {
        const payload: any = { x: node.x, y: node.y }
        if (node.metadata) payload.metadata = node.metadata
        if (node.id > 0) {
          await apiUpdateCanvasNode(id, node.id, payload).catch(() => {})
        } else {
          // New unsaved node: create it
          const created = await apiAddCanvasNode(id, {
            type: node.type,
            label: node.label,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            color: node.color,
            metadata: node.metadata,
          }).catch(() => null)
          if (created) node.id = created.id
        }
      }

      // Save edges
      for (const edge of data.edges) {
        if (edge.id > 0) {
          await apiUpdateCanvasEdge(id, edge.id, { label: edge.label, style: edge.style }).catch(() => {})
        } else if (edge.source_node_id > 0 && edge.target_node_id > 0) {
          await apiAddCanvasEdge(id, {
            source_node_id: edge.source_node_id,
            target_node_id: edge.target_node_id,
            label: edge.label,
          }).catch(() => {})
        }
      }

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
