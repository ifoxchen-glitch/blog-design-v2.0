<template>
  <div class="tree-node">
    <div
      class="flex items-center gap-1 py-1 px-2 hover:bg-base-200/30 rounded cursor-pointer"
      :class="{ 'bg-base-200/30': selected }"
      :style="{ paddingLeft: (depth * 16 + 8) + 'px' }"
      @click="select"
    >
      <button
        v-if="node.children?.length"
        class="btn btn-xs btn-ghost btn-square p-0"
        @click.stop="expanded = !expanded"
      >
        <svg class="w-3 h-3 transition-transform" :class="expanded && 'rotate-90'" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
      <span v-else class="w-4" />
      <span class="text-sm">{{ node.label }}</span>
    </div>
    <div v-if="expanded && node.children?.length">
      <TreeNode
        v-for="child in node.children"
        :key="child.value"
        :node="child"
        :depth="depth + 1"
        :selected-value="selectedValue"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface TreeNode {
  label: string
  value: string | number
  children?: TreeNode[]
}

const props = defineProps<{
  node: TreeNode
  depth?: number
  selectedValue?: string | number
}>()

const emit = defineEmits<{
  select: [value: string | number]
}>()

const expanded = ref(false)
const selected = computed(() => props.node.value === props.selectedValue)

const select = () => emit('select', props.node.value)
</script>