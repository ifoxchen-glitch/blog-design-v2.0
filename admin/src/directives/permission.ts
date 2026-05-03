import type { DirectiveBinding } from 'vue'
import { usePermissionStore } from '../stores/permission'

type PermissionValue = string | string[]

const removedNodes = new WeakMap<
  Element,
  { parent: ParentNode; next: Node | null }
>()

function hasPermission(value: PermissionValue): boolean {
  const perm = usePermissionStore()
  if (Array.isArray(value)) {
    return value.some((code) => perm.hasPermission(code))
  }
  return perm.hasPermission(value)
}

function remove(el: HTMLElement): void {
  if (!el.parentNode) return
  removedNodes.set(el, { parent: el.parentNode, next: el.nextSibling })
  el.remove()
}

function restore(el: HTMLElement): void {
  const info = removedNodes.get(el)
  if (!info) return
  info.parent.insertBefore(el, info.next)
  removedNodes.delete(el)
}

export const vPermission = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
    if (!hasPermission(binding.value)) {
      remove(el)
    }
  },
  updated(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
    const hasPerm = hasPermission(binding.value)
    const isRemoved = removedNodes.has(el)

    if (hasPerm && isRemoved) {
      restore(el)
    } else if (!hasPerm && !isRemoved) {
      remove(el)
    }
  },
}
