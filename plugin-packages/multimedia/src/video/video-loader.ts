import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin, Asset } from '@galacean/effects';
import type { PluginData } from '../type';
import { processMultimedia } from '../utils';

export class VideoLoader extends AbstractPlugin {
  static override async processRawJSON (
    json: spec.JSONScene,
    options: SceneLoadOptions,
  ): Promise<void> {
    const { videos = [] } = json;
    const { hookTimeInfo, engine, assets } = options.pluginData as PluginData;
    const loadedVideos = (await hookTimeInfo('processVideos', () => processMultimedia(videos, spec.MultimediaType.video, options))).filter(item => item !== undefined);

    for (let i = 0; i < videos.length; i++) {
      assets[videos[i].id] = loadedVideos[i];
    }

    if (engine) {
      for (let i = 0; i < loadedVideos.length; i++) {
        const videoAsset = new Asset<HTMLVideoElement>(engine);

        videoAsset.data = loadedVideos[i] as HTMLVideoElement;
        videoAsset.setInstanceId(videos[i].id);
        engine.addInstance(videoAsset);
      }
    }
  }
}
