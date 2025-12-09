import type {
  EventSystem, SceneLoadOptions, Composition, MessageItem, Scene, Engine,
} from '@galacean/effects-core';
import { AssetService, assertExist, AssetManager, isArray, logger, PluginSystem } from '@galacean/effects-core';
import * as THREE from 'three';
import { ThreeComposition } from './three-composition';
import { ThreeEngine } from './three-engine';

export type ThreeDisplayObjectOptions = {
  width: number,
  height: number,
  event?: EventSystem,
  camera?: THREE.Camera,
};

/**
 *
 * @example
 * ``` ts
 * const renderer = new THREE.WebGLRenderer({...});
 * const scene = new THREE.Scene();
 * const { width, height } = renderer.domElement.getBoundingClientRect();
 * const displayObject = new ThreeDisplayObject(renderer.getContext(), { width, height });
 *
 * await displayObject.loadScene(json);
 * scene.add(displayObject);
 * ```
 */
export class ThreeDisplayObject extends THREE.Group {
  compositions: ThreeComposition[] = [];
  camera?: THREE.Camera;
  engine: Engine;
  assetManager: AssetManager;
  env = '';

  readonly width: number;
  readonly height: number;

  get renderer () {
    return this.engine.renderer;
  }

  private baseCompositionIndex = 0;
  private assetService: AssetService;

  /**
   *
   * @param context
   */
  constructor (
    context: WebGLRenderingContext | WebGL2RenderingContext,
    options: ThreeDisplayObjectOptions,
  ) {
    super();

    const { width, height, camera } = options;

    this.engine = new ThreeEngine(context);
    this.assetService = new AssetService(this.engine);
    this.width = width;
    this.height = height;
    this.camera = camera;
  }
  /**
   * 获取当前播放合成，如果是多个合成同时播放，返回第一个合成
   */
  get currentComposition () {
    return this.compositions[0];
  }

  /**
   * 加载动画资源
   * @param scene - 一个或一组 URL 或者通过 URL 请求的 JSONObject 或者 Scene 对象
   * @param options - 加载可选参数
   * @returns
   */
  async loadScene (scene: Scene.LoadType, options?: SceneLoadOptions): Promise<Composition>;
  async loadScene (scene: Scene.LoadType[], options?: SceneLoadOptions): Promise<Composition[]>;
  async loadScene (
    scene: Scene.LoadType | Scene.LoadType[],
    options?: SceneLoadOptions,
  ): Promise<Composition | Composition[]> {
    assertExist(this.renderer, 'Renderer is not exist, maybe the Player has been disabled or in gl \'debug-disable\' mode.');

    const last = performance.now();
    const scenes: Scene.LoadType[] = [];
    const compositions: Composition[] = [];
    const autoplay = options?.autoplay ?? true;
    const baseOrder = this.baseCompositionIndex;

    if (isArray(scene)) {
      scenes.push(...scene);
    } else {
      scenes.push(scene);
    }

    await Promise.all(
      scenes.map(async (url, index) => {
        const { source, options: opts } = this.assetService.assembleSceneLoadOptions(url, { autoplay, ...options });
        const assetManager = new AssetManager(opts);
        const scene = await assetManager.loadScene(source, this.renderer);

        const engine = this.engine;

        engine.clearResources();

        // 触发插件系统 pluginSystem 的回调 onAssetsLoadFinish
        PluginSystem.onAssetsLoadFinish(scene, assetManager.options, engine);
        this.assetService.prepareAssets(scene, assetManager.getAssets());
        this.assetService.updateTextVariables(scene, assetManager.options.variables);
        this.assetService.initializeTexture(scene);

        const composition = this.createComposition(scene, opts);

        this.baseCompositionIndex += 1;
        composition.setIndex(baseOrder + index);
        compositions[index] = composition;
      }),
    );

    for (let i = 0; i < compositions.length; i++) {
      if (autoplay) {
        compositions[i].play();
      } else {
        compositions[i].pause();
      }
    }

    const compositionNames = compositions.map(composition => composition.name);
    const firstFrameTime = performance.now() - last;

    for (const composition of compositions) {
      composition.statistic.firstFrameTime = firstFrameTime;
    }
    logger.info(`First frame [${compositionNames}]: ${firstFrameTime.toFixed(4)}ms.`);

    return isArray(scene) ? compositions : compositions[0];
  }

  private createComposition (
    scene: Scene,
    options: SceneLoadOptions = {},
  ): Composition {
    const composition = new ThreeComposition({
      ...options,
      width: this.width,
      height: this.height,
      renderer: this.renderer,
      onItemMessage: (message: MessageItem) => {
        this.dispatchEvent({ type: 'message', message });
      },
    }, scene);

    composition.on('end', () => {
      this.dispatchEvent({ type: 'end', composition });
    });
    (this.renderer.engine as ThreeEngine).setOptions({
      threeCamera: this.camera,
      threeGroup: this,
      composition,
    });

    this.compositions.push(composition);

    return composition;
  }

  pause () {
    this.dispatchEvent({ type: 'pause' });
    this.compositions.forEach(composition => {
      composition.pause();
    });
  }

  resume () {
    this.dispatchEvent({ type: 'resume' });
    this.compositions.forEach(composition => {
      composition.resume();
    });
  }

  /**
   *
   * @param delta
   */
  update (delta: number) {
    this.compositions.forEach(composition => {
      composition.update(delta);
    });
  }
}
