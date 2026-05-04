// 角色下拉选项,T2.22 用户编辑抽屉的"角色"字段使用。
// 设计文档 §7.2

import { ref, onMounted } from 'vue'
import { apiGetRoles, type RoleItem } from '../api/rbac'

export function useRoleOptions(immediate = true) {
  const roleOptions = ref<Array<{ label: string; value: number }>>([])
  const allRoles = ref<RoleItem[]>([])
  const loading = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      const res = await apiGetRoles()
      allRoles.value = res.items
      roleOptions.value = res.items
        .filter((r) => r.status === 'active')
        .map((r) => ({ label: r.name, value: r.id }))
    } finally {
      loading.value = false
    }
  }

  if (immediate) {
    onMounted(load)
  }

  return { roleOptions, allRoles, loading, reload: load }
}
