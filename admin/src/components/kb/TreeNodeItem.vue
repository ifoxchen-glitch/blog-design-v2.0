<script setup lang="ts">
import type { PropType } from 'vue'
import { NTag, NButton } from 'naive-ui'
import {
  ChevronForwardOutline,
  ChevronDownOutline,
  DocumentOutline,
  FolderOutline,
  FolderOpenOutline,
} from '@vicons/ionicons5'
import type { FileTreeNode } from '../../api/kb'

const props = defineProps({
  node: { type: Object as PropType<FileTreeNode>, required: true },
  depth: { type: Number, default: 0 },
  expanded: { type: Object as PropType<Set<string>>, required: true },
  showStatus: { type: Boolean, default: false },
  diffStatus: { type: String as PropType<'new' | 'old' | 'synced' | null>, default: null },
})

const emit = defineEmits<{ toggle: [path: string] }>()

const isFolder = props.node.type === 'folder'
const isExpanded = () => props.expanded.has(props.node.path)

function statusLabel(s: string | null | undefined): string {
  switch (s) {
    case 'synced': return '已同步'
    case 'skipped': return '跳过'
    case 'conflict': return '冲突'
    case 'error': return '错误'
    default: return ''
  }
}

function statusType(s: string | null | undefined): 'success' | 'default' | 'warning' | 'error' {
  switch (s) {
    case 'synced': return 'success'
    case 'skipped': return 'default'
    case 'conflict': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
}

function diffLabel(s: string | null | undefined): string {
  switch (s) {
    case 'new': return '新'
    case 'old': return '旧'
    case 'synced': return '已同步'
    default: return ''
  }
}
function diffType(s: string | null | undefined): 'info' | 'warning' | 'success' {
  switch (s) {
    case 'new': return 'info'
    case 'old': return 'warning'
    case 'synced': return 'success'
    default: return 'success'
  }
}

function formatSize(bytes: number): string {
  const kb = bytes / 1024
  if (kb < 1) return `${bytes} B`
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 py-0.5 px-1 hover:bg-base-200/50 rounded cursor-pointer"
      :style="{ paddingLeft: `${depth * 16 + 4}px` }"
      @click="isFolder ? emit('toggle', node.path) : undefined"
    >
      <!-- Chevron / spacer -->
      <span v-if="!isFolder" style="width:14px;display:inline-block" />
      <NButton v-else size="tiny" quaternary @click.stop="emit('toggle', node.path)">
        <ChevronDownOutline v-if="isExpanded()" style="width:12px;height:12px" />
        <ChevronForwardOutline v-else style="width:12px;height:12px" />
      </NButton>

      <!-- Icon -->
      <FolderOpenOutline v-if="isFolder && isExpanded()" style="width:14px;height:14px;color:#f59e0b" />
      <FolderOutline v-else-if="isFolder" style="width:14px;height:14px;color:#f59e0b" />
      <DocumentOutline v-else style="width:14px;height:14px;color:#94a3b8" />

      <!-- Name -->
      <span class="truncate" :style="{ color: isFolder ? '#e2e8f0' : '#cbd5e1' }">{{ node.name }}</span>

      <!-- Diff status badge (对比标记) -->
      <NTag v-if="diffStatus" :type="diffType(diffStatus)" size="tiny" style="margin-left:4px">
        {{ diffLabel(diffStatus) }}
      </NTag>

      <!-- Status badge -->
      <NTag v-if="showStatus && node.status" :type="statusType(node.status)" size="tiny" style="margin-left:4px">
        {{ statusLabel(node.status) }}
      </NTag>

      <!-- Size -->
      <span v-if="!isFolder && node.size" class="text-[10px] text-gray-400 ml-auto shrink-0">
        {{ formatSize(node.size) }}
      </span>

      <!-- Detail -->
      <span v-if="node.detail" class="text-[10px] text-gray-400 ml-2 truncate max-w-32">
        {{ node.detail }}
      </span>
    </div>

    <!-- Children (recursive) -->
    <template v-if="isFolder && isExpanded() && node.children?.length">
      <TreeNodeItem
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :expanded="expanded"
        :show-status="showStatus"
        :diff-status="diffStatus"
        @toggle="emit('toggle', $event)"
      />
    </template>
  </div>
</template>
