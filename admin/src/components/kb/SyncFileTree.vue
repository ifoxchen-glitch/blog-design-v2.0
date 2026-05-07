<script setup lang="ts">
import { ref } from 'vue'
import { NEmpty } from 'naive-ui'
import TreeNodeItem from './TreeNodeItem.vue'
import type { FileTreeNode } from '../../api/kb'

defineProps<{
  tree: FileTreeNode[]
  loading?: boolean
  emptyText?: string
  showStatus?: boolean
}>()

const expanded = ref<Set<string>>(new Set())
function toggleExpand(path: string) {
  if (expanded.value.has(path)) {
    expanded.value.delete(path)
  } else {
    expanded.value.add(path)
  }
}
</script>

<template>
  <div class="text-xs font-mono">
    <NEmpty v-if="tree.length === 0 && !loading" :description="emptyText || '暂无文件'" class="py-8" />
    <template v-for="node in tree" :key="node.path">
      <TreeNodeItem
        :node="node"
        :depth="0"
        :expanded="expanded"
        :show-status="showStatus"
        @toggle="toggleExpand"
      />
    </template>
  </div>
</template>
