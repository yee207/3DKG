<template>
  <div style="position: relative; width: 100%; height: 100vh;">
    <div id="cesiumContainer" style="width: 100%; height: 100%;"></div>
    <div id="infoPopup" style="position: absolute; top: 20px; right: 20px; background: white; padding: 10px; border: 1px solid #ccc; display: none;">
      <h3>图谱节点信息</h3>
      <button id="closePopup" style="position: absolute; top: 5px; right: 5px;">X</button>
      <p><strong>OBJECTID:</strong> <span id="infoObjectId"></span></p>
      <p><strong>名称:</strong> <span id="infoEntityName"></span></p>
      <p><strong>建筑高度:</strong> <span id="infoBuildingHeight"></span></p>
      <p><strong>基底面积:</strong> <span id="infoBaseArea"></span></p>
    </div>
  </div>
</template>
<script>
import * as Cesium from 'cesium';
import EntityNodeLayer from './EntityNodeLayer.js';

export default {
  name: 'CesiumMap',
  async mounted() {
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzNDAwODhjMy01MDk4LTRmNGMtODJkMS1mNmNjMmIyNjA2N2QiLCJpZCI6MzAyNjEwLCJpYXQiOjE3NDgzMzc1NjF9.t50HQNcFhZ66tUhK2fqkyIesH6AouryuFwaraVP7jQ4';
    const viewer = new Cesium.Viewer('cesiumContainer', {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      imageryProvider: false,
      baseLayerPicker: false,
    });

    const nodeLayer = new EntityNodeLayer(viewer);
    let tileset;

    try {
      tileset = await Cesium.Cesium3DTileset.fromUrl('http://192.168.1.20:8080/tileset.json');
      viewer.scene.primitives.add(tileset);

      const heightOffset = -26.5;
      const boundingSphere = tileset.boundingSphere;
      const cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);
      const surface = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0);
      const offset = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
      const translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3());
      tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);

      viewer.zoomTo(tileset);
    } catch (error) {
      console.error('加载 3D Tiles 失败:', error);
    }

    const geojsonFiles = [      { url: 'http://192.168.1.20:8080/geojson1/语义化建筑_5.geojson', type: 'polygon', color: Cesium.Color.GREEN.withAlpha(0.5), labelField: 'entityname' },    ];

    for (const file of geojsonFiles) {
      try {
        const dataSource = await Cesium.GeoJsonDataSource.load(file.url, {
          clampToGround: true,
          stroke: Cesium.Color.BLACK,
          fill: file.type === 'polygon' ? file.color : undefined,
          strokeWidth: 1,
        });
        viewer.dataSources.add(dataSource);
        console.log(`Loaded dataSource: ${file.url}`, dataSource);

        dataSource.entities.values.forEach(entity => {
          let position = entity.position?.getValue(Cesium.JulianDate.now());
          let labelPosition = position;

          if (file.type === 'polygon') {
            const hierarchy = entity.polygon?.hierarchy.getValue(Cesium.JulianDate.now());
            if (hierarchy && hierarchy.positions && hierarchy.positions.length > 0) {
              position = Cesium.BoundingSphere.fromPoints(hierarchy.positions).center;
              const height = entity.properties['建筑高度']?.getValue() || 0;
              entity.polygon.material = file.color; // 确保绿色填充
              entity.polygon.extrudedHeight = height; // 应用高度
              const cartographic = Cesium.Cartographic.fromCartesian(position);
              labelPosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height + height + 2);
            }
          }

          if (position) {
            entity.position = labelPosition;
            entity.label = {
              text: `\u00A0${entity.properties[file.labelField]?.getValue() || '未知'}`,
              font: '10px sans-serif',
              fillColor: Cesium.Color.BLACK,
              backgroundColor: Cesium.Color.WHITE,
              showBackground: true,
              backgroundPadding: new Cesium.Cartesian2(5, 2),
              style: Cesium.LabelStyle.FILL,
              pixelOffset: new Cesium.Cartesian2(10, 0),
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.TOP,
            };
            entity.point = {
              pixelSize: 6,
              color: Cesium.Color.fromCssColorString('rgb(217,91,80)'),
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
            };
          }
        });
      } catch (error) {
        console.error(`加载 ${file.url} 失败:`, error);
      }
    }

    nodeLayer.addNodesFromTileset(tileset);
    for (const file of geojsonFiles) {
      const dataSource = await Cesium.GeoJsonDataSource.load(file.url);
      nodeLayer.addNodesFromGeoJSON(dataSource);
    }

    const originalColors = new Map();
    nodeLayer.nodes.forEach((node, id) => {
      originalColors.set(id, node.point.color);
    });

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(movement => {
      const picked = viewer.scene.pick(movement.position);
      if (Cesium.defined(picked)) {
        const entity = picked.id;
        const primitive = picked.primitive;

        // 点击第二层图谱节点
        if (entity && entity.point) {
          const nodeId = Array.from(nodeLayer.nodes.keys()).find(id => nodeLayer.nodes.get(id) === entity);
          if (nodeId) {
            const mapping = nodeLayer.getMappedTileFeature(nodeId);
            if (mapping && mapping.objectId) {
              let geojsonEntity = null;
              const dataSources = viewer.dataSources._dataSources || [];
              for (const dataSource of dataSources) {
                geojsonEntity = dataSource.entities.values.find(e => {
                  const oid = e.properties['OBJECTID']?.getValue();
                  return oid && oid.toString() === mapping.objectId;
                });
                if (geojsonEntity) break;
              }
              console.log('Mapping objectId:', mapping.objectId, 'Found geojsonEntity:', geojsonEntity);
              if (geojsonEntity && geojsonEntity.polygon) {
                geojsonEntity.polygon.material = Cesium.Color.YELLOW; // 高亮 GeoJSON 建筑
                console.log('Applied yellow to polygon:', geojsonEntity.polygon); // 调试
              }
            }
            entity.point.color = Cesium.Color.YELLOW; // 高亮第二层节点

            const properties = nodeLayer.getNodeProperties(nodeId);
            if (properties) {
              console.log('Node properties:', properties);
              document.getElementById('infoObjectId').textContent = properties.OBJECTID;
              document.getElementById('infoEntityName').textContent = properties.entityname;
              document.getElementById('infoBuildingHeight').textContent = properties.buildingHeight;
              document.getElementById('infoBaseArea').textContent = properties.baseArea;
              document.getElementById('infoPopup').style.display = 'block';
            } else {
              console.log('No properties found for nodeId:', nodeId);
            }
          }
        }
        // 点击第一层 GeoJSON 建筑
        else if (entity && entity.polygon) {
          const objectId = entity.properties['OBJECTID']?.getValue();
          console.log('Clicked entity OBJECTID:', objectId);
          if (objectId) {
            const nodeId = Array.from(nodeLayer.nodeToTileMap.entries()).find(([id, tile]) => {
              console.log('Tile objectId:', tile.objectId);
              return tile.objectId === objectId.toString();
            })?.[0];
            console.log('Found nodeId:', nodeId);
            if (nodeId) {
              const node = nodeLayer.nodes.get(nodeId);
              if (node) {
                node.point.color = Cesium.Color.YELLOW; // 高亮第二层节点
              }
            }
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      nodeLayer.nodes.forEach((node, id) => {
        node.point.color = originalColors.get(id);
      });
      for (const dataSource of viewer.dataSources._dataSources || []) {
        dataSource.entities.values.forEach(e => {
          if (e.polygon) e.polygon.material = e.polygon.material.withAlpha(0.5); // 恢复 GeoJSON 颜色
        });
      }
      if (tileset) tileset.style = new Cesium.Cesium3DTileStyle(); // 恢复 3D Tiles 颜色
      document.getElementById('infoPopup').style.display = 'none';
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    this.$nextTick(() => {
      document.getElementById('closePopup').addEventListener('click', () => {
        document.getElementById('infoPopup').style.display = 'none';
      });
    });
  },
};
</script>