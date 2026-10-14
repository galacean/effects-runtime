import { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class SubCompositionMixerPlayable extends TrackMixerPlayable {
  override evaluate (boundObject: object, context: FrameContext): void {
    if (!(boundObject instanceof CompositionComponent)) {
      return;
    }

    const compositionComponent = boundObject;

    let hasInput = false;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      if (this.getClipWeight(i) > 0) {
        hasInput = true;

        break;
      }
    }

    if (hasInput) {
      compositionComponent.item.setActive(true);
    } else {
      compositionComponent.item.setActive(false);
    }
  }
}
