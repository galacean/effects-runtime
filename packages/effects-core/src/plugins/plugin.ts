import type { Scene, SceneLoadOptions } from '../scene';
import type { Composition } from '../composition';
import type { Engine } from '../engine';

export interface PluginConstructor {
  new(): Plugin,

  [key: string]: any,
}

/**
 * 抽象插件类
 * 注册合成不同生命周期的回调函数
 */
export abstract class Plugin {
  order = 100;
  name = 'Plugin';

  /**
   * 场景加载时触发，用于加载插件所需的自定义资源。
   * 此阶段适合发起异步资源请求。
   * @param scene - 场景对象
   * @param options - 场景加载选项
   */
  async onAssetsLoadStart (scene: Scene, options?: SceneLoadOptions): Promise<void> { }

  /**
   * 场景资源加载完成后触发。
   * 此时 JSON 中的图片和二进制已加载完成，可对资源做进一步处理。
   * @param scene - 场景对象
   * @param options - 场景加载选项
   * @param engine - 引擎实例
   */
  onAssetsLoadFinish (scene: Scene, options: SceneLoadOptions, engine: Engine): void { }

  /**
   * 合成创建完成后触发。
   * @param composition - 合成对象
   * @param scene - 场景对象
   */
  onCompositionCreated (composition: Composition, scene?: Scene): void { }

  /**
   * 合成销毁时触发。
   * @param composition - 合成对象
   */
  onCompositionDestroy (composition: Composition): void { }

  /**
   * 引擎创建完成后触发。
   * 适用于注册引擎级单例、建立以引擎为键的映射、绑定全局监听等场景。
   * @param engine - 引擎实例
   * @since 2.10.0
   */
  onEngineCreated (engine: Engine): void { }

  /**
   * 引擎销毁时触发。
   * 适合解绑监听、释放引擎级资源或清理以引擎为键的映射。
   * @param engine - 引擎实例
   * @since 2.10.0
   */
  onEngineDestroy (engine: Engine): void { }
}
