import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

/**
 * 视频加载插件
 */
export class VideoLoader extends AbstractPlugin {

  override async processAssets (
    json: spec.JSONScene,
    options: SceneLoadOptions = {},
  ) {
    const { videos = [] } = json;
    const loadedAssets = await processMultimedia<HTMLVideoElement>(videos, spec.MultimediaType.video, options);

    return {
      assets: videos,
      loadedAssets,
    };
  }
}
