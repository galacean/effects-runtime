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
      // Parent clips supply time directly while standalone playback state remains independent.
      this.originalUpdateMode = boundObject.updateMode;
      boundObject.updateMode = UpdateModes.Manual;
    }
  }

  protected override tearDown (timeline: TimelineInstance): void {
    const { boundObject, originalUpdateMode } = this;

    this.boundObject = undefined;
    if (boundObject) {
      // Release the child's evaluation at its current time before restoring its update mode.
      boundObject.finishEvaluation();
      boundObject.updateMode = originalUpdateMode;
    }
  }
}
