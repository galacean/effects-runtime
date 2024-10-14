import type { FixedNumberExpression } from '@galacean/effects-specification';
import { createValueGetter } from '../../../math/value-getter';
import { effectsClass, serialize } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { FloatPropertyClipPlayable } from '../playables';

@effectsClass('FloatPropertyPlayableAsset')
export class FloatPropertyPlayableAsset extends PlayableAsset {
  @serialize()
  curveData: FixedNumberExpression;

  override createPlayable (graph: PlayableGraph): Playable {
    const clipPlayable = new FloatPropertyClipPlayable(graph);

    clipPlayable.curve = createValueGetter(this.curveData);
    clipPlayable.value = clipPlayable.curve.getValue(0);

    return clipPlayable;
  }
}
