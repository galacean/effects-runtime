import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { processMultimedia, checkAutoplayPermission } from '../utils';

export class VideoLoader extends AbstractPlugin {
  static override async prepareAssets (
    json: spec.JSONScene,
    options: SceneLoadOptions = {},
  ) {
    await checkAutoplayPermission();
    const { videos = [] } = json;
    const loadedAssets = await processMultimedia<HTMLVideoElement>(videos, spec.MultimediaType.video, options);

    return {
      assets: videos,
      loadedAssets,
    };
  }
}
