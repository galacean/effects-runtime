import type { FixedNumberExpression } from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.FloatPropertyPlayableAsset)
export class FloatPropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: FixedNumberExpression;

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable();

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
