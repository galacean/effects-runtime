import type { FrameContext } from '../playable';
import type { CacheDataManager } from '../cache-data-manager';
import type { VFXItem } from '../../../vfx-item';
import type { TransformContribution, TransformPlayable } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

interface TransformEvaluationState {
  /** Lazily captured mixing baseline for the current active clip scopes. */
  initialValues?: number[],
  activeClips: Set<TransformPlayable>,
  nextActiveClips: Set<TransformPlayable>,
}

/** Blend valid absolute channels and keep the last applied transform when clips expire. */
export class TransformMixerPlayable extends TrackMixerPlayable {
  private readonly totals: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  private readonly weights: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  private readonly result: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  private readonly validChannels: boolean[] = [false, false, false, false, false, false, false, false, false];

  override evaluate (segmentId: number, item: VFXItem | undefined, context: FrameContext, cache: CacheDataManager): void {
    const states = cache.getOrAddTrackData(() => new WeakMap<VFXItem, TransformEvaluationState>());
    let state = item ? states.get(item) : undefined;

    if (item && !state) {
      state = {
        activeClips: new Set(), nextActiveClips: new Set(),
      };
      states.set(item, state);
    }
    state?.nextActiveClips.clear();
    this.totals.fill(0);
    this.weights.fill(0);
    this.validChannels.fill(false);
    let hasContinuingClip = false;

    for (const clip of this.getSegment(segmentId).clips) {
      const index = clip.playableIndex;
      const playable = this.clipPlayables[index] as TransformPlayable;

      this.evaluateClip(clip, item, context, cache);
      if (this.accumulate(playable.contribution, this.clipWeights[index]) && state) {
        state.nextActiveClips.add(playable);
        hasContinuingClip ||= state.activeClips.has(playable);
      }
    }

    if (!item || !state) {
      return;
    }
    // A new set of clips captures its own baseline without restoring the object.
    if (!hasContinuingClip) {
      state.initialValues = undefined;
    }
    const previousClips = state.activeClips;

    state.activeClips = state.nextActiveClips;
    state.nextActiveClips = previousClips;

    if (state.activeClips.size === 0) {
      return;
    }
    this.resolve(item, state);
    this.writeValues(item, this.result, this.validChannels);
  }

  private accumulate (contribution: TransformContribution, weight: number): boolean {
    let hasInput = false;

    for (let channel = 0; channel < 9; channel++) {
      if (!contribution.validChannels[channel]) {
        continue;
      }
      this.validChannels[channel] = true;
      this.totals[channel] += contribution.values[channel] * weight;
      this.weights[channel] += weight;
      hasInput = true;
    }

    return hasInput;
  }

  private resolve (item: VFXItem, state: TransformEvaluationState): void {
    this.readValues(item, this.result);
    for (let channel = 0; channel < 9; channel++) {
      if (!this.validChannels[channel]) {
        continue;
      }
      if (this.weights[channel] > 0) {
        this.result[channel] = this.totals[channel] / this.weights[channel];
      } else {
        // A zero-weight contribution still owns its channels; an absent one does not.
        state.initialValues ??= this.readValues(item, []);
        this.result[channel] = state.initialValues[channel];
      }
    }
  }

  private readValues (item: VFXItem, values: number[]): number[] {
    const { position, rotation, scale } = item.transform;

    values[0] = position.x;
    values[1] = position.y;
    values[2] = position.z;
    values[3] = rotation.x;
    values[4] = rotation.y;
    values[5] = rotation.z;
    values[6] = scale.x;
    values[7] = scale.y;
    values[8] = scale.z;

    return values;
  }

  private writeValues (item: VFXItem, values: number[], validChannels: boolean[]): void {
    if (validChannels[0] || validChannels[1] || validChannels[2]) {
      item.transform.setPosition(values[0], values[1], values[2]);
    }
    if (validChannels[3] || validChannels[4] || validChannels[5]) {
      item.transform.setRotation(values[3], values[4], values[5]);
    }
    if (validChannels[6] || validChannels[7] || validChannels[8]) {
      item.transform.setScale(values[6], values[7], values[8]);
    }
  }
}
