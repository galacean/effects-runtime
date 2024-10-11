import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin, Asset } from '@galacean/effects';
import type { PluginData } from '../type';
import { checkAutoplayPermission, processMultimedia } from '../utils';

export class AudioLoader extends AbstractPlugin {
  static override async processRawJSON (
    json: spec.JSONScene,
    options: SceneLoadOptions,
  ): Promise<void> {
    await checkAutoplayPermission();
    const { audios = [] } = json;
    const { hookTimeInfo, engine, assets } = options.pluginData as PluginData;
    const loadedAudios = (await hookTimeInfo('processAudios', () => processMultimedia(audios, spec.MultimediaType.audio, options))).filter(item => item !== undefined);

    for (let i = 0; i < audios.length; i++) {
      assets[audios[i].id] = loadedAudios[i];
    }

    if (engine) {
      for (let i = 0; i < loadedAudios.length; i++) {
        const audioAsset = new Asset<HTMLAudioElement | AudioBuffer>(engine);

        audioAsset.data = loadedAudios[i];
        audioAsset.setInstanceId(audios[i].id);
        engine.addInstance(audioAsset);
      }
    }
  }
}
