import type * as spec from '@galacean/effects-specification';
import type { SceneLoadOptions } from '../asset-manager';
import type { Scene } from '../scene';
import type { VFXItem } from '../vfx-item';
import type { RenderFrame, Renderer } from '../render';
import type { Composition } from '../composition';

export interface Plugin {
  /**
   * plugin 的数组内排序，按照升序排列
   * 默认为100
   */
  order: number,
  name: string,

  /**
   * 合成创建时调用，用于触发元素在合成创建时的回调
   * @param composition
   * @param scene
   */
  onCompositionConstructed: (composition: Composition, scene: Scene) => void,

  /**
   * 合成 delay 结束后触发，合成播放阶段只触发一次此函数
   * @param composition
   * @param item
   */
  onCompositionItemLifeBegin: (composition: Composition, item: VFXItem<any>) => void,

  /**
   * 合成生命周期结束时触发（无论结束行为）
   * 合成播放阶段只触发一次此函数
   * @param composition
   * @param item
   */
  onCompositionItemLifeEnd: (composition: Composition, item: VFXItem<any>) => void,

  /**
   * 合成销毁时触发（当合成的结束行为是冻结、循环或合成配置了 reusable 时不触发）
   * 元素销毁应该在合成销毁时调用。
   * @param composition
   * @param item
   */
  onCompositionItemRemoved: (composition: Composition, item: VFXItem<any>) => void,

  /**
   * 合成重播时的回调
   * @param composition
   * @param frame
   */
  onCompositionReset: (composition: Composition, frame: RenderFrame) => void,

  /**
   * 合成即将重播，此函数后 frame 会被销毁
   * @param composition
   * @param frame
   */
  onCompositionWillReset: (composition: Composition, frame: RenderFrame) => void,

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

  /**
   * 合成更新后，在渲染前进行 RenderFrame 的配置，添加渲染的 Mesh 到 renderFrame 中，
   * 如果此函数返回 true，将进行 renderFrame 后处理函数配置
   * mesh 的 priority 必须等于 item.listIndex，否则渲染顺序将不符合 Galacean Effects 的规则
   * @param composition
   * @param frame
   * @return 默认 false，为 true 时才会执行 postProcessFrame
   */
  prepareRenderFrame (composition: Composition, frame: RenderFrame): boolean,

  /**
   * 当所有的 plugin 都调用过 prepareRenderFrame 后，对于需要进行后处理的 plugin，调用此函数，
   * 此函数一般用于切割 renderPass，如果对于 renderPass 有切割，记得在销毁时还原切割
   * @param composition
   * @param frame
   */
  postProcessFrame: (composition: Composition, frame: RenderFrame) => void,
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
   * player.loadScene 函数调用的时候会触发此函数，
   * 此阶段可以对资源 JSON 进行处理，替换调 JSON 中的数据，或者直接终止加载流程
   * 一旦被 reject，加载过程将失败
   * @param json 动画资源
   * @param options 加载参数
   */
  static processRawJSON: (json: spec.JSONScene, options: SceneLoadOptions) => Promise<void>;

  /**
   * player.loadScene 函数调用的时候会触发此函数，
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
  static precompile (compositions: spec.Composition[], renderer: Renderer): Promise<void> {
    return Promise.resolve();
  }

  onCompositionConstructed (composition: Composition, scene: Scene): void { }

  onCompositionItemLifeBegin (composition: Composition, item: VFXItem<any>): void { }

  onCompositionItemLifeEnd (composition: Composition, item: VFXItem<any>): void { }

  onCompositionItemRemoved (composition: Composition, item: VFXItem<any>): void { }

  onCompositionReset (composition: Composition, frame: RenderFrame): void { }

  onCompositionWillReset (composition: Composition, frame: RenderFrame): void { }

  onCompositionDestroyed (composition: Composition): void { }

  onCompositionUpdate (composition: Composition, dt: number): void { }

  prepareRenderFrame (composition: Composition, frame: RenderFrame): boolean {
    return false;
  }

  postProcessFrame (composition: Composition, frame: RenderFrame): void { }
}
