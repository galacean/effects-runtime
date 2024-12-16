import type { AnimationClip } from '../../cal/calculate-vfx-item';
import type { GraphContext } from '../graph-context';
import { PoseNode } from '../graph-node';
import type { PoseResult } from '../pose-result';

export class AnimationClipNode extends PoseNode {
  private animation: AnimationClip;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    return result;
  }

}