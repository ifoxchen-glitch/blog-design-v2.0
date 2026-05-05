import type { DirectiveBinding } from 'vue'
import { usePermissionStore } from '../stores/permission'

type PermissionValue = string | string[]

const HIDDEN_ATTR = 'data-permission-hidden'

function hasPermission(value: PermissionValue): boolean {
  const perm = usePermissionStore()
  if (Array.isArray(value)) {
    return value.some((code) => perm.hasPermission(code))
  }
  return perm.hasPermission(value)
}

function hide(el: HTMLElement): void {
  if (el.hasAttribute(HIDDEN_ATTR)) return
  const prev = el.style.display
  el.setAttribute(HIDDEN_ATTR, prev)
  el.style.display = 'none'
}

function show(el: HTMLElement): void {
  if (!el.hasAttribute(HIDDEN_ATTR)) return
  const prev = el.getAttribute(HIDDEN_ATTR) ?? ''
  el.style.display = prev
  el.removeAttribute(HIDDEN_ATTR)
}

export const vPermission = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
    if (!hasPermission(binding.value)) {
      hide(el)
    }
  },
  updated(el: HTMLElement, binding: DirectiveBinding<PermissionValue>) {
    const hasPerm = hasPermission(binding.value)
    const isHidden = el.hasAttribute(HIDDEN_ATTR)

    if (hasPerm && isHidden) {
      show(el)
    } else if (!hasPerm && !isHidden) {
      hide(el)
    }
  },
}
