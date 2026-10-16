import type { CompositionComponent } from '../../../components';
import type { FrameContext } from '../playable';
import { ClipPlayable } from '../playable';

export class SubCompositionClipPlayable extends ClipPlayable {
  override evaluate (boundObject: CompositionComponent | undefined, context: FrameContext): void {
    boundObject?.sampleTime(context.time);
  }
}
