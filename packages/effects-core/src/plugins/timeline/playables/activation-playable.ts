import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

/**
 * @since 2.0.0
 */
export class ActivationPlayable extends Playable {

  override processFrame (context: FrameContext): void {
    const vfxItem = context.output.getUserData();

    if (!(vfxItem instanceof VFXItem)) {
      return;
    }

    vfxItem.time = this.time;
  }
}