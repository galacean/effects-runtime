import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';
import type { TrackInstance } from '../track-instance';

export class TrackMixerPlayable extends Playable {

  trackInstance: TrackInstance;
  clipPlayables: Playable[] = [];
  clipWeights: number[] = [];

  override processFrame (context: FrameContext): void {
    for (const clipPlayable of this.clipPlayables) {
      clipPlayable.processFrame(context);
    }
    this.evaluate(context);
  }

  setClipWeight (playable: Playable, weight: number): void;

  setClipWeight (inputIndex: number, weight: number): void;

  setClipWeight (playableOrIndex: Playable | number, weight: number): void {
    if (playableOrIndex instanceof Playable) {
      for (let i = 0; i < this.clipPlayables.length; i++) {
        if (this.clipPlayables[i] === playableOrIndex) {
          this.clipWeights[i] = weight;

          return;
        }
      }
    } else {
      if (this.clipWeights.length < playableOrIndex + 1) {
        this.clipWeights.length = playableOrIndex + 1;
      }
      this.clipWeights[playableOrIndex] = weight;
    }
  }

  getClipWeight (inputIndex: number): number {
    return this.clipWeights[inputIndex];
  }

  getClipPlayable (index: number) {
    return this.clipPlayables[index];
  }

  evaluate (context: FrameContext) {
    // Override
  }

}
