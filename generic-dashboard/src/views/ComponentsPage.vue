<template>
  <div class="p-4 space-y-6 pb-20">
    <h1 class="text-2xl font-bold mb-6">组件库</h1>

    <!-- Buttons -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Button 按钮</h2>
      <div class="flex flex-wrap gap-2">
        <Button label="Primary" variant="primary" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Accent" variant="accent" />
        <Button label="Ghost" variant="ghost" />
        <Button label="Outline" variant="outline" />
        <Button label="Error" variant="error" />
        <Button label="Success" variant="success" />
        <Button label="Loading" variant="primary" loading />
      </div>
    </section>

    <!-- Inputs -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Input 输入框</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input v-model="inputVal" label="文本输入" placeholder="请输入..." />
        <InputNumber v-model="numVal" label="数字输入" :min="0" :max="100" suffix="ms" />
      </div>
    </section>

    <!-- Select -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Select 选择器</h2>
      <div class="w-64">
        <Select v-model="selectVal" :options="selectOptions" label="选择选项" />
      </div>
    </section>

    <!-- DatePicker -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">DatePicker 日期选择</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DatePicker v-model="dateVal" label="选择日期" />
        <DateRangePicker v-model:start="startDate" v-model:end="endDate" label="日期范围" />
      </div>
    </section>

    <!-- ColorPicker -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">ColorPicker 颜色选择</h2>
      <div class="w-64">
        <ColorPicker v-model="colorVal" label="选择颜色" />
      </div>
    </section>

    <!-- Avatar -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Avatar 头像</h2>
      <div class="flex items-center gap-4">
        <Avatar size="xs" fallback="A" />
        <Avatar size="sm" fallback="B" />
        <Avatar size="md" fallback="CK" online />
        <Avatar size="lg" fallback="D" />
        <Avatar size="xl" src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" />
      </div>
    </section>

    <!-- StatusBadge -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">StatusBadge 状态徽章</h2>
      <div class="flex flex-wrap gap-2">
        <StatusBadge status="online" />
        <StatusBadge status="offline" />
        <StatusBadge status="warning" />
        <StatusBadge status="error" />
        <StatusBadge status="success" />
      </div>
    </section>

    <!-- Loading -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Loading 加载</h2>
      <div class="flex items-center gap-4">
        <Loading size="xs" />
        <Loading size="sm" />
        <Loading size="md" />
        <Loading size="lg" text="加载中..." />
      </div>
    </section>

    <!-- Empty -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Empty 空状态</h2>
      <Empty text="暂无数据" />
    </section>

    <!-- Pagination -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Pagination 分页</h2>
      <Pagination v-model="pageVal" :total="100" :page-size="10" show-info />
    </section>

    <!-- Cards -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Card 卡片</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="基础卡片">
          <p class="text-sm text-base-content/70">卡片内容区域</p>
        </Card>
        <Card title="可点击卡片" clickable @click="() => {}">
          <p class="text-sm text-base-content/70">点击我</p>
        </Card>
      </div>
    </section>

    <!-- PanelCard -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">PanelCard 面板卡片</h2>
      <PanelCard title="面板标题">
        <div class="space-y-2">
          <InfoRow label="连接数" value="1,234" />
          <InfoRow label="上传" value="12.5 MB/s" />
          <InfoRow label="下载" value="45.8 MB/s" />
        </div>
      </PanelCard>
    </section>

    <!-- CollapseCard -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">CollapseCard 折叠卡片</h2>
      <CollapseCard title="可折叠内容">
        <div class="space-y-2">
          <p class="text-sm">这是折叠卡片的内容。</p>
          <p class="text-sm">点击标题可以展开/折叠。</p>
        </div>
      </CollapseCard>
    </section>

    <!-- Charts -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Charts 图表</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="LineChart 折线图">
          <LineChart :data="lineData" :width="280" :height="150" />
        </Card>
        <Card title="AreaChart 面积图">
          <AreaChart :data="lineData" :width="280" :height="150" />
        </Card>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Card title="RadarChart 雷达图">
          <RadarChart :data="radarData" :width="250" :height="250" />
        </Card>
        <Card title="DonutChart 环形图">
          <DonutChart :data="donutData" :width="250" :height="200" />
        </Card>
      </div>
    </section>

    <!-- DataTable -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">DataTable 数据表格</h2>
      <DataTable :columns="tableColumns" :data="tableData" />
    </section>

    <!-- TagFilter -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">TagFilter 标签过滤</h2>
      <TagFilter v-model="tagVal" :tags="tagOptions" />
    </section>

    <!-- Modal Demo -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Modal 弹窗</h2>
      <Button label="打开弹窗" @click="modalOpen = true" />
      <Modal :open="modalOpen" title="弹窗标题" @close="modalOpen = false">
        <p class="text-sm">这是弹窗内容。</p>
        <template #action>
          <Button label="确定" variant="primary" size="sm" @click="modalOpen = false" />
        </template>
      </Modal>
    </section>

    <!-- Tooltip -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Tooltip 提示</h2>
      <div class="flex gap-4">
        <Tooltip content="顶部提示" position="top">
          <Button label="Top" variant="ghost" />
        </Tooltip>
        <Tooltip content="底部提示" position="bottom">
          <Button label="Bottom" variant="ghost" />
        </Tooltip>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Components
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import InputNumber from '@/components/common/InputNumber.vue'
import Select from '@/components/common/Select.vue'
import DatePicker from '@/components/data/DatePicker.vue'
import DateRangePicker from '@/components/data/DateRangePicker.vue'
import ColorPicker from '@/components/data/ColorPicker.vue'
import Avatar from '@/components/common/Avatar.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Loading from '@/components/common/Loading.vue'
import Empty from '@/components/common/Empty.vue'
import Pagination from '@/components/common/Pagination.vue'
import Card from '@/components/common/Card.vue'
import PanelCard from '@/components/common/PanelCard.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import InfoRow from '@/components/common/InfoRow.vue'
import LineChart from '@/components/charts/LineChart.vue'
import AreaChart from '@/components/charts/AreaChart.vue'
import RadarChart from '@/components/charts/RadarChart.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import DataTable from '@/components/data/DataTable.vue'
import TagFilter from '@/components/data/TagFilter.vue'
import Modal from '@/components/common/Modal.vue'
import Tooltip from '@/components/common/Tooltip.vue'

// Form values
const inputVal = ref('')
const numVal = ref(50)
const selectVal = ref('')
const dateVal = ref('')
const startDate = ref('')
const endDate = ref('')
const colorVal = ref('#64d2ff')
const pageVal = ref(1)
const modalOpen = ref(false)
const tagVal = ref<string[]>([])

const selectOptions = [
  { label: '选项一', value: '1' },
  { label: '选项二', value: '2' },
  { label: '选项三', value: '3' },
]

const tagOptions = ['全部', 'HTTP', 'SOCKS5', 'Shadowsocks', 'VMess', 'Trojan']

// Chart data
const lineData = [
  { name: 'Mon', value: 120 },
  { name: 'Tue', value: 200 },
  { name: 'Wed', value: 150 },
  { name: 'Thu', value: 280 },
  { name: 'Fri', value: 220 },
  { name: 'Sat', value: 180 },
  { name: 'Sun', value: 250 },
]

const radarData = [
  { name: '速度', value: 80 },
  { name: '稳定', value: 90 },
  { name: '延迟', value: 60 },
  { name: '带宽', value: 75 },
  { name: '安全', value: 85 },
]

const donutData = [
  { name: 'HTTP', value: 40 },
  { name: 'SOCKS5', value: 25 },
  { name: 'Shadowsocks', value: 20 },
  { name: 'VMess', value: 15 },
]

// Table
const tableColumns = [
  { key: 'name', title: '名称' },
  { key: 'type', title: '类型' },
  { key: 'latency', title: '延迟' },
  { key: 'status', title: '状态' },
]

const tableData = [
  { name: 'HK-01', type: 'VMess', latency: '45ms', status: 'online' },
  { name: 'JP-02', type: 'Shadowsocks', latency: '68ms', status: 'online' },
  { name: 'US-03', type: 'Trojan', latency: '120ms', status: 'offline' },
  { name: 'SG-04', type: 'HTTP', latency: '35ms', status: 'online' },
]
</script>