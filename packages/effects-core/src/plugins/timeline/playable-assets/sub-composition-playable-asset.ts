import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { SubCompositionClipPlayable } from '../playables';

@effectsClass(spec.DataType.SubCompositionPlayableAsset)
export class SubCompositionPlayableAsset extends PlayableAsset {
  override createPlayable (graph: PlayableGraph): Playable {
    return new SubCompositionClipPlayable(graph);
  }
}
