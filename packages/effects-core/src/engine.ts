import * as spec from '@galacean/effects-specification';
import type { Database, SceneData } from './asset-loader';
import { AssetLoader } from './asset-loader';
import type { EffectsObject } from './effects-object';
import type { Material } from './material';
import type { GPUCapability, Geometry, Mesh, RenderPass, Renderer, ShaderLibrary } from './render';
import type { Scene } from './scene';
import type { Texture } from './texture';
import { generateTransparentTexture, generateWhiteTexture } from './texture';
import type { Disposable } from './utils';
import { addItem, logger, removeItem } from './utils';

/**
 * Engine 基类，负责维护所有 GPU 资源的管理及销毁
 */
export class Engine implements Disposable {
  renderer: Renderer;
  emptyTexture: Texture;
  transparentTexture: Texture;
  gpuCapability: GPUCapability;
  jsonSceneData: SceneData;
  objectInstance: Record<string, EffectsObject>;
  assetLoader: AssetLoader;
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

  constructor () {
    this.jsonSceneData = {};
    this.objectInstance = {};
    this.assetLoader = new AssetLoader(this);
    this.emptyTexture = generateWhiteTexture(this);
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

  getInstance (id: string) {
    return this.objectInstance[id];
  }

  removeInstance (id: string) {
    delete this.objectInstance[id];
  }

  addPackageDatas (scene: Scene) {
    const { jsonScene, textureOptions = [] } = scene;
    const {
      items = [], materials = [], shaders = [], geometries = [], components = [],
      animations = [], bins = [], miscs = [],
    } = jsonScene;

    for (const vfxItemData of items) {
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

      //@ts-expect-error
      binaryData.buffer = binaryBuffer;
      if (binaryData.id) {
        this.addEffectsObjectData(binaryData);
      }
    }
    for (const textureData of textureOptions) {
      this.addEffectsObjectData(textureData as spec.EffectComponentData);
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
        await this.assetLoader.loadGUIDAsync(itemData.id);
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
