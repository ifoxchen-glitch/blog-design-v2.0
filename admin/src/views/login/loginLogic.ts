// Pure helpers for views/login/index.vue. Kept separate so the SFC stays
// small and the decision logic is unit-testable without a DOM.
//
// extractErrorMessage(err): turn whatever was thrown by authStore.login()
//   into a human-readable string. Priority:
//     1. AxiosError-shaped: err.response.data.message (server's own copy)
//     2. AxiosError-shaped, 401 with no message: '邮箱或密码错误'
//     3. AxiosError-shaped, network failure / no response: '网络异常,请稍后重试'
//     4. Error.message
//     5. Fallback: '登录失败,请重试'
//
// resolveRedirect(query): pick the post-login destination. Trusts an
// in-app redirect param (anything starting with '/') and ignores absolute
// URLs to avoid open-redirect to attacker-controlled hosts. Defaults to
// '/dashboard' (T1.23 will register that route).

import type { LocationQuery } from 'vue-router'

interface AxiosLikeError {
  response?: {
    status?: number
    data?: { message?: unknown } | null
  }
  message?: string
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function extractErrorMessage(err: unknown): string {
  if (isObject(err)) {
    const e = err as AxiosLikeError
    const data = e.response?.data
    if (isObject(data) && typeof data.message === 'string' && data.message.trim()) {
      return data.message
    }
    if (e.response?.status === 401) {
      return '邮箱或密码错误'
    }
    if (e.response === undefined && typeof e.message === 'string' && e.message) {
      // No response object at all = network/timeout (axios sets err.message
      // but err.response is undefined).
      return '网络异常,请稍后重试'
    }
    if (typeof e.message === 'string' && e.message.trim()) {
      return e.message
    }
  }
  return '登录失败,请重试'
}

export function resolveRedirect(query: LocationQuery | Record<string, unknown>): string {
  const raw = (query as Record<string, unknown>).redirect
  if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/dashboard'
}
