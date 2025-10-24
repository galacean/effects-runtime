import { AssetManager } from './asset-manager';
import type { MessageItem } from './composition';
import { Composition } from './composition';
import { PLAYER_OPTIONS_ENV_EDITOR } from './constants';
import type { Engine } from './engine';
import type { Scene, SceneLoadOptions } from './scene';
import { isArray, logger } from './utils';
import * as spec from '@galacean/effects-specification';

export class SceneLoader {
  static async load (scene: Scene.LoadType | Scene.LoadType[], engine: Engine, onItemMessage?: (message: MessageItem) => void, options?: SceneLoadOptions): Promise<Composition | Composition[]> {

    const autoplay = options?.autoplay ?? true;
    const last = performance.now();
    const sceneUrls: Scene.LoadType[] = [];
    const compositions: Composition[] = [];
    const asyncShaderCompile = engine.gpuCapability?.detail?.asyncShaderCompile;
    const baseOrder = engine.compositions.length;

    if (isArray(scene)) {
      sceneUrls.push(...scene);
    } else {
      sceneUrls.push(scene);
    }

    for (const assetManager of engine.assetManagers) {
      assetManager.dispose();
    }

    engine.assetManagers = [];

    const sceneLoadResults = await Promise.all(
      sceneUrls.map(async (url, index) => {
        const { source, options: opts } = engine.assetService.assembleSceneLoadOptions(url, { autoplay, ...options });
        const assetManager = new AssetManager(opts);

        // TODO 多 json 之间目前不共用资源，如果后续需要多 json 共用，这边缓存机制需要额外处理
        engine.assetManagers.push(assetManager);

        const scene = await assetManager.loadScene(source, engine.renderer, { env: engine.env });

        return { scene, assetManager };
      }),
    );

    for (let i = 0; i < sceneLoadResults.length; i++) {
      const loadResult = sceneLoadResults[i];
      const scene = loadResult.scene;
      const assetManager = loadResult.assetManager;
      const opts = assetManager.options;
      const compositionAutoplay = opts?.autoplay ?? autoplay;

      engine.assetService.prepareAssets(scene, scene.assets);
      engine.assetService.updateTextVariables(scene, opts.variables);
      engine.assetService.initializeTexture(scene);

      scene.pluginSystem.precompile(scene.jsonScene.compositions, engine.renderer);

      const composition = this.createComposition(scene, engine, onItemMessage, opts);

      composition.setIndex(baseOrder + i);
      compositions[i] = composition;

      if (compositionAutoplay) {
        composition.play();
      } else {
        composition.pause();
      }
    }

    const compileStart = performance.now();

    await new Promise(resolve => {
      engine.renderer.getShaderLibrary()?.compileAllShaders(() => resolve(null));
    });

    const compileTime = performance.now() - compileStart;

    engine.ticker?.start();

    const compositionNames = compositions.map(composition => composition.name);
    const firstFrameTime = performance.now() - last;

    for (const composition of compositions) {
      composition.statistic.compileTime = compileTime;
      composition.statistic.firstFrameTime = firstFrameTime;
    }
    logger.info(`First frame [${compositionNames}]: ${firstFrameTime.toFixed(4)}ms.`);
    logger.info(`Shader ${asyncShaderCompile ? 'async' : 'sync'} compile [${compositionNames}]: ${compileTime.toFixed(4)}ms.`);

    return isArray(scene) ? compositions : compositions[0];
  }

  private static createComposition (scene: Scene, engine: Engine, onItemMessage?: (message: MessageItem) => void, options: SceneLoadOptions = {}): Composition {
    const renderer = engine.renderer;
    const composition = new Composition({
      ...options,
      renderer,
      width: renderer.getWidth(),
      height: renderer.getHeight(),
      event: engine.eventSystem,
      onItemMessage,
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