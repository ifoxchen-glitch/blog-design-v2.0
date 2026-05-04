<script setup lang="ts">
/**
 * 通用表单抽屉。
 *
 * 用法:
 * - 创建/编辑共用同一抽屉,父组件按 mode 控制 title 与初始值。
 * - <slot /> 放 NForm 主体。
 * - <slot name="footer" /> 自定义底部按钮(默认提供取消/确定)。
 * - 父组件监听 @submit 触发实际接口;成功后再 update:show=false。
 *
 * @example
 *   <FormDrawer v-model:show="open" title="新建用户" :loading="saving" @submit="handleSave">
 *     <NForm ...>...</NForm>
 *   </FormDrawer>
 */
import {
  NDrawer,
  NDrawerContent,
  NSpace,
  NButton,
} from 'naive-ui'

interface Props {
  show: boolean
  title: string
  width?: number | string
  loading?: boolean
  submitText?: string
  cancelText?: string
  closeOnConfirm?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 480,
  loading: false,
  submitText: '确定',
  cancelText: '取消',
  closeOnConfirm: false,
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

function handleCancel() {
  emit('cancel')
  emit('update:show', false)
}

function handleSubmit() {
  emit('submit')
  if (props.closeOnConfirm) {
    emit('update:show', false)
  }
}

function handleUpdateShow(value: boolean) {
  emit('update:show', value)
}
</script>

<template>
  <NDrawer
    :show="props.show"
    :width="props.width"
    placement="right"
    @update:show="handleUpdateShow"
  >
    <NDrawerContent :title="props.title" closable>
      <div class="form-drawer-body">
        <slot />
      </div>

      <template #footer>
        <slot name="footer" :submit="handleSubmit" :cancel="handleCancel" :loading="props.loading">
          <NSpace>
            <NButton @click="handleCancel">{{ props.cancelText }}</NButton>
            <NButton
              type="primary"
              :loading="props.loading"
              :disabled="props.loading"
              @click="handleSubmit"
            >
              {{ props.submitText }}
            </NButton>
          </NSpace>
        </slot>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.form-drawer-body {
  padding-bottom: 8px;
}
</style>
