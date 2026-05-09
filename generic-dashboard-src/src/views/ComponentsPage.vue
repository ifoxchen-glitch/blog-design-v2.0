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

    <!-- Badge -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Badge 徽章</h2>
      <div class="flex flex-wrap gap-2">
        <Badge variant="primary">Primary</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="error">Error</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="primary" outline>Outline</Badge>
      </div>
    </section>

    <!-- Alert -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Alert 警告提示</h2>
      <div class="space-y-2">
        <Alert variant="success">操作成功完成！</Alert>
        <Alert variant="warning">请注意检查配置。</Alert>
        <Alert variant="error">发生错误，请重试。</Alert>
        <Alert variant="info">这是一条提示信息。</Alert>
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

    <!-- Skeleton -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Skeleton 骨架屏</h2>
      <div class="space-y-2">
        <Skeleton width="200px" />
        <Skeleton width="300px" height="20px" />
        <Skeleton width="100px" height="100px" variant="circular" />
        <Skeleton width="100%" height="60px" variant="rectangular" />
      </div>
    </section>

    <!-- Empty -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Empty 空状态</h2>
      <Empty text="暂无数据" />
    </section>

    <!-- Switch & Checkbox & Radio -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Switch / Checkbox / Radio</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Switch 开关</h3>
          <div class="flex items-center gap-2">
            <Switch v-model="switchVal" />
            <span class="text-sm">{{ switchVal ? '开启' : '关闭' }}</span>
          </div>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Checkbox 复选框</h3>
          <Checkbox v-model="checkboxVal" label="选项 A" />
          <Checkbox v-model="checkboxVal2" label="选项 B" variant="success" />
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Radio 单选框</h3>
          <Radio v-model="radioVal" :options="radioOptions" name="demo" />
        </div>
      </div>
    </section>

    <!-- Slider & Rate -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Slider 滑块 / Rate 评分</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Slider</h3>
          <Slider v-model="sliderVal" />
          <p class="text-sm text-base-content/60">值: {{ sliderVal }}</p>
        </div>
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Rate</h3>
          <Rate v-model="rateVal" />
          <p class="text-sm text-base-content/60">评分: {{ rateVal }} 星</p>
        </div>
      </div>
    </section>

    <!-- Progress -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Progress 进度环</h2>
      <div class="flex items-center gap-4">
        <Progress :percent="25" variant="primary" />
        <Progress :percent="50" variant="success" />
        <Progress :percent="75" variant="warning" />
        <Progress :percent="100" variant="error" />
      </div>
    </section>

    <!-- Statistic -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Statistic 统计数值</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Statistic title="总连接数" value="1,234" description="较昨日 +12%" />
        <Statistic title="活跃用户" value="892" description="占总数 72%" variant="success" />
        <Statistic title="流量使用" value="45.8 GB" variant="info" />
        <Statistic title="错误数" value="23" variant="error" />
      </div>
    </section>

    <!-- Steps -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Steps 步骤条</h2>
      <Steps :steps="steps" :current-step="currentStep" />
      <div class="flex gap-2 mt-4">
        <Button label="上一步" size="sm" variant="outline" @click="currentStep = Math.max(1, currentStep - 1)" />
        <Button label="下一步" size="sm" @click="currentStep = Math.min(steps.length, currentStep + 1)" />
      </div>
    </section>

    <!-- Timeline -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Timeline 时间线</h2>
      <Timeline :items="timelineItems" variant="primary" />
    </section>

    <!-- Breadcrumb -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Breadcrumb 面包屑</h2>
      <Breadcrumb :items="breadcrumbItems" />
    </section>

    <!-- Dropdown -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Dropdown 下拉菜单</h2>
      <div class="flex gap-4">
        <Dropdown label="Click Trigger">
          <ul class="menu bg-base-100 rounded-box w-52 p-2 shadow">
            <li><a>选项一</a></li>
            <li><a>选项二</a></li>
            <li><a>选项三</a></li>
          </ul>
        </Dropdown>
        <Dropdown label="Hover Trigger" trigger="hover">
          <ul class="menu bg-base-100 rounded-box w-52 p-2 shadow">
            <li><a>操作 A</a></li>
            <li><a>操作 B</a></li>
          </ul>
        </Dropdown>
      </div>
    </section>

    <!-- Popover -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Popover 气泡卡片</h2>
      <div class="flex gap-4">
        <Popover>
          <template #trigger>
            <Button label="Hover Me" variant="outline" />
          </template>
          <div class="text-sm">
            <p class="font-semibold mb-1">气泡标题</p>
            <p>这是气泡卡片的内容区域。</p>
          </div>
        </Popover>
      </div>
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

    <!-- Drawer Demo -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Drawer 抽屉</h2>
      <div class="flex gap-2">
        <Button label="右侧抽屉" @click="drawerRight = true" />
        <Button label="左侧抽屉" variant="outline" @click="drawerLeft = true" />
      </div>
      <Drawer v-model="drawerRight" title="右侧抽屉" placement="right">
        <p class="text-sm">这是右侧抽屉的内容。</p>
      </Drawer>
      <Drawer v-model="drawerLeft" title="左侧抽屉" placement="left" size="sm">
        <p class="text-sm">这是左侧抽屉的内容。</p>
      </Drawer>
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

    <!-- Upload -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Upload 文件上传</h2>
      <Upload v-model="uploadFiles" hint="支持 jpg, png, pdf 格式" />
    </section>

    <!-- QRCode -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">QRCode 二维码</h2>
      <QRCode value="https://example.com" :size="150" />
    </section>

    <!-- Carousel -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Carousel 轮播图</h2>
      <Carousel :items="carouselItems" height="12rem" />
    </section>

    <!-- Calendar -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Calendar 日历</h2>
      <Card>
        <Calendar v-model="calendarDate" :events="calendarEvents" />
      </Card>
    </section>

    <!-- Transfer -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Transfer 穿梭框</h2>
      <Transfer v-model="transferItems" :source-items="transferSource" />
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
          <DonutChart :segments="donutData" :size="160" />
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

    <!-- Pagination -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Pagination 分页</h2>
      <Pagination v-model="pageVal" :total="100" :page-size="10" show-info />
    </section>

    <!-- Textarea -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Textarea 多行文本</h2>
      <Textarea v-model="textareaVal" label="备注" placeholder="请输入多行文本..." :rows="4" :max-length="200" hint="最多200字符" />
    </section>

    <!-- TimePicker -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">TimePicker 时间选择</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TimePicker v-model="timeVal" label="选择时间" />
        <TimePicker v-model="timeValSec" label="选择时间（含秒）" :show-second="true" />
      </div>
    </section>

    <!-- ColorTag -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">ColorTag 彩色标签</h2>
      <div class="flex flex-wrap gap-2">
        <ColorTag label="Primary" color="primary" />
        <ColorTag label="Success" color="success" pill />
        <ColorTag label="Warning" color="warning" size="sm" />
        <ColorTag label="Error" color="error" outline />
        <ColorTag label="Info" color="info" />
        <ColorTag label="Ghost" color="ghost" />
        <ColorTag label="#FF6B6B" :bg="'#FF6B6B'" text="white" />
      </div>
    </section>

    <!-- Tabs -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Tabs 标签页</h2>
      <Tabs v-model="activeTab" :tabs="tabOptions" />
      <div class="mt-2 text-sm text-base-content/60">当前: {{ activeTab }}</div>
    </section>

    <!-- Notification -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Notification 通知</h2>
      <div class="flex flex-wrap gap-2">
        <Button label="成功通知" variant="success" size="sm" @click="showNotif('success')" />
        <Button label="错误通知" variant="error" size="sm" @click="showNotif('error')" />
        <Button label="警告通知" variant="warning" size="sm" @click="showNotif('warning')" />
        <Button label="提示通知" variant="outline" size="sm" @click="showNotif('info')" />
      </div>
    </section>

    <!-- Divider -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Divider 分隔线</h2>
      <div class="space-y-4">
        <Divider />
        <Divider with-text text="分隔" />
        <Divider position="left" with-text text="左侧对齐" color="primary" />
        <Divider dashed with-text text="虚线分隔" />
      </div>
    </section>

    <!-- Space -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Space 间距</h2>
      <Space :size="'md'" wrap align="center">
        <Button label="按钮1" size="sm" />
        <Button label="按钮2" size="sm" />
        <Button label="按钮3" size="sm" />
        <Button label="按钮4" size="sm" />
        <Button label="按钮5" size="sm" />
      </Space>
    </section>

    <!-- TagInput -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">TagInput 标签输入</h2>
      <div class="max-w-md">
        <TagInput v-model="tagInputVal" label="添加标签" placeholder="输入后按回车添加标签" :max-tags="5" />
      </div>
    </section>

    <!-- Countdown -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Countdown 倒计时</h2>
      <div class="flex items-center gap-6">
        <div class="text-center">
          <p class="text-xs opacity-60 mb-1">标准</p>
          <Countdown :target-time="targetTime" />
        </div>
        <div class="text-center">
          <p class="text-xs opacity-60 mb-1">大号+毫秒</p>
          <Countdown :target-time="targetTime" size="xl" />
        </div>
        <div class="text-center">
          <p class="text-xs opacity-60 mb-1">带天数</p>
          <Countdown :target-time="targetTimeFar" size="lg" :show-days="true" />
        </div>
      </div>
    </section>

    <!-- ContextMenu -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">ContextMenu 右键菜单</h2>
      <div class="p-4 bg-base-200/50 rounded-lg text-center text-sm text-base-content/60">
        在此区域<strong>右键点击</strong>查看右键菜单
      </div>
      <ContextMenu ref="ctxMenu" :items="ctxItems" @close="ctxVisible = false" />
    </section>

    <!-- Scrollbar -->
    <section class="space-y-3">
      <h2 class="text-lg font-medium text-base-content/70">Scrollbar 自定义滚动条</h2>
      <Scrollbar direction="horizontal" style="max-width: 400px">
        <div class="flex gap-2 p-1" style="width: 800px">
          <div v-for="n in 8" :key="n" class="card w-32 bg-base-200 p-3 flex-shrink-0">
            <div class="text-sm font-medium">卡片 {{ n }}</div>
            <div class="text-xs opacity-60">这是内容区域</div>
          </div>
        </div>
      </Scrollbar>
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
import Badge from '@/components/common/Badge.vue'
import Alert from '@/components/common/Alert.vue'
import Loading from '@/components/common/Loading.vue'
import Skeleton from '@/components/common/Skeleton.vue'
import Empty from '@/components/common/Empty.vue'
import Switch from '@/components/common/Switch.vue'
import Checkbox from '@/components/common/Checkbox.vue'
import Radio from '@/components/common/Radio.vue'
import Slider from '@/components/data/Slider.vue'
import Rate from '@/components/data/Rate.vue'
import Progress from '@/components/data/Progress.vue'
import Statistic from '@/components/data/Statistic.vue'
import Steps from '@/components/data/Steps.vue'
import Timeline from '@/components/data/Timeline.vue'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import Dropdown from '@/components/common/Dropdown.vue'
import Popover from '@/components/common/Popover.vue'
import Modal from '@/components/common/Modal.vue'
import Drawer from '@/components/common/Drawer.vue'
import Tooltip from '@/components/common/Tooltip.vue'
import Upload from '@/components/data/Upload.vue'
import QRCode from '@/components/data/QRCode.vue'
import Carousel from '@/components/common/Carousel.vue'
import Calendar from '@/components/data/Calendar.vue'
import Transfer from '@/components/data/Transfer.vue'
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
import Textarea from '@/components/common/Textarea.vue'
import TimePicker from '@/components/common/TimePicker.vue'
import ColorTag from '@/components/common/ColorTag.vue'
import Tabs from '@/components/common/Tabs.vue'
import Notification from '@/components/common/Notification.vue'
import Divider from '@/components/common/Divider.vue'
import Space from '@/components/common/Space.vue'
import TagInput from '@/components/data/TagInput.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import Countdown from '@/components/common/Countdown.vue'
import Scrollbar from '@/components/layout/Scrollbar.vue'

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
const drawerRight = ref(false)
const drawerLeft = ref(false)
const tagVal = ref<string[]>([])
const switchVal = ref(false)
const checkboxVal = ref(true)
const checkboxVal2 = ref(false)
const radioVal = ref('1')
const sliderVal = ref(50)
const rateVal = ref(3)
const currentStep = ref(2)
const uploadFiles = ref<File[]>([])
const calendarDate = ref(new Date())
const transferItems = ref<(string | number)[]>(['1', '3'])
const textareaVal = ref('')
const timeVal = ref('14:30')
const timeValSec = ref('23:59:59')
const activeTab = ref('tab1')
const tagInputVal = ref<string[]>(['Vue', 'TypeScript'])
const ctxVisible = ref(false)
const ctxMenu = ref()
const ctxItems = [
  { label: '复制', shortcut: 'Ctrl+C', action: () => {} },
  { label: '粘贴', shortcut: 'Ctrl+V', action: () => {} },
  { type: 'separator' as const },
  { label: '删除', shortcut: 'Del', action: () => {} },
]
const tabOptions = [
  { label: '概览', value: 'tab1' },
  { label: '详情', value: 'tab2' },
  { label: '设置', value: 'tab3' },
]
const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
const targetTimeFar = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString()

function showNotif(type: 'success' | 'error' | 'warning' | 'info') {
  const msg: Record<string, { title: string; message: string }> = {
    success: { title: '操作成功', message: '任务已成功完成！' },
    error: { title: '操作失败', message: '发生错误，请重试。' },
    warning: { title: '注意', message: '请检查输入是否正确。' },
    info: { title: '提示', message: '这是一条信息提示。' },
  }
  Notification({
    message: msg[type].message,
    title: msg[type].title,
    type,
    duration: 3000,
  })
}

const selectOptions = [
  { label: '选项一', value: '1' },
  { label: '选项二', value: '2' },
  { label: '选项三', value: '3' },
]

const radioOptions = [
  { label: '选项 A', value: '1' },
  { label: '选项 B', value: '2' },
  { label: '选项 C', value: '3' },
]

const tagOptions = ['全部', 'HTTP', 'SOCKS5', 'Shadowsocks', 'VMess', 'Trojan']

const steps = [
  { title: '选择配置', description: '选择代理配置' },
  { title: '确认信息', description: '确认配置信息' },
  { title: '完成设置', description: '设置完成' },
]

const timelineItems = [
  { title: '创建项目', description: '初始化项目结构', time: '2024-01-01 10:00' },
  { title: '开发阶段', description: '实现核心功能', time: '2024-01-02 14:30' },
  { title: '测试上线', description: '部署到生产环境', time: '2024-01-03 09:00' },
]

const breadcrumbItems = [
  { label: '首页', href: '/' },
  { label: '组件库', href: '/components' },
  { label: '当前页面' },
]

const carouselItems = [
  'https://picsum.photos/800/400?random=1',
  'https://picsum.photos/800/400?random=2',
  'https://picsum.photos/800/400?random=3',
]

const calendarEvents = [
  new Date(2024, 0, 15),
  new Date(2024, 0, 20),
]

const transferSource = [
  { label: '选项一', value: '1' },
  { label: '选项二', value: '2' },
  { label: '选项三', value: '3' },
  { label: '选项四', value: '4' },
  { label: '选项五', value: '5' },
]

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
  { label: 'HTTP', value: 40 },
  { label: 'SOCKS5', value: 25 },
  { label: 'Shadowsocks', value: 20 },
  { label: 'VMess', value: 15 },
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
