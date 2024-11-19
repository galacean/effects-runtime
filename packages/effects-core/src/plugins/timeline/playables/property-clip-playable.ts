import type { ValueGetter } from '../../../math';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class PropertyClipPlayable<T> extends Playable {
  value: T;
  curve: ValueGetter<T>;

  override processFrame (context: FrameContext): void {
    this.value = this.curve.getValue(this.time / this.getDuration());
  }
}