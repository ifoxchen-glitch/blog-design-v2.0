// 权限下拉与树形数据,T2.23/T2.25 使用。
// 设计文档 §7.3

import { ref, computed, onMounted } from 'vue'
import { apiGetPermissions, type PermissionItem } from '../api/rbac'

export function usePermissionOptions(immediate = true) {
  const allPermissions = ref<PermissionItem[]>([])
  const loading = ref(false)

  // 扁平选项,key 用 code 字符串(适用于菜单管理的 permissionCode 下拉)
  const permissionOptions = computed(() =>
    allPermissions.value.map((p) => ({
      label: `${p.name} (${p.code})`,
      value: p.code,
    })),
  )

  // 资源去重列表(权限管理页的 resource 筛选下拉用)
  const resourceOptions = computed(() => {
    const set = new Set<string>()
    allPermissions.value.forEach((p) => set.add(p.resource))
    return Array.from(set).map((r) => ({ label: r, value: r }))
  })

  // 按 resource 分组的树形结构(角色管理页的权限勾选树用)
  // 父节点 key 用 `group-${resource}` 字符串,叶子用 permission id (number)。
  // n-tree 在 cascade 模式下,checked-keys 只返回叶子节点 id。
  interface PermissionTreeNode {
    key: string | number
    label: string
    children?: PermissionTreeNode[]
  }
  const permissionTree = computed<PermissionTreeNode[]>(() => {
    const groups = new Map<string, PermissionTreeNode>()
    for (const p of allPermissions.value) {
      let group = groups.get(p.resource)
      if (!group) {
        group = {
          key: `group-${p.resource}`,
          label: p.resource,
          children: [],
        }
        groups.set(p.resource, group)
      }
      group.children!.push({
        key: p.id,
        label: `${p.name} (${p.code})`,
      })
    }
    return Array.from(groups.values())
  })

  async function load(): Promise<void> {
    loading.value = true
    try {
      const res = await apiGetPermissions()
      allPermissions.value = res.items
    } finally {
      loading.value = false
    }
  }

  if (immediate) {
    onMounted(load)
  }

  return {
    allPermissions,
    permissionOptions,
    resourceOptions,
    permissionTree,
    loading,
    reload: load,
  }
}
