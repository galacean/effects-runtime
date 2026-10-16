import { Asset } from '../../asset';
import type { TimelineInstance } from './timeline-instance';

/**
 * Shared evaluation lifecycle for clips and track mixers.
 * @since 2.0.0
 */
export abstract class Playable {
  protected requiresSetup = false;
  protected requiresTearDown = false;

  onBeginEvaluation (timeline: TimelineInstance): void {
    if (this.requiresSetup) {
      this.setup(timeline);
    }
  }

  onEndEvaluation (timeline: TimelineInstance): void {
    if (this.requiresTearDown) {
      this.tearDown(timeline);
    }
  }

  protected setup (timeline: TimelineInstance): void {
    // Override
  }

  protected tearDown (timeline: TimelineInstance): void {
    // Override
  }
}

/** Clip playable. Evaluation time is supplied by the track. */
export class ClipPlayable extends Playable {
  /** Compiled clip duration used by normalized curves. */
  duration = 0;

  /** The binding may be absent; sampling can still run without a target object. */
  evaluate (boundObject: object | undefined, context: FrameContext): void {
    // Override
  }
}

export abstract class PlayableAsset extends Asset {
  abstract createPlayable (): ClipPlayable;
}

export interface FrameContext {
  /** Current evaluation time, mapped into clip space when evaluating a playable. */
  time: number,
  deltaTime: number,
}

export enum PlayState {
  Playing,
  Paused,
  Stopped,
}
