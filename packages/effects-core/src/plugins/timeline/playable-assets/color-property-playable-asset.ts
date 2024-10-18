import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { PropertyClipPlayable } from '../playables';
import type { ColorCurveData } from '../../../math';
import { createValueGetter } from '../../../math';
import type { Color } from '@galacean/effects-math/es/core';

@effectsClass('ColorPropertyPlayableAsset')
export class ColorPropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: ColorCurveData;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new PropertyClipPlayable<Color>(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
