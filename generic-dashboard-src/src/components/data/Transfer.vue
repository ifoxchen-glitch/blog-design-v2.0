<template>
  <div class="grid grid-cols-2 gap-4">
    <!-- Source Panel -->
    <div class="card bg-base-200 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">{{ sourceTitle }}</h3>
          <span class="text-sm opacity-60">{{ selected.length }} / {{ sourceItems.length }}</span>
        </div>
        <div v-if="filterable" class="mb-2">
          <input
            v-model="sourceSearch"
            type="text"
            :placeholder="filterPlaceholder"
            class="input input-sm input-bordered w-full"
          />
        </div>
        <ul class="menu bg-base-100 rounded-box max-h-80 overflow-y-auto">
          <li
            v-for="item in filteredSourceItems"
            :key="item.value"
            :class="['hover:bg-base-300 cursor-pointer', selected.includes(item.value) && 'bg-base-300']"
            @click="toggleItem(item.value)"
          >
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                :checked="selected.includes(item.value)"
                class="checkbox checkbox-sm checkbox-primary"
                @click.prevent
              />
              <span>{{ item.label }}</span>
            </label>
          </li>
        </ul>
      </div>
    </div>
    
    <!-- Target Panel -->
    <div class="card bg-base-200 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">{{ targetTitle }}</h3>
          <button
            v-if="selected.length > 0"
            class="btn btn-ghost btn-xs"
            @click="clearAll"
          >
            清空
          </button>
        </div>
        <ul class="menu bg-base-100 rounded-box max-h-96 overflow-y-auto">
          <li
            v-for="item in selectedItems"
            :key="item.value"
            class="hover:bg-base-300"
          >
            <div class="flex items-center justify-between">
              <span>{{ item.label }}</span>
              <button
                class="btn btn-ghost btn-xs btn-square"
                @click="removeItem(item.value)"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </li>
          <li v-if="selected.length === 0" class="text-center opacity-50 py-4">
            暂无选择
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface TransferItem {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  sourceItems: TransferItem[]
  modelValue: (string | number)[]
  sourceTitle?: string
  targetTitle?: string
  filterable?: boolean
  filterPlaceholder?: string
}>(), {
  sourceTitle: '源列表',
  targetTitle: '目标列表',
  filterable: true,
  filterPlaceholder: '搜索...',
})

const emit = defineEmits<{
  'update:modelValue': [value: (string | number)[]]
}>()

const selected = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const sourceSearch = ref('')

const filteredSourceItems = computed(() => {
  if (!sourceSearch.value) return props.sourceItems
  return props.sourceItems.filter(item =>
    item.label.toLowerCase().includes(sourceSearch.value.toLowerCase())
  )
})

const selectedItems = computed(() => {
  return props.sourceItems.filter(item => selected.value.includes(item.value))
})

const toggleItem = (value: string | number) => {
  const index = selected.value.indexOf(value)
  if (index > -1) {
    selected.value = selected.value.filter(v => v !== value)
  } else {
    selected.value = [...selected.value, value]
  }
}

const removeItem = (value: string | number) => {
  selected.value = selected.value.filter(v => v !== value)
}

const clearAll = () => {
  selected.value = []
}
</script>
