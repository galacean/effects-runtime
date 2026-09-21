import type * as spec from '@galacean/effects-specification';
import { ItemType, DataType } from '@galacean/effects-specification';
import type { Engine } from './engine';
import { AssetServer } from './asset-server';
import { Composition } from './composition';
import { PLAYER_OPTIONS_ENV_EDITOR } from './constants';
import type { Scene, SceneLoadOptions } from './scene';
import { addItem, removeItem, logger } from './utils';
import { PluginSystem } from './plugin-system';
import { EngineServer } from './engine-server';
import { effectsClass } from './decorators';

/** Schedules and unloads the compositions owned by an engine. */
@effectsClass('SceneServer')
export class SceneServer extends EngineServer {
  private disposed = false;
  private readonly _compositions: Composition[] = [];

  constructor (engine: Engine) {
    super(engine, 200);
  }

  private readonly resizeCameras = (): void => {
    const { width, height } = this.engine.canvas;

    for (const composition of this.compositions) {
      composition.camera.aspect = width / height;
    }
  };

  override onInit (): void {
    this.engine.on('resize', this.resizeCameras);
  }

  get compositions (): Composition[] {
    return this._compositions.sort((a, b) => a.getIndex() - b.getIndex());
  }

  addComposition (composition: Composition) {
    if (this.engine.disposed) {
      return;
    }
    addItem(this._compositions, composition);
  }

  removeComposition (composition: Composition) {
    removeItem(this._compositions, composition);
  }

  async loadScene (scene: Scene.LoadType, options: SceneLoadOptions = {}): Promise<Composition> {
    const { engine } = this;
    const last = performance.now();
    const asyncShaderCompile = engine.graphicsServer.renderingDevice.gpuCapability?.detail?.asyncShaderCompile;
    const compositionIndex = this.compositions.length;

    // TODO 多 json 之间目前不共用资源，如果后续需要多 json 共用，这边缓存机制需要额外处理
    const assetManager = engine.getServer(AssetServer).createAssetManager(options);

    const loadedScene = await assetManager.loadScene(scene, engine.renderer);

    engine.effectsObjectServer.clearResources();

    // 通过 PluginSystem.notifyAssetsLoadFinish 通知所有插件的 onAssetsLoadFinish 回调
    PluginSystem.notifyAssetsLoadFinish(loadedScene, assetManager.options, engine);

    engine.getServer(AssetServer).prepareAssets(loadedScene, loadedScene.assets);
    this.updateTextVariables(loadedScene, options.variables);

    const composition = this.createComposition(loadedScene, options);

    composition.setIndex(compositionIndex);
    const compileStart = performance.now();

    await new Promise(resolve => {
      engine.graphicsServer.renderingDevice.getShaderLibrary()?.compileAllShaders(() => resolve(null));
    });

    const compileTime = performance.now() - compileStart;

    engine.ticker?.start();

    const compositionName = composition.name;
    const firstFrameTime = performance.now() - last;

    composition.statistic.compileTime = compileTime;
    composition.statistic.firstFrameTime = firstFrameTime;
    logger.info(`First frame [${compositionName}]: ${firstFrameTime.toFixed(4)}ms.`);
    logger.info(`Shader ${asyncShaderCompile ? 'async' : 'sync'} compile [${compositionName}]: ${compileTime.toFixed(4)}ms.`);

    return composition;
  }

  private createComposition (scene: Scene, options: SceneLoadOptions = {}): Composition {
    const { engine } = this;
    const composition = new Composition(engine, {
      ...options,
    }, scene);

    // TODO 目前编辑器会每帧调用 loadScene, 在这编译会导致闪帧，待编辑器渲染逻辑优化后移除。
    if (engine.env !== PLAYER_OPTIONS_ENV_EDITOR) {
      engine.getServer(AssetServer).createShaderVariant();
    }

    return composition;
  }

  /**
   * 根据用户参数修改文本元素的原始数据
   * @param scene
   * @param options
   */
  updateTextVariables (
    scene: Scene,
    variables: spec.TemplateVariables = {},
  ) {
    scene.jsonScene.items.forEach(item => {
      if (item.type === ItemType.text || item.type === ItemType.richtext) {
        const textVariable = variables[item.name] as string;

        if (textVariable === undefined || textVariable === null) {
          return;
        }

        item.components.forEach(({ id }) => {
          const componentData = this.engine.getServer(AssetServer).findEffectsObjectData(id) as spec.TextComponentData;

          if (componentData?.dataType === DataType.TextComponent || componentData?.dataType === DataType.RichTextComponent) {
            componentData.options.text = textVariable;
          }
        });
      }
    });
  }

  override onUpdate (deltaTime: number): void {
    for (const composition of this.compositions) {
      composition.sceneTicking.update.tick(deltaTime);
    }
  }

  override onLateUpdate (deltaTime: number): void {
    for (const composition of this.compositions) {
      composition.sceneTicking.lateUpdate.tick(deltaTime);
    }
  }

  override onBeforeExit (): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.engine.off('resize', this.resizeCameras);
    for (const composition of this.compositions.slice()) {
      composition.dispose();
    }
    this.compositions.length = 0;
  }
}
