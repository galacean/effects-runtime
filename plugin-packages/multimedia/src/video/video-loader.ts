import type { Scene, SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

/**
 * 视频加载插件
 */
export class VideoLoader extends AbstractPlugin {

  override async processAssets (
    scene: Scene,
    options: SceneLoadOptions = {},
  ) {
    const { videos = [] } = scene.jsonScene;
    const loadedAssets = await processMultimedia<HTMLVideoElement>(videos, spec.MultimediaType.video, options);

    for (let i = 0;i < videos.length;i++) {
      const video = videos[i];

      scene.assets[video.id] = loadedAssets[i];
    }
  }
}
