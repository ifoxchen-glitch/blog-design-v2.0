// Verifies useTable composable behavior.
//
// Usage (from admin/):
//   npx tsx scripts/check-use-table.ts

import { effectScope, nextTick } from 'vue'
import { useTable } from '../src/composables/useTable'

let pass = true
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? 'OK  ' : 'FAIL'
  console.log(`[${tag}] ${label}${detail ? '  -- ' + detail : ''}`)
  if (!ok) pass = false
}

interface Row {
  id: number
  name: string
}

interface Query {
  keyword?: string
  status?: string
}

function makeFetch(rows: Row[], delay = 0) {
  const counter = { calls: 0 }
  const fetcher = async (
    params: Query & { page: number; pageSize: number },
  ) => {
    counter.calls += 1
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    void params
    return { list: rows.map((r) => ({ ...r })), total: rows.length }
  }
  return { fetcher, counter }
}

async function flush() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

// === T1: immediate fetch on mount ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const rows: Row[] = [{ id: 1, name: 'a' }]
    const { fetcher, counter } = makeFetch(rows)
    const t = useTable<Row, Query>({ fetch: fetcher })
    await flush()
    check('T1: immediate=true triggers initial fetch', counter.calls === 1)
    check('T1: data populated', t.data.value.length === 1 && t.data.value[0].id === 1)
    check('T1: total set', t.total.value === 1)
    check('T1: loading false after settle', t.loading.value === false)
  })
  scope.stop()
}

// === T2: immediate=false skips initial fetch ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const { fetcher, counter } = makeFetch([])
    const t = useTable<Row, Query>({ fetch: fetcher, immediate: false })
    await flush()
    check('T2: immediate=false → no initial fetch', counter.calls === 0)
    void t
  })
  scope.stop()
}

// === T3: changing query resets page to 1 and refetches ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const { fetcher, counter } = makeFetch([{ id: 1, name: 'a' }])
    const t = useTable<Row, Query>({
      fetch: fetcher,
      initialQuery: {} as Query,
    })
    await flush()
    const initialCalls = counter.calls
    t.page.value = 3
    await flush()
    check('T3a: changing page triggered fetch', counter.calls === initialCalls + 1)
    check('T3a: page is 3', t.page.value === 3)

    t.query.keyword = 'hello'
    await flush()
    check('T3b: page reset to 1 after query change', t.page.value === 1)
    // page change to 1 may cascade an extra fetch; assert at least one new call.
    check('T3b: query change triggered refetch', counter.calls > initialCalls + 1)
  })
  scope.stop()
}

// === T4: changing page only does not touch query ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const { fetcher } = makeFetch([{ id: 1, name: 'a' }])
    const t = useTable<Row, Query>({
      fetch: fetcher,
      initialQuery: { keyword: 'foo' } as Query,
    })
    await flush()
    t.page.value = 2
    await flush()
    check('T4: page change keeps query.keyword', t.query.keyword === 'foo')
    check('T4: page is 2', t.page.value === 2)
  })
  scope.stop()
}

// === T5: race guard — slow first request, fast second wins ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const slowRows: Row[] = [{ id: 100, name: 'slow' }]
    const fastRows: Row[] = [{ id: 200, name: 'fast' }]

    let callIdx = 0
    const fetcher = async (params: Query & { page: number; pageSize: number }) => {
      const myCall = ++callIdx
      if (myCall === 1) {
        await new Promise((r) => setTimeout(r, 60))
        void params
        return { list: slowRows.map((r) => ({ ...r })), total: 1 }
      } else {
        await new Promise((r) => setTimeout(r, 5))
        void params
        return { list: fastRows.map((r) => ({ ...r })), total: 1 }
      }
    }

    const t = useTable<Row, Query>({ fetch: fetcher, immediate: false })

    // Fire request #1 (slow), then #2 (fast). Wait for slow to complete.
    const p1 = t.refresh()
    const p2 = t.refresh()
    await Promise.all([p1, p2])
    await flush()

    check('T5: race guard — final data is from latest request', t.data.value[0]?.id === 200)
  })
  scope.stop()
}

// === T6: handlePageChange / handlePageSizeChange ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const { fetcher } = makeFetch([])
    const t = useTable<Row, Query>({ fetch: fetcher, immediate: false })
    t.handlePageChange(5)
    check('T6a: handlePageChange sets page', t.page.value === 5)
    t.handlePageSizeChange(50)
    check('T6b: handlePageSizeChange sets pageSize', t.pageSize.value === 50)
    check('T6b: handlePageSizeChange resets page to 1', t.page.value === 1)
  })
  scope.stop()
}

// === T7: error handling ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const fetcher = async () => {
      throw new Error('boom')
    }
    const t = useTable<Row, Query>({
      fetch: fetcher as any,
      immediate: false,
    })
    await t.refresh()
    check('T7: error captured', t.error.value !== null && t.error.value.message === 'boom')
    check('T7: loading false after error', t.loading.value === false)
  })
  scope.stop()
}

// === T8: reset() restores query and page ===
{
  const scope = effectScope()
  await scope.run(async () => {
    const { fetcher } = makeFetch([])
    const t = useTable<Row, Query>({
      fetch: fetcher,
      initialQuery: { keyword: 'init' } as Query,
    })
    await flush()
    t.query.keyword = 'changed'
    t.page.value = 3
    await flush()
    await t.reset()
    await flush()
    check('T8: reset restored keyword', t.query.keyword === 'init')
    check('T8: reset page to 1', t.page.value === 1)
  })
  scope.stop()
}

console.log('')
console.log(
  pass
    ? 'PASS: useTable composable verified.'
    : 'FAIL: see [FAIL] entries above.',
)
process.exit(pass ? 0 : 1)
