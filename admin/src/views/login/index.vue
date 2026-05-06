<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NInput,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { useAuthStore } from '../../stores/auth'
import { extractErrorMessage, resolveRedirect } from './loginLogic'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const errorMessage = ref('')

const form = reactive({
  email: '',
  password: '',
})

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: ['blur', 'input'] },
    { type: 'email', message: '请输入合法的邮箱地址', trigger: ['blur'] },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: ['blur', 'input'] },
    { min: 6, message: '密码至少 6 位', trigger: ['blur'] },
  ],
}

async function handleSubmit(): Promise<void> {
  if (loading.value) return
  errorMessage.value = ''
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    await authStore.login(form.email.trim(), form.password)
    const target = resolveRedirect(route.query)
    await router.replace(target)
  } catch (err) {
    errorMessage.value = extractErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-svh flex items-center justify-center p-6">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="flex items-center justify-center gap-3 mb-8">
        <svg class="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
        <span class="text-xl font-semibold tracking-tight">Blog Admin</span>
      </div>

      <!-- Card -->
      <div class="bg-base-100 rounded-2xl border border-base-content/5 p-6 md:p-8">
        <div class="text-center mb-6">
          <h1 class="text-lg font-semibold">管理后台登录</h1>
          <p class="text-sm text-base-content/50 mt-1">请输入账号密码继续</p>
        </div>

        <NAlert
          v-if="errorMessage"
          type="error"
          :show-icon="false"
          class="mb-4"
        >
          {{ errorMessage }}
        </NAlert>

        <NForm
          ref="formRef"
          :model="form"
          :rules="rules"
          label-placement="top"
          :show-require-mark="false"
          @keyup.enter="handleSubmit"
        >
          <NFormItem label="邮箱" path="email">
            <NInput
              v-model:value="form.email"
              placeholder="admin@example.com"
              :disabled="loading"
              autocomplete="username"
            />
          </NFormItem>
          <NFormItem label="密码" path="password">
            <NInput
              v-model:value="form.password"
              type="password"
              show-password-on="click"
              placeholder="请输入密码"
              :disabled="loading"
              autocomplete="current-password"
            />
          </NFormItem>
          <NButton
            type="primary"
            block
            :loading="loading"
            :disabled="loading"
            @click="handleSubmit"
          >
            登录
          </NButton>
        </NForm>
      </div>
    </div>
  </div>
</template>
