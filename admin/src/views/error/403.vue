<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NResult } from 'naive-ui'

const route = useRoute()
const router = useRouter()

const fromPath = computed(() => {
  const f = route.query.from
  return typeof f === 'string' ? f : null
})

function goBack(): void {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.replace('/')
  }
}
</script>

<template>
  <div class="forbidden-page">
    <NResult
      status="403"
      title="403 — 没有访问权限"
      :description="fromPath ? `你尝试访问的页面 ${fromPath} 需要的权限你目前没有。` : '你没有访问该页面的权限。'"
    >
      <template #footer>
        <NButton @click="goBack">返回</NButton>
      </template>
    </NResult>
  </div>
</template>

<style scoped>
.forbidden-page {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
</style>
