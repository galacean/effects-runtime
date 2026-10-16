import type { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import type { TimelineInstance } from '../timeline-instance';
import { TrackMixerPlayable } from './track-mixer-playable';

export class ActivationMixerPlayable extends TrackMixerPlayable {
  private boundItem: VFXItem | undefined;
  private originalActive: boolean;
  private originalTransformValid: boolean;

  constructor () {
    super();
    this.allowEmptySegments = true;
    this.requiresSetup = true;
    this.requiresTearDown = true;
  }

  protected override setup (timeline: TimelineInstance): void {
    const boundItem = timeline.getBoundObject(this.objectBindingId) as VFXItem | undefined;

    this.boundItem = boundItem;
    if (boundItem) {
      this.originalActive = boundItem.isActive;
      this.originalTransformValid = boundItem.transform.getValid();
    }
  }

  protected override tearDown (timeline: TimelineInstance): void {
    const { boundItem, originalActive, originalTransformValid } = this;

    this.boundItem = undefined;
    if (boundItem) {
      boundItem.transform.setValid(originalTransformValid);
      boundItem.setActive(originalActive);
    }
  }

  override evaluate (segmentId: number, boundItem: VFXItem | undefined, context: FrameContext): void {
    this.defaultEvaluate(segmentId, boundItem, context);
    if (!boundItem) {
      return;
    }
    const active = this.hasActiveClip(segmentId);

    boundItem.transform.setValid(active);
    boundItem.setActive(active);
  }
}
