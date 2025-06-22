<template>
  <div id="cesiumContainer" style="width: 100vw; height: 100vh;"></div>
</template>

<script>
import * as Cesium from 'cesium';

export default {
  name: "CesiumViewer",
  mounted() {
    const viewer = new Cesium.Viewer("cesiumContainer", {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      imageryProvider: false,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
    });
    viewer.scene.debugShowFramesPerSecond = true; // 显示 FPS
    this.loadTileset(viewer);
  },
  methods: {
    async loadTileset(viewer) {
  try {
    const tileset = await Cesium.Cesium3DTileset.fromUrl(
      "http://192.168.1.20:8080/tileset.json",
      {
        maximumScreenSpaceError: 1, // 提高细节
        debugShowBoundingVolume: false, // 显示边界框
        debugShowContentBoundingVolume: false, // 显示内容边界框
        skipLevelOfDetail: false // 强制加载所有细节
      }
    );
    viewer.scene.primitives.add(tileset);
    viewer.camera.flyToBoundingSphere(tileset.boundingSphere, { duration: 0 });
    viewer.scene.globe.enableLighting = true;
    viewer.scene.fxaa = true;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    
    viewer.camera.flyTo({
    destination: tileset.boundingSphere.center,
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-30.0), // 向下看
      roll: 0.0
    }
});

    console.log("✅ Tileset loaded");
  } catch (error) {
    console.error("❌ Tileset error:", error);
  }
}
  },
};
</script>