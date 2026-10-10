import type { CompositionComponent } from '../../components';
import type { PlayableOutput } from './playable';
import type { TrackMixerPlayable } from './playables';
import type { TrackAsset } from './track';

/**
 * A class that stores track assets and the generated mixer playables and playable outputs.
 * It is used to query the corresponding playable object based on the track asset.
 */
export class TrackInstance {
  boundObject: object;

  trackAsset: TrackAsset;
  mixer: TrackMixerPlayable;
  output: PlayableOutput;
  /** 播放器 restoreData 中的索引；-1 表示尚未缓存。 */
  restoreStateIndex = -1;

  children: TrackInstance[] = [];

  constructor (
    trackAsset: TrackAsset,
    mixer: TrackMixerPlayable,
    output: PlayableOutput,
    readonly composition: CompositionComponent,
  ) {
    this.trackAsset = trackAsset;
    this.mixer = mixer;
    this.output = output;

    this.mixer.trackInstance = this;
  }

  addChild (trackInstance: TrackInstance) {
    this.children.push(trackInstance);
  }
}
