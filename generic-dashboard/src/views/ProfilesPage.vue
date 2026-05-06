<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Profile list -->
      <PanelCard>
        <div class="flex items-center gap-2">
          <button class="btn btn-sm btn-primary" @click="addProfile">
            <span class="mr-1">+</span> 新建
          </button>
          <button class="btn btn-sm btn-ghost bg-base-200/30" @click="importProfile">
            导入
          </button>
        </div>
      </PanelCard>

      <!-- Profiles -->
      <div class="space-y-3">
        <div
          v-for="profile in profiles"
          :key="profile.id"
          :class="[
            'bg-base-200/30 rounded-xl p-4 transition-all',
            profile.active ? 'ring-2 ring-primary' : ''
          ]"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ profile.icon }}</span>
                <span class="text-sm font-medium">{{ profile.name }}</span>
                <span v-if="profile.active" class="badge badge-sm badge-primary">当前</span>
              </div>
              <div class="text-xs text-base-content/50 mt-2 font-mono truncate">
                {{ profile.url || '本地配置' }}
              </div>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-xs text-base-content/40">
                  {{ profile.proxyCount }} 节点
                </span>
                <span class="text-xs text-base-content/40">
                  {{ profile.ruleCount }} 规则
                </span>
                <span class="text-xs text-base-content/40">
                  更新于 {{ profile.updatedAt }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button
                v-if="!profile.active"
                class="btn btn-xs btn-ghost"
                @click="activateProfile(profile)"
              >
                启用
              </button>
              <button
                v-if="profile.url"
                class="btn btn-xs btn-ghost"
                @click="updateProfile(profile)"
              >
                <span v-if="profile.updating" class="loading loading-xs"></span>
                <span v-else>更新</span>
              </button>
              <button class="btn btn-xs btn-ghost" @click="editProfile(profile)">
                编辑
              </button>
              <button
                v-if="!profile.active"
                class="btn btn-xs btn-ghost text-error"
                @click="deleteProfile(profile)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit modal -->
      <dialog ref="modalRef" class="modal">
        <div class="modal-box bg-base-200">
          <h3 class="font-bold text-lg mb-4">{{ editingProfile ? '编辑配置' : '新建配置' }}</h3>

          <div class="space-y-3">
            <div class="form-control">
              <label class="label">
                <span class="label-text text-sm">名称</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                class="input input-sm bg-base-200/30 w-full"
                placeholder="配置名称"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text text-sm">订阅地址</span>
              </label>
              <input
                v-model="form.url"
                type="text"
                class="input input-sm bg-base-200/30 w-full"
                placeholder="订阅链接（可选）"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text text-sm">更新间隔</span>
              </label>
              <select v-model="form.interval" class="select select-sm bg-base-200/30 w-full">
                <option value="0">手动更新</option>
                <option value="3600">每小时</option>
                <option value="86400">每天</option>
                <option value="604800">每周</option>
              </select>
            </div>
          </div>

          <div class="modal-action">
            <button class="btn btn-sm btn-ghost" @click="closeModal">取消</button>
            <button class="btn btn-sm btn-primary" @click="saveProfile">保存</button>
          </div>
        </div>
      </dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'

const modalRef = ref<HTMLDialogElement>()

interface Profile {
  id: number
  name: string
  icon: string
  url?: string
  active: boolean
  proxyCount: number
  ruleCount: number
  updatedAt: string
  interval?: number
  updating?: boolean
}

const profiles = ref<Profile[]>([
  {
    id: 1,
    name: '机场订阅',
    icon: '✈️',
    url: 'https://example.com/subscribe/xxx',
    active: true,
    proxyCount: 156,
    ruleCount: 5678,
    updatedAt: '2 小时前',
    interval: 86400,
  },
  {
    id: 2,
    name: '私人节点',
    icon: '🔐',
    url: 'https://my-server.com/config.yaml',
    active: false,
    proxyCount: 8,
    ruleCount: 234,
    updatedAt: '1 天前',
    interval: 0,
  },
  {
    id: 3,
    name: '本地配置',
    icon: '📁',
    active: false,
    proxyCount: 12,
    ruleCount: 1234,
    updatedAt: '3 天前',
  },
])

const editingProfile = ref<Profile | null>(null)

const form = reactive({
  name: '',
  url: '',
  interval: 86400,
})

const addProfile = () => {
  editingProfile.value = null
  form.name = ''
  form.url = ''
  form.interval = 86400
  modalRef.value?.showModal()
}

const editProfile = (profile: Profile) => {
  editingProfile.value = profile
  form.name = profile.name
  form.url = profile.url || ''
  form.interval = profile.interval || 0
  modalRef.value?.showModal()
}

const closeModal = () => {
  modalRef.value?.close()
}

const saveProfile = () => {
  if (editingProfile.value) {
    // Update existing
    Object.assign(editingProfile.value, {
      name: form.name,
      url: form.url || undefined,
      interval: form.interval,
    })
  } else {
    // Create new
    profiles.value.push({
      id: Date.now(),
      name: form.name,
      icon: '📄',
      url: form.url || undefined,
      active: false,
      proxyCount: 0,
      ruleCount: 0,
      updatedAt: '刚刚',
      interval: form.interval,
    })
  }
  closeModal()
}

const activateProfile = (profile: Profile) => {
  profiles.value.forEach(p => p.active = false)
  profile.active = true
}

const updateProfile = async (profile: Profile) => {
  profile.updating = true
  await new Promise(r => setTimeout(r, 2000))
  profile.updating = false
  profile.updatedAt = '刚刚'
}

const deleteProfile = (profile: Profile) => {
  profiles.value = profiles.value.filter(p => p.id !== profile.id)
}

const importProfile = () => {
  addProfile()
}
</script>
