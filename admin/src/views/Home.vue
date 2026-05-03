<script setup lang="ts">
import { NButton, NCard, NSpace } from 'naive-ui'
import { Rocket } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useCounterStore } from '../stores/counter'

const counter = useCounterStore()
</script>

<template>
  <div class="p-8">
    <NCard title="超级后台 · Home" class="max-w-xl">
      <NSpace vertical>
        <p class="text-gray-600">
          Vue 3 + Vite + Naive UI + Tailwind + Pinia + Vue Router 全套已就绪
        </p>
        <NSpace>
          <NButton type="primary" @click="counter.increment">
            <template #icon>
              <NIcon><Rocket /></NIcon>
            </template>
            count: {{ counter.count }}
          </NButton>
          <span class="text-sm text-gray-500 self-center">
            doubled: {{ counter.doubled }}
          </span>
        </NSpace>
        <RouterLink to="/about" class="text-blue-600 underline">
          → about
        </RouterLink>
      </NSpace>
    </NCard>
  </div>
</template>
