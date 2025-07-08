import * as spec from '@galacean/effects-specification';
import type {
  BaseContent, BinaryFile, CompositionData, Item, JSONScene, JSONSceneLegacy, SpineResource,
  SpineContent, TimelineAssetData, CustomShapeData, ShapeComponentData, CompositionContent,
} from '@galacean/effects-specification';
import {
  DataType, END_BEHAVIOR_PAUSE, END_BEHAVIOR_PAUSE_AND_DESTROY, EndBehavior, ItemType,
  JSONSceneVersion, ShapePrimitiveType,
} from '@galacean/effects-specification';
import { MaskMode } from '../material';
import { generateGUID } from '../utils';
import { convertAnchor, ensureFixedNumber, ensureFixedVec3 } from './utils';

/**
 * 2.1 以下版本数据适配（mars-player@2.4.0 及以上版本支持 2.1 以下数据的适配）
 */
export function version21Migration (json: JSONSceneLegacy): JSONSceneLegacy {
  json.compositions.forEach(composition => {
    composition.items.forEach(item => {
      if (item.type === ItemType.null) {
        if (item.endBehavior === EndBehavior.destroy) {
          item.endBehavior = EndBehavior.freeze;
        }
      }
    });
  });

  json.version = JSONSceneVersion['2_1'];

  return json;
}

/**
 * 2.2 以下版本数据适配（mars-player@2.5.0 及以上版本支持 2.2 以下数据的适配）
 */
export function version22Migration (json: JSONSceneLegacy): JSONSceneLegacy {
  const singleVersion = json.version?.split('.');

  if (!singleVersion || Number(singleVersion[0]) > 2 || (Number(singleVersion[0]) === 2 && Number(singleVersion[1]) >= 2)) {
    return json;
  }

  json.compositions.forEach(composition => {
    composition.items.forEach(item => {
      if (item.type === ItemType.mesh || item.type === ItemType.light) {
        item.endBehavior = item.endBehavior as unknown === 1 ? EndBehavior.destroy : item.endBehavior;
      }
    });
  });

  return json;
}

let currentMaskComponent: string;
const componentMap: Map<string, spec.ComponentData> = new Map();
const itemMap: Map<string, spec.VFXItemData> = new Map();

/**
 * 3.1 版本数据适配
 * - 富文本插件名称的适配
 */
export function version31Migration (json: JSONScene): JSONScene {
  // Custom shape fill 属性位置迁移
  for (const component of json.components) {
    if (component.dataType === DataType.ShapeComponent) {
      const shapeComponent = component as ShapeComponentData;

      if (shapeComponent.type === ShapePrimitiveType.Custom) {
        const customShapeComponent = shapeComponent as CustomShapeData;

        //@ts-expect-error
        if (customShapeComponent.shapes?.length > 0 && customShapeComponent.shapes[0].fill) {
          // @ts-expect-error
          customShapeComponent.fill = customShapeComponent.shapes[0].fill;
        }

        // easingIn 和 easingOut 绝对坐标转相对坐标
        const easingInFlag = new Array(customShapeComponent.easingIns.length);
        const easingOutFlag = new Array(customShapeComponent.easingOuts.length).fill(false);

        for (const shape of customShapeComponent.shapes) {
          for (const index of shape.indexes) {
            const point = customShapeComponent.points[index.point];
            const easingIn = customShapeComponent.easingIns[index.easingIn];
            const easingOut = customShapeComponent.easingOuts[index.easingOut];

            if (!easingInFlag[index.easingIn]) {
              easingIn.x -= point.x;
              easingIn.y -= point.y;
              easingInFlag[index.easingIn] = true;
            }
            if (!easingOutFlag[index.easingOut]) {
              easingOut.x -= point.x;
              easingOut.y -= point.y;
              easingOutFlag[index.easingOut] = true;
            }
          }
        }
      }
    }
  }

  return json;
}

export function version32Migration (json: JSONScene): JSONScene {
  componentMap.clear();
  itemMap.clear();
  const { compositions, items, components } = json;
  // 处理旧蒙版数据

  for (const component of components) {
    componentMap.set(component.id, component);
  }
  for (const item of items) {
    itemMap.set(item.id, item);
  }

  for (const comp of compositions) {
    processContent(comp);
  }

  return json;
}

/**
 * Migrates a JSONScene to version 3.3 by updating plugin names, normalizing shape references, and converting composition IDs to GUIDs.
 *
 * - Renames the "richtext" plugin to "rich-text".
 * - Replaces integer-based shape references in sprite components with actual shape data.
 * - Converts composition IDs to GUIDs and creates corresponding CompositionComponent entries.
 * - Updates references in composition options to use the new GUIDs.
 *
 * @returns The migrated JSONScene object compatible with version 3.3.
 */
export function version33Migration (json: JSONScene): JSONScene {
  // 修正老版本数据中，富文本插件名称的问题
  json.plugins?.forEach((plugin, index) => {
    if (plugin === 'richtext') {
      json.plugins[index] = 'rich-text';
    }
  });

  // 老 shape 数据兼容
  for (const item of json.items) {
    if (item.type === spec.ItemType.sprite) {
      const spriteComponent = componentMap.get(item.components[0].id) as spec.SpriteComponentData;

      if (spriteComponent) {
        const shape = spriteComponent.renderer.shape;
        let shapeData;

        if (Number.isInteger(shape)) {
          shapeData = json.shapes[shape as number];
        } else {
          shapeData = shape;
        }

        spriteComponent.renderer.shape = shapeData;
      }
    }
  }

  // Composition id 转 guid, Composition 分离 CompositionComponent
  const compositionId = json.compositionId;
  const compositionIdToGUIDMap: Record<string, string> = {};

  for (const composition of json.compositions) {
    const guid = generateGUID();

    compositionIdToGUIDMap[composition.id] = guid;
    if (composition.id === compositionId) {
      json.compositionId = guid;
    }
    composition.id = guid;

    const compositionComponent = {
      id: generateGUID(),
      dataType:'CompositionComponent',
      items: composition.items,
      timelineAsset: composition.timelineAsset,
      sceneBindings: composition.sceneBindings,
    } as unknown as spec.ComponentData;

    //@ts-expect-error
    composition.timelineAsset = undefined;
    //@ts-expect-error
    composition.sceneBindings = undefined;
    //@ts-expect-error
    composition.components = [{ id:compositionComponent.id }];
    json.components.push(compositionComponent);
  }
  // 预合成元素 refId 同步改为生成的合成 guid
  for (const item of json.items) {
    if (item.content) {
      const compositionOptions = (item.content as CompositionContent).options;

      if (compositionOptions && compositionOptions.refId !== undefined) {
        compositionOptions.refId = compositionIdToGUIDMap[compositionOptions.refId];
      }
    }
  }

  return json;
}

export function processContent (composition: spec.CompositionData) {
  for (const item of composition.items) {
    const itemProps = itemMap.get(item.id);

    if (!itemProps) {
      return;
    }

    if (
      itemProps.type === spec.ItemType.sprite ||
      itemProps.type === spec.ItemType.particle ||
      itemProps.type === spec.ItemType.spine ||
      itemProps.type === spec.ItemType.text ||
      itemProps.type === spec.ItemType.richtext ||
      itemProps.type === spec.ItemType.video ||
      itemProps.type === spec.ItemType.shape
    ) {
      const component = componentMap.get(itemProps.components[0].id);

      if (component) {
        processMask(component);
      }
    }
  }
}

export function processMask (renderContent: any) {
  const renderer = renderContent.renderer;
  const maskMode = renderer?.maskMode;

  if (!maskMode || maskMode === MaskMode.NONE) {

    return;
  }

  if (maskMode === MaskMode.MASK) {
    renderContent.mask = {
      isMask: true,
    };
    currentMaskComponent = renderContent.id;
  } else if (
    maskMode === spec.ObscuredMode.OBSCURED ||
    maskMode === spec.ObscuredMode.REVERSE_OBSCURED
  ) {
    renderContent.mask = {
      inverted: maskMode === spec.ObscuredMode.REVERSE_OBSCURED ? true : false,
      reference: {
        'id': currentMaskComponent,
      },
    };
  }
}

/**
 * 3.0 以下版本数据适配（runtime 2.0及以上版本支持）
 */
export function version30Migration (json: JSONSceneLegacy): JSONScene {
  const result: JSONScene = {
    ...json,
    items: [],
    compositions: [],
    components: [],
    materials: [],
    shaders: [],
    geometries: [],
    animations: [],
    miscs: [],
  };

  // image数据添加 guid
  for (const image of result.images) {
    image.id = generateGUID();
  }

  // 兼容老版本数据中不存在textures的情况
  result.textures ??= [];
  result.textures.forEach(textureOptions => {
    textureOptions.id = generateGUID();
    textureOptions.dataType = DataType.Texture;
    // @ts-expect-error
    textureOptions.source = { id: result.images[textureOptions.source]?.id };
  });

  if (result.textures.length < result.images.length) {
    for (let i = result.textures.length; i < result.images.length; i++) {
      result.textures.push({
        id: generateGUID(),
        dataType: DataType.Texture,
        //@ts-expect-error
        source: { id: result.images[i].id },
        flipY: true,
      });
    }
  }

  // 处理老版本数据中 bins 没有 id 的情况
  if (json.bins) {
    convertBinaryAsset(json.bins, result);
  }

  const itemOldIdToGuidMap: Record<string, string> = {};
  const guidToItemMap: Record<string, Item> = {};

  // 更正Composition.endBehavior
  for (const composition of json.compositions) {
    // composition 的 endBehavior 兼容
    if (
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      composition.endBehavior === END_BEHAVIOR_PAUSE_AND_DESTROY ||
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      composition.endBehavior === END_BEHAVIOR_PAUSE
    ) {
      composition.endBehavior = EndBehavior.freeze;
    }

    // 过滤掉滤镜元素
    composition.items = composition.items.filter(item => item.type !== '8' as ItemType);

    // 过滤掉粒子滤镜（扭曲）
    composition.items.forEach(item => {
      if (item.type === ItemType.particle) {
        // @ts-expect-error
        const filterData = item.content['filter'];

        if (filterData) {
          // @ts-expect-error
          delete item.content['filter'];
        }
      }
    });

    for (const item of composition.items) {
      itemOldIdToGuidMap[item.id] = generateGUID();
      // TODO: 编辑器测试用，上线后删除
      //@ts-expect-error
      item.oldId = item.id;
      item.id = itemOldIdToGuidMap[item.id];
      guidToItemMap[item.id] = item;
    }

    composition.items.forEach((item, index) => {
      if (item.parentId) {
        if (item.parentId.includes('^')) {
          const parentId = (item.parentId).split('^')[0];
          const nodeId = (item.parentId).split('^')[1];

          item.parentId = itemOldIdToGuidMap[parentId] + '^' + nodeId;
        } else {
          item.parentId = itemOldIdToGuidMap[item.parentId];
        }
      }

      // @ts-expect-error fix item type
      result.items.push(item);

      // @ts-expect-error fix item type
      composition.items[index] = { id: item.id };
    });

    const compositionData: CompositionData = {
      ...composition,
      timelineAsset: { id: '' },
      sceneBindings: [],
    };

    result.compositions.push(compositionData);
    // 生成时间轴数据
    convertTimelineAsset(compositionData, guidToItemMap, result);

  }

  for (const item of result.items) {
    // 原 texture 索引转为统一 guid 索引
    if (item.content) {
      if (item.content.renderer) {
        if (item.content.renderer.texture !== undefined) {
          const oldTextureId = item.content.renderer.texture;

          item.content.renderer.texture = { id: result.textures[oldTextureId].id };
        }
      }

      if (item.content.trails) {
        if (item.content.trails.texture !== undefined) {
          const oldTextureId = item.content.trails.texture;

          item.content.trails.texture = { id: result.textures[oldTextureId].id };
        }
      }
    }

    // item 的 transform 属性由数组转为 {x:n, y:n, z:n}
    if (item.transform) {
      //@ts-expect-error
      const position = [...item.transform.position ?? [0, 0, 0]];
      //@ts-expect-error
      const rotation = [...item.transform.rotation ?? [0, 0, 0]] as number[];
      //@ts-expect-error
      const scale = [...item.transform.scale ?? [1, 1, 1]];

      Object.assign(item, {
        transform: {
          position: { x: position[0], y: position[1], z: position[2] },
          eulerHint: { x: rotation[0], y: rotation[1], z: rotation[2] },
          scale: { x: scale[0], y: scale[1], z: scale[0] },
        },
      });

      // sprite 的 scale 转为 size
      if (item.type === ItemType.sprite) {
        item.transform.size = { x: scale[0], y: scale[1] };
        item.transform.scale = { x: 1, y: 1, z: 1 };
      }

      // sprite 的 anchor 修正
      if (item.type === ItemType.sprite) {
        const content = item.content;

        if (!content.renderer) {
          content.renderer = {};
        }
        const renderer = content.renderer;
        const realAnchor = convertAnchor(renderer.anchor, renderer.particleOrigin);
        const startSize = item.transform.size;

        // 兼容旧JSON（anchor和particleOrigin可能同时存在）
        if (!renderer.anchor && renderer.particleOrigin !== undefined) {
          item.transform.position.x += -realAnchor[0] * (startSize?.x ?? 1);
          item.transform.position.y += -realAnchor[1] * (startSize?.y ?? 1);
        }
        item.transform.anchor = { x: realAnchor[0] * (startSize?.x ?? 1), y: realAnchor[1] * (startSize?.y ?? 1) };
      }
    }

    if (item.type === ItemType.particle) {
      const content = item.content;

      if (!content.renderer) {
        content.renderer = {};
      }
      const renderer = content.renderer;

      content.renderer.anchor = convertAnchor(renderer.anchor, renderer.particleOrigin);
    }

    // 修复相机K帧缺失 asMovement 参数
    if (item.type === ItemType.camera && item.content.positionOverLifetime && Object.keys(item.content.positionOverLifetime).length !== 0) {
      item.content.positionOverLifetime.asMovement = true;
    }

    // 修正老 json 的 item.pluginName
    if (item.pn !== undefined) {
      const pn = item.pn;
      const { plugins = [] } = json;

      if (pn !== undefined && Number.isInteger(pn)) {
        item.pluginName = plugins[pn];
      }
    }

    // 修正老 json 的 item.type
    if (item.pluginName === 'editor-gizmo') {
      //@ts-expect-error
      item.type = 'editor-gizmo';
    }
    if (item.pluginName === 'orientation-transformer') {
      //@ts-expect-error
      item.type = 'orientation-transformer';
    }

    // gizmo 的 target id 转换为新的 item guid
    if (item.content.options.target && item.pluginName === 'editor-gizmo') {
      item.content.options.target = itemOldIdToGuidMap[item.content.options.target];
    }

    // Spine 元素转为 guid 索引
    if (
      item.type === ItemType.spine
      && json.spines
      && json.spines.length !== 0
    ) {
      convertSpineData(json.spines[item.content.options.spine], item.content, result);
    }

    // item 的 content 转为 component data 加入 JSONScene.components
    if (
      item.type === ItemType.sprite ||
      item.type === ItemType.particle ||
      item.type === ItemType.mesh ||
      item.type === ItemType.skybox ||
      item.type === ItemType.light ||
      item.type === 'camera' as ItemType ||
      item.type === ItemType.tree ||
      item.type === ItemType.interact ||
      item.type === ItemType.camera ||
      item.type === ItemType.text ||
      item.type === ItemType.spine ||
      item.type === 'editor-gizmo' as ItemType ||
      item.type === 'orientation-transformer' as ItemType
    ) {
      item.components = [];
      result.components.push(item.content);
      item.content.id = generateGUID();
      item.content.item = { id: item.id };
      item.dataType = DataType.VFXItemData;
      item.components.push({ id: item.content.id });
    }

    if (item.type === ItemType.null || item.type === ItemType.composition) {
      item.components = [];
      item.dataType = DataType.VFXItemData;
    }

    switch (item.type) {
      case ItemType.sprite:
        item.content.dataType = DataType.SpriteComponent;

        break;
      case ItemType.particle:
        item.content.dataType = DataType.ParticleSystem;

        break;
      case ItemType.mesh:
        item.content.dataType = DataType.MeshComponent;

        break;
      case ItemType.skybox:
        item.content.dataType = DataType.SkyboxComponent;

        break;
      case ItemType.light:
        item.content.dataType = DataType.LightComponent;

        break;
      case 'camera' as ItemType:
        item.content.dataType = DataType.CameraComponent;

        break;
      case 'editor-gizmo' as ItemType:
        item.content.dataType = 'GizmoComponent';

        break;
      case 'orientation-transformer' as ItemType:
        item.content.dataType = 'OrientationComponent';

        break;
      case ItemType.tree:
        item.content.dataType = DataType.TreeComponent;

        break;
      case ItemType.interact:
        item.content.dataType = DataType.InteractComponent;

        break;
      case ItemType.camera:
        item.content.dataType = DataType.CameraController;

        break;
      case ItemType.text:
        item.content.dataType = DataType.TextComponent;

        break;
      case ItemType.spine:
        item.content.dataType = DataType.SpineComponent;

        break;
    }
  }

  result.version = JSONSceneVersion['3_0'];

  return result;
}

/**
 * 2.5 以下版本 赫尔米特数据转换成贝塞尔数据
 */
export function version24Migration (json: JSONScene): JSONScene {
  // 曲线转换成贝塞尔
  json.compositions.map((comp: any) => {
    for (const item of comp.items) {
      convertParam(item.content);
    }
  });

  return json;
}

export function convertParam (content?: BaseContent) {
  if (!content) {
    return;
  }
  for (const key of Object.keys(content)) {
    const value = content[key];
    const isArray = Array.isArray(value);

    if (isArray && value.length === 2 && Array.isArray(value[1])) {
      if (key === 'path') {
        content[key] = ensureFixedVec3(value);
      } else {
        content[key] = ensureFixedNumber(value);
      }
    } else if (!isArray && typeof value === 'object') {
      convertParam(value);
    }
  }
}

function convertTimelineAsset (composition: CompositionData, guidToItemMap: Record<string, Item>, jsonScene: JSONScene) {
  const sceneBindings = [];
  const trackDatas = [];
  const playableAssetDatas = [];
  const timelineAssetData: TimelineAssetData = {
    tracks: [],
    id: generateGUID(),
    //@ts-expect-error
    dataType: 'TimelineAsset',
  };

  for (const itemDataPath of composition.items) {
    const item = guidToItemMap[itemDataPath.id];
    const subTrackDatas = [];

    const newActivationPlayableAsset = {
      id: generateGUID(),
      dataType: 'ActivationPlayableAsset',
    };

    playableAssetDatas.push(newActivationPlayableAsset);
    const newActivationTrackData = {
      id: generateGUID(),
      dataType: 'ActivationTrack',
      children: [],
      clips: [
        {
          start: item.delay,
          duration: item.duration,
          endBehavior: item.endBehavior,
          asset: {
            id: newActivationPlayableAsset.id,
          },
        },
      ],
    };

    subTrackDatas.push({ id: newActivationTrackData.id });
    trackDatas.push(newActivationTrackData);

    if (item.type !== ItemType.particle) {
      const newTransformPlayableAssetData = {
        id: generateGUID(),
        dataType: 'TransformPlayableAsset',
        //@ts-expect-error
        sizeOverLifetime: item.content.sizeOverLifetime,
        //@ts-expect-error
        rotationOverLifetime: item.content.rotationOverLifetime,
        //@ts-expect-error
        positionOverLifetime: item.content.positionOverLifetime,
      };

      playableAssetDatas.push(newTransformPlayableAssetData);
      const newTrackData = {
        id: generateGUID(),
        dataType: 'TransformTrack',
        children: [],
        clips: [
          {
            start: item.delay,
            duration: item.duration,
            endBehavior: item.endBehavior,
            asset: {
              id: newTransformPlayableAssetData.id,
            },
          },
        ],
      };

      subTrackDatas.push({ id: newTrackData.id });
      trackDatas.push(newTrackData);
    }

    if (item.type === ItemType.sprite || item.type === ItemType.text) {
      const newSpriteColorPlayableAssetData = {
        id: generateGUID(),
        dataType: 'SpriteColorPlayableAsset',
        colorOverLifetime: item.content.colorOverLifetime,
      };

      playableAssetDatas.push(newSpriteColorPlayableAssetData);
      const newTrackData = {
        id: generateGUID(),
        dataType: 'SpriteColorTrack',
        children: [],
        clips: [
          {
            start: item.delay,
            duration: item.duration,
            endBehavior: item.endBehavior,
            asset: {
              id: newSpriteColorPlayableAssetData.id,
            },
          },
        ],
      };

      subTrackDatas.push({ id: newTrackData.id });
      trackDatas.push(newTrackData);
    }

    if (item.type === ItemType.composition) {
      const newSubCompositionPlayableAssetData = {
        id: generateGUID(),
        dataType: 'SubCompositionPlayableAsset',
      };

      playableAssetDatas.push(newSubCompositionPlayableAssetData);
      const newTrackData = {
        id: generateGUID(),
        dataType: 'SubCompositionTrack',
        children: [],
        clips: [
          {
            start: item.delay,
            duration: item.duration,
            endBehavior: item.endBehavior,
            asset: {
              id: newSubCompositionPlayableAssetData.id,
            },
          },
        ],
      };

      subTrackDatas.push({ id: newTrackData.id });
      trackDatas.push(newTrackData);
    }

    const bindingTrackData = {
      id: generateGUID(),
      dataType: 'ObjectBindingTrack',
      children: subTrackDatas,
      clips: [],
    };

    trackDatas.push(bindingTrackData);
    timelineAssetData.tracks.push({ id: bindingTrackData.id });
    sceneBindings.push({
      key: { id: bindingTrackData.id },
      value: { id: item.id },
    });
  }

  const trackIds = [];

  for (const trackData of trackDatas) {
    trackIds.push({ id: trackData.id });
  }

  composition.timelineAsset = { id: timelineAssetData.id };
  composition.sceneBindings = sceneBindings;

  jsonScene.miscs.push(timelineAssetData);

  for (const trackData of trackDatas) {
    //@ts-expect-error
    jsonScene.miscs.push(trackData);
  }
  for (const playableAsset of playableAssetDatas) {
    //@ts-expect-error
    jsonScene.miscs.push(playableAsset);
  }
}

export function convertBinaryAsset (bins: BinaryFile[], jsonScene: JSONScene) {
  //@ts-expect-error
  jsonScene.bins = bins.map(bin => ({
    url: bin.url,
    'dataType': 'BinaryAsset',
    id: generateGUID(),
  }));
}

export function convertSpineData (resource: SpineResource, content: SpineContent, jsonScene: JSONScene) {
  //@ts-expect-error
  content.resource = {
    'atlas': {
      'bins': {
        //@ts-expect-error
        'id': jsonScene.bins[resource.atlas[1][0]].id,
      },
      'source': resource.atlas[1].slice(1),
    },
    'skeleton': {
      'bins': {
        //@ts-expect-error
        'id': jsonScene.bins[resource.skeleton[1][0]].id,
      },
      'source': resource.skeleton[1].slice(1),
    },
    'skeletonType': resource.skeletonType,
    'images': resource.images.map(i => ({
      //@ts-expect-error
      id: jsonScene.textures[i].id,
    })),
  };

}
