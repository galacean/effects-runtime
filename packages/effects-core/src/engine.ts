import * as spec from '@galacean/effects-specification';
import type { Database, SceneData } from './asset-loader';
import { AssetLoader } from './asset-loader';
import type { EffectsObject } from './effects-object';
import type { Material } from './material';
import type { GPUCapability, Geometry, Mesh, RenderPass, Renderer, ShaderLibrary } from './render';
import type { Scene, SceneRenderLevel } from './scene';
import type { Texture } from './texture';
import { generateTransparentTexture, generateWhiteTexture } from './texture';
import type { Disposable } from './utils';
import { addItem, isPlainObject, logger, removeItem } from './utils';
import { EffectsPackage } from './effects-package';
import { passRenderLevel } from './pass-render-level';

/**
 * Engine 基类，负责维护所有 GPU 资源的管理及销毁
 */
export class Engine implements Disposable {
  /**
   * 渲染器
   */
  renderer: Renderer;
  /**
   * 渲染等级
   */
  renderLevel?: SceneRenderLevel;
  whiteTexture: Texture;
  transparentTexture: Texture;
  /**
   * GPU 能力
   */
  gpuCapability: GPUCapability;
  jsonSceneData: SceneData;
  objectInstance: Record<string, EffectsObject>;
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要

  /**
   * 渲染过程中错误队列
   */
  renderErrors: Set<Error> = new Set();

  protected destroyed = false;
  protected textures: Texture[] = [];
  protected materials: Material[] = [];
  protected geometries: Geometry[] = [];
  protected meshes: Mesh[] = [];
  protected renderPasses: RenderPass[] = [];

  private assetLoader: AssetLoader;

  /**
   *
   */
  constructor () {
    this.jsonSceneData = {};
    this.objectInstance = {};
    this.assetLoader = new AssetLoader(this);
    this.whiteTexture = generateWhiteTexture(this);
    this.transparentTexture = generateTransparentTexture(this);
  }

  /**
   * 创建 Engine 对象。
   */
  static create: (gl: WebGLRenderingContext | WebGL2RenderingContext) => Engine;

  clearResources () {
    this.jsonSceneData = {};
    this.objectInstance = {};
  }

  addEffectsObjectData (data: spec.EffectsObjectData) {
    this.jsonSceneData[data.id] = data;
  }

  findEffectsObjectData (uuid: string) {
    return this.jsonSceneData[uuid];
  }

  addInstance (effectsObject: EffectsObject) {
    this.objectInstance[effectsObject.getInstanceId()] = effectsObject;
  }

  /**
   * @ignore
   */
  findObject<T> (guid: spec.DataPath): T {
    // 编辑器可能传 Class 对象，这边判断处理一下直接返回原对象。
    if (!(isPlainObject(guid))) {
      return guid as T;
    }

    if (this.objectInstance[guid.id]) {
      return this.objectInstance[guid.id] as T;
    }

    const result = this.assetLoader.loadGUID<T>(guid);

    return result;
  }

  removeInstance (id: string) {
    delete this.objectInstance[id];
  }

  addPackageDatas (scene: Scene) {
    const { jsonScene, textureOptions = [] } = scene;
    const {
      items = [], materials = [], shaders = [], geometries = [], components = [],
      animations = [], bins = [], miscs = [], compositions,
    } = jsonScene;

    for (const compositionData of compositions) {
      this.addEffectsObjectData(compositionData as unknown as spec.EffectsObjectData);
    }
    for (const vfxItemData of items) {
      if (!passRenderLevel(vfxItemData.renderLevel, scene.renderLevel)) {
        vfxItemData.components = [];
        vfxItemData.type = spec.ItemType.null;
      }
      this.addEffectsObjectData(vfxItemData);
    }
    for (const materialData of materials) {
      this.addEffectsObjectData(materialData);
    }
    for (const shaderData of shaders) {
      this.addEffectsObjectData(shaderData);
    }
    for (const geometryData of geometries) {
      this.addEffectsObjectData(geometryData);
    }
    for (const componentData of components) {
      this.addEffectsObjectData(componentData);
    }
    for (const animationData of animations) {
      this.addEffectsObjectData(animationData);
    }
    for (const miscData of miscs) {
      this.addEffectsObjectData(miscData);
    }
    for (let i = 0; i < bins.length; i++) {
      const binaryData = bins[i];
      const binaryBuffer = scene.bins[i];

      if (binaryData.dataType === spec.DataType.BinaryAsset) {
        //@ts-expect-error
        binaryData.buffer = binaryBuffer;
        if (binaryData.id) {
          this.addEffectsObjectData(binaryData);
        }
      } else {
        const effectsPackage = new EffectsPackage();

        effectsPackage.deserializeFromBinary(new Uint8Array(binaryBuffer));
        for (const effectsObjectData of effectsPackage.exportObjectDatas) {
          this.addEffectsObjectData(effectsObjectData);
        }
      }
    }
    for (const textureData of textureOptions) {
      this.addEffectsObjectData(textureData as spec.EffectsObjectData);
    }
  }

  async createVFXItems (scene: Scene) {
    const { jsonScene } = scene;

    for (const itemData of jsonScene.items) {
      const itemType = itemData.type;

      if (!(
        itemType === 'ECS' as spec.ItemType ||
        itemType === 'camera' as spec.ItemType ||
        itemType === spec.ItemType.sprite ||
        itemType === spec.ItemType.particle ||
        itemType === spec.ItemType.mesh ||
        itemType === spec.ItemType.skybox ||
        itemType === spec.ItemType.light ||
        itemType === spec.ItemType.tree ||
        itemType === spec.ItemType.interact ||
        itemType === spec.ItemType.camera
      )) {
        continue;
      }
      if (this.database) {
        this.assetLoader.loadGUID(itemData);
      }
    }
  }

  addTexture (tex: Texture) {
    if (this.destroyed) {
      return;
    }
    addItem(this.textures, tex);
  }

  removeTexture (tex: Texture) {
    if (this.destroyed) {
      return;
    }
    removeItem(this.textures, tex);
  }

  addMaterial (mat: Material) {
    if (this.destroyed) {
      return;
    }
    addItem(this.materials, mat);
  }

  removeMaterial (mat: Material) {
    if (this.destroyed) {
      return;
    }
    removeItem(this.materials, mat);
  }

  addGeometry (geo: Geometry) {
    if (this.destroyed) {
      return;
    }
    addItem(this.geometries, geo);
  }

  removeGeometry (geo: Geometry) {
    if (this.destroyed) {
      return;
    }
    removeItem(this.geometries, geo);
  }

  addMesh (mesh: Mesh) {
    if (this.destroyed) {
      return;
    }
    addItem(this.meshes, mesh);
  }

  removeMesh (mesh: Mesh) {
    if (this.destroyed) {
      return;
    }
    removeItem(this.meshes, mesh);
  }

  addRenderPass (pass: RenderPass) {
    if (this.destroyed) {
      return;
    }
    addItem(this.renderPasses, pass);
  }

  removeRenderPass (pass: RenderPass) {
    if (this.destroyed) {
      return;
    }
    removeItem(this.renderPasses, pass);
  }

  get isDestroyed (): boolean {
    return this.destroyed;
  }

  getShaderLibrary (): ShaderLibrary {
    return this.renderer.getShaderLibrary() as ShaderLibrary;
  }

  /**
   * 销毁所有缓存的资源
   */
  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    const info: string[] = [];

    if (this.renderPasses.length > 0) {
      info.push(`Pass ${this.renderPasses.length}`);
    }
    if (this.meshes.length > 0) {
      info.push(`Mesh ${this.meshes.length}`);
    }
    if (this.geometries.length > 0) {
      info.push(`Geom ${this.geometries.length}`);
    }
    if (this.textures.length > 0) {
      info.push(`Tex ${this.textures.length}`);
    }

    if (info.length > 0) {
      logger.warn(`Release GPU memory: ${info.join(', ')}.`);
    }

    this.renderPasses.forEach(pass => pass.dispose());
    this.meshes.forEach(mesh => mesh.dispose());
    this.geometries.forEach(geo => geo.dispose());
    this.materials.forEach(mat => mat.dispose());
    this.textures.forEach(tex => tex.dispose());

    this.textures = [];
    this.materials = [];
    this.geometries = [];
    this.meshes = [];
    this.renderPasses = [];
    // @ts-expect-error
    this.renderer = null;
  }
}
