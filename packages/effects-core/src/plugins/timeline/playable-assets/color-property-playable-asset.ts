import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { Color } from '@galacean/effects-math/es/core';
import * as spec from '@galacean/effects-specification';

@effectsClass(spec.DataType.ColorPropertyPlayableAsset)
export class ColorPropertyPlayableAsset extends PlayableAsset {
  curveData: spec.ColorCurveValue;

  override fromData (data: spec.ColorPropertyPlayableAssetData): void {
    super.fromData(data);
    this.curveData = data.curveData;
  }

  override createPlayable (): Playable {
    const clipPlayable = new PropertyClipPlayable<Color>();

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
