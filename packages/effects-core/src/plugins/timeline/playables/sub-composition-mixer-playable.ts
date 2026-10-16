import type { CompositionComponent } from '../../../components';
import { UpdateModes } from '../../../components';
import type { TimelineInstance } from '../timeline-asset';
import { TrackMixerPlayable } from './track-mixer-playable';

export class SubCompositionMixerPlayable extends TrackMixerPlayable {
  private boundObject: CompositionComponent | undefined;
  private originalUpdateMode: UpdateModes;

  constructor () {
    super();
    this.requiresSetup = true;
    this.requiresTearDown = true;
  }

  protected override setup (timeline: TimelineInstance): void {
    const boundObject = timeline.getBoundObject(this.objectBindingId) as CompositionComponent | undefined;

    this.boundObject = boundObject;
    if (boundObject) {
      this.originalUpdateMode = boundObject.updateMode;
      boundObject.updateMode = UpdateModes.Manual;
    }
  }

  protected override tearDown (timeline: TimelineInstance): void {
    const { boundObject, originalUpdateMode } = this;

    this.boundObject = undefined;
    if (boundObject) {
      boundObject.finishEvaluation();
      boundObject.updateMode = originalUpdateMode;
    }
  }
}
