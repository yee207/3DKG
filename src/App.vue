<template>
  <div>
    <!-- 原代码：保留并注释 -->
    <!-- <CesiumViewer /> -->
    <CesiumMap />
  </div>
</template>

<script setup>
import CesiumMap from './components/CesiumMap.vue'; // 更正组件名
// 原代码：保留并注释
// import CesiumViewer from './components/CesiumViewer.vue'
</script>

<style>
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
