import type { AnimationClip } from '../../cal/calculate-vfx-item';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { GraphNodeAsset, PoseNode, type GraphNodeAssetData } from '../graph-node';
import { NodeAssetType, nodeAssetClass } from '../node-asset-type';
import type { PoseResult } from '../pose-result';

export interface AnimationClipNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.AnimationClipNodeAsset,
  dataSlotIndex: number,
}

@nodeAssetClass(NodeAssetType.AnimationClipNodeAsset)
export class AnimationClipNodeAsset extends GraphNodeAsset {
  dataSlotIndex = -1;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(AnimationClipNode, context);

    node.animation = context.dataSet.getResource(this.dataSlotIndex);
  }

  override load (data: AnimationClipNodeAssetData): void {
    super.load(data);

    this.dataSlotIndex = data.dataSlotIndex;
  }
}

export class AnimationClipNode extends PoseNode {
  animation: AnimationClip | null = null;
  loop = true;

  private time = 0;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    this.time += context.deltaTime;

    if (!this.animation) {
      return result;
    }

    this.markNodeActive(context);

    this.time = this.loop ? this.time % this.animation.duration : this.time;
    this.animation.getPose(this.time, result.pose);

    return result;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.time = 0;
  }
}