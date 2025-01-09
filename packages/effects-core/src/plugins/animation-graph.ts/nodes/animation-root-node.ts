import type { NodeAssetType } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';
import type { GraphNodeAssetData } from '../graph-node';
import { GraphNodeAsset, PoseNode } from '../graph-node';
import type { PoseResult } from '../pose-result';

export interface AnimationRootNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.AnimationRootNodeAsset,
  poseNode: number,
}

export class AnimationRootNodeAsset extends GraphNodeAsset {
  poseNode: number;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(AnimationRootNode, context);

    node.poseNode = context.getNode<PoseNode>(this.poseNode);
  }

  override load (data: AnimationRootNodeAssetData): void {
    super.load(data);
    this.poseNode = data.poseNode;
  }
}

export class AnimationRootNode extends PoseNode {
  poseNode: PoseNode | null = null;

  protected override initializeInternal (context: GraphContext): void {
    this.poseNode?.initialize(context);
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.poseNode) {
      return result;
    }

    this.poseNode.evaluate(context, result);

    return result;
  }
}