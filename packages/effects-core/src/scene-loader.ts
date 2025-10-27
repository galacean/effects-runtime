import { AssetManager } from './asset-manager';
import { Composition } from './composition';
import { PLAYER_OPTIONS_ENV_EDITOR } from './constants';
import type { Engine } from './engine';
import type { Scene, SceneLoadOptions } from './scene';
import { logger } from './utils';
import * as spec from '@galacean/effects-specification';

export class SceneLoader {
  static async load (scene: Scene.LoadType, engine: Engine, options: SceneLoadOptions = {}): Promise<Composition> {
    const last = performance.now();
    const asyncShaderCompile = engine.gpuCapability?.detail?.asyncShaderCompile;
    const compositionIndex = engine.compositions.length;

    const assetManager = new AssetManager(options);

    // TODO 多 json 之间目前不共用资源，如果后续需要多 json 共用，这边缓存机制需要额外处理
    engine.assetManagers.push(assetManager);

    const loadedScene = await assetManager.loadScene(scene, engine.renderer, { env: engine.env });

    engine.assetService.prepareAssets(loadedScene, loadedScene.assets);
    engine.assetService.updateTextVariables(loadedScene, options.variables);
    engine.assetService.initializeTexture(loadedScene);

    loadedScene.pluginSystem.precompile(loadedScene.jsonScene.compositions, engine.renderer);

    const composition = this.createComposition(loadedScene, engine, options);

    composition.setIndex(compositionIndex);
    const compileStart = performance.now();

    await new Promise(resolve => {
      engine.renderer.getShaderLibrary()?.compileAllShaders(() => resolve(null));
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

  private static createComposition (scene: Scene, engine: Engine, options: SceneLoadOptions = {}): Composition {
    const renderer = engine.renderer;
    const composition = new Composition({
      ...options,
      renderer,
      width: renderer.getWidth(),
      height: renderer.getHeight(),
      event: engine.eventSystem,
    }, scene);

    // 中低端设备降帧到 30fps·
    if (engine.ticker && options.renderLevel === spec.RenderLevel.B) {
      engine.ticker.setFPS(Math.min(engine.ticker.getFPS(), 30));
    }

    // TODO 目前编辑器会每帧调用 loadScene, 在这编译会导致闪帧，待编辑器渲染逻辑优化后移除。
    if (engine.env !== PLAYER_OPTIONS_ENV_EDITOR) {
      engine.assetService.createShaderVariant();
    }

    return composition;
  }
}