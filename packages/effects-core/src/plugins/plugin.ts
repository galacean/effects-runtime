import type * as spec from '@galacean/effects-specification';
import type { Scene, SceneLoadOptions } from '../scene';
import type { Composition } from '../composition';
import type { Engine } from '../engine';

export interface PluginConstructor {
  new(): AbstractPlugin,

  [key: string]: any,
}

/**
 * 抽象插件类
 * 注册合成不同生命周期的回调函数
 */
export abstract class AbstractPlugin {
  order = 100;
  name = '';

  /***
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段可以对资源 JSON 进行处理，替换调 JSON 中的数据，或者直接终止加载流程
   * 一旦被 reject，加载过程将失败
   * @param json 动画资源
   * @param options 加载参数
   */
  processRawJSON (json: spec.JSONScene, options: SceneLoadOptions): void {
  }

  /**
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段可以加载插件所需类型资源，并返回原始资源和加载后的资源。
   * @param json
   * @param options
   * @returns
   */
  async processAssets (json: spec.JSONScene, options?: SceneLoadOptions): Promise<{ assets: spec.AssetBase[], loadedAssets: unknown[] }> {
    return { assets: [], loadedAssets: [] };
  }

  /**
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段时，json 中的图片和二进制已经被加载完成，可以对加载好的资源做进一步处理，
   * 如果 promise 被 reject, loadScene 函数同样会被 reject，表示场景加载失败。
   * 请记住，整个 load 阶段都不要创建 GL 相关的对象，只创建 JS 对象
   * 此阶段晚于 processRawJSON
   * @param {Scene} scene
   * @param {SceneLoadOptions} options
   */
  async prepareResource (scene: Scene, options: SceneLoadOptions, engine: Engine): Promise<void> {
  }

  onCompositionConstructed (composition: Composition, scene: Scene): void { }

  onCompositionDestroyed (composition: Composition): void { }

  onCompositionUpdate (composition: Composition, dt: number): void { }
}
