import type { CompositionComponent } from '../../../components';
import { UpdateModes } from '../../../components';
import { TrackMixerPlayable } from './track-mixer-playable';

export class SubCompositionMixerPlayable extends TrackMixerPlayable {
  private originalUpdateMode: UpdateModes;

  override onBeginEvaluation (boundObject: CompositionComponent): void {
    this.originalUpdateMode = boundObject.updateMode;
    boundObject.updateMode = UpdateModes.Manual;
  }

  override onEndEvaluation (boundObject: CompositionComponent): void {
    boundObject.finishEvaluation();
    boundObject.updateMode = this.originalUpdateMode;
  }
}
