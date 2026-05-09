<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div
        v-if="visible"
        ref="menuRef"
        :style="menuStyle"
        :class="['menu menu-sm bg-base-100 shadow-xl rounded-lg border border-base-300 p-1 min-w-[160px] z-[9999]']"
        @contextmenu.prevent
      >
        <template v-for="(item, i) in items" :key="i">
          <li v-if="item.type === 'separator'">
            <span class="h-px bg-base-300/60 my-1" />
          </li>
          <li v-else>
            <button
              class="flex items-center gap-2 text-sm rounded-md px-2 py-1.5"
              :class="item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-base-200'"
              @click="item.disabled || handleClick(item)"
            >
              <span v-if="item.icon" v-html="item.icon" class="w-4 h-4 flex-shrink-0" />
              <span>{{ item.label }}</span>
              <span v-if="item.shortcut" class="ml-auto text-xs opacity-50">{{ item.shortcut }}</span>
            </button>
          </li>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface MenuItem {
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  type?: 'separator'
  action?: () => void
}

interface Props {
  items: MenuItem[]
  x?: number
  y?: number
}

const props = withDefaults(defineProps<Props>(), {
  x: 0,
  y: 0,
})

const emit = defineEmits<{
  close: []
  select: [item: MenuItem]
}>()

const menuRef = ref<HTMLElement>()
const visible = ref(false)

const menuStyle = computed(() => ({
  position: 'fixed',
  left: `${props.x}px`,
  top: `${props.y}px`,
}))

function handleClick(item: MenuItem) {
  if (item.action) item.action()
  emit('select', item)
  close()
}

function close() {
  visible.value = false
  emit('close')
}

function showAt(x: number, y: number) {
  visible.value = true
  nextTick(() => {
    if (!menuRef.value) return
    const rect = menuRef.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (x + rect.width > vw) x = vw - rect.width - 8
    if (y + rect.height > vh) y = vh - rect.height - 8
    if (x < 0) x = 8
    if (y < 0) y = 8
  })
}

defineExpose({ showAt, close })
</script>

<style scoped>
.ctx-enter-active, .ctx-leave-active {
  transition: all 0.15s ease;
  transform-origin: top left;
}
.ctx-enter-from, .ctx-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
