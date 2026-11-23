import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ClipPlayable } from '../playable';
import { TimelineClip } from '../timeline-clip';
import { SubCompositionClipPlayable } from '../playables';

@effectsClass(spec.DataType.SubCompositionPlayableAsset)
export class SubCompositionPlayableAsset extends TimelineClip {
  override createPlayable (): ClipPlayable {
    return new SubCompositionClipPlayable();
  }
}
