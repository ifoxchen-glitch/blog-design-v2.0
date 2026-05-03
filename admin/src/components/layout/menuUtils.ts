import type { MenuOption } from 'naive-ui'
import type { MenuNode } from '../../api/auth'

export function buildOptions(nodes: MenuNode[]): MenuOption[] {
  return nodes.map((n) => ({
    label: n.name,
    key: n.path ?? String(n.id),
    icon: undefined,
    children: n.children?.length ? buildOptions(n.children) : undefined,
  }))
}

export function findActiveKey(options: MenuOption[], path: string): string | null {
  for (const opt of options) {
    const key = String(opt.key)
    if (path === key || path.startsWith(key + '/')) {
      const child = opt.children ? findActiveKey(opt.children, path) : null
      return child ?? key
    }
  }
  return null
}
