import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './index.css'

const app = createApp(App)

// Handle Vue errors gracefully
app.config.errorHandler = (err, instance, info) => {
  // Ignore parentNode errors from ECharts dispose
  if (err instanceof TypeError && err.message.includes('parentNode')) {
    console.warn('[Vue] ECharts dispose race condition handled')
    return
  }
  console.error('[Vue Error]', err, info)
}

app.use(router)
app.mount('#app')
