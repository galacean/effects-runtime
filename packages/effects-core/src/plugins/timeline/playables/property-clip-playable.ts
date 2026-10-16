import type { ValueGetter } from '../../../math';
import type { FrameContext } from '../playable';
import { Playable } from '../playable';

export class PropertyClipPlayable<T> extends Playable {
  value: T;
  curve: ValueGetter<T>;

  override evaluate (boundObject: object | undefined, context: FrameContext): void {
    this.value = this.curve.getValue(context.time / this.duration, this.value);
  }
}
