import { Asset } from '../../asset';

/**
 * Clip playable. Evaluation time is supplied by the track.
 * @since 2.0.0
 */
export class Playable {
  /** Compiled clip duration used by normalized curves. */
  duration = 0;

  processFrame (boundObject: object, context: FrameContext) {

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
