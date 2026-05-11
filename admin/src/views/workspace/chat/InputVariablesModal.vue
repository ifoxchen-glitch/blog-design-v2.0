<script setup lang="ts">
import { ref, computed } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton } from 'naive-ui'
import type { PromptTemplate } from '../../../api/kb'

const props = defineProps<{
  modelValue: boolean
  template: PromptTemplate | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'confirm', filledContent: string): void
}>()

const values = ref<Record<string, string>>({})

function initValues() {
  if (props.template) {
    const init: Record<string, string> = {}
    for (const v of props.template.variables) {
      init[v.name] = v.default ?? ''
    }
    values.value = init
  }
}

const canConfirm = computed(() => {
  if (!props.template) return false
  return props.template.variables.every(v => values.value[v.name]?.trim())
})

function handleConfirm() {
  if (!props.template || !canConfirm.value) return
  let content = props.template.content
  for (const [name, val] of Object.entries(values.value)) {
    content = content.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), val)
  }
  emit('confirm', content)
  emit('update:modelValue', false)
}
</script>

<template>
  <NModal
    :show="modelValue"
    preset="card"
    :title="template ? `填写变量: ${template.title}` : ''"
    style="width:440px"
    @update:show="(v) => emit('update:modelValue', v)"
    @after-enter="initValues"
  >
    <NForm v-if="template" label-placement="top">
      <NFormItem
        v-for="v in template.variables"
        :key="v.name"
        :label="v.label"
      >
        <NInput
          v-model:value="values[v.name]"
          :placeholder="`输入 ${v.label}…`"
          :type="v.name === 'code' || v.name === 'text' ? 'textarea' : 'text'"
          :rows="v.name === 'code' ? 5 : 2"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NButton @click="emit('update:modelValue', false)">取消</NButton>
        <NButton type="primary" :disabled="!canConfirm" @click="handleConfirm">
          确认发送
        </NButton>
      </div>
    </template>
  </NModal>
</template>
