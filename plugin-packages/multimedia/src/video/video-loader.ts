import type { SceneLoadOptions } from '@galacean/effects';
import { spec, AbstractPlugin } from '@galacean/effects';
import { processMultimedia } from '../utils';

export class VideoLoader extends AbstractPlugin {
  static override async processAssets (
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
