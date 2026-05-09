<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Proxy groups -->
      <PanelCard>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="group in proxyGroups"
            :key="group.name"
            :class="['btn btn-sm', activeGroup === group.name ? 'btn-primary' : 'btn-ghost bg-base-200/30']"
            @click="activeGroup = group.name"
          >
            {{ group.name }}
            <span class="badge badge-xs ml-1">{{ group.nodes.length }}</span>
          </button>
        </div>
      </PanelCard>

      <!-- Current group info -->
      <CollapseCard :title="currentGroup?.name || '代理组'" :default-open="true">
        <div class="space-y-3">
          <InfoRow label="类型" :value="currentGroup?.type" />
          <InfoRow label="当前节点" :value="currentGroup?.now" variant="success" />
          <InfoRow label="节点数" :value="String(currentGroup?.nodes.length)" />
        </div>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-sm btn-primary" @click="testAllLatency">
            <span v-if="testing" class="loading loading-xs"></span>
            {{ testing ? '测速中...' : '全部测速' }}
          </button>
          <button class="btn btn-sm btn-ghost bg-base-200/30" @click="selectFastest">
            选择最快
          </button>
        </div>
      </CollapseCard>

      <!-- Proxy nodes grid -->
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <div
          v-for="node in currentGroup?.nodes"
          :key="node.name"
          :class="[
            'bg-base-200/30 rounded-xl p-3 cursor-pointer transition-all',
            currentGroup?.now === node.name ? 'ring-2 ring-primary' : 'hover:bg-base-200/50'
          ]"
          @click="selectNode(node.name)"
        >
          <div class="flex items-center gap-2">
            <span class="text-lg">{{ node.flag }}</span>
            <span class="text-sm font-medium truncate flex-1">{{ node.name }}</span>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <LatencyTag :latency="node.latency" :testing="node.testing" />
            <button
              class="btn btn-xs btn-ghost"
              @click.stop="testLatency(node)"
            >
              <span v-if="node.testing" class="loading loading-xs"></span>
              <span v-else>🔄</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Proxy providers -->
      <CollapseCard title="外部代理源" :default-open="false">
        <div class="space-y-3">
          <div
            v-for="provider in providers"
            :key="provider.name"
            class="bg-base-200/20 rounded-lg p-3"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">{{ provider.name }}</div>
                <div class="text-xs text-base-content/50 mt-1">
                  {{ provider.nodeCount }} 节点 · 更新于 {{ provider.updatedAt }}
                </div>
              </div>
              <button class="btn btn-xs btn-ghost" @click="updateProvider(provider)">
                <span v-if="provider.updating" class="loading loading-xs"></span>
                <span v-else>更新</span>
              </button>
            </div>
          </div>
        </div>
      </CollapseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'
import InfoRow from '@/components/common/InfoRow.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import LatencyTag from '@/components/proxies/LatencyTag.vue'

const activeGroup = ref('PROXY')
const testing = ref(false)

const proxyGroups = ref([
  {
    name: 'PROXY',
    type: 'Selector',
    now: '🇭🇰 香港 01',
    nodes: [
      { name: '🇭🇰 香港 01', flag: '🇭🇰', latency: 42, testing: false },
      { name: '🇭🇰 香港 02', flag: '🇭🇰', latency: 68, testing: false },
      { name: '🇭🇰 香港 03', flag: '🇭🇰', latency: 55, testing: false },
      { name: '🇯🇵 日本 01', flag: '🇯🇵', latency: 120, testing: false },
      { name: '🇯🇵 日本 02', flag: '🇯🇵', latency: 135, testing: false },
      { name: '🇸🇬 新加坡', flag: '🇸🇬', latency: 89, testing: false },
      { name: '🇺🇸 美国 01', flag: '🇺🇸', latency: 210, testing: false },
      { name: '🇺🇸 美国 02', flag: '🇺🇸', latency: 195, testing: false },
    ],
  },
  {
    name: 'Auto',
    type: 'URLTest',
    now: '🇭🇰 香港 01',
    nodes: [
      { name: '🇭🇰 香港 01', flag: '🇭🇰', latency: 42, testing: false },
      { name: '🇭🇰 香港 02', flag: '🇭🇰', latency: 68, testing: false },
      { name: '🇯🇵 日本 01', flag: '🇯🇵', latency: 120, testing: false },
    ],
  },
  {
    name: 'Domestic',
    type: 'Selector',
    now: 'DIRECT',
    nodes: [
      { name: 'DIRECT', flag: '🌐', latency: 0, testing: false },
      { name: '🇨🇳 国内中转', flag: '🇨🇳', latency: 35, testing: false },
    ],
  },
])

const providers = ref([
  { name: 'AirportSub', nodeCount: 156, updatedAt: '2 小时前', updating: false },
  { name: 'PrivateNodes', nodeCount: 8, updatedAt: '1 天前', updating: false },
])

const currentGroup = computed(() => proxyGroups.value.find(g => g.name === activeGroup.value))

const selectNode = (name: string) => {
  if (currentGroup.value) {
    currentGroup.value.now = name
  }
}

const testLatency = async (node: any) => {
  node.testing = true
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1000))
  node.latency = Math.floor(30 + Math.random() * 200)
  node.testing = false
}

const testAllLatency = async () => {
  testing.value = true
  const nodes = currentGroup.value?.nodes || []
  await Promise.all(nodes.map(testLatency))
  testing.value = false
}

const selectFastest = () => {
  const nodes = currentGroup.value?.nodes || []
  const fastest = nodes.reduce((min, n) =>
    n.latency > 0 && (min.latency === 0 || n.latency < min.latency) ? n : min
  , nodes[0])
  if (fastest && currentGroup.value) {
    currentGroup.value.now = fastest.name
  }
}

const updateProvider = async (provider: any) => {
  provider.updating = true
  await new Promise(r => setTimeout(r, 2000))
  provider.updatedAt = '刚刚'
  provider.updating = false
}
</script>
