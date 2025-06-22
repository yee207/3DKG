import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

window.CESIUM_BASE_URL = '/cesium/';

createApp(App).mount('#app')
