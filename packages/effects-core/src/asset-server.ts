import * as spec from '@galacean/effects-specification';
import { EngineServer } from './engine-server';
import { effectsClass } from './decorators';
import type { Engine } from './engine';
import type { ImageLike, SceneLoadOptions } from './scene';
import { Scene } from './scene';
import type { EffectsObject } from './effects-object';
import { DataAsset } from './asset';
import { Material } from './material';
import { AssetLoader } from './asset-loader';
import type { Database, SceneData } from './asset-loader';
import { AssetManager } from './asset-manager';
import { EffectsPackage } from './effects-package';
import { passRenderLevel } from './pass-render-level';
import { generateEmptyTexture, generateWhiteTexture } from './texture';
import type { Texture } from './texture';
import type { AbstractConstructor } from './utils';

/** Engine-owned asset preparation and built-in resource lifecycle. */
@effectsClass('AssetServer')
export class AssetServer extends EngineServer {
  whiteTexture: Texture;
  transparentTexture: Texture;
  jsonSceneData: SceneData = {};
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要
  assetManagers: AssetManager[] = [];
  /** @internal */
  readonly assetLoader: AssetLoader;
  private readonly builtinObjects = new Map<string, EffectsObject>();
  private readonly assets = new Map<string, EffectsObject>();
  private readonly assetIds = new WeakMap<EffectsObject, string>();

  constructor (engine: Engine) {
    super(engine, -600);
    this.assetLoader = new AssetLoader(engine);
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

  clearSceneData (): void {
    this.jsonSceneData = {};
    this.assets.clear();
  }

  /** @internal Add a loaded asset to the cache by its serialized ID. */
  addAsset (id: string, asset: EffectsObject): void {
    const key = String(id);

    this.removeAsset(asset);
    this.assets.set(key, asset);
    this.assetIds.set(asset, key);
  }

  /** @internal Remove the asset when its runtime object is unregistered. */
  removeAsset (asset: EffectsObject): void {
    const id = this.assetIds.get(asset);

    if (id !== undefined) {
      if (this.assets.get(id) === asset) {
        this.assets.delete(id);
      }
      this.assetIds.delete(asset);
    }
  }

  /** @internal Find an asset already loaded under its serialized ID. */
  findAsset (id: string): EffectsObject | undefined {
    return this.assets.get(String(id));
  }

  loadGUID<T> (dataPath: spec.DataPath, type?: AbstractConstructor): T {
    const asset = dataPath ? this.findAsset(dataPath.id) : undefined;

    return asset ? asset as T : this.assetLoader.loadGUID<T>(dataPath, type);
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
      this.addEffectsObjectData(textureData as spec.EffectsObjectData);
    }
  }

  prepareAssets (
    scene: Scene,
    assets: Record<string, ImageLike>,
  ) {
    for (const assetId of Object.keys(assets)) {
      const asset = assets[assetId];
      const engineAsset = new DataAsset<ImageLike>(this.engine);

      engineAsset.data = asset;
      engineAsset.definition.id = assetId;
      this.addAsset(assetId, engineAsset);
    }

    // 加入 json 资产数据
    this.addPackageDatas(scene);

    this.registerBuiltinObjects();
  }

  // TODO Material 单独存表, 加速查询
  createShaderVariant () {
    for (const guid of Object.keys(this.engine.effectsObjectServer.objectInstance)) {
      const effectsObject = this.engine.effectsObjectServer.objectInstance[guid];

      if (effectsObject instanceof Material) {
        effectsObject.createShaderVariant();
      }
    }
  }

  private registerBuiltinObjects (): void {
    for (const [id, object] of this.builtinObjects) {
      object.registerObject();
      this.addAsset(id, object);
    }
  }

  override onDispose (): void {
    this.assetManagers.forEach(assetManager => assetManager.dispose());
    this.assetManagers.length = 0;
    this.builtinObjects.forEach(object => object.dispose());
    this.builtinObjects.clear();
    this.assets.clear();
  }
}
