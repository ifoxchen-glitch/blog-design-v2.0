<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import { NCard, NSpace, NStatistic, NGrid, NGridItem } from 'naive-ui'

const auth = useAuthStore()
</script>

<template>
  <NSpace vertical size="large">
    <NCard :title="`欢迎回来，${auth.user?.username ?? '访客'}`">
      <p>这是 Dashboard 占位页。后续可在此处展示站点统计数据、快捷入口等内容。</p>
    </NCard>

    <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
      <NGridItem span="1 s:2 m:1">
        <NCard>
          <NStatistic label="文章总数" :value="0" />
        </NCard>
      </NGridItem>
      <NGridItem span="1 s:2 m:1">
        <NCard>
          <NStatistic label="标签总数" :value="0" />
        </NCard>
      </NGridItem>
      <NGridItem span="1 s:2 m:1">
        <NCard>
          <NStatistic label="分类总数" :value="0" />
        </NCard>
      </NGridItem>
      <NGridItem span="1 s:2 m:1">
        <NCard>
          <NStatistic label="今日访问" :value="0" />
        </NCard>
      </NGridItem>
    </NGrid>
  </NSpace>
</template>
