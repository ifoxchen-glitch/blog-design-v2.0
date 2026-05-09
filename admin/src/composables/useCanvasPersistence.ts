import { ref } from 'vue'
import {
  apiGetCanvas,
  apiUpdateCanvas,
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
      // Note: individual node positions are saved via addNode/updateNode during element creation/modification.
      // The extract/save cycle here just ensures viewport is persisted.
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
