import type { FixedNumberExpression } from '@galacean/effects-specification';
import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { PropertyClipPlayable } from '../playables';
import { createValueGetter } from '../../../math';
import { spec } from '@galacean/effects-core';

@effectsClass(spec.DataType.FloatPropertyPlayableAsset)
export class FloatPropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: FixedNumberExpression;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new PropertyClipPlayable(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
