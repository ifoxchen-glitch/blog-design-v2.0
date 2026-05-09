<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Filter bar -->
      <PanelCard>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="ruleType" class="select select-sm bg-base-200/30">
            <option value="">全部类型</option>
            <option value="DOMAIN">DOMAIN</option>
            <option value="DOMAIN-SUFFIX">DOMAIN-SUFFIX</option>
            <option value="DOMAIN-KEYWORD">DOMAIN-KEYWORD</option>
            <option value="IP-CIDR">IP-CIDR</option>
            <option value="SRC-IP-CIDR">SRC-IP-CIDR</option>
            <option value="GEOIP">GEOIP</option>
            <option value="DST-PORT">DST-PORT</option>
            <option value="SRC-PORT">SRC-PORT</option>
            <option value="PROCESS-NAME">PROCESS-NAME</option>
            <option value="RULE-SET">RULE-SET</option>
            <option value="MATCH">MATCH</option>
          </select>
          <select v-model="rulePolicy" class="select select-sm bg-base-200/30">
            <option value="">全部策略</option>
            <option value="PROXY">PROXY</option>
            <option value="DIRECT">DIRECT</option>
            <option value="REJECT">REJECT</option>
          </select>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索规则..."
            class="input input-sm bg-base-200/30 flex-1 min-w-[200px]"
          />
        </div>
      </PanelCard>

      <!-- Rule stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-primary">{{ ruleCounts.total }}</div>
          <div class="text-xs text-base-content/50 mt-1">总规则</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-success">{{ ruleCounts.proxy }}</div>
          <div class="text-xs text-base-content/50 mt-1">PROXY</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-info">{{ ruleCounts.direct }}</div>
          <div class="text-xs text-base-content/50 mt-1">DIRECT</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-error">{{ ruleCounts.reject }}</div>
          <div class="text-xs text-base-content/50 mt-1">REJECT</div>
        </div>
      </div>

      <!-- Rule sets -->
      <CollapseCard title="规则集" :default-open="false">
        <div class="space-y-2">
          <div
            v-for="ruleSet in ruleSets"
            :key="ruleSet.name"
            class="bg-base-200/20 rounded-lg p-3"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">{{ ruleSet.name }}</div>
                <div class="text-xs text-base-content/50 mt-1">
                  {{ ruleSet.ruleCount }} 规则 · {{ ruleSet.type }}
                </div>
              </div>
              <StatusBadge :status="ruleSet.loaded ? 'success' : 'loading'" :text="ruleSet.loaded ? '已加载' : '加载中'" />
            </div>
          </div>
        </div>
      </CollapseCard>

      <!-- Rule list -->
      <PanelCard title="规则列表">
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr class="text-base-content/50">
                <th class="text-xs">#</th>
                <th class="text-xs">类型</th>
                <th class="text-xs">匹配</th>
                <th class="text-xs">策略</th>
                <th class="text-xs">命中</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(rule, idx) in filteredRules" :key="idx" class="hover:bg-base-200/20">
                <td class="text-xs text-base-content/40">{{ idx + 1 }}</td>
                <td>
                  <span class="badge badge-sm bg-base-200/50">{{ rule.type }}</span>
                </td>
                <td class="text-sm truncate max-w-[200px]">{{ rule.payload }}</td>
                <td>
                  <span :class="['badge badge-sm', policyBadgeClass(rule.policy)]">
                    {{ rule.proxy || rule.policy }}
                  </span>
                </td>
                <td class="text-xs text-base-content/40 tabular-nums">{{ rule.hits }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredRules.length === 0" class="text-center text-base-content/40 py-8">
          暂无规则
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

const ruleType = ref('')
const rulePolicy = ref('')
const searchQuery = ref('')

interface Rule {
  type: string
  payload: string
  policy: string
  proxy?: string
  hits: number
}

const rules = ref<Rule[]>([
  { type: 'DOMAIN-SUFFIX', payload: 'google.com', policy: 'PROXY', hits: 1523 },
  { type: 'DOMAIN-SUFFIX', payload: 'github.com', policy: 'PROXY', hits: 892 },
  { type: 'DOMAIN-SUFFIX', payload: 'githubusercontent.com', policy: 'PROXY', hits: 456 },
  { type: 'DOMAIN-KEYWORD', payload: 'google', policy: 'PROXY', hits: 2341 },
  { type: 'DOMAIN', payload: 'api.openai.com', policy: 'PROXY', proxy: '🇺🇸 美国 01', hits: 345 },
  { type: 'DOMAIN-SUFFIX', payload: 'openai.com', policy: 'PROXY', hits: 567 },
  { type: 'DOMAIN-SUFFIX', payload: 'anthropic.com', policy: 'PROXY', hits: 234 },
  { type: 'DOMAIN-SUFFIX', payload: 'cloudflare.com', policy: 'PROXY', hits: 1234 },
  { type: 'DOMAIN-SUFFIX', payload: 'apple.com', policy: 'DIRECT', hits: 5678 },
  { type: 'DOMAIN-SUFFIX', payload: 'icloud.com', policy: 'DIRECT', hits: 2345 },
  { type: 'DOMAIN-SUFFIX', payload: 'microsoft.com', policy: 'DIRECT', hits: 3456 },
  { type: 'IP-CIDR', payload: '192.168.0.0/16', policy: 'DIRECT', hits: 12345 },
  { type: 'IP-CIDR', payload: '10.0.0.0/8', policy: 'DIRECT', hits: 8765 },
  { type: 'IP-CIDR', payload: '172.16.0.0/12', policy: 'DIRECT', hits: 5432 },
  { type: 'GEOIP', payload: 'CN', policy: 'DIRECT', hits: 45678 },
  { type: 'DOMAIN-KEYWORD', payload: 'ad', policy: 'REJECT', hits: 987 },
  { type: 'DOMAIN-SUFFIX', payload: 'ad.doubleclick.net', policy: 'REJECT', hits: 654 },
  { type: 'RULE-SET', payload: 'proxy', policy: 'PROXY', hits: 12345 },
  { type: 'RULE-SET', payload: 'cn', policy: 'DIRECT', hits: 23456 },
  { type: 'MATCH', payload: '*', policy: 'PROXY', hits: 567 },
])

const ruleSets = ref([
  { name: 'proxy', type: 'http', ruleCount: 5678, loaded: true },
  { name: 'cn', type: 'http', ruleCount: 12345, loaded: true },
  { name: 'cncidr', type: 'http', ruleCount: 3456, loaded: true },
  { name: 'private', type: 'http', ruleCount: 234, loaded: true },
  { name: 'reject', type: 'http', ruleCount: 890, loaded: true },
])

const filteredRules = computed(() => {
  return rules.value.filter(rule => {
    const matchType = !ruleType.value || rule.type === ruleType.value
    const matchPolicy = !rulePolicy.value || rule.policy === rulePolicy.value
    const matchSearch = !searchQuery.value ||
      rule.payload.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchType && matchPolicy && matchSearch
  })
})

const ruleCounts = computed(() => ({
  total: rules.value.length,
  proxy: rules.value.filter(r => r.policy === 'PROXY').length,
  direct: rules.value.filter(r => r.policy === 'DIRECT').length,
  reject: rules.value.filter(r => r.policy === 'REJECT').length,
}))

const policyBadgeClass = (policy: string) => {
  switch (policy) {
    case 'PROXY': return 'bg-primary/20 text-primary'
    case 'DIRECT': return 'bg-success/20 text-success'
    case 'REJECT': return 'bg-error/20 text-error'
    default: return 'bg-base-200/50'
  }
}
</script>
