import type { ValueGetter } from '../../../math';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';

export class FloatPropertyClipPlayable extends Playable {
  value: number;
  curve: ValueGetter<number>;

  override processFrame (context: FrameContext): void {
    this.value = this.curve.getValue(this.time);
  }
}