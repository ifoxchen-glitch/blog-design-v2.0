<template>
  <div class="p-4 pb-20 lg:pb-4">
    <h2 class="mb-4 text-xl font-bold">连接拓扑</h2>
    <SankeyChart
      title="连接拓扑"
      :nodes="nodes"
      :links="links"
      :height="500"
    />
  </div>
</template>

<script setup lang="ts">
import SankeyChart from '@/components/charts/SankeyChart.vue'

const nodes = [
  { name: '192.168.3.20', itemStyle: { color: '#818cf8' } },
  { name: '192.168.3.77', itemStyle: { color: '#818cf8' } },
  { name: '192.168.3.150', itemStyle: { color: '#818cf8' } },
  { name: '192.168.3.241', itemStyle: { color: '#818cf8' } },
  { name: '192.168.3.100', itemStyle: { color: '#818cf8' } },
  { name: '192.168.3.196', itemStyle: { color: '#818cf8' } },
  { name: '192.168.3.155', itemStyle: { color: '#818cf8' } },
  { name: 'Match', itemStyle: { color: '#86efac' } },
  { name: 'DomainKeyword: google', itemStyle: { color: '#86efac' } },
  { name: 'DomainKeyword: github', itemStyle: { color: '#86efac' } },
  { name: 'DomainSuffix: windows.com', itemStyle: { color: '#86efac' } },
  { name: 'DomainSuffix: microsoft.com', itemStyle: { color: '#86efac' } },
  { name: 'IPCIDR: 192.168.0.0/16', itemStyle: { color: '#86efac' } },
  { name: 'DomainSuffix: apple.com', itemStyle: { color: '#86efac' } },
  { name: '布咕', itemStyle: { color: '#fde047' } },
  { name: 'DIRECT', itemStyle: { color: '#fca5a5' } },
]

const links = [
  { source: '192.168.3.20', target: 'Match', value: 8 },
  { source: '192.168.3.77', target: 'Match', value: 5 },
  { source: '192.168.3.150', target: 'Match', value: 6 },
  { source: '192.168.3.241', target: 'Match', value: 4 },
  { source: '192.168.3.100', target: 'Match', value: 7 },
  { source: '192.168.3.196', target: 'Match', value: 3 },
  { source: '192.168.3.155', target: 'Match', value: 4 },
  { source: '192.168.3.150', target: 'DomainKeyword: google', value: 3 },
  { source: '192.168.3.100', target: 'DomainKeyword: github', value: 2 },
  { source: '192.168.3.77', target: 'DomainSuffix: windows.com', value: 2 },
  { source: '192.168.3.241', target: 'DomainSuffix: microsoft.com', value: 2 },
  { source: '192.168.3.196', target: 'IPCIDR: 192.168.0.0/16', value: 3 },
  { source: '192.168.3.155', target: 'DomainSuffix: apple.com', value: 2 },
  { source: 'Match', target: '布咕', value: 20 },
  { source: 'DomainKeyword: google', target: '布咕', value: 3 },
  { source: 'DomainKeyword: github', target: '布咕', value: 2 },
  { source: 'DomainSuffix: windows.com', target: 'DIRECT', value: 2 },
  { source: 'DomainSuffix: microsoft.com', target: 'DIRECT', value: 2 },
  { source: 'IPCIDR: 192.168.0.0/16', target: 'DIRECT', value: 3 },
  { source: 'DomainSuffix: apple.com', target: 'DIRECT', value: 2 },
]
</script>
