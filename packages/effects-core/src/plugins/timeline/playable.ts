import { Asset } from '../../asset';
import type { CacheDataManager } from './cache-data-manager';

/**
 * Shared evaluation lifecycle for clips and track mixers.
 * @since 2.0.0
 */
export abstract class Playable {
  /** Called when this track or clip enters evaluation. */
  onBeginEvaluation (cache: CacheDataManager): void {
    // Override
  }

  /** Called when this track or clip leaves evaluation. */
  onEndEvaluation (cache: CacheDataManager): void {
    // Override
  }
}

/** Clip playable. Evaluation time is supplied by the track. */
export class ClipPlayable extends Playable {
  /** Compiled clip duration used by normalized curves. */
  duration = 0;

  /** The binding may be absent; sampling can still run without a target object. */
  evaluate (boundObject: object | undefined, context: FrameContext, cache: CacheDataManager): void {
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
