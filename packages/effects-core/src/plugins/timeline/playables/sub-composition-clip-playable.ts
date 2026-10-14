import { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

export class SubCompositionClipPlayable extends Playable {
  override processFrame (boundObject: object, context: FrameContext): void {
    if (boundObject instanceof CompositionComponent) {
      // RuntimeClip has already mapped parent time through the clip's range
      // and end behavior, so sample that time directly.
      boundObject.sampleTime(this.getTime());
    }
  }
}
