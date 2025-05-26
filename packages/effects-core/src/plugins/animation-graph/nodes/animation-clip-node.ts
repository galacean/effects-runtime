import { clamp } from '@galacean/effects-math/es/core/utils';
import type { AnimationClip } from '../../cal/calculate-vfx-item';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { GraphNodeAsset, PoseNode, type GraphNodeAssetData } from '../graph-node';
import { NodeAssetType, nodeDataClass } from '../node-asset-type';
import type { PoseResult } from '../pose-result';

export interface AnimationClipNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.AnimationClipNodeAsset,
  dataSlotIndex: number,
}

@nodeDataClass(NodeAssetType.AnimationClipNodeAsset)
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

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.animation) {
      return result;
    }

    this.markNodeActive(context);

    this.previousTime = this.currentTime;
    this.currentTime = this.previousTime + context.deltaTime / this.duration;
    if (!this.loop) {
      this.currentTime = clamp(this.currentTime, 0, 1);
    } else {
      if (this.currentTime > 1) {
        this.currentTime = this.currentTime % 1;
      }
    }

    const time = this.currentTime * this.duration;

    this.animation.getPose(time, result.pose);

    return result;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.duration = this.animation?.duration ?? 0;
    this.previousTime = this.currentTime = 0;
  }
}