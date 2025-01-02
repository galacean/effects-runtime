import type { GraphContext } from '../graph-context';
import { PoseNode } from '../graph-node';
import type { PoseResult } from '../pose-result';

export class AnimationRootNode extends PoseNode {
  poseNode: PoseNode;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.poseNode) {
      return result;
    }

    this.poseNode.evaluate(context, result);

    return result;
  }

}