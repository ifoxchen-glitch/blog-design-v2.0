<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NInput, NInputNumber, NModal, NForm, NFormItem, NPopconfirm, useMessage } from 'naive-ui'
import { AddOutline, TrashOutline, PencilOutline } from '@vicons/ionicons5'
import PageHeader from '../../components/common/PageHeader.vue'
import { apiListKbTasks, apiCreateKbTask, apiUpdateKbTask, apiDeleteKbTask, type KbTask } from '../../api/kb'

const message = useMessage()
const tasks = ref<KbTask[]>([])
const loading = ref(false)

const COLUMNS = [
  { key: 'todo', label: '待办', color: 'text-base-content/60' },
  { key: 'in_progress', label: '进行中', color: 'text-blue-500' },
  { key: 'done', label: '已完成', color: 'text-green-500' },
] as const

function tasksByStatus(status: string) {
  return tasks.value.filter(t => t.status === status)
}

const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ title: '', description: '', status: 'todo' as KbTask['status'], priority: 2 })
const formLoading = ref(false)

function openCreate(status?: KbTask['status']) {
  editingId.value = null
  form.value = { title: '', description: '', status: status || 'todo', priority: 2 }
  showModal.value = true
}

function openEdit(task: KbTask) {
  editingId.value = task.id
  form.value = { title: task.title, description: task.description || '', status: task.status, priority: task.priority }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.title.trim()) { message.warning('请输入标题'); return }
  formLoading.value = true
  try {
    if (editingId.value) {
      await apiUpdateKbTask(editingId.value, form.value)
      message.success('已更新')
    } else {
      await apiCreateKbTask(form.value)
      message.success('已创建')
    }
    showModal.value = false
    await loadTasks()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    formLoading.value = false
  }
}

async function handleDelete(id: number) {
  await apiDeleteKbTask(id)
  message.success('已删除')
  await loadTasks()
}

async function handleStatusChange(task: KbTask, newStatus: KbTask['status']) {
  await apiUpdateKbTask(task.id, { status: newStatus })
  await loadTasks()
}

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = await apiListKbTasks()
  } catch {
    message.error('加载任务失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadTasks)
</script>

<template>
  <div>
    <PageHeader title="看板工作室" subtitle="管理个人任务" />
    <div class="flex gap-4 overflow-hidden" style="height: calc(100vh - 220px)">
      <div
        v-for="col in COLUMNS"
        :key="col.key"
        class="flex-1 flex flex-col min-w-0"
      >
        <!-- Column header -->
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" :class="col.key === 'todo' ? 'bg-base-content/40' : col.key === 'in_progress' ? 'bg-blue-500' : 'bg-green-500'" />
            <span class="text-sm font-medium" :class="col.color">{{ col.label }}</span>
            <span class="text-xs text-base-content/30">({{ tasksByStatus(col.key).length }})</span>
          </div>
          <NButton size="tiny" quaternary @click="openCreate(col.key as KbTask['status'])">
            <AddOutline class="w-3.5 h-3.5" />
          </NButton>
        </div>

        <!-- Task cards -->
        <div class="flex-1 overflow-y-auto space-y-2 pr-1">
          <div
            v-for="task in tasksByStatus(col.key)"
            :key="task.id"
            class="bg-base-100 rounded-lg border border-base-content/10 p-3 hover:border-primary/30 transition-all group"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="text-sm flex-1">{{ task.title }}</div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <NButton size="tiny" quaternary class="!p-0.5" @click="openEdit(task)">
                  <PencilOutline class="w-3 h-3 text-base-content/40" />
                </NButton>
                <NPopconfirm @negative-click="handleDelete(task.id)">
                  <template #trigger>
                    <NButton size="tiny" quaternary class="!p-0.5">
                      <TrashOutline class="w-3 h-3 text-red-400" />
                    </NButton>
                  </template>
                  确认删除此任务？
                </NPopconfirm>
              </div>
            </div>
            <div v-if="task.description" class="text-xs text-base-content/40 mt-1 line-clamp-2">
              {{ task.description }}
            </div>
            <div class="flex items-center gap-2 mt-2">
              <template v-if="col.key === 'todo'">
                <button class="text-[10px] text-blue-400 hover:underline" @click="handleStatusChange(task, 'in_progress')">→ 进行中</button>
              </template>
              <template v-if="col.key === 'in_progress'">
                <button class="text-[10px] text-base-content/30 hover:underline" @click="handleStatusChange(task, 'todo')">← 待办</button>
                <button class="text-[10px] text-green-400 hover:underline" @click="handleStatusChange(task, 'done')">→ 完成</button>
              </template>
              <template v-if="col.key === 'done'">
                <button class="text-[10px] text-blue-400 hover:underline" @click="handleStatusChange(task, 'in_progress')">← 进行中</button>
              </template>
              <div class="flex-1" />
              <span v-if="task.priority === 1" class="text-[10px] px-1 py-0.5 rounded bg-red-50 text-red-500">高优</span>
            </div>
          </div>

          <div v-if="tasksByStatus(col.key).length === 0" class="text-center text-base-content/20 text-xs py-8">
            暂无任务
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit modal -->
    <NModal v-model:show="showModal" preset="card" :title="editingId ? '编辑任务' : '新建任务'" style="width:420px">
      <NForm :model="form" label-placement="top">
        <NFormItem label="标题" required>
          <NInput v-model:value="form.title" placeholder="任务标题" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="form.description" type="textarea" :rows="3" placeholder="可选描述" />
        </NFormItem>
        <div class="grid grid-cols-2 gap-4">
          <NFormItem label="状态">
            <NInput v-model:value="form.status" disabled />
          </NFormItem>
          <NFormItem label="优先级 (1=高, 2=中, 3=低)">
            <NInputNumber v-model:value="form.priority" :min="1" :max="3" />
          </NFormItem>
        </div>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" :loading="formLoading" @click="handleSave">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
