import type { ImageLike, Scene, SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

/**
 * 音频加载插件
 */
export class AudioLoader extends AbstractPlugin {

  override async processAssets (
    scene: Scene,
    options: SceneLoadOptions = {},
  ) {
    const { audios = [] } = scene.jsonScene;
    const loadedAssets = await processMultimedia<HTMLAudioElement | AudioBuffer>(audios, spec.MultimediaType.audio, options);

    for (let i = 0;i < audios.length;i++) {
      const audio = audios[i];

      scene.assets[audio.id] = loadedAssets[i] as ImageLike;
    }
  }
}
