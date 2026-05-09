<template>
  <div class="text-sm breadcrumbs">
    <ul>
      <li v-for="(item, index) in items" :key="index">
        <a v-if="item.href && index < items.length - 1" :href="item.href" class="hover:underline">
          <component v-if="item.icon" :is="item.icon" class="w-4 h-4 mr-1" />
          {{ item.label }}
        </a>
        <span v-else class="flex items-center">
          <component v-if="item.icon" :is="item.icon" class="w-4 h-4 mr-1" />
          {{ item.label }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: Component
}

defineProps<{
  items: BreadcrumbItem[]
}>()
</script>
