// Verifies the behavior of admin/src/api/request.ts:
// - Bearer header attached when an access token is present
// - 401 -> auto refresh -> retry once with new token
// - Refresh failure -> tokens cleared + onUnauthorized callback fires
// - Concurrent 401s share a single in-flight refresh
//
// Runs a tiny node:http mock that stands in for adminApp@3000, then drives
// the real createRequest/createMemoryTokenStore and asserts the observed
// effects (header values, hit counts, store state, callback count).
//
// Usage (from admin/):
//   npx tsx scripts/check-axios-request.ts

import http from 'node:http'
import { createRequest } from '../src/api/request'
import { createMemoryTokenStore } from '../src/api/tokenStorage'

const PORT = 33421
const BASE = `http://localhost:${PORT}`

interface ServerStats {
  authRequiredHits: number
  noAuthHits: number
  refreshHits: number
  lastAuthHeader: string | undefined
  lastRefreshBody: string | undefined
}

let stats: ServerStats = newStats()

function newStats(): ServerStats {
  return {
    authRequiredHits: 0,
    noAuthHits: 0,
    refreshHits: 0,
    lastAuthHeader: undefined,
    lastRefreshBody: undefined,
  }
}

function createMockServer() {
  return http.createServer((req, res) => {
    const url = req.url || ''
    res.setHeader('Content-Type', 'application/json')

    if (url === '/api/auth-required' && req.method === 'GET') {
      stats.authRequiredHits++
      stats.lastAuthHeader = req.headers.authorization
      const auth = req.headers.authorization
      if (auth === 'Bearer good-token' || auth === 'Bearer new-access') {
        res.statusCode = 200
        res.end(JSON.stringify({ code: 200, message: 'success', data: { ok: true } }))
      } else {
        res.statusCode = 401
        res.end(JSON.stringify({ code: 401, message: 'unauthorized' }))
      }
      return
    }

    if (url === '/api/no-auth' && req.method === 'GET') {
      stats.noAuthHits++
      stats.lastAuthHeader = req.headers.authorization
      res.statusCode = 200
      res.end(JSON.stringify({ code: 200, message: 'success', data: {} }))
      return
    }

    if (url === '/api/v2/auth/refresh' && req.method === 'POST') {
      stats.refreshHits++
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        stats.lastRefreshBody = body
        let parsed: { refreshToken?: string } = {}
        try {
          parsed = JSON.parse(body)
        } catch {
          // ignore
        }
        if (parsed.refreshToken === 'good-refresh') {
          res.statusCode = 200
          res.end(
            JSON.stringify({
              code: 200,
              message: 'success',
              data: { accessToken: 'new-access' },
            }),
          )
        } else {
          res.statusCode = 401
          res.end(JSON.stringify({ code: 401, message: 'invalid refresh' }))
        }
      })
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ code: 404, message: 'not found' }))
  })
}

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

async function run() {
  const server = createMockServer()
  await new Promise<void>((resolve) => server.listen(PORT, resolve))

  try {
    // === A: No token, public endpoint ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore()
      let unauthCalled = 0
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {
          unauthCalled++
        },
      })
      const res = await req.get('/api/no-auth')
      check('A1: no-token request reaches server', stats.noAuthHits === 1)
      check(
        'A2: no Authorization header sent',
        stats.lastAuthHeader === undefined,
        `got: ${stats.lastAuthHeader}`,
      )
      check('A3: response 200', res.status === 200)
      check('A4: onUnauthorized not called', unauthCalled === 0)
    }

    // === B: Valid token attached, no refresh needed ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore({ access: 'good-token' })
      let unauthCalled = 0
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {
          unauthCalled++
        },
      })
      const res = await req.get('/api/auth-required')
      check(
        'B1: Authorization header is "Bearer good-token"',
        stats.lastAuthHeader === 'Bearer good-token',
        `got: ${stats.lastAuthHeader}`,
      )
      check('B2: response 200', res.status === 200)
      check('B3: only one server hit', stats.authRequiredHits === 1)
      check('B4: no refresh attempted', stats.refreshHits === 0)
      check('B5: onUnauthorized not called', unauthCalled === 0)
    }

    // === C: 401 -> refresh -> retry succeeds ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore({
        access: 'bad-token',
        refresh: 'good-refresh',
      })
      let unauthCalled = 0
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {
          unauthCalled++
        },
      })
      const res = await req.get('/api/auth-required')
      check('C1: response 200 after refresh+retry', res.status === 200)
      check('C2: refresh hit exactly once', stats.refreshHits === 1)
      check(
        'C3: protected hit twice (original + retry)',
        stats.authRequiredHits === 2,
      )
      check(
        'C4: token store updated to new-access',
        tokenStore.getAccess() === 'new-access',
      )
      check(
        'C5: refresh token preserved',
        tokenStore.getRefresh() === 'good-refresh',
      )
      check(
        'C6: retry sent new Bearer token',
        stats.lastAuthHeader === 'Bearer new-access',
        `got: ${stats.lastAuthHeader}`,
      )
      check('C7: onUnauthorized not called', unauthCalled === 0)
    }

    // === D: 401 + bad refresh token -> failure path ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore({
        access: 'bad-token',
        refresh: 'bad-refresh',
      })
      let unauthCalled = 0
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {
          unauthCalled++
        },
      })
      let rejected = false
      try {
        await req.get('/api/auth-required')
      } catch {
        rejected = true
      }
      check('D1: request rejected', rejected)
      check('D2: refresh hit once', stats.refreshHits === 1)
      check(
        'D3: protected hit once (no retry)',
        stats.authRequiredHits === 1,
      )
      check(
        'D4: tokens cleared',
        tokenStore.getAccess() === null && tokenStore.getRefresh() === null,
      )
      check('D5: onUnauthorized called once', unauthCalled === 1)
    }

    // === E: 401 + no refresh token -> immediate failure ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore({
        access: 'bad-token',
        refresh: null,
      })
      let unauthCalled = 0
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {
          unauthCalled++
        },
      })
      let rejected = false
      try {
        await req.get('/api/auth-required')
      } catch {
        rejected = true
      }
      check('E1: request rejected', rejected)
      check('E2: no refresh attempted', stats.refreshHits === 0)
      check(
        'E3: protected hit once',
        stats.authRequiredHits === 1,
      )
      check(
        'E4: tokens cleared',
        tokenStore.getAccess() === null && tokenStore.getRefresh() === null,
      )
      check('E5: onUnauthorized called once', unauthCalled === 1)
    }

    // === F: After successful refresh, subsequent calls use new token directly ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore({
        access: 'bad-token',
        refresh: 'good-refresh',
      })
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {},
      })
      await req.get('/api/auth-required') // triggers refresh
      const r2 = await req.get('/api/auth-required') // uses new-access
      check('F1: second response 200', r2.status === 200)
      check('F2: still only 1 refresh hit', stats.refreshHits === 1)
      check(
        'F3: 3 protected hits (original + retry + fresh)',
        stats.authRequiredHits === 3,
      )
      check(
        'F4: last auth header is new-access',
        stats.lastAuthHeader === 'Bearer new-access',
      )
    }

    // === G: Concurrent 401s share a single refresh ===
    {
      stats = newStats()
      const tokenStore = createMemoryTokenStore({
        access: 'bad-token',
        refresh: 'good-refresh',
      })
      const req = createRequest({
        baseURL: BASE,
        tokenStore,
        onUnauthorized: () => {},
      })
      const [r1, r2, r3] = await Promise.all([
        req.get('/api/auth-required'),
        req.get('/api/auth-required'),
        req.get('/api/auth-required'),
      ])
      check(
        'G1: all 3 succeed',
        r1.status === 200 && r2.status === 200 && r3.status === 200,
      )
      check(
        'G2: refresh called exactly once',
        stats.refreshHits === 1,
        `got: ${stats.refreshHits}`,
      )
      check(
        'G3: protected hit 6 times (3 original + 3 retry)',
        stats.authRequiredHits === 6,
        `got: ${stats.authRequiredHits}`,
      )
    }
  } finally {
    server.close()
  }

  console.log('')
  console.log(
    pass
      ? 'PASS: axios request module behavior verified.'
      : 'FAIL: see [FAIL] entries above.',
  )
  process.exit(pass ? 0 : 1)
}

run().catch((err) => {
  console.error('UNEXPECTED ERROR:', err)
  process.exit(1)
})
