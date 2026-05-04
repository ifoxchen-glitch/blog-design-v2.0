<script setup lang="ts">
import { computed } from 'vue'
import {
  NSpace,
  NBreadcrumb,
  NBreadcrumbItem,
} from 'naive-ui'
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
  <div class="page-header" style="margin-bottom: 24px">
    <NSpace vertical :size="12">
      <NBreadcrumb v-if="hasBreadcrumbs">
        <NBreadcrumbItem
          v-for="(crumb, i) in props.breadcrumbs"
          :key="i"
          :clickable="!!crumb.to"
          @click="handleCrumbClick(crumb.to)"
        >
          {{ crumb.label }}
        </NBreadcrumbItem>
      </NBreadcrumb>

      <div
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        "
      >
        <div
          style="
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
          "
        >
          <h1
            style="
              margin: 0;
              font-size: 22px;
              font-weight: 600;
              line-height: 1.4;
            "
          >
            {{ props.title }}
          </h1>
          <slot name="extra" />
        </div>

        <div
          v-if="props.subtitle"
          style="
            flex-basis: 100%;
            color: var(--color-fg-muted, #888);
            font-size: 14px;
            margin-top: -4px;
          "
        >
          {{ props.subtitle }}
        </div>

        <div style="display: flex; gap: 8px; align-items: center">
          <slot />
        </div>
      </div>
    </NSpace>
  </div>
</template>

<style scoped>
.page-header {
  width: 100%;
}
</style>
