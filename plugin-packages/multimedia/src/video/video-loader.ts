import type { SceneLoadOptions, spec } from '@galacean/effects';
import { AbstractPlugin, Asset, AssetManager, MediaType } from '@galacean/effects';
import type { PluginData } from '../type';

export class VideoLoader extends AbstractPlugin {
  static override async processRawJSON (
    json: spec.JSONScene,
    options: SceneLoadOptions,
  ): Promise<void> {
    const { videos = [] } = json;
    const { hookTimeInfo, renderer, assetManager } = options.pluginData as PluginData;
    const loadedVideos = await hookTimeInfo('processVideos', () => AssetManager.processMedia(videos, MediaType.video, options));

    for (let i = 0; i < videos.length; i++) {
      assetManager.assets[videos[i].id] = loadedVideos[i];
    }

    if (renderer) {
      for (let i = 0; i < loadedVideos.length; i++) {
        const videoAsset = new Asset<HTMLVideoElement>(renderer.engine);

        videoAsset.data = loadedVideos[i] as HTMLVideoElement;
        videoAsset.setInstanceId(videos[i].id);
        renderer.engine.addInstance(videoAsset);
      }
    }

  }
}
