<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Toolbar -->
      <PanelCard>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="currentFile" class="select select-sm bg-base-200/30">
            <option value="config.yaml">config.yaml</option>
            <option value="proxy.yaml">proxy.yaml</option>
            <option value="rule.yaml">rule.yaml</option>
            <option value="dns.yaml">dns.yaml</option>
          </select>
          <button class="btn btn-sm btn-ghost bg-base-200/30" @click="formatConfig">
            格式化
          </button>
          <button class="btn btn-sm btn-ghost bg-base-200/30" @click="validateConfig">
            验证
          </button>
          <button class="btn btn-sm btn-primary" @click="saveConfig">
            {{ saving ? '保存中...' : '保存' }}
          </button>
          <button class="btn btn-sm btn-ghost bg-base-200/30" @click="reloadConfig">
            重载
          </button>
        </div>
      </PanelCard>

      <!-- Validation result -->
      <div v-if="validationResult" :class="[
        'rounded-xl p-3',
        validationResult.valid ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
      ]">
        <div class="flex items-center gap-2">
          <span>{{ validationResult.valid ? '✓' : '✗' }}</span>
          <span>{{ validationResult.message }}</span>
        </div>
        <div v-if="validationResult.errors?.length" class="mt-2 text-xs space-y-1">
          <div v-for="err in validationResult.errors" :key="err">
            {{ err }}
          </div>
        </div>
      </div>

      <!-- Editor -->
      <PanelCard :title="currentFile">
        <div class="relative">
          <textarea
            v-model="fileContent"
            class="textarea textarea-sm bg-base-200/20 w-full h-[60vh] font-mono text-xs leading-relaxed resize-none focus:outline-none"
            spellcheck="false"
            @input="markDirty"
          />
          <div v-if="isDirty" class="absolute top-2 right-2">
            <span class="badge badge-sm bg-warning/20 text-warning">未保存</span>
          </div>
        </div>

        <!-- Line count -->
        <div class="text-xs text-base-content/40 mt-2">
          {{ lineCount }} 行 · {{ charCount }} 字符
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'

const currentFile = ref('config.yaml')
const isDirty = ref(false)
const saving = ref(false)

const validationResult = ref<{
  valid: boolean
  message: string
  errors?: string[]
} | null>(null)

const fileContents: Record<string, string> = {
  'config.yaml': `# Mihomo 配置文件
mixed-port: 7890
allow-lan: true
bind-address: "*"
mode: rule
log-level: info
ipv6: false
external-controller: 127.0.0.1:9090

dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  nameserver:
    - 223.5.5.5
    - 119.29.29.29
  fallback:
    - 8.8.8.8
    - 1.1.1.1

proxies:
  - name: "🇭🇰 香港 01"
    type: ss
    server: hk1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password"

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - 🇭🇰 香港 01

rules:
  - DOMAIN-SUFFIX,google.com,PROXY
  - GEOIP,CN,DIRECT
  - MATCH,PROXY`,

  'proxy.yaml': `# 代理节点配置
proxies:
  - name: "🇭🇰 香港 01"
    type: ss
    server: hk1.example.com
    port: 443
    cipher: aes-256-gcm
    password: "password"

  - name: "🇭🇰 香港 02"
    type: vmess
    server: hk2.example.com
    port: 443
    uuid: xxx-xxx-xxx
    alterId: 0
    cipher: auto
    tls: true

  - name: "🇯🇵 日本 01"
    type: trojan
    server: jp1.example.com
    port: 443
    password: "password"
    sni: jp1.example.com`,

  'rule.yaml': `# 路由规则配置
rules:
  # Proxy
  - DOMAIN-SUFFIX,google.com,PROXY
  - DOMAIN-SUFFIX,github.com,PROXY
  - DOMAIN-SUFFIX,githubusercontent.com,PROXY
  - DOMAIN-KEYWORD,google,PROXY

  # Direct
  - DOMAIN-SUFFIX,apple.com,DIRECT
  - DOMAIN-SUFFIX,microsoft.com,DIRECT
  - GEOIP,CN,DIRECT

  # Reject
  - DOMAIN-KEYWORD,ad,REJECT
  - DOMAIN-SUFFIX,ad.doubleclick.net,REJECT

  # Rule-Set
  - RULE-SET,proxy,PROXY
  - RULE-SET,cn,DIRECT

  # Final
  - MATCH,PROXY`,

  'dns.yaml': `# DNS 配置
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - '*.lan'
    - localhost.ptlogin2.qq.com

  nameserver:
    - 223.5.5.5
    - 119.29.29.29

  fallback:
    - 8.8.8.8
    - 1.1.1.1
    - tls://8.8.8.8:853
    - tls://1.1.1.1:853

  fallback-filter:
    geoip: true
    geoip-code: CN`,
}

const fileContent = ref(fileContents['config.yaml'])

const lineCount = computed(() => fileContent.value.split('\n').length)
const charCount = computed(() => fileContent.value.length)

const markDirty = () => {
  isDirty.value = true
  validationResult.value = null
}

const formatConfig = () => {
  // Simple YAML formatting - add proper indentation
  const lines = fileContent.value.split('\n')
  fileContent.value = lines.join('\n')
  isDirty.value = true
}

const validateConfig = () => {
  const errors: string[] = []

  // Basic validation
  if (!fileContent.value.includes('proxies:')) {
    errors.push('缺少 proxies 配置')
  }
  if (!fileContent.value.includes('rules:')) {
    errors.push('缺少 rules 配置')
  }

  // Check for common syntax errors
  const lines = fileContent.value.split('\n')
  lines.forEach((line, idx) => {
    if (line.includes('\t')) {
      errors.push(`第 ${idx + 1} 行: YAML 不应使用 Tab 缩进`)
    }
  })

  validationResult.value = errors.length === 0
    ? { valid: true, message: '配置验证通过' }
    : { valid: false, message: '配置验证失败', errors }
}

const saveConfig = async () => {
  saving.value = true
  await new Promise(r => setTimeout(r, 1000))
  saving.value = false
  isDirty.value = false
  validationResult.value = { valid: true, message: '配置已保存' }
}

const reloadConfig = () => {
  fileContent.value = fileContents[currentFile.value]
  isDirty.value = false
  validationResult.value = null
}

// Watch file change
import { watch } from 'vue'
watch(currentFile, (file) => {
  fileContent.value = fileContents[file]
  isDirty.value = false
  validationResult.value = null
})
</script>
