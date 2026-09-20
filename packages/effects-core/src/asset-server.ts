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
import { SceneServer } from './scene-server';

/** Engine-owned asset preparation and built-in resource lifecycle. */
@effectsClass('AssetServer')
export class AssetServer extends EngineServer {
  jsonSceneData: SceneData = {};
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要
  assetManagers: AssetManager[] = [];
  private readonly assetLoader: AssetLoader;
  private readonly builtinObjects: EffectsObject[] = [];

  constructor (engine: Engine) {
    super(engine, -600);
    this.assetLoader = new AssetLoader(engine);
  }

  override onInit (): void {
    this.builtinObjects.push(this.engine.whiteTexture);
    this.builtinObjects.push(this.engine.transparentTexture);
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
    this.engine.getServer(SceneServer).updateTextVariables(scene, variables);
  }

  addEffectsObjectData (data: spec.EffectsObjectData) {
    this.jsonSceneData[data.id] = data;
  }

  findEffectsObjectData (uuid: string) {
    return this.jsonSceneData[uuid];
  }

  loadGUID<T> (guid: spec.DataPath): T {
    return this.assetLoader.loadGUID<T>(guid);
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

  prepareAssets (
    scene: Scene,
    assets: Record<string, ImageLike>,
  ) {
    for (const assetId of Object.keys(assets)) {
      const asset = assets[assetId];
      const engineAsset = new DataAsset<ImageLike>(this.engine);

      engineAsset.data = asset;
      engineAsset.setInstanceId(assetId);
    }

    // 加入 json 资产数据
    this.addPackageDatas(scene);

    // 加入内置引擎对象
    for (const effectsObject of this.builtinObjects) {
      effectsObject.registerObject();
    }
  }

  // TODO Material 单独存表, 加速查询
  createShaderVariant () {
    for (const guid of Object.keys(this.engine.objectInstance)) {
      const effectsObject = this.engine.objectInstance[guid];

      if (effectsObject instanceof Material) {
        effectsObject.createShaderVariant();
      }
    }
  }

  private destroyBuiltinObjects () {
    for (const effectsObject of this.builtinObjects) {
      effectsObject.dispose();
    }

    this.builtinObjects.length = 0;
  }

  override onDispose (): void {
    this.destroyBuiltinObjects();
  }
}
