import type { AnimationClip } from '../../cal/calculate-vfx-item';
import type { GraphContext } from '../graph-context';
import { PoseNode } from '../graph-node';
import type { PoseResult } from '../pose-result';

export class AnimationClipNode extends PoseNode {
  private time = 0;
  private animation: AnimationClip;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    this.time += context.deltaTime;

    this.animation.getPose(this.time, result.pose);

    return result;
  }

}