import * as spec from '@galacean/effects-specification';
import { EngineServer } from './engine-server';
import { effectsClass, getClass } from './decorators';
import type { Engine } from './engine';
import type { ImageLike, SceneLoadOptions } from './scene';
import { Scene } from './scene';
import type { EffectsObject } from './effects-object';
import { Asset } from './asset';
import { Material } from './material';
import { PluginSystem } from './plugin-system';
import { AssetManager } from './asset-manager';
import { EffectsPackage } from './effects-package';
import { passRenderLevel } from './pass-render-level';
import { SerializationHelper } from './serialization-helper';
import { generateEmptyTexture, generateWhiteTexture, Texture } from './texture';
import type { AbstractConstructor, Constructor } from './utils';

export type SceneData = Record<string, spec.EffectsObjectData>;

export class Database {
  async loadGUID (guid: string): Promise<EffectsObject | undefined> {
    return undefined;
  }
}

/** Engine-owned asset preparation and built-in resource lifecycle. */
@effectsClass('AssetServer')
export class AssetServer extends EngineServer {
  whiteTexture: Texture;
  transparentTexture: Texture;
  jsonSceneData: SceneData = {};
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要
  assetManagers: AssetManager[] = [];
  private readonly builtinObjects = new Map<string, EffectsObject>();

  constructor (engine: Engine) {
    super(engine, -600);
  }

  override onInit (): void {
    const { engine } = this;

    this.whiteTexture = generateWhiteTexture(engine);
    this.transparentTexture = generateEmptyTexture(engine);
    this.builtinObjects.set(spec.BuiltinObjectGUID.WhiteTexture, this.whiteTexture);
    this.builtinObjects.set(spec.BuiltinObjectGUID.EmptyTexture, this.transparentTexture);
    this.registerBuiltinObjects();
  }

  /**
   * @param url
   * @param options
   * @returns
   */
  assembleSceneLoadOptions (
    url: Scene.LoadType,
    options: SceneLoadOptions = {},
  ) {
    let source: Scene.LoadType = url;

    // 加载多个合成链接并各自设置可选参数
    if (Scene.isURL(url)) {
      if (!Scene.isJSONObject(url)) {
        source = url.url;
      }
      if (Scene.isWithOptions(url)) {
        options = {
          ...options,
          ...url.options,
        };
      }
    }

    return {
      source,
      options,
    };
  }

  updateTextVariables (scene: Scene, variables: spec.TemplateVariables = {}) {
    this.engine.sceneServer.updateTextVariables(scene, variables);
  }

  addEffectsObjectData (data: spec.EffectsObjectData) {
    this.jsonSceneData[data.id] = data;
  }

  findEffectsObjectData (uuid: string) {
    return this.jsonSceneData[uuid];
  }

  /** @internal Prepare the definitions and inputs for one scene load. */
  prepareSceneAssets (scene: Scene, options: SceneLoadOptions): void {
    this.jsonSceneData = {};
    PluginSystem.notifyAssetsLoadFinish(scene, options, this.engine);
    this.prepareAssets(scene, scene.assets);
    this.updateTextVariables(scene, options.variables);
  }

  loadGUID<T> (dataPath: spec.DataPath, type?: AbstractConstructor): T {
    if (!dataPath) {
      return null as T;
    }

    const id = String(dataPath.id);
    const builtin = this.builtinObjects.get(id);

    if (builtin) {
      return builtin as T;
    }
    const data = this.findEffectsObjectData(id);

    if (!data) {
      console.warn(`Object data with uuid: ${id} not found.`);

      return undefined as T;
    }

    const objectClass: Constructor<Asset> | undefined = getClass(data.dataType);

    if (!objectClass) {
      console.warn(`Constructor for DataType: ${data.dataType} not found.`);

      return undefined as T;
    }
    const isAsset = objectClass === Asset || objectClass.prototype instanceof Asset;

    if (!isAsset || (type && objectClass !== type && !(objectClass.prototype instanceof type))) {
      return undefined as T;
    }

    const instance = new objectClass(this.engine);
    const context = this.engine.effectsObjectServer.deserializationContext;

    // References read in fromData can already resolve this instance.
    context?.idsMapping.set(id, instance.getInstanceId());
    context?.sceneAssets.add(instance);
    SerializationHelper.deserialize({ ...data }, instance);

    return instance as T;
  }

  createAssetManager (options: SceneLoadOptions): AssetManager {
    const manager = new AssetManager(options);

    this.assetManagers.push(manager);

    return manager;
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
        // type 仅作为降级标记保留给用户代码（isNull）使用，运行时行为由清空组件决定
        vfxItemData.type = spec.ItemType.null;
        // 清除预合成引用，降级元素不再实例化预合成（预合成由顶层 refId 结构判定）
        delete (vfxItemData as { refId?: string }).refId;
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
      if (!(textureData instanceof Texture)) {
        this.addEffectsObjectData(textureData as spec.EffectsObjectData);
      }
    }
  }

  prepareAssets (
    scene: Scene,
    assets: Record<string, ImageLike>,
  ) {
    // 加入 json 资产数据
    this.addPackageDatas(scene);
    for (const id of Object.keys(assets)) {
      const input = { id, dataType: 'DataAsset' as spec.DataType, data: assets[id] };

      this.addEffectsObjectData(input);
    }
    this.registerBuiltinObjects();
  }

  // TODO Material 单独存表, 加速查询
  createShaderVariant () {
    for (const guid of Object.keys(this.engine.effectsObjectServer.objectInstance)) {
      const effectsObject = this.engine.effectsObjectServer.objectInstance[guid];

      if (effectsObject instanceof Material && effectsObject.shader) {
        effectsObject.createShaderVariant();
      }
    }
  }

  private registerBuiltinObjects (): void {
    for (const object of this.builtinObjects.values()) {
      object.registerObject();
    }
  }

  override onDispose (): void {
    this.assetManagers.forEach(assetManager => assetManager.dispose());
    this.assetManagers.length = 0;
    this.builtinObjects.forEach(object => object.dispose());
    this.builtinObjects.clear();
  }
}
