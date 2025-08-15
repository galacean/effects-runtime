import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { Playable } from '../playable';
import { PlayableAsset } from '../playable';
import { SubCompositionClipPlayable } from '../playables';

@effectsClass(spec.DataType.SubCompositionPlayableAsset)
export class SubCompositionPlayableAsset extends PlayableAsset {
  override createPlayable (): Playable {
    return new SubCompositionClipPlayable();
  }
}
