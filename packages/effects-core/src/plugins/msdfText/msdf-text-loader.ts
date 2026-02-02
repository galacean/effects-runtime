import { Plugin } from '../plugin';
import type { Scene, SceneLoadOptions } from '../../scene';
import type { Engine } from '../../engine';

/**
 * MSDF文本插件加载器
 */
export class MSDFTextLoader extends Plugin {
  override name = 'msdfText';

  override async onAssetsLoadStart (scene: Scene, options?: SceneLoadOptions): Promise<void> {
    // 可以在这里预加载字体资源
    // 目前由用户自行加载字体资源
  }

  override onAssetsLoadFinish (scene: Scene, options: SceneLoadOptions, engine: Engine): void {
    // 资源加载完成后的处理
  }
}
