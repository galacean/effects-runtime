import type { FrameContext } from '../playable';
import { Playable, PlayState } from '../playable';
import type { RuntimeClip, TrackAsset } from '../track';

/** Compiled track evaluator. Binding objects and frame contexts are supplied by the timeline. */
export class TrackMixerPlayable extends Playable {

  sourceTrack: TrackAsset;
  objectBindingId = '';
  clipPlayables: Playable[] = [];
  clipWeights: number[] = [];

  protected readonly runtimeClips: RuntimeClip[] = [];

  addRuntimeClip (clip: RuntimeClip): void {
    this.runtimeClips.push(clip);
    this.clipPlayables.push(clip.playable);
    this.clipWeights.push(0);
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
    const index = typeof playableOrIndex === 'number' ? playableOrIndex : this.clipPlayables.indexOf(playableOrIndex);

    if (index >= 0) {
      this.clipWeights[index] = weight;
    }
  }

  getClipWeight (inputIndex: number): number {
    return this.clipWeights[inputIndex];
  }

  getClipPlayable (index: number) {
    return this.clipPlayables[index];
  }

  protected hasActiveClip (): boolean {
    for (let i = 0; i < this.clipPlayables.length; i++) {
      if (this.clipWeights[i] > 0) {
        return true;
      }
    }

    return false;
  }

  evaluate (boundObject: object, context: FrameContext) {
    // Override
  }

}
