import { CompositionComponent } from '../../../comp-vfx-item';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class SubCompositionClipPlayable extends Playable {

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!(boundObject instanceof CompositionComponent)) {
      return;
    }

    boundObject.time = this.getTime();
  }
}