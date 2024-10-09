import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin, Asset, AssetManager, MediaType } from '@galacean/effects';
import type { PluginData } from '../type';

export class AudioLoader extends AbstractPlugin {
  static override async processRawJSON (json: spec.JSONScene, options: SceneLoadOptions): Promise<void> {
    const { audios = [] } = json;
    const { hookTimeInfo, renderer, assetManager } = options.pluginData as PluginData;

    const loadedAudios = await hookTimeInfo('processAudios', () => AssetManager.processMedia(audios, MediaType.audio, options));

    for (let i = 0; i < audios.length; i++) {
      assetManager.assets[audios[i].id] = loadedAudios[i];
    }

    if (renderer) {
      for (let i = 0; i < loadedAudios.length; i++) {
        const audioAsset = new Asset<HTMLAudioElement | AudioBuffer>(renderer.engine);

        audioAsset.data = loadedAudios[i] as HTMLAudioElement | AudioBuffer;
        audioAsset.setInstanceId(audios[i].id);
        renderer.engine.addInstance(audioAsset);
      }
    }

  }
}
