import type { PrecompileOptions, Renderer, SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin, PLAYER_OPTIONS_ENV_EDITOR } from '@galacean/effects';
import { checkAutoplayPermission, processMultimedia } from '../utils';

/**
 * 音频加载插件
 */
export class AudioLoader extends AbstractPlugin {

  static override precompile (compositions: spec.Composition[], renderer: Renderer, options?: PrecompileOptions): Promise<any> {
    const engine = renderer.engine;
    const { env } = options ?? { env: '' };

    if (env === PLAYER_OPTIONS_ENV_EDITOR) {
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
    const { audios = [] } = json;
    const loadedAssets = await processMultimedia<HTMLAudioElement | AudioBuffer>(audios, spec.MultimediaType.audio, options);

    return {
      assets: audios,
      loadedAssets,
    };
  }
}
