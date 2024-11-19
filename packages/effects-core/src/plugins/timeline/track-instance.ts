import type { Playable, PlayableOutput } from '../cal/playable-graph';
import type { TrackAsset } from './track';

/**
 * A class that stores track assets and the generated mixer playables and playable outputs.
 * It is used to query the corresponding playable object based on the track asset.
 */
export class TrackInstance {
  trackAsset: TrackAsset;
  mixer: Playable;
  output: PlayableOutput;

  children: TrackInstance[] = [];

  constructor (trackAsset: TrackAsset, mixer: Playable, output: PlayableOutput) {
    this.trackAsset = trackAsset;
    this.mixer = mixer;
    this.output = output;
  }

  addChild (trackInstance: TrackInstance) {
    this.children.push(trackInstance);
  }
}