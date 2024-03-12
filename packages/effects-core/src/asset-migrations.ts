import { v4 as uuidv4 } from 'uuid';
import * as spec from '@galacean/effects-specification';
import type { VFXItemProps } from './vfx-item';
import { DataType, type DataPath } from './asset-loader';
import type { Scene } from './scene';
import { generateGUID } from './utils';

type ecScene = spec.JSONScene & { items: VFXItemProps[], components: DataPath[] };

export function version3Migration (scene: Record<string, any>): Scene {
  scene.jsonScene.version = 3.0;
  const ecScene = scene.jsonScene as ecScene;

  if (!ecScene.items) {
    ecScene.items = [];
  }

  // 所有 composition 的 items push 进 ecScene.items
  for (const composition of scene.jsonScene.compositions) {
    for (let i = 0; i < composition.items.length; i++) {
      ecScene.items.push(composition.items[i]);
    }
  }

  // item.id 转为 uuid
  const itemGuidMap: Record<string, string> = {}; // <id, guid>

  for (const item of ecScene.items) {
    itemGuidMap[item.id] = generateGUID();
    item.id = itemGuidMap[item.id];
  }

  for (const item of ecScene.items) {
    if (item.parentId) {
      if (item.parentId.includes('^')) {
        const parentId = (item.parentId).split('^')[0];
        const nodeId = (item.parentId).split('^')[1];

        item.parentId = itemGuidMap[parentId] + '^' + nodeId;
      } else {
        item.parentId = itemGuidMap[item.parentId];
      }
    }
  }

  // composition 的 items 转为 { id: string }
  for (const composition of scene.jsonScene.compositions) {
    for (let i = 0; i < composition.items.length; i++) {
      composition.items[i] = { id: composition.items[i].id };
    }
  }

  // texture 增加 id 和 dataType
  for (const texture of scene.textureOptions) {
    texture.id = generateGUID();
    texture.dataType = DataType.Texture;
  }

  if (!ecScene.components) {
    ecScene.components = [];
  }
  const components = ecScene.components;

  for (const item of ecScene.items) {

    // 原 texture 索引转为统一 guid 索引
    if (item.content) {
      //@ts-expect-error
      if (item.content.renderer) {
        //@ts-expect-error
        if (item.content.renderer.texture !== undefined) {
          //@ts-expect-error
          const oldTextureId = item.content.renderer.texture;

          //@ts-expect-error
          item.content.renderer.texture = { id: scene.textureOptions[oldTextureId].id };
        }
      }

      //@ts-expect-error
      if (item.content.trails) {
        //@ts-expect-error
        if (item.content.trails.texture !== undefined) {
          //@ts-expect-error
          const oldTextureId = item.content.trails.texture;

          //@ts-expect-error
          item.content.trails.texture = { id: scene.textureOptions[oldTextureId].id };
        }
      }
    }

    // item 的 transform 属性由数组转为 {x:n, y:n, z:n}
    if (item.transform) {
      let position = item.transform.position;
      let rotation = item.transform.rotation;
      let scale = item.transform.scale;

      if (!position) {
        position = [0, 0, 0];
      }
      if (!rotation) {
        rotation = [0, 0, 0];
      }
      if (!scale) {
        scale = [1, 1, 1];
      }

      //@ts-expect-error
      item.transform.position = { x: position[0], y: position[1], z: position[2] };
      //@ts-expect-error
      item.transform.rotation = { x: rotation[0], y: rotation[1], z: rotation[2] };
      //@ts-expect-error
      item.transform.scale = { x: scale[0], y: scale[1], z: scale[2] };
    }

    // item 的 content 转为 component data 加入 JSONScene.components
    const uuid = uuidv4().replace(/-/g, '');

    if (item.type === spec.ItemType.sprite) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.SpriteComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.particle) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.ParticleSystem;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.mesh) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.MeshComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.skybox) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.SkyboxComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.light) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.LightComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === 'camera') {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.CameraComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.tree) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.TreeComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.interact) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.InteractComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.camera) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.CameraController;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    } else if (item.type === spec.ItemType.text) {
      //@ts-expect-error
      item.components = [];
      //@ts-expect-error
      components.push(item.content);
      //@ts-expect-error
      item.content.id = uuid;
      //@ts-expect-error
      item.content.dataType = DataType.TextComponent;
      //@ts-expect-error
      item.content.item = { id: item.id };
      //@ts-expect-error
      item.dataType = DataType.VFXItemData;
      //@ts-expect-error
      item.components.push({ id: item.content.id });
    }
  }

  return scene as Scene;
}
