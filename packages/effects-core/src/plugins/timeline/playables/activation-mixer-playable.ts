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
      this.showRendererComponents(boundItem);
    } else {
      boundItem.transform.setValid(false);
      this.hideRendererComponents(boundItem);
    }
  }

  private hideRendererComponents (item: VFXItem) {
    for (const rendererComponent of item.rendererComponents) {
      if (rendererComponent.enabled) {
        rendererComponent.enabled = false;
      }
    }
  }

  private showRendererComponents (item: VFXItem) {
    for (const rendererComponent of item.rendererComponents) {
      if (!rendererComponent.enabled) {
        rendererComponent.enabled = true;
      }
    }
  }
}
