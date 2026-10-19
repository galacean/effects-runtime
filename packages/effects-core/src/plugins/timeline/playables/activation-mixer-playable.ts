import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import type { CacheDataManager } from '../cache-data-manager';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ActivationMixerPlayable extends TrackMixerPlayable {
  constructor () {
    super();
    this.allowEmptySegments = true;
  }

  override evaluate (segmentId: number, boundItem: VFXItem | undefined, context: FrameContext, cache: CacheDataManager): void {
    if (!boundItem) {
      return;
    }
    this.defaultEvaluate(segmentId, boundItem, context, cache);
    const active = this.hasActiveClip(segmentId);

    boundItem.transform.setValid(active);
    boundItem.setActive(active);
  }
}
