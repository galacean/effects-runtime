import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class ActivationMixerPlayable extends Playable {

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!(boundObject instanceof VFXItem)) {
      return;
    }

    const boundItem = boundObject;

    let hasInput = false;

    for (let i = 0; i < this.getInputCount(); i++) {
      if (this.getInputWeight(i) > 0) {
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
