// Shared Axios instance + interceptors for the admin v2 SPA.
//
// Behavior:
// - Request: attach `Authorization: Bearer <accessToken>` if a token exists.
// - Response 401: try `POST /api/v2/auth/refresh` once. On success, replay the
//   original request with the new access token. On failure (no refresh
//   token, expired, server rejected), clear local tokens and invoke
//   `onUnauthorized` (default: redirect to /login).
// - Concurrent refreshes are de-duplicated: only one refresh request is in
//   flight at a time; queued retries share its result.
//
// `createRequest` is a factory so the verifier can plug in a memory token
// store, a mock baseURL, and a callback in place of `window.location`.

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import {
  tokenStorage as defaultTokenStorage,
  type TokenStore,
} from './tokenStorage'

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface RequestOptions {
  baseURL?: string
  timeout?: number
  tokenStore?: TokenStore
  onUnauthorized?: () => void
  refreshPath?: string
}

interface RetryConfig extends InternalAxiosRequestConfig {
  __isRetry?: boolean
}

export function createRequest(opts: RequestOptions = {}): AxiosInstance {
  const tokenStore = opts.tokenStore ?? defaultTokenStorage()
  const onUnauthorized =
    opts.onUnauthorized ??
    (() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    })
  const refreshPath = opts.refreshPath ?? '/api/v2/auth/refresh'
  const baseURL = opts.baseURL ?? '/'

  const instance = axios.create({
    baseURL,
    timeout: opts.timeout ?? 15000,
    headers: { 'Content-Type': 'application/json' },
  })

  let refreshPromise: Promise<string | null> | null = null

  function attemptRefresh(): Promise<string | null> {
    if (refreshPromise) return refreshPromise
    const p = (async (): Promise<string | null> => {
      const refreshToken = tokenStore.getRefresh()
      if (!refreshToken) return null
      try {
        const res = await axios.post<ApiResponse<{ accessToken: string }>>(
          `${baseURL.replace(/\/$/, '')}${refreshPath}`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        )
        const newToken = res.data?.data?.accessToken
        if (!newToken) return null
        tokenStore.setAccess(newToken)
        return newToken
      } catch {
        return null
      }
    })()
    refreshPromise = p
    p.finally(() => {
      if (refreshPromise === p) refreshPromise = null
    })
    return refreshPromise
  }

  function readBearer(headerValue: unknown): string | null {
    if (typeof headerValue !== 'string') return null
    return headerValue.startsWith('Bearer ') ? headerValue.slice(7) : null
  }

  instance.interceptors.request.use((config) => {
    const token = tokenStore.getAccess()
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const original = error.config as RetryConfig | undefined
      if (!original || error.response?.status !== 401) {
        return Promise.reject(error)
      }
      if (original.__isRetry) {
        tokenStore.clear()
        onUnauthorized()
        return Promise.reject(error)
      }
      // If a concurrent request already refreshed and the store now holds a
      // different access token than the one this request used, skip our own
      // refresh and just retry. Avoids triggering N refreshes when N
      // requests fail concurrently with the same expired token.
      const sentToken = readBearer(original.headers.get('Authorization'))
      const currentToken = tokenStore.getAccess()
      if (currentToken && sentToken && currentToken !== sentToken) {
        original.__isRetry = true
        return instance.request(original)
      }
      const newToken = await attemptRefresh()
      if (!newToken) {
        tokenStore.clear()
        onUnauthorized()
        return Promise.reject(error)
      }
      original.__isRetry = true
      return instance.request(original)
    },
  )

  return instance
}

export const request = createRequest()
