<script setup lang="ts">
import { NCard, NEmpty, NText } from 'naive-ui'
import PageHeader from '../../../../components/common/PageHeader.vue'
</script>

<template>
  <div>
    <PageHeader title="系统监控" subtitle="实时系统状态与性能指标" />
    <NCard>
      <NEmpty description="系统监控面板开发中">
        <template #extra>
          <NText depth="3">
            Phase 3 规划功能，敬请期待。
          </NText>
        </template>
      </NEmpty>
    </NCard>
  </div>
</template>
