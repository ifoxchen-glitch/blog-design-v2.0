<template>
  <div class="calendar">
    <div class="flex items-center justify-between mb-4">
      <button class="btn btn-ghost btn-sm btn-square" @click="prevMonth">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span class="font-semibold">{{ year }}年{{ month + 1 }}月</span>
      <button class="btn btn-ghost btn-sm btn-square" @click="nextMonth">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
    
    <div class="grid grid-cols-7 gap-1 text-center">
      <div v-for="day in weekdays" :key="day" class="text-xs font-medium opacity-50 py-2">
        {{ day }}
      </div>
      
      <div
        v-for="(date, index) in calendarDays"
        :key="index"
        :class="[
          'calendar-day p-2 rounded text-sm cursor-pointer transition-colors',
          !date.currentMonth && 'opacity-30',
          date.isToday && 'bg-primary text-primary-content',
          isSelected(date) && 'ring-2 ring-primary',
          date.hasEvent && 'font-bold',
        ]"
        @click="selectDate(date)"
      >
        {{ date.day }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface CalendarDay {
  day: number
  month: number
  year: number
  currentMonth: boolean
  isToday: boolean
  hasEvent?: boolean
}

const props = defineProps<{
  modelValue?: Date
  events?: Date[]
}>()

const emit = defineEmits<{
  'update:modelValue': [date: Date]
  'select': [date: Date]
}>()

const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const selectedDate = ref<Date>(props.modelValue || today)

const year = computed(() => currentYear.value)
const month = computed(() => currentMonth.value)

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const calendarDays = computed(() => {
  const days: CalendarDay[] = []
  const firstDay = new Date(year.value, month.value, 1)
  const lastDay = new Date(year.value, month.value + 1, 0)
  const startDay = firstDay.getDay()
  
  // Previous month days
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year.value, month.value, -i)
    days.push(createCalendarDay(date, false))
  }
  
  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year.value, month.value, i)
    days.push(createCalendarDay(date, true))
  }
  
  // Next month days
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year.value, month.value + 1, i)
    days.push(createCalendarDay(date, false))
  }
  
  return days
})

const createCalendarDay = (date: Date, currentMonth: boolean): CalendarDay => {
  const isToday = date.toDateString() === today.toDateString()
  const hasEvent = props.events?.some(e => e.toDateString() === date.toDateString())
  
  return {
    day: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear(),
    currentMonth,
    isToday,
    hasEvent,
  }
}

const isSelected = (date: CalendarDay) => {
  if (!selectedDate.value) return false
  return (
    date.day === selectedDate.value.getDate() &&
    date.month === selectedDate.value.getMonth() &&
    date.year === selectedDate.value.getFullYear()
  )
}

const selectDate = (date: CalendarDay) => {
  const newDate = new Date(date.year, date.month, date.day)
  selectedDate.value = newDate
  emit('update:modelValue', newDate)
  emit('select', newDate)
}

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}
</script>

<style scoped>
.calendar-day:hover {
  background: oklch(var(--b2));
}

.calendar-day:active {
  background: oklch(var(--b3));
}
</style>
