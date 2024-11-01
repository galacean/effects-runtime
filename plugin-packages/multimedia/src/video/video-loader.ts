import type { PrecompileOptions, Renderer, SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { checkAutoplayPermission, processMultimedia } from '../utils';

/**
 * 视频加载插件
 */
export class VideoLoader extends AbstractPlugin {

  static override precompile (compositions: spec.Composition[], renderer: Renderer, options?: PrecompileOptions): Promise<any> {
    const engine = renderer.engine;
    const { env } = options ?? { env: '' };

    if (env === 'editor') {
      return checkAutoplayPermission().catch(error => {
        engine.renderErrors.add(error);
      });
    }

    return Promise.resolve();
  }

  static override async processAssets (
    json: spec.JSONScene,
    options: SceneLoadOptions = {},
  ) {
    const { videos = [] } = json;
    const loadedAssets = await processMultimedia<HTMLVideoElement>(videos, spec.MultimediaType.video, options);

    return {
      assets: videos,
      loadedAssets,
    };
  }
}
