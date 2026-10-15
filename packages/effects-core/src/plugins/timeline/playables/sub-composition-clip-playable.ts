import type { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

export class SubCompositionClipPlayable extends Playable {
  override processFrame (boundObject: CompositionComponent, context: FrameContext): void {
    boundObject.sampleTime(context.time);
  }
}
