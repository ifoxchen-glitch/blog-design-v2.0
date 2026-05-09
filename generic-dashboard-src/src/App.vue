<template>
  <div
    class="bg-base-200 home-page flex h-dvh w-screen overflow-hidden"
    :class="isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'"
  >
    <!-- Sidebar (desktop) -->
    <div
      class="relative z-40 hidden flex-none overflow-visible transition-[width] duration-320 ease-[cubic-bezier(0.34,0.1,0.2,1)] md:flex"
      :class="isCollapsed ? 'w-18' : 'w-64'"
    >
      <SideBar v-model:collapsed="isCollapsed" class="absolute inset-y-0 left-0" />
    </div>

    <!-- Main content area -->
    <div class="relative flex flex-1 flex-col overflow-hidden">
      <!-- Top bar with collapse toggle -->
      <div class="hidden h-14 shrink-0 items-center border-b border-base-content/30 px-4 md:flex">
        <button
          @click="isCollapsed = !isCollapsed"
          class="btn btn-ghost btn-sm btn-circle"
          title="切换侧边栏"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span class="ml-3 text-sm font-medium text-base-content/70">流量监控面板</span>
      </div>

      <!-- Page content -->
      <div class="flex flex-1 flex-col overflow-y-auto">
        <RouterView v-slot="{ Component, route }">
          <Transition name="fade" mode="out-in">
            <Component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </div>

      <!-- Mobile bottom dock -->
      <MobileDock />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import SideBar from '@/components/sidebar/SideBar.vue'
import MobileDock from '@/components/navigation/MobileDock.vue'

const isCollapsed = ref(false)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
