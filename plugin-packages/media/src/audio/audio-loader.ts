import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin, Asset, AssetManager, MediaType } from '@galacean/effects';

export class AudioLoader extends AbstractPlugin {
  static override async processRawJSON(json: spec.JSONScene, options: SceneLoadOptions): Promise<void> {
    const { audios = [] } = json;
    const { hookTimeInfo, renderer, assetManager } = options.pluginData as Record<string, any>;

    const [loadedAudios] = await Promise.all([
      hookTimeInfo('processVideos', () => AssetManager.processMedia(audios, MediaType.audio, options)),
    ]);

    if (renderer) {
      for (let i = 0; i < loadedAudios.length; i++) {
        const audioAsset = new Asset<HTMLAudioElement | AudioBuffer>(renderer.engine);

        audioAsset.data = loadedAudios[i] as HTMLAudioElement | AudioBuffer;
        audioAsset.setInstanceId(audios[i].id);
        renderer.engine.addInstance(audioAsset);
      }

      for (let i = 0; i < audios.length; i++) {
        assetManager.assets[audios[i].id] = loadedAudios[i];
      }
    }

  }
}
