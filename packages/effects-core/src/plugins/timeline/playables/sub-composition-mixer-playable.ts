import { CompositionComponent } from '../../../comp-vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { TrackMixerPlayable } from './track-mixer-playable';

export class SubCompositionMixerPlayable extends TrackMixerPlayable {
  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData();

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