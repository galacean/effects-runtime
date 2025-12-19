import { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

export class SubCompositionClipPlayable extends Playable {
  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (boundObject instanceof CompositionComponent) {
      boundObject.time = this.getTime();
    }
  }
}
