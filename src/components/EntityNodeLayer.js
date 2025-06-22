import * as Cesium from 'cesium';

class EntityNodeLayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = this.viewer.entities;
    this.nodes = new Map();
    this.nodeHeightOffset = 150;
    this.placeHeightOffset = 250;
    this.blockHeightOffset = 350;
    this.maxHeight = 0;
    this.nodeToTileMap = new Map();
    this.places = new Map();
    this.placeToNodesMap = new Map();
    this.block = null;

    this.neighborhoods = [
      '当代花园典雅苑',
      '鲁磨路社区',
      '紫菘社区',
      '光谷中心花园',
      '鲁巷教师小区',
      '碧水花园',
    ];
  }

  computeMaxHeight() {
    let maxHeight = 0;
    this.entities.values.forEach(entity => {
      let position = entity.position?.getValue(Cesium.JulianDate.now());
      if (position) {
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        const height = cartographic.height;
        if (height > maxHeight) maxHeight = height;
      }
    });
    this.maxHeight = maxHeight;
  }

  addNodesFromTileset(tileset) {
  tileset.tileVisible.addEventListener(tile => {
    const content = tile.content;
    if (content && content.featuresLength > 0) {
      for (let i = 0; i < content.featuresLength; i++) {
        const feature = content.getFeature(i);
        const properties = feature.getPropertyNames().reduce((obj, key) => {
          obj[key] = feature.getProperty(key);
          return obj;
        }, {});
        const position = Cesium.BoundingSphere.fromPoints(content.boundingVolume.positions).center;
        const height = properties['建筑高度'] || 10;
        if (position && properties.entityname) {
          const cartographic = Cesium.Cartographic.fromCartesian(position);
          const baseHeight = cartographic.height + height - 26.5;
          const nodePosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, this.maxHeight + this.nodeHeightOffset);
          const basePosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, baseHeight);
          // 假设 entityname 对应 geojson 中的 entityname，需从 geojson 映射
          this.addNodeWithConnection(nodePosition, basePosition, properties.entityname, Cesium.Color.GREEN.withAlpha(0.8), '建筑', feature, properties.OBJECTID || null, properties.entityname);
        }
      }
    }
  });
}

  addNodesFromGeoJSON(dataSource) {
  dataSource.entities.values.forEach(entity => {
    let position = entity.position?.getValue(Cesium.JulianDate.now());
    let labelText = '未知';
    let color, type, baseHeight;
    let cartographic;

    if (entity.polygon) { // 只处理建筑
      const hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
      if (hierarchy && hierarchy.positions && hierarchy.positions.length > 0) {
        position = Cesium.BoundingSphere.fromPoints(hierarchy.positions).center;
        const height = entity.properties['建筑高度']?.getValue() || 0;
        labelText = entity.properties['entityname']?.getValue() || '未知';
        color = Cesium.Color.GREEN.withAlpha(0.8);
        type = '建筑';
        cartographic = Cesium.Cartographic.fromCartesian(position);
        baseHeight = cartographic.height + height;
        position = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, this.maxHeight + this.nodeHeightOffset);
      }
    }

    if (position && cartographic && type === '建筑') {
      const basePosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, baseHeight);
      const objectId = entity.properties['OBJECTID']?.getValue();
      const entityName = entity.properties['entityname']?.getValue() || labelText;
      this.addNodeWithConnection(position, basePosition, labelText, color, type, entity, objectId, entityName);
    }
  });
}

  addNodeWithConnection(nodePosition, basePosition, text, color, type, feature, objectId, entityName) {
  const id = `${type}-${objectId || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const nodeEntity = this.entities.add({
    position: nodePosition,
    point: {
      pixelSize: 10,
      color: color,
      heightReference: Cesium.HeightReference.NONE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
    },
  });

  this.nodes.set(id, nodeEntity);
  this.nodeToTileMap.set(id, { feature, objectId: objectId ? objectId.toString() : null }); // 确保 objectId 为字符串

  this.addPlaceNode(nodePosition, entityName, nodeEntity);
}

  addPlaceNode(nodePosition, entityName, nodeEntity) {
    let placeName = '未知';
    for (const neighborhood of this.neighborhoods) {
      if (entityName.startsWith(neighborhood)) {
        placeName = neighborhood;
        break;
      }
    }

    if (placeName === '未知') {
      if (entityName.includes('学校') || entityName.includes('幼儿园')) {
        placeName = entityName;
      } else if (entityName.includes('商圈') || entityName.includes('广场')) {
        placeName = entityName;
      }
    }

    let placeEntity = this.places.get(placeName);
    if (!placeEntity) {
      const cartographic = Cesium.Cartographic.fromCartesian(nodePosition);
      const placePosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, this.maxHeight + this.placeHeightOffset);
      placeEntity = this.entities.add({
        position: placePosition,
        point: {
          pixelSize: 15,
          color: Cesium.Color.PURPLE.withAlpha(0.8),
          heightReference: Cesium.HeightReference.NONE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
        },
      });
      this.places.set(placeName, placeEntity);
      this.placeToNodesMap.set(placeName, []);
    }

    this.entities.add({
      polyline: {
        positions: [nodePosition, placeEntity.position.getValue(Cesium.JulianDate.now())],
        width: 1,
        material: Cesium.Color.WHITE.withAlpha(0.5),
      },
    });

    this.placeToNodesMap.get(placeName).push(nodeEntity);
    this.addBlockNode(placeEntity, placeName);
  }

  addBlockNode(placeEntity, placeName) {
    if (!this.block) {
      const placePosition = placeEntity.position.getValue(Cesium.JulianDate.now());
      const cartographic = Cesium.Cartographic.fromCartesian(placePosition);
      const blockPosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, this.maxHeight + this.blockHeightOffset);
      this.block = this.entities.add({
        position: blockPosition,
        point: {
          pixelSize: 20,
          color: Cesium.Color.ORANGE.withAlpha(0.8),
          heightReference: Cesium.HeightReference.NONE,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
        },
      });
    }

    this.entities.add({
      polyline: {
        positions: [placeEntity.position.getValue(Cesium.JulianDate.now()), this.block.position.getValue(Cesium.JulianDate.now())],
        width: 1,
        material: Cesium.Color.WHITE.withAlpha(0.5),
      },
    });
  }

  // 获取映射的 TileFeature 和 objectId
  getMappedTileFeature(nodeId) {
    return this.nodeToTileMap.get(nodeId);
  }

  // 获取图谱节点属性
  getNodeProperties(nodeId) {
  const mapping = this.nodeToTileMap.get(nodeId);
  if (mapping && mapping.feature) {
    const feature = mapping.feature;
    if (feature.properties) { // 优先使用 GeoJSON 实体属性
      return {
        OBJECTID: feature.properties['OBJECTID']?.getValue() || '未知',
        entityname: feature.properties['entityname']?.getValue() || '未知',
        buildingHeight: feature.properties['建筑高度']?.getValue() || '未知',
        baseArea: feature.properties['basearea']?.getValue() || '未知',
      };
    }
  }
  return null; // 若无属性，返回 null
}

  clearNodes() {
    this.nodes.forEach((entity, id) => this.entities.remove(entity));
    this.places.forEach((entity, name) => this.entities.remove(entity));
    if (this.block) this.entities.remove(this.block);
    this.nodes.clear();
    this.places.clear();
    this.nodeToTileMap.clear();
    this.placeToNodesMap.clear();
    this.block = null;
  }
}

export default EntityNodeLayer;