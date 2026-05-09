<template>
  <div class="qr-code" ref="qrRef">
    <canvas ref="canvasRef" :width="size" :height="size" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

// Simple QR Code generator using canvas
// For production, use a library like qrcode.js

const props = withDefaults(defineProps<{
  value: string
  size?: number
  level?: 'L' | 'M' | 'Q' | 'H'
  bgColor?: string
  fgColor?: string
}>(), {
  size: 200,
  level: 'M',
  bgColor: '#ffffff',
  fgColor: '#000000',
})

const canvasRef = ref<HTMLCanvasElement>()

const generateQR = async () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Simple placeholder - in production, use a QR library
  ctx.fillStyle = props.bgColor
  ctx.fillRect(0, 0, props.size, props.size)
  
  ctx.fillStyle = props.fgColor
  const moduleCount = 21
  const moduleSize = props.size / (moduleCount + 8)
  const offset = moduleSize * 4
  
  // Draw position patterns (corners)
  drawPositionPattern(ctx, offset, offset, moduleSize)
  drawPositionPattern(ctx, offset + (moduleCount - 7) * moduleSize, offset, moduleSize)
  drawPositionPattern(ctx, offset, offset + (moduleCount - 7) * moduleSize, moduleSize)
  
  // Draw data modules (simplified)
  ctx.fillStyle = props.fgColor
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (isDataModule(row, col, moduleCount)) {
        const x = offset + col * moduleSize
        const y = offset + row * moduleSize
        ctx.fillRect(x, y, moduleSize, moduleSize)
      }
    }
  }
  
  // Draw text overlay
  ctx.font = `${Math.max(10, props.size / 20)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = props.fgColor
  ctx.fillText('QR', props.size / 2, props.size / 2)
}

const drawPositionPattern = (ctx: CanvasRenderingContext2D, x: number, y: number, moduleSize: number) => {
  // Outer square
  ctx.fillStyle = props.fgColor
  ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize)
  
  // Inner white square
  ctx.fillStyle = props.bgColor
  ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize)
  
  // Center square
  ctx.fillStyle = props.fgColor
  ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize)
}

const isDataModule = (row: number, col: number, moduleCount: number): boolean => {
  // Skip position patterns
  if (row < 8 && col < 8) return false
  if (row < 8 && col >= moduleCount - 8) return false
  if (row >= moduleCount - 8 && col < 8) return false
  
  // Pseudo-random pattern based on value hash
  const hash = hashString(props.value)
  const index = row * moduleCount + col
  return ((hash >> (index % 32)) & 1) === 1
}

const hashString = (str: string): number => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

onMounted(() => {
  generateQR()
})

watch(() => props.value, generateQR)
watch(() => props.size, generateQR)
</script>

<style scoped>
.qr-code {
  display: inline-block;
}
</style>
