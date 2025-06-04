import { clamp } from '@galacean/effects-math/es/core/utils';
import type { AnimationClip, AnimationCurve } from '../../cal/calculate-vfx-item';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { GraphNodeAsset, PoseNode, type GraphNodeAssetData } from '../graph-node';
import { NodeAssetType, nodeDataClass } from '../node-asset-type';
import type { PoseResult } from '../pose-result';
import type { ReferencePose } from '../reference-pose';
import type { Pose } from '../pose';

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

  private animatable: Animatable | null = null;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.animatable) {
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

    this.animatable.getPose(time, result.pose);

    return result;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.duration = this.animation?.duration ?? 0;
    this.previousTime = this.currentTime = 0;

    if (this.animation) {
      this.animatable = new Animatable(context.referencePose, this.animation);
    }
  }
}

enum TransformCurveType {
  Position,
  Scale,
  Rotation,
  Euler
}

export class TransformCurveBinding {
  type: TransformCurveType;
  curve: AnimationCurve;
  boneIndex: number;
}

export class Animatable {
  referencePose: ReferencePose;
  animationClip: AnimationClip;
  transformCurveBindings: TransformCurveBinding[] = [];

  constructor (referencePose: ReferencePose, animationClip: AnimationClip) {
    this.referencePose = referencePose;
    this.animationClip = animationClip;

    for (const curve of animationClip.positionCurves) {
      this.addCurveBinding(curve, TransformCurveType.Position);
    }
    for (const curve of animationClip.scaleCurves) {
      this.addCurveBinding(curve, TransformCurveType.Scale);
    }
    for (const curve of animationClip.rotationCurves) {
      this.addCurveBinding(curve, TransformCurveType.Rotation);
    }
    for (const curve of animationClip.eulerCurves) {
      this.addCurveBinding(curve, TransformCurveType.Euler);
    }
  }

  addCurveBinding (curve: AnimationCurve, type: TransformCurveType) {
    const referencePose = this.referencePose;
    const boneIndex = referencePose.pathToBoneIndex.get(curve.path);

    if (boneIndex !== undefined) {
      this.transformCurveBindings.push({
        curve,
        boneIndex,
        type,
      });
    }
  }

  getPose (time: number, outPose: Pose) {
    const life = time % this.animationClip.duration;

    for (const curveBinding of this.transformCurveBindings) {
      const curveValue = curveBinding.curve.keyFrames.getValue(life);
      const outTransform = outPose.parentSpaceTransforms[curveBinding.boneIndex];

      switch (curveBinding.type) {
        case TransformCurveType.Position:
          outTransform.position.copyFrom(curveValue);

          break;
        case TransformCurveType.Scale:
          outTransform.scale.copyFrom(curveValue);

          break;
        case TransformCurveType.Rotation:
          outTransform.rotation.copyFrom(curveValue);

          break;
        case TransformCurveType.Euler:
          outTransform.euler.copyFrom(curveValue);

          break;
      }
    }
  }
}