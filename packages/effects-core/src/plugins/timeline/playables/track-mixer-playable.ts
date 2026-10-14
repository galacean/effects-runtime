import type { FrameContext } from '../playable';
import { Playable, PlayState } from '../playable';
import type { RuntimeClip, TrackAsset } from '../track';

/** Compiled track evaluator. Binding objects and frame contexts are supplied by the timeline. */
export class TrackMixerPlayable extends Playable {

  sourceTrack: TrackAsset;
  objectBindingId = '';
  clipPlayables: Playable[] = [];
  clipWeights: number[] = [];

  private readonly runtimeClips: RuntimeClip[] = [];

  addRuntimeClip (clip: RuntimeClip): void {
    this.runtimeClips.push(clip);
    this.clipPlayables.push(clip.playable);
    this.setClipWeight(clip.playable, 0.0);
  }

  /** Resolve local clip times and weights before any track processes its frame. */
  prepareFrame (time: number): void {
    for (const clip of this.runtimeClips) {
      clip.evaluateAt(time);
    }
  }

  override processFrame (boundObject: object, context: FrameContext): void {
    for (const clipPlayable of this.clipPlayables) {
      if (clipPlayable.getPlayState() === PlayState.Playing) {
        clipPlayable.processFrame(boundObject, context);
      }
    }
    this.evaluate(boundObject, context);
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

  evaluate (boundObject: object, context: FrameContext) {
    // Override
  }

}
