import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

/**
 * @since 2.0.0
 */
export class ActivationPlayable extends Playable {

  override processFrame (boundObject: object, context: FrameContext): void {
    const vfxItem = boundObject;

    if (!(vfxItem instanceof VFXItem)) {
      return;
    }

    vfxItem.time = this.time;
  }
}
