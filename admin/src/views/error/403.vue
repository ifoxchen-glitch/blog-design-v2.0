<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
  <div class="min-h-svh flex items-center justify-center p-6">
    <div class="bg-base-100 rounded-2xl border border-base-content/5 p-10 max-w-md w-full text-center">
      <div class="text-6xl font-extralight text-base-content/10 mb-4">403</div>
      <h1 class="text-xl font-semibold text-base-content mb-2">没有访问权限</h1>
      <p class="text-sm text-base-content/50 mb-8">
        {{ fromPath ? `你尝试访问的页面 ${fromPath} 需要的权限你目前没有。` : '你没有访问该页面的权限。' }}
      </p>
      <button class="btn btn-primary px-6" @click="goBack">返回</button>
    </div>
  </div>
</template>
