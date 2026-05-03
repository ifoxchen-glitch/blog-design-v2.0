<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div>
    <h1>欢迎回来，{{ auth.user?.username ?? '访客' }}</h1>
    <p>这是 Dashboard 占位页。</p>
  </div>
</template>
