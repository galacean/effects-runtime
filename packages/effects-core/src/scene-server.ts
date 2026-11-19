import * as spec from '@galacean/effects-specification';
import type { Engine } from './engine';
import { Composition } from './composition';
import { PLAYER_OPTIONS_ENV_EDITOR } from './constants';
import type { SceneLoadOptions } from './scene';
import { Scene } from './scene';
import { addItem, removeItem, logger } from './utils';
import { EngineServer } from './engine-server';
import { effectsClass } from './decorators';
import { passRenderLevel } from './pass-render-level';
import { PluginSystem } from './plugin-system';

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

  /** Resolve per-scene options before loading the source. */
  assembleSceneLoadOptions (url: Scene.LoadType, options: SceneLoadOptions = {}) {
    let source: Scene.LoadType = url;

    if (Scene.isURL(url)) {
      if (!Scene.isJSONObject(url)) {
        source = url.url;
      }
      if (Scene.isWithOptions(url)) {
        options = { ...options, ...url.options };
      }
    }

    return { source, options };
  }

  /** @internal Apply scene load policies before instantiating its objects. */
  prepareScene (scene: Scene, options: SceneLoadOptions = {}): void {
    const { assetServer } = this.engine;

    assetServer.clearEffectsObjectData();
    PluginSystem.notifyAssetsLoadFinish(scene, options, this.engine);
    for (const item of scene.jsonScene.items) {
      if (!passRenderLevel(item.renderLevel, scene.renderLevel)) {
        item.components = [];
        // Keep the legacy type marker while skipping components and precomposition contents.
        item.type = spec.ItemType.null;
        delete (item as { refId?: string }).refId;
      }
    }
    assetServer.prepareAssets(scene);
    this.updateTextVariables(scene, options.variables);
  }

  private updateTextVariables (scene: Scene, variables: spec.TemplateVariables = {}): void {
    for (const item of scene.jsonScene.items) {
      const textVariable = variables[item.name] as string;

      if (textVariable === undefined || textVariable === null) {
        continue;
      }
      for (const { id } of item.components ?? []) {
        const componentData = this.engine.assetServer.findEffectsObjectData(id) as spec.TextComponentData;

        if (componentData?.dataType === spec.DataType.TextComponent || componentData?.dataType === spec.DataType.RichTextComponent) {
          componentData.options.text = textVariable;
        }
      }
    }
  }

  async loadScene (scene: Scene.LoadType, options: SceneLoadOptions = {}): Promise<Composition> {
    const { engine } = this;
    const last = performance.now();
    const asyncShaderCompile = engine.displayServer.renderingDevice.gpuCapability?.detail?.asyncShaderCompile;
    const compositionIndex = this.compositions.length;

    // TODO 多 json 之间目前不共用资源，如果后续需要多 json 共用，这边缓存机制需要额外处理
    const { source, options: sceneOptions } = this.assembleSceneLoadOptions(scene, options);
    const assetManager = engine.assetServer.createAssetManager(sceneOptions);

    const loadedScene = await assetManager.loadScene(source, engine.renderer);

    this.prepareScene(loadedScene, assetManager.options);

    const composition = this.createComposition(loadedScene, sceneOptions);

    composition.setIndex(compositionIndex);
    const compileStart = performance.now();

    await new Promise(resolve => {
      engine.displayServer.renderingDevice.getShaderLibrary()?.compileAllShaders(() => resolve(null));
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
      engine.assetServer.createShaderVariant();
    }

    return composition;
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

  override onFixedUpdate (deltaTime: number): void {
    for (const composition of this.compositions) {
      composition.sceneTicking.fixedUpdate.tick(deltaTime);
    }
  }

  override onLateFixedUpdate (deltaTime: number): void {
    for (const composition of this.compositions) {
      composition.sceneTicking.lateFixedUpdate.tick(deltaTime);
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
