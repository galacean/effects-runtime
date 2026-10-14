import type { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class SubCompositionMixerPlayable extends TrackMixerPlayable {
  override evaluate (boundObject: CompositionComponent, context: FrameContext): void {
    boundObject.item.setActive(this.hasActiveClip());
  }
}
