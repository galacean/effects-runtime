import type { Player, spec } from '@galacean/effects';
import { Player as EffectsPlayer } from '@galacean/effects';
import { previewScene } from '../../asset/preview-scene';
import type { JsonAssetFile } from './json-asset-file';

export function generateAssetScene (assetFile: JsonAssetFile): spec.JSONScene | undefined {
  const scene = JSON.parse(JSON.stringify(previewScene)) as spec.JSONScene;
  const data = {
    ...assetFile.Data,
    id: assetFile.ID,
    dataType: assetFile.TypeName,
  } as spec.EffectsObjectData;

  if (assetFile.TypeName === 'Geometry') {
    data.id = scene.geometries[0].id;
    scene.geometries[0] = data as spec.GeometryData;

    return scene;
  }
  if (assetFile.TypeName === 'Material') {
    data.id = scene.materials[0].id;
    scene.materials[0] = data as spec.MaterialData;

    return scene;
  }
  if (assetFile.TypeName === 'Texture') {
    return createTexturePreviewScene(assetFile.ID);
  }

  return undefined;
}

function createTexturePreviewScene (textureId: string): spec.JSONScene {
  const compositionId = 'editor-texture-preview-composition';
  const compositionComponentId = 'editor-texture-preview-composition-component';
  const spriteItemId = 'editor-texture-preview-item';
  const spriteComponentId = 'editor-texture-preview-component';

  return {
    version: '3.8',
    playerVersion: {
      web: '2.10.0',
      native: '2.10.0',
    },
    type: 'ge',
    compositionId,
    compositions: [{
      id: compositionId,
      name: 'Texture Preview',
      duration: 5,
      startTime: 0,
      endBehavior: 0,
      previewSize: [512, 512],
      camera: {
        fov: 60,
        far: 20,
        near: 0.1,
        clipMode: 1,
        position: [0, 0, 8],
      },
      components: [{ id: compositionComponentId }],
      children: [{ id: spriteItemId }],
    }],
    items: [{
      id: spriteItemId,
      name: 'texture-preview-sprite',
      duration: 5,
      type: '1',
      visible: true,
      endBehavior: 0,
      delay: 0,
      renderLevel: 'B+',
      components: [{ id: spriteComponentId }],
      children: [],
      transform: {
        position: { x: 0, y: 0, z: 0 },
        eulerHint: { x: 0, y: 0, z: 0 },
        anchor: { x: 0, y: 0 },
        size: { x: 4, y: 4 },
        scale: { x: 1, y: 1, z: 1 },
      },
      dataType: 'VFXItemData',
    }],
    components: [{
      id: compositionComponentId,
      item: { id: compositionId },
      dataType: 'CompositionComponent',
      items: [{ id: spriteItemId }],
    }, {
      id: spriteComponentId,
      item: { id: spriteItemId },
      dataType: 'SpriteComponent',
      options: { startColor: [1, 1, 1, 1] },
      renderer: {
        renderMode: 1,
        texture: { id: textureId },
      },
    }],
    images: [],
    plugins: [],
    materials: [],
    shaders: [],
    geometries: [],
    animations: [],
    miscs: [],
    textures: [],
    bins: [],
  } as unknown as spec.JSONScene;
}

export function createPreviewPlayer (): Player {
  const container = document.createElement('div');

  container.style.width = '100px';
  container.style.height = '100px';
  container.style.backgroundColor = 'black';
  document.body.appendChild(container);

  return new EffectsPlayer({ container });
}
