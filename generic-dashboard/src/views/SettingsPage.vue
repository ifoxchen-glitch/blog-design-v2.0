<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- General settings -->
      <CollapseCard title="通用设置" :default-open="true">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">系统代理</div>
              <div class="text-xs text-base-content/50 mt-1">修改系统网络代理设置</div>
            </div>
            <input type="checkbox" v-model="settings.systemProxy" class="toggle toggle-primary" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">TUN 模式</div>
              <div class="text-xs text-base-content/50 mt-1">透明代理，接管所有流量</div>
            </div>
            <input type="checkbox" v-model="settings.tunMode" class="toggle toggle-primary" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">开机自启</div>
              <div class="text-xs text-base-content/50 mt-1">系统启动时自动运行</div>
            </div>
            <input type="checkbox" v-model="settings.autoLaunch" class="toggle toggle-primary" />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">静默模式</div>
              <div class="text-xs text-base-content/50 mt-1">隐藏系统托盘图标</div>
            </div>
            <input type="checkbox" v-model="settings.silentMode" class="toggle toggle-primary" />
          </div>
        </div>
      </CollapseCard>

      <!-- Backend settings -->
      <CollapseCard title="后端设置" :default-open="true">
        <div class="space-y-3">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-sm">后端地址</span>
            </label>
            <input
              type="text"
              v-model="settings.backendUrl"
              class="input input-sm bg-base-200/30 w-full"
              placeholder="http://127.0.0.1:9090"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-sm">API 密钥</span>
            </label>
            <input
              type="password"
              v-model="settings.apiSecret"
              class="input input-sm bg-base-200/30 w-full"
              placeholder="可选"
            />
          </div>

          <div class="flex gap-2">
            <button class="btn btn-sm btn-primary" @click="testBackend">
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
            <button class="btn btn-sm btn-ghost bg-base-200/30" @click="reconnect">
              重连
            </button>
          </div>
        </div>
      </CollapseCard>

      <!-- Display settings -->
      <CollapseCard title="显示设置" :default-open="false">
        <div class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text text-sm">主题</span>
            </label>
            <select v-model="settings.theme" class="select select-sm bg-base-200/30 w-full">
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="auto">跟随系统</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-sm">语言</span>
            </label>
            <select v-model="settings.language" class="select select-sm bg-base-200/30 w-full">
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="en-US">English</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">显示延迟测试</div>
              <div class="text-xs text-base-content/50 mt-1">节点卡片显示延迟标签</div>
            </div>
            <input type="checkbox" v-model="settings.showLatency" class="toggle toggle-primary" />
          </div>
        </div>
      </CollapseCard>

      <!-- About -->
      <CollapseCard title="关于" :default-open="false">
        <div class="space-y-3">
          <InfoRow label="版本" value="v1.0.0" />
          <InfoRow label="内核" value="Mihomo v1.18.0" />
          <InfoRow label="协议" value="HTTP + WebSocket" />
          <div class="mt-4 flex gap-2">
            <a href="#" class="btn btn-sm btn-ghost bg-base-200/30">GitHub</a>
            <a href="#" class="btn btn-sm btn-ghost bg-base-200/30">文档</a>
            <button class="btn btn-sm btn-ghost bg-base-200/30" @click="checkUpdate">
              检查更新
            </button>
          </div>
        </div>
      </CollapseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import InfoRow from '@/components/common/InfoRow.vue'

const testing = ref(false)

const settings = reactive({
  systemProxy: true,
  tunMode: false,
  autoLaunch: true,
  silentMode: false,
  backendUrl: 'http://127.0.0.1:9090',
  apiSecret: '',
  theme: 'dark',
  language: 'zh-CN',
  showLatency: true,
})

const testBackend = async () => {
  testing.value = true
  await new Promise(r => setTimeout(r, 1500))
  testing.value = false
  // Simulate success
  alert('连接成功！')
}

const reconnect = () => {
  alert('已发送重连请求')
}

const checkUpdate = () => {
  alert('已是最新版本')
}
</script>
