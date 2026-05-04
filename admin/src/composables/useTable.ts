import { ref, reactive, watch, type Ref } from 'vue'

export interface PageQuery {
  page: number
  pageSize: number
}

export interface UseTableFetchResult<TRow> {
  list: TRow[]
  total: number
}

export interface UseTableOptions<TRow, TQuery extends object> {
  fetch: (
    params: TQuery & PageQuery,
  ) => Promise<UseTableFetchResult<TRow>>
  initialQuery?: TQuery
  pageSize?: number
  immediate?: boolean
}

export interface UseTableReturn<TRow, TQuery extends object> {
  data: Ref<TRow[]>
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  loading: Ref<boolean>
  error: Ref<Error | null>
  query: TQuery
  refresh(): Promise<void>
  reset(): Promise<void>
  handlePageChange(p: number): void
  handlePageSizeChange(s: number): void
}

export function useTable<TRow, TQuery extends object = Record<string, unknown>>(
  opts: UseTableOptions<TRow, TQuery>,
): UseTableReturn<TRow, TQuery> {
  const initialPageSize = opts.pageSize ?? 20
  const immediate = opts.immediate !== false
  const initialQuery = (opts.initialQuery ?? ({} as TQuery))

  const data = ref([]) as Ref<TRow[]>
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(initialPageSize)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const query = reactive<Record<string, unknown>>({
    ...(initialQuery as Record<string, unknown>),
  }) as TQuery

  let requestId = 0
  let suppressQueryWatch = false

  async function refresh(): Promise<void> {
    const myId = ++requestId
    loading.value = true
    error.value = null
    try {
      const params = {
        ...(query as object),
        page: page.value,
        pageSize: pageSize.value,
      } as TQuery & PageQuery

      const res = await opts.fetch(params)
      // Race guard: only the latest request applies its result.
      if (myId !== requestId) return

      data.value = res.list ?? []
      total.value = res.total ?? 0
    } catch (e) {
      if (myId !== requestId) return
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      if (myId === requestId) {
        loading.value = false
      }
    }
  }

  async function reset(): Promise<void> {
    suppressQueryWatch = true
    Object.keys(query as object).forEach((k) => {
      delete (query as Record<string, unknown>)[k]
    })
    Object.assign(query as object, initialQuery as object)
    page.value = 1
    pageSize.value = initialPageSize
    // Allow watchers to flush, then refresh once.
    await Promise.resolve()
    suppressQueryWatch = false
    await refresh()
  }

  function handlePageChange(p: number): void {
    page.value = p
  }

  function handlePageSizeChange(s: number): void {
    pageSize.value = s
    page.value = 1
  }

  // Pagination changes: refresh.
  watch([page, pageSize], () => {
    if (suppressQueryWatch) return
    void refresh()
  })

  // Query changes: reset to page 1, then refresh.
  watch(
    () => ({ ...(query as object) }),
    () => {
      if (suppressQueryWatch) return
      if (page.value !== 1) {
        // Setting page to 1 will trigger the pagination watcher above.
        page.value = 1
      } else {
        void refresh()
      }
    },
    { deep: true },
  )

  if (immediate) {
    void refresh()
  }

  return {
    data,
    total,
    page,
    pageSize,
    loading,
    error,
    query,
    refresh,
    reset,
    handlePageChange,
    handlePageSizeChange,
  }
}
