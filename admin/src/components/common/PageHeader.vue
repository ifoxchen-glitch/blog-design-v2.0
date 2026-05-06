<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

interface BreadcrumbItem {
  label: string
  to?: string
}

const props = defineProps<{
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
}>()

const router = useRouter()

const hasBreadcrumbs = computed(
  () => Array.isArray(props.breadcrumbs) && props.breadcrumbs.length > 0,
)

function handleCrumbClick(to: string | undefined) {
  if (to) router.push(to)
}
</script>

<template>
  <div class="mb-6">
    <!-- Breadcrumbs -->
    <div
      v-if="hasBreadcrumbs"
      class="flex items-center gap-2 text-sm text-base-content/50 mb-3"
    >
      <template v-for="(crumb, i) in props.breadcrumbs" :key="i">
        <span v-if="i > 0" class="text-base-content/20">/</span>
        <span
          :class="[
            crumb.to ? 'hover:text-primary cursor-pointer transition-colors' : '',
          ]"
          @click="handleCrumbClick(crumb.to)"
        >
          {{ crumb.label }}
        </span>
      </template>
    </div>

    <!-- Title row -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-xl font-semibold text-base-content tracking-tight">
            {{ props.title }}
          </h1>
          <slot name="extra" />
        </div>
        <p
          v-if="props.subtitle"
          class="text-sm text-base-content/50 mt-1"
        >
          {{ props.subtitle }}
        </p>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <slot />
      </div>
    </div>
  </div>
</template>
