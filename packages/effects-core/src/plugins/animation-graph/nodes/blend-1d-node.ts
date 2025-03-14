import type { GraphContext, InstantiationContext } from '../graph-context';
import type { FloatValueNode, GraphNodeAssetData } from '../graph-node';
import { GraphNodeAsset, PoseNode } from '../graph-node';
import type { Pose } from '../pose';
import { PoseResult } from '../pose-result';
import { NodeAssetType, nodeAssetClass } from '../..';
import type { Vector3Like } from '@galacean/effects-math/es/core/type';
import type { Euler } from '@galacean/effects-math/es/core/euler';

export interface Blend1DNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.Blend1DNodeAsset,
  source0: number,
  source1: number,
  inputParameterValueNode: number,
}

@nodeAssetClass(NodeAssetType.Blend1DNodeAsset)
export class Blend1DNodeAsset extends GraphNodeAsset {
  source0: number;
  source1: number;
  inputParameterValueNode: number;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(Blend1DNode, context);

    node.source0 = context.getNode<PoseNode>(this.source0);
    node.source1 = context.getNode<PoseNode>(this.source1);
    node.inputParameterValueNode = context.getNode<FloatValueNode>(this.inputParameterValueNode);
  }

  override load (data: Blend1DNodeAssetData): void {
    super.load(data);
    this.source0 = data.source0;
    this.source1 = data.source1;
    this.inputParameterValueNode = data.inputParameterValueNode;
  }
}

export class Blend1DNode extends PoseNode {
  source0: PoseNode | null = null;
  source1: PoseNode | null = null;

  inputParameterValueNode: FloatValueNode | null = null;

  source0Result: PoseResult;
  source1Result: PoseResult;

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.source0Result = new PoseResult(context.referencePose);
    this.source1Result = new PoseResult(context.referencePose);

    this.source0?.initialize(context);
    this.source1?.initialize(context);
    this.inputParameterValueNode?.initialize(context);
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.source0?.shutdown(context);
    this.source1?.shutdown(context);
    this.inputParameterValueNode?.shutdown(context);
    super.shutdown(context);
  }

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.inputParameterValueNode) {
      return result;
    }

    this.markNodeActive(context);

    const blendWeight = this.inputParameterValueNode.getValue<number>(context);

    if (this.source0 && !this.source1) {
      this.source0.evaluate(context, this.source0Result);
      this.localBlend(this.source0Result.pose, this.source1Result.pose, blendWeight, result.pose);
    } else if (this.source0 && this.source1) {
      this.source0.evaluate(context, this.source0Result);
      this.source1.evaluate(context, this.source1Result);
      this.localBlend(this.source0Result.pose, this.source1Result.pose, blendWeight, result.pose);
    }

    return result;
  }

  private localBlend (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {
    for (let i = 0;i < sourcePose.parentSpaceReferencePosition.length;i++) {
      const sourcePosition = sourcePose.parentSpaceReferencePosition[i];
      const targetPosition = targetPose.parentSpaceReferencePosition[i];
      const resultPosition = resultPose.parentSpaceReferencePosition[i];

      this.lerpVector3(sourcePosition, targetPosition, blendWeight, resultPosition);
    }
    for (let i = 0;i < sourcePose.parentSpaceReferenceRotation.length;i++) {
      const sourceRotation = sourcePose.parentSpaceReferenceRotation[i];
      const targetRotation = targetPose.parentSpaceReferenceRotation[i];
      const resultRotation = resultPose.parentSpaceReferenceRotation[i];

      resultRotation.copyFrom(sourceRotation).slerp(targetRotation, blendWeight);
    }
    for (let i = 0;i < sourcePose.parentSpaceReferenceScale.length;i++) {
      const sourceScale = sourcePose.parentSpaceReferenceScale[i];
      const targetScale = targetPose.parentSpaceReferenceScale[i];
      const resultScale = resultPose.parentSpaceReferenceScale[i];

      this.lerpVector3(sourceScale, targetScale, blendWeight, resultScale);
    }
    for (let i = 0;i < sourcePose.parentSpaceReferenceEuler.length;i++) {
      const sourceEuler = sourcePose.parentSpaceReferenceEuler[i];
      const targetEuler = targetPose.parentSpaceReferenceEuler[i];
      const resultEuler = resultPose.parentSpaceReferenceEuler[i];

      this.lerpEuler(sourceEuler, targetEuler, blendWeight, resultEuler);
    }
  }

  private lerpEuler (from: Euler, to: Euler, t: number, res: Euler): Euler {
    res.x = this.lerpAngle(from.x, to.x, t);
    res.y = this.lerpAngle(from.y, to.y, t);
    res.z = this.lerpAngle(from.z, to.z, t);

    return res;
  }

  private lerpVector3 (from: Vector3Like, to: Vector3Like, t: number, result: Vector3Like) {
    result.x = from.x + (to.x - from.x) * t;
    result.y = from.y + (to.y - from.y) * t;
    result.z = from.z + (to.z - from.z) * t;

    return result;
  }

  private normalizeAngle (angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  /**
   * 计算两个角度之间的最短路径差
   */
  private shortestAngleDiff (from: number, to: number): number {
    let diff = this.normalizeAngle(to) - this.normalizeAngle(from);

    if (diff > 180) {diff -= 360;}
    if (diff < -180) {diff += 360;}

    return diff;
  }

  private lerpAngle (fromAngle: number, toAngle: number, t: number): number {
    const diff = this.shortestAngleDiff(fromAngle, toAngle);

    return this.normalizeAngle(fromAngle + diff * t);
  }
}