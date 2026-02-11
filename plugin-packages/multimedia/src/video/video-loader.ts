import type { Scene, SceneLoadOptions } from '@galacean/effects';
import { spec, Plugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

/**
 * 视频加载插件
 */
export class VideoLoader extends Plugin {

  override async onAssetsLoadStart (
    scene: Scene,
    options: SceneLoadOptions = {},
  ) {
    const { videos = [] } = scene.jsonScene;
    const loadedAssets = await processMultimedia<HTMLVideoElement>(videos, spec.MultimediaType.video, options);

    videos.forEach((video, index) => {
      scene.assets[video.id] = loadedAssets[index];
    });
  }
}
