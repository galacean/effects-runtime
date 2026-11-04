import * as spec from '@galacean/effects-specification';
import type { ClipPlayable, FrameContext } from '../playable';
import { Playable } from '../playable';
import type { TrackAsset } from '../track';
import type { CacheDataManager } from '../cache-data-manager';

export interface ClipEvaluationData {
  playableIndex: number,
  start: number,
  duration: number,
  endBehavior: spec.EndBehavior,
}

export interface EvaluationSegment {
  start: number,
  end: number,
  clips: ClipEvaluationData[],
}

/** Compiled track evaluator. Binding objects and frame contexts are supplied by the timeline. */
export class TrackMixerPlayable extends Playable {

  sourceTrack: TrackAsset;
  objectBindingId = '';
  clipPlayables: ClipPlayable[] = [];
  clipWeights: number[] = [];

  protected allowEmptySegments = false;

  private readonly segments: EvaluationSegment[] = [];

  getSegments (): readonly EvaluationSegment[] {
    return this.segments;
  }

  getSegment (segmentId: number): EvaluationSegment {
    return this.segments[segmentId];
  }

  /** Compile the evaluation ranges supplied by the source track into segments. */
  compileSegments (clips: ClipEvaluationData[]): void {
    this.segments.length = 0;
    this.clipWeights.fill(0);
    const boundaries = new Set<number>();

    if (this.allowEmptySegments) {
      boundaries.add(-Infinity);
      boundaries.add(Infinity);
    }

    for (const clip of clips) {
      const end = clip.endBehavior === spec.EndBehavior.destroy ? clip.start + clip.duration : Infinity;

      if (end <= clip.start) {
        continue;
      }
      boundaries.add(clip.start);
      boundaries.add(end);
    }
    const times = Array.from(boundaries).sort((a, b) => a - b);

    for (let i = 0; i < times.length - 1; i++) {
      const start = times[i];
      const activeClips: ClipEvaluationData[] = [];

      for (const clip of clips) {
        const end = clip.endBehavior === spec.EndBehavior.destroy ? clip.start + clip.duration : Infinity;

        if (start >= clip.start && start < end) {
          activeClips.push(clip);
        }
      }
      if (this.allowEmptySegments || activeClips.length > 0) {
        this.segments.push({ start, end: times[i + 1], clips: activeClips });
      }
    }
  }

  /** Mix the selected segment's clip samples and write the result to the bound object. */
  evaluate (segmentId: number, boundObject: object | undefined, context: FrameContext, cache: CacheDataManager): void {
    // Override
  }

  setClipWeight (playable: ClipPlayable, weight: number): void;

  setClipWeight (inputIndex: number, weight: number): void;

  setClipWeight (playableOrIndex: ClipPlayable | number, weight: number): void {
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

  protected hasActiveClip (segmentId: number): boolean {
    for (const clip of this.getSegment(segmentId).clips) {
      if (this.clipWeights[clip.playableIndex] > 0) {
        return true;
      }
    }

    return false;
  }
}
