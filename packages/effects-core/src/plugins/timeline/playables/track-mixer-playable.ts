import * as spec from '@galacean/effects-specification';
import type { FrameContext, Playable } from '../playable';
import type { TrackAsset } from '../track';

export interface ClipEvaluationData {
  playableIndex: number,
  start: number,
  duration: number,
  endBehavior: spec.EndBehavior,
}

interface EvaluationSegment {
  start: number,
  end: number,
  clips: ClipEvaluationData[],
}

/** Compiled track evaluator. Binding objects and frame contexts are supplied by the timeline. */
export class TrackMixerPlayable {

  sourceTrack: TrackAsset;
  objectBindingId = '';
  clipPlayables: Playable[] = [];
  clipWeights: number[] = [];

  protected allowEmptySegments = false;

  private readonly segments: EvaluationSegment[] = [];
  private activeSegment: EvaluationSegment | null = null;
  private readonly clipContext: FrameContext = { time: 0, deltaTime: 0 };

  protected get activeClips (): readonly ClipEvaluationData[] {
    return this.activeSegment?.clips ?? [];
  }

  /** Whether the current time belongs to a compiled segment, including empty ones. */
  hasActiveSegment (): boolean {
    return this.activeSegment !== null;
  }

  /** Called before the track enters evaluation. */
  onBeginEvaluation (boundObject: object): void {
    // Override
  }

  /** Called after the track leaves evaluation. */
  onEndEvaluation (boundObject: object): void {
    // Override
  }

  /** Compile the evaluation ranges supplied by the source track into segments. */
  compileSegments (clips: ClipEvaluationData[]): void {
    this.segments.length = 0;
    this.activeSegment = null;
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

  /** Select the segment containing this time, including backward seeks and gaps. */
  prepareFrame (time: number): void {
    this.activeSegment = null;
    this.clipWeights.fill(0);
    let lower = 0;
    let upper = this.segments.length - 1;

    while (lower <= upper) {
      const index = Math.floor((lower + upper) / 2);
      const segment = this.segments[index];

      if (time < segment.start) {
        upper = index - 1;
      } else if (time >= segment.end) {
        lower = index + 1;
      } else {
        this.activeSegment = segment;

        break;
      }
    }
    for (const clip of this.activeClips) {
      this.clipWeights[clip.playableIndex] = 1;
    }
  }

  processFrame (boundObject: object, context: FrameContext): void {
    for (const clip of this.activeClips) {
      const clipPlayable = this.clipPlayables[clip.playableIndex];

      clipPlayable.processFrame(boundObject, this.getClipContext(clip, context));
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
    for (const clip of this.activeClips) {
      if (this.clipWeights[clip.playableIndex] > 0) {
        return true;
      }
    }

    return false;
  }

  protected getClipContext (clip: ClipEvaluationData, context: FrameContext): FrameContext {
    let time = context.time - clip.start;

    if (time > clip.duration) {
      if (clip.endBehavior === spec.EndBehavior.restart) {
        time %= clip.duration;
      } else if (clip.endBehavior === spec.EndBehavior.freeze) {
        time = clip.duration;
      }
    }
    this.clipContext.time = time;
    this.clipContext.deltaTime = context.deltaTime;

    return this.clipContext;
  }

  evaluate (boundObject: object, context: FrameContext) {
    // Override
  }

}
