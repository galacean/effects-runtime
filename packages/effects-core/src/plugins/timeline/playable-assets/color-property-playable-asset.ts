import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import type { Color } from '@galacean/effects-math/es/core';
import { spec } from '@galacean/effects-core';

@effectsClass(spec.DataType.ColorPropertyPlayableAsset)
export class ColorPropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: spec.ColorCurveData;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new PropertyClipPlayable<Color>(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
