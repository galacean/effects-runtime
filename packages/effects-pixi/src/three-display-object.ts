import type { EventSystem, JSONValue, SceneLoadOptions, Renderer } from '@galacean/effects-core';
import { AssetManager } from '@galacean/effects-core';
import * as THREE from 'three';
import { ThreeComposition } from './three-composition';
import type { ThreeRenderFrame } from './three-render-frame';
import { ThreeRenderer } from './three-renderer';

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
  compositions: ThreeComposition[];
  camera: THREE.Camera | undefined;
  renderer: Renderer;

  readonly width: number;
  readonly height: number;

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
   * 异步加载动画资源并初始化合成
   * @param url - URL 或者通过 URL 请求的 JSONObject
   * @param options - 加载可选参数
   * @returns
   */
  async loadScene (url: string | JSONValue, options: SceneLoadOptions = {}) {
    const assetManager = new AssetManager({});
    const scene = await assetManager.loadScene(url);
    const composition = new ThreeComposition({
      renderer: this.renderer,
      width: this.width,
      height: this.height,
    }, scene);

    (composition.renderFrame as ThreeRenderFrame).group = this;
    (composition.renderFrame as ThreeRenderFrame).threeCamera = this.camera;
    this.compositions = [composition];
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
