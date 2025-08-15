import { effectsClass, serialize } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { Color } from '@galacean/effects-math/es/core';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.ColorPropertyPlayableAsset)
export class ColorPropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: spec.ColorCurveValue;

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable<Color>();

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
