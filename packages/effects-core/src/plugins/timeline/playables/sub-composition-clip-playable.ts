import type { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

export class SubCompositionClipPlayable extends Playable {
  override evaluate (boundObject: CompositionComponent | undefined, context: FrameContext): void {
    boundObject?.sampleTime(context.time);
  }
}
