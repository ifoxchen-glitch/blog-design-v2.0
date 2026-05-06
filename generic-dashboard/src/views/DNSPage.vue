<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- DNS stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-primary">{{ dnsStats.queries }}</div>
          <div class="text-xs text-base-content/50 mt-1">查询数</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-success">{{ dnsStats.cacheHit }}</div>
          <div class="text-xs text-base-content/50 mt-1">缓存命中</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-info">{{ dnsStats.cacheSize }}</div>
          <div class="text-xs text-base-content/50 mt-1">缓存大小</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums">{{ dnsStats.avgLatency }}ms</div>
          <div class="text-xs text-base-content/50 mt-1">平均延迟</div>
        </div>
      </div>

      <!-- DNS servers -->
      <CollapseCard title="DNS 服务器" :default-open="true">
        <div class="space-y-2">
          <div
            v-for="server in dnsServers"
            :key="server.address"
            class="bg-base-200/20 rounded-lg p-3"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-lg">{{ server.flag }}</span>
                <div>
                  <div class="text-sm font-medium">{{ server.name }}</div>
                  <div class="text-xs text-base-content/50 font-mono">{{ server.address }}</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <LatencyTag :latency="server.latency" />
                <input
                  type="checkbox"
                  :checked="server.enabled"
                  class="toggle toggle-sm toggle-primary"
                  @change="server.enabled = !server.enabled"
                />
              </div>
            </div>
          </div>
        </div>
      </CollapseCard>

      <!-- DNS cache -->
      <CollapseCard title="DNS 缓存" :default-open="false">
        <template #header-right>
          <button class="btn btn-xs btn-ghost" @click="flushCache">
            清空缓存
          </button>
        </template>

        <div class="space-y-1">
          <div
            v-for="entry in dnsCache"
            :key="entry.domain"
            class="bg-base-200/20 rounded-lg p-2 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm truncate max-w-[200px]">{{ entry.domain }}</span>
              <span class="text-xs text-base-content/40">{{ entry.ttl }}s</span>
            </div>
            <div class="text-xs font-mono text-base-content/60">{{ entry.ip }}</div>
          </div>

          <div v-if="dnsCache.length === 0" class="text-center text-base-content/40 py-4">
            缓存为空
          </div>
        </div>
      </CollapseCard>

      <!-- Query log -->
      <PanelCard title="查询日志">
        <div class="space-y-1 font-mono text-xs max-h-[40vh] overflow-y-auto">
          <div
            v-for="log in queryLogs"
            :key="log.id"
            :class="[
              'rounded-lg p-2',
              log.cached ? 'bg-success/5' : 'bg-base-200/20'
            ]"
          >
            <div class="flex items-center gap-2">
              <span class="text-base-content/40">{{ log.time }}</span>
              <span class="truncate flex-1">{{ log.domain }}</span>
              <span class="text-base-content/60">{{ log.type }}</span>
              <LatencyTag :latency="log.latency" :testing="log.pending" />
              <span v-if="log.cached" class="badge badge-xs bg-success/20 text-success">缓存</span>
            </div>
          </div>
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import LatencyTag from '@/components/proxies/LatencyTag.vue'

const dnsStats = reactive({
  queries: 12456,
  cacheHit: 8234,
  cacheSize: 1024,
  avgLatency: 12,
})

const dnsServers = ref([
  { name: 'Google DNS', address: '8.8.8.8:53', flag: '🇺🇸', latency: 15, enabled: true },
  { name: 'Cloudflare DNS', address: '1.1.1.1:53', flag: '🌐', latency: 12, enabled: true },
  { name: '阿里 DNS', address: '223.5.5.5:53', flag: '🇨🇳', latency: 8, enabled: true },
  { name: '腾讯 DNS', address: '119.29.29.29:53', flag: '🇨🇳', latency: 10, enabled: false },
])

const dnsCache = ref([
  { domain: 'google.com', ip: '142.250.185.78', ttl: 180 },
  { domain: 'github.com', ip: '140.82.121.4', ttl: 120 },
  { domain: 'api.openai.com', ip: '104.18.32.7', ttl: 60 },
  { domain: 'apple.com', ip: '17.253.144.10', ttl: 300 },
  { domain: 'microsoft.com', ip: '20.70.246.20', ttl: 240 },
])

interface QueryLog {
  id: number
  time: string
  domain: string
  type: string
  latency: number
  cached: boolean
  pending?: boolean
}

const queryLogs = ref<QueryLog[]>([
  { id: 1, time: '09:30:15', domain: 'api.github.com', type: 'A', latency: 18, cached: false },
  { id: 2, time: '09:30:14', domain: 'google.com', type: 'A', latency: 0, cached: true },
  { id: 3, time: '09:30:12', domain: 'cdn.apple.com', type: 'AAAA', latency: 22, cached: false },
  { id: 4, time: '09:30:10', domain: 'github.com', type: 'A', latency: 0, cached: true },
])

let logId = 5
let timer: ReturnType<typeof setInterval>
const domains = ['api.twitter.com', 'api.openai.com', 'cloudflare.com', 'example.com', 'api.stripe.com']

onMounted(() => {
  timer = setInterval(() => {
    const domain = domains[Math.floor(Math.random() * domains.length)]
    const cached = Math.random() > 0.6
    queryLogs.value.unshift({
      id: logId++,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      domain,
      type: 'A',
      latency: cached ? 0 : Math.floor(10 + Math.random() * 30),
      cached,
    })
    if (queryLogs.value.length > 50) queryLogs.value.pop()
    dnsStats.queries++
    if (cached) dnsStats.cacheHit++
  }, 1500)
})

onUnmounted(() => clearInterval(timer))

const flushCache = () => {
  dnsCache.value = []
  dnsStats.cacheSize = 0
}
</script>
