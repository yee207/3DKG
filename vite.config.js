import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      cesium: 'cesium',
    },
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  build: {
    rollupOptions: {
      external: ['cesium'],
    },
  },
  server: {
    fs: {
      allow: ['.'],
    },
    proxy: {
      '/geojson1': {
        target: 'http://192.168.1.20:8080/geojson1',
        changeOrigin: true,
      },
      '/tileset.json': {
        target: 'http://192.168.1.20:8080',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/Restructure/, ''),
      },
    },
  },
});