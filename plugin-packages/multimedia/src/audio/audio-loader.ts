import type { Scene, SceneLoadOptions } from '@galacean/effects';
import { spec, Plugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

/**
 * 音频加载插件
 */
export class AudioLoader extends Plugin {

  override async onAssetsLoadStart (
    scene: Scene,
    options: SceneLoadOptions = {},
  ) {
    const { audios = [] } = scene.jsonScene;

    scene.audios = await processMultimedia<HTMLAudioElement | AudioBuffer>(audios, spec.MultimediaType.audio, options);
  }
}
