import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ActivationMixerPlayable extends TrackMixerPlayable {

  override evaluate (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!(boundObject instanceof VFXItem)) {
      return;
    }

    const boundItem = boundObject;

    let hasInput = false;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      if (this.getClipWeight(i) > 0) {
        hasInput = true;

        break;
      }
    }

    if (hasInput) {
      boundItem.transform.setValid(true);
      boundItem.setActive(true);
    } else {
      boundItem.transform.setValid(false);
      boundItem.setActive(false);
    }
  }
}
