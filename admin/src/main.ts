import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { vPermission } from './directives/permission'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('permission', vPermission)
app.mount('#app')
