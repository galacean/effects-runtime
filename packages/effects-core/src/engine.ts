import * as spec from '@galacean/effects-specification';
import type { Database, EffectsObjectData, SceneData } from './deserializer';
import { Deserializer } from './deserializer';
import type { EffectsObject } from './effects-object';
import { glContext } from './gl';
import type { Material } from './material';
import type { GPUCapability, Geometry, Mesh, RenderPass, Renderer, ShaderLibrary } from './render';
import type { Scene } from './scene';
import { Texture, TextureSourceType } from './texture';
import type { Disposable } from './utils';
import { addItem, logger, removeItem } from './utils';

/**
 * Engine 基类，负责维护所有 GPU 资源的销毁
 */
export class Engine implements Disposable {
  renderer: Renderer;
  emptyTexture: Texture;
  transparentTexture: Texture;
  gpuCapability: GPUCapability;
  jsonSceneData: SceneData;
  objectInstance: Record<string, EffectsObject>;
  deserializer: Deserializer;
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要

  protected destroyed = false;
  protected textures: Texture[] = [];
  protected materials: Material[] = [];
  protected geometries: Geometry[] = [];
  protected meshes: Mesh[] = [];
  protected renderPasses: RenderPass[] = [];

  constructor () {
    this.jsonSceneData = {};
    this.objectInstance = {};
    this.deserializer = new Deserializer(this);
    this.createDefaultTexture();
  }

  /**
   * 创建 Engine 对象。
   */
  static create: (gl: WebGLRenderingContext | WebGL2RenderingContext) => Engine;

  clearResources () {
    this.jsonSceneData = {};
    this.deserializer.clearInstancePool();
  }

  addEffectsObjectData (data: EffectsObjectData) {
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
    const jsonScene = scene.jsonScene;

    //@ts-expect-error
    if (jsonScene.items) {
      //@ts-expect-error
      for (const vfxItemData of jsonScene.items) {
        this.addEffectsObjectData(vfxItemData);
      }
    }
    //@ts-expect-error
    if (jsonScene.materials) {
      //@ts-expect-error
      for (const materialData of jsonScene.materials) {
        this.addEffectsObjectData(materialData);
      }
    }
    //@ts-expect-error
    if (jsonScene.shaders) {
      //@ts-expect-error
      for (const shaderData of jsonScene.shaders) {
        this.addEffectsObjectData(shaderData);
      }
    }
    //@ts-expect-error
    if (jsonScene.geometries) {
      //@ts-expect-error
      for (const geometryData of jsonScene.geometries) {
        this.addEffectsObjectData(geometryData);
      }
    }
    //@ts-expect-error
    if (jsonScene.components) {
      //@ts-expect-error
      for (const componentData of jsonScene.components) {
        this.addEffectsObjectData(componentData);
      }
    }
    if (scene.textureOptions) {
      for (const textureData of scene.textureOptions) {
        //@ts-expect-error
        this.addEffectsObjectData(textureData);
      }
    }
  }

  async createVFXItemsAsync (scene: Scene) {
    const jsonScene = scene.jsonScene;

    //@ts-expect-error
    for (const itemData of jsonScene.items) {
      if (!(
        itemData.type === 'ECS' ||
        itemData.type === spec.ItemType.sprite ||
        itemData.type === spec.ItemType.particle ||
        itemData.type === spec.ItemType.mesh ||
        itemData.type === spec.ItemType.skybox ||
        itemData.type === spec.ItemType.light ||
        itemData.type === 'camera' ||
        itemData.type === spec.ItemType.tree ||
        itemData.type === spec.ItemType.interact ||
        itemData.type === spec.ItemType.camera)
      ) {
        continue;
      }
      if (this.database) {
        await this.deserializer.loadGUIDAsync(itemData.id);
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

  private createDefaultTexture () {
    const sourceOpts = {
      type: glContext.UNSIGNED_BYTE,
      format: glContext.RGBA,
      internalFormat: glContext.RGBA,
      wrapS: glContext.MIRRORED_REPEAT,
      wrapT: glContext.MIRRORED_REPEAT,
      minFilter: glContext.NEAREST,
      magFilter: glContext.NEAREST,
    };

    this.emptyTexture = Texture.create(
      this,
      {
        data: {
          width: 1,
          height: 1,
          data: new Uint8Array([255, 255, 255, 255]),
        },
        sourceType: TextureSourceType.data,
        ...sourceOpts,
      },
    );
    this.transparentTexture = Texture.create(
      this,
      {
        data: {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        },
        sourceType: TextureSourceType.data,
        ...sourceOpts,
      }
    );
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
      logger.warn(`Release GPU memory: ${info.join(', ')}`);
    }

    this.renderPasses.forEach(pass => {
      pass.dispose();
    });
    this.meshes.forEach(mesh => {
      mesh.dispose();
    });
    this.geometries.forEach(geo => {
      geo.dispose();
    });
    this.materials.forEach(mat => {
      mat.dispose();
    });
    this.textures.forEach(tex => {
      tex.dispose();
    });

    this.textures = [];
    this.materials = [];
    this.geometries = [];
    this.meshes = [];
    this.renderPasses = [];
    // @ts-expect-error
    this.renderer = null;
  }
}
