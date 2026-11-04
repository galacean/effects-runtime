import type * as spec from '@galacean/effects-specification';
import { Asset } from '../../asset';
import type { ClipPlayable } from './playable';

/** TODO: update to spec. */
export interface TimelineClipData extends spec.EffectsObjectData {
  start?: number,
  duration?: number,
  endBehavior?: spec.EndBehavior,
}

/**
 * Timeline clip data and its playable factory.
 * @since 2.0.0
 */
export abstract class TimelineClip extends Asset {
  name: string;
  start = 0;
  duration = 0;
  endBehavior: spec.EndBehavior;

  abstract createPlayable (): ClipPlayable;

  override fromData (data: TimelineClipData): void {
    super.fromData(data);
    if (data.name !== undefined) { this.name = data.name; }
    if (data.start !== undefined) { this.start = data.start; }
    if (data.duration !== undefined) { this.duration = data.duration; }
    if (data.endBehavior !== undefined) { this.endBehavior = data.endBehavior; }
  }
}
