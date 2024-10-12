import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { checkAutoplayPermission, processMultimedia } from '../utils';

export class AudioLoader extends AbstractPlugin {
  static override async prepareAssets (
    json: spec.JSONScene,
    options: SceneLoadOptions = {},
  ) {
    await checkAutoplayPermission();
    const { audios = [] } = json;
    const loadedAssets = await processMultimedia<HTMLAudioElement | AudioBuffer>(audios, spec.MultimediaType.audio, options);

    return {
      assets: audios,
      loadedAssets,
    };
  }
}
