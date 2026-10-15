import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

/**
 * @since 2.0.0
 */
export class ActivationPlayable extends Playable {

  override processFrame (boundObject: VFXItem, context: FrameContext): void {
    boundObject.time = context.time;
  }
}
