import type {
  EventSystem, SceneLoadOptions, Renderer, Composition, SceneLoadType, SceneType, Texture,
  MessageItem,
} from '@galacean/effects-core';
import { AssetManager, isArray, isSceneURL, isSceneWithOptions, logger } from '@galacean/effects-core';
import * as THREE from 'three';
import { ThreeComposition } from './three-composition';
import { ThreeRenderer } from './three-renderer';
import type { ThreeEngine } from './three-engine';

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
  renderer: Renderer;
  assetManager: AssetManager;
  env = '';

  readonly width: number;
  readonly height: number;

  private baseCompositionIndex = 0;

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

    this.renderer = new ThreeRenderer(context);
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
  async loadScene (scene: SceneLoadType, options?: SceneLoadOptions): Promise<Composition>;
  async loadScene (scene: SceneLoadType[], options?: SceneLoadOptions): Promise<Composition[]>;
  async loadScene (scene: SceneLoadType | SceneLoadType[], options?: SceneLoadOptions): Promise<Composition | Composition[]> {
    let composition: Composition | Composition[];
    const baseOrder = this.baseCompositionIndex;

    if (isArray(scene)) {
      this.baseCompositionIndex += scene.length;
      composition = await Promise.all(scene.map(async (scn, index) => {
        const res = await this.createComposition(scn, options);

        res.setIndex(baseOrder + index);

        return res;
      }));
    } else {
      this.baseCompositionIndex += 1;
      composition = await this.createComposition(scene, options);
      composition.setIndex(baseOrder);
    }

    return composition;
  }

  pause () {
    this.dispatchEvent({ type: 'pause' });
    this.compositions.forEach(composition => {
      composition.pause();
    });
  }

  resume () {
    this.compositions.forEach(composition => {
      composition.resume();
    });
  }

  private async createComposition (url: SceneLoadType, options: SceneLoadOptions = {}): Promise<Composition> {
    const last = performance.now();
    let opts = {
      autoplay: true,
      ...options,
    };
    let source: SceneType;

    if (isSceneURL(url)) {
      source = url.url;
      if (isSceneWithOptions(url)) {
        opts = {
          ...opts,
          ...url.options || {},
        };
      }
    } else {
      source = url;
    }

    if (this.assetManager) {
      this.assetManager.updateOptions(opts);
    } else {
      this.assetManager = new AssetManager(opts);
    }

    const scene = await this.assetManager.loadScene(source, this.renderer, { env: this.env });
    const engine = this.renderer.engine;

    // TODO 多 json 之间目前不共用资源，如果后续需要多 json 共用，这边缓存机制需要额外处理
    engine.clearResources();
    engine.addPackageDatas(scene);

    for (let i = 0; i < scene.textureOptions.length; i++) {
      scene.textureOptions[i] = engine.assetLoader.loadGUID(scene.textureOptions[i].id);
      (scene.textureOptions[i] as Texture).initialize();
    }

    if (engine.database) {
      await engine.createVFXItems(scene);
    }
    const composition = new ThreeComposition({
      ...opts,
      width: this.width,
      height: this.height,
      renderer: this.renderer,
      handleItemMessage: (message: MessageItem) => {
        this.dispatchEvent({ type: 'message', message });
      },
    }, scene);

    (this.renderer.engine as ThreeEngine).setOptions({ threeCamera: this.camera, threeGroup: this, composition });

    if (opts.autoplay) {
      composition.play();
    } else {
      composition.pause();
    }

    const firstFrameTime = (performance.now() - last) + composition.statistic.loadTime;

    composition.statistic.firstFrameTime = firstFrameTime;
    logger.info(`First frame: [${composition.name}]${firstFrameTime.toFixed(4)}ms.`);

    this.compositions.push(composition);

    return composition;
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
