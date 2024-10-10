import type { ValueGetter } from '../../../math';
import type { FrameContext } from '../../cal/playable-graph';
import { Playable } from '../../cal/playable-graph';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';

export class CurvePropertyClipPlayable extends Playable {
  value: number | Vector3;
  curve: ValueGetter<number | Vector3>;

  override processFrame (context: FrameContext): void {
    this.value = this.curve.getValue(this.time);
  }
}