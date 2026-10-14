import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ActivationMixerPlayable extends TrackMixerPlayable {

  override evaluate (boundItem: VFXItem, context: FrameContext): void {
    const active = this.hasActiveClip();

    boundItem.transform.setValid(active);
    boundItem.setActive(active);
  }
}
