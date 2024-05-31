import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class ActivationMixerPlayable extends Playable {
  private bindingItem: VFXItem;

  override processFrame (context: FrameContext): void {
    if (!this.bindingItem) {
      this.bindingItem = context.output.getUserData() as VFXItem;
    }

    if (!this.bindingItem) {
      return;
    }
    const bindingItem = this.bindingItem;

    let hasInput = false;

    for (let i = 0; i < this.getInputCount(); i++) {
      if (this.getInputWeight(i) > 0) {
        hasInput = true;

        break;
      }
    }

    if (hasInput) {
      bindingItem.transform.setValid(true);
      this.showRendererComponents(bindingItem);
    } else {
      bindingItem.transform.setValid(false);
      this.hideRendererComponents(bindingItem);
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
