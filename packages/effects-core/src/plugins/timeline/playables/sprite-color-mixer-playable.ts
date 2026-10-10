import { MaskableGraphic } from '../../../components';
import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class SpriteColorMixerPlayable extends TrackMixerPlayable {

  override captureRestoreState (context: FrameContext): number {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return -1;
    }
    const material = item.getComponent(MaskableGraphic)?.material;
    const color = material?.getColor('_Color');

    if (!material || !color) {
      return -1;
    }

    return this.trackInstance.composition.addRestoreData(color.toArray());
  }

  override restoreState (context: FrameContext, value: number[]): void {
    const item = context.output.getUserData();

    if (item instanceof VFXItem) {
      item.getComponent(MaskableGraphic)?.material.getColor('_Color')?.setFromArray(value);
    }
  }

  override evaluate (context: FrameContext): void {
  }
}
