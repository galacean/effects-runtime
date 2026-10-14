import type { FrameContext } from './playable';
import type { TrackMixerPlayable } from './playables';
import type { TrackAsset } from './track';

/**
 * A class that stores track assets, generated mixer playables, bindings, and frame contexts.
 * It is used to query the corresponding playable object based on the track asset.
 */
export class TrackInstance {
  boundObject: object;

  trackAsset: TrackAsset;
  mixer: TrackMixerPlayable;
  readonly context: FrameContext = { deltaTime: 0 };

  children: TrackInstance[] = [];

  constructor (trackAsset: TrackAsset, mixer: TrackMixerPlayable) {
    this.trackAsset = trackAsset;
    this.mixer = mixer;

    this.mixer.trackInstance = this;
  }

  addChild (trackInstance: TrackInstance) {
    this.children.push(trackInstance);
  }
}
