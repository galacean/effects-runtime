import type * as spec from '@galacean/effects-specification';
import type { Scene, SceneLoadOptions } from '../scene';
import type { RenderFrame, Renderer } from '../render';
import type { Composition } from '../composition';

export interface Plugin {
  /**
   * plugin 的数组内排序，按照升序排列
   * @default 100
   */
  order: number,
  name: string,

  /**
   * 在加载到 JSON 后，就可以进行提前编译
   * @param json
   * @param player
   */
  precompile: (compositions: spec.CompositionData[], renderer: Renderer) => void,

  /**
   * 合成创建时调用，用于触发元素在合成创建时的回调
   * @param composition
   * @param scene
   */
  onCompositionConstructed: (composition: Composition, scene: Scene) => void,

  /**
   * 合成重播时的回调
   * @param composition
   * @param frame
   */
  onCompositionReset: (composition: Composition, frame: RenderFrame) => void,

  /**
   * 合成销毁时的会调，需要销毁 composition 中对应的资源
   * @param composition
   */
  onCompositionDestroyed: (composition: Composition) => void,

  /**
   * 合成更新时的回调，每帧都会进行调用，在每个元素调用 onUpdate 之前被触发
   * @param composition
   * @param dt 更新的毫秒
   */
  onCompositionUpdate: (composition: Composition, dt: number) => void,
}

export interface PluginConstructor {
  new(): Plugin,

  [key: string]: any,
}

/**
 * 抽象插件类
 * 注册合成不同生命周期的回调函数
 */
export abstract class AbstractPlugin implements Plugin {
  order = 100;
  name = '';

  /***
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段可以对资源 JSON 进行处理，替换调 JSON 中的数据，或者直接终止加载流程
   * 一旦被 reject，加载过程将失败
   * @param json 动画资源
   * @param options 加载参数
   */
  static processRawJSON: (json: spec.JSONScene, options: SceneLoadOptions) => Promise<void>;

  /**
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段可以加载插件所需类型资源，并返回原始资源和加载后的资源。
   * @param json
   * @param options
   * @returns
   */
  static processAssets: (json: spec.JSONScene, options?: SceneLoadOptions) => Promise<{ assets: spec.AssetBase[], loadedAssets: unknown[] }>;

  /**
   * loadScene 函数调用的时候会触发此函数，
   * 此阶段时，json 中的图片和二进制已经被加载完成，可以对加载好的资源做进一步处理，
   * 如果 promise 被 reject, loadScene 函数同样会被 reject，表示场景加载失败。
   * 请记住，整个 load 阶段都不要创建 GL 相关的对象，只创建 JS 对象
   * 此阶段晚于 processRawJSON
   * @param {Scene} scene
   * @param {SceneLoadOptions} options
   */
  static prepareResource: (scene: Scene, options: SceneLoadOptions) => Promise<void>;

  /**
   * 在加载到 JSON 后，就可以进行提前编译
   * @param json
   * @param player
   */
  precompile (compositions: spec.CompositionData[], renderer: Renderer): void { }

  onCompositionConstructed (composition: Composition, scene: Scene): void { }

  onCompositionReset (composition: Composition, frame: RenderFrame): void { }

  onCompositionDestroyed (composition: Composition): void { }

  onCompositionUpdate (composition: Composition, dt: number): void { }
}
