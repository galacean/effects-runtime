import { Asset } from '../../asset';
import type { TimelineInstance } from './timeline-asset';

/**
 * Clip playable. Evaluation time is supplied by the track.
 * @since 2.0.0
 */
export class Playable {
  /** Compiled clip duration used by normalized curves. */
  duration = 0;

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

  /** The binding may be absent; sampling can still run without a target object. */
  evaluate (boundObject: object | undefined, context: FrameContext): void {
    // Override
  }
}

export abstract class PlayableAsset extends Asset {
  abstract createPlayable (): Playable;
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
