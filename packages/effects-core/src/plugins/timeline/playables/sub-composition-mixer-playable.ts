import { CompositionComponent } from '../../../comp-vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class SubCompositionMixerPlayable extends Playable {
  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!(boundObject instanceof CompositionComponent)) {
      return;
    }

    const compositionComponent = boundObject;

    let hasInput = false;

    for (let i = 0; i < this.getInputCount(); i++) {
      if (this.getInputWeight(i) > 0) {
        hasInput = true;

        break;
      }
    }

    if (hasInput) {
      compositionComponent.showItems();
    } else {
      compositionComponent.hideItems();
    }
  }
}