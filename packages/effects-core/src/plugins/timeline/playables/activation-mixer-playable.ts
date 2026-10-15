import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ActivationMixerPlayable extends TrackMixerPlayable {
  private originalActive: boolean;
  private originalTransformValid: boolean;

  constructor () {
    super();
    this.allowEmptySegments = true;
  }

  override onBeginEvaluation (boundItem: VFXItem): void {
    this.originalActive = boundItem.isActive;
    this.originalTransformValid = boundItem.transform.getValid();
  }

  override onEndEvaluation (boundItem: VFXItem): void {
    boundItem.transform.setValid(this.originalTransformValid);
    boundItem.setActive(this.originalActive);
  }

  override evaluate (boundItem: VFXItem, context: FrameContext): void {
    const active = this.hasActiveClip();

    boundItem.transform.setValid(active);
    boundItem.setActive(active);
  }
}
