<script setup lang="ts">
// Admin login page. Shape: NCard wrapping NForm with email + password +
// submit. On success, redirects to ?redirect or /dashboard via
// router.replace (so the login page doesn't sit in history). On failure,
// displays the server's message inline via NAlert; the form fields stay
// filled so the user can correct just the password.

import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NAlert,
  NButton,
  NCard,
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
  <div class="login-page">
    <NCard class="login-card" title="管理后台登录" :bordered="true">
      <NAlert
        v-if="errorMessage"
        type="error"
        :show-icon="false"
        class="login-alert"
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
    </NCard>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
}

.login-alert {
  margin-bottom: 16px;
}
</style>
