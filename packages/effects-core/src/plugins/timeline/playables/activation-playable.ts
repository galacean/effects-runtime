import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

interface AnimationGraphRuntimeTimeComponent {
  clearAnimationGraphRuntimeTime: () => void,
}

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
    // Timeline owns item.time on this path, so any AnimationGraph runtime duration held by components is stale.
    this.clearAnimationGraphRuntimeTime(vfxItem);
  }

  private clearAnimationGraphRuntimeTime (vfxItem: VFXItem): void {
    for (const component of vfxItem.components) {
      const runtimeTimeComponent = component as Partial<AnimationGraphRuntimeTimeComponent>;

      if (typeof runtimeTimeComponent.clearAnimationGraphRuntimeTime === 'function') {
        runtimeTimeComponent.clearAnimationGraphRuntimeTime();
      }
    }
  }
}
