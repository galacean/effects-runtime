import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { ClipPlayable } from '../playable';

/**
 * @since 2.0.0
 */
export class ActivationPlayable extends ClipPlayable {

  override evaluate (boundObject: VFXItem | undefined, context: FrameContext): void {
    if (boundObject) {
      boundObject.time = context.time;
    }
  }
}
