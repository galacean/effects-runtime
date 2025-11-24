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

  initialize (): void { }

  /**
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段可以加载插件所需类型资源，并返回原始资源和加载后的资源。
   * @param scene
   * @param options
   * @returns
   */
  async processAssets (scene: Scene, options?: SceneLoadOptions): Promise<void> {
  }

  /**
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段时，json 中的图片和二进制已经被加载完成，可以对加载好的资源做进一步处理，
   * 如果 promise 被 reject, loadScene 函数同样会被 reject，表示场景加载失败。
   * 请记住，整个 load 阶段都不要创建 GL 相关的对象，只创建 JS 对象
   * 此阶段晚于 processAssets
   * @param {Scene} scene
   * @param {SceneLoadOptions} options
   */
  async prepareResource (scene: Scene, options: SceneLoadOptions, engine: Engine): Promise<void> {
  }

  onCompositionConstructed (composition: Composition, scene: Scene): void { }

  onCompositionDestroyed (composition: Composition): void { }
}
