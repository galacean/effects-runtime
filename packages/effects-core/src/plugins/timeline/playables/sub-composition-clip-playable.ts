import type { CompositionComponent } from '../../../comp-vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class SubCompositionClipPlayable extends Playable {

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData() as CompositionComponent;

    boundObject.time = this.getTime();
  }
}