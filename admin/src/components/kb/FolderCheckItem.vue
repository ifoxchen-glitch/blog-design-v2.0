<script setup lang="ts">
import type { PropType } from 'vue'
import type { FileTreeNode } from '../../api/kb'

const props = defineProps({
  node: { type: Object as PropType<FileTreeNode>, required: true },
  selectedPaths: { type: Array as PropType<string[]>, required: true },
  depth: { type: Number, default: 0 },
})

const emit = defineEmits<{ (e: 'toggle', path: string): void }>()

function isChecked(node: FileTreeNode): boolean {
  return props.selectedPaths.includes(node.path + '/') || props.selectedPaths.includes(node.path)
}

function handleToggle(node: FileTreeNode) {
  const p = node.type === 'folder' ? node.path + '/' : node.path
  emit('toggle', p)
}
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1.5 py-0.5 hover:bg-base-200/50 rounded cursor-pointer text-xs"
      :style="{ paddingLeft: `${depth * 16 + 4}px` }"
    >
      <input
        type="checkbox"
        :checked="isChecked(node)"
        class="w-3 h-3 shrink-0 accent-primary"
        @change="handleToggle(node)"
      />
      <span class="text-base-content/60">{{ node.type === 'folder' ? '📁' : '📄' }}</span>
      <span class="text-base-content truncate">{{ node.name }}</span>
    </div>
    <template v-if="node.type === 'folder' && node.children && node.children.length">
      <FolderCheckItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :selected-paths="selectedPaths"
        :depth="depth + 1"
        @toggle="(p: string) => emit('toggle', p)"
      />
    </template>
  </div>
</template>
