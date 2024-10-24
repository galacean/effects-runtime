import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

/**
 * 音频加载插件
 */
export class AudioLoader extends AbstractPlugin {
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
