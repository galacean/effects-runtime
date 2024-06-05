import { effectsClass } from 'packages/effects-core/src/decorators';
import type { Playable, PlayableGraph } from '../../cal/playable-graph';
import { PlayableAsset } from '../../cal/playable-graph';
import { SubCompositionClipPlayable } from './sub-composition-clip-playable';

@effectsClass('SubCompositionPlayableAsset')
export class SubCompositionPlayableAsset extends PlayableAsset {
  override createPlayable (graph: PlayableGraph): Playable {
    return new SubCompositionClipPlayable(graph);
  }
}