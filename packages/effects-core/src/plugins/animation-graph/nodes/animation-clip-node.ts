import { clamp } from '@galacean/effects-math/es/core/utils';
import * as spec from '@galacean/effects-specification';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { GraphNodeData, PoseNode } from '../graph-node';
import { nodeDataClass } from '../node-asset-type';
import type { PoseResult } from '../pose-result';
import type { Skeleton } from '../skeleton';
import type { Pose } from '../pose';
import type {
  AnimationClip, AnimationCurve, FloatAnimationCurve, ColorAnimationCurve, AnimationEventReference,
} from '../../../animation';

@nodeDataClass(spec.NodeDataType.AnimationClipNodeData)
export class AnimationClipNodeData extends GraphNodeData {
  playRate = 1.0;
  loopAnimation = true;
  dataSlotIndex = -1;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(AnimationClipNode, context);

    node.animation = context.dataSet.getResource(this.dataSlotIndex);
  }

  override load (data: spec.AnimationClipNodeData): void {
    super.load(data);

    const fullData = {
      playRate: 1.0,
      loopAnimation: true,
      ...data,
    };

    this.dataSlotIndex = data.dataSlotIndex;
    this.playRate = fullData.playRate;
    this.loopAnimation = fullData.loopAnimation;
  }
}

export class AnimationClipNode extends PoseNode {
  animation: AnimationClip | null = null;

  private animatable: Animatable | null = null;

  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    if (!this.animatable) {
      return result;
    }

    this.markNodeActive(context);

    const nodeData = this.getNodeData<AnimationClipNodeData>();

    this.previousTime = this.currentTime;
    this.currentTime = this.previousTime + context.deltaTime / this.duration * nodeData.playRate;

    if (!nodeData.loopAnimation) {
      this.currentTime = clamp(this.currentTime, 0, 1);
    } else {
      if (this.currentTime > 1) {
        this.currentTime = this.currentTime % 1;
      }
    }

    // Sample Events
    //-------------------------------------------------------------------------
    this.sampleEvents(context);

    const time = this.currentTime * this.duration;

    this.animatable.getPose(time, result.pose);

    return result;
  }

  private sampleEvents (context: GraphContext): void {
    if (!this.animatable || this.animatable.events.length === 0) {
      return;
    }

    const previousTimeInSeconds = this.previousTime * this.duration;
    const currentTimeInSeconds = this.currentTime * this.duration;

    for (const eventReference of this.animatable.events) {
      const eventTime = eventReference.event.startTime;

      // Check if event falls within the current time interval
      let shouldTrigger = false;

      // Looping: handle wrap-around at 1.0
      if (this.previousTime <= this.currentTime) {
        // Normal case: no wrap-around
        shouldTrigger = previousTimeInSeconds < eventTime && eventTime <= currentTimeInSeconds;
      } else {
        // Wrap-around case: previousTime > currentTime (e.g., 0.9 -> 0.1)
        shouldTrigger = eventTime > previousTimeInSeconds || eventTime <= currentTimeInSeconds;
      }

      if (shouldTrigger) {
        eventReference.currentTime = currentTimeInSeconds;
        eventReference.deltaTime = context.deltaTime;
        context.activeEvents.push(eventReference);
      }
    }
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.duration = this.animation?.duration ?? 0;
    this.previousTime = this.currentTime = 0;

    if (this.animation) {
      this.animatable = new Animatable(context.skeleton, this.animation);
    }
  }
}

enum TransformCurveType {
  Position,
  Scale,
  Rotation,
  Euler
}

export interface TransformCurveInfo {
  type: TransformCurveType,
  curve: AnimationCurve,
  boneIndex: number,
}

export interface FloatCurveInfo {
  curve: FloatAnimationCurve,
  animatedObjectIndex: number,
}

export interface ColorCurveInfo {
  curve: ColorAnimationCurve,
  animatedObjectIndex: number,
}

export class Animatable {
  /**
   * @internal
   */
  events: AnimationEventReference[] = [];

  private transformCurveInfos: TransformCurveInfo[] = [];
  private floatCurveInfos: FloatCurveInfo[] = [];
  private colorCurveInfos: ColorCurveInfo[] = [];

  constructor (
    private skeleton: Skeleton,
    private animationClip: AnimationClip,
  ) {
    for (const curve of animationClip.positionCurves) {
      this.addTransformCurveInfo(curve, TransformCurveType.Position);
    }
    for (const curve of animationClip.scaleCurves) {
      this.addTransformCurveInfo(curve, TransformCurveType.Scale);
    }
    for (const curve of animationClip.rotationCurves) {
      this.addTransformCurveInfo(curve, TransformCurveType.Rotation);
    }
    for (const curve of animationClip.eulerCurves) {
      this.addTransformCurveInfo(curve, TransformCurveType.Euler);
    }
    for (const curve of animationClip.floatCurves) {
      this.addFloatCurveInfo(curve);
    }
    for (const curve of animationClip.colorCurves) {
      this.addColorCurveInfo(curve);
    }

    for (const eventInfo of this.animationClip.events) {
      this.events.push({
        event: eventInfo,
        currentTime: 0,
        deltaTime: 0,
      });
    }
  }

  getPose (time: number, outPose: Pose) {
    const life = clamp(time, 0, this.animationClip.duration);

    for (const curveInfo of this.transformCurveInfos) {
      const curveValue = curveInfo.curve.keyFrames.getValue(life);
      const outTransform = outPose.parentSpaceTransforms[curveInfo.boneIndex];

      switch (curveInfo.type) {
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

    for (const curveInfo of this.floatCurveInfos) {
      const floatValue = curveInfo.curve.keyFrames.getValue(life);

      outPose.floatPropertyValues[curveInfo.animatedObjectIndex] = floatValue;
    }

    for (const curveInfo of this.colorCurveInfos) {
      const colorValue = curveInfo.curve.keyFrames.getValue(life);

      outPose.colorPropertyValues[curveInfo.animatedObjectIndex] = colorValue;
    }
  }

  private addTransformCurveInfo (curve: AnimationCurve, type: TransformCurveType) {
    const boneIndex = this.skeleton.pathToBoneIndex.get(curve.path);

    if (boneIndex !== undefined) {
      this.transformCurveInfos.push({
        curve,
        boneIndex,
        type,
      });
    }
  }

  private addFloatCurveInfo (curve: FloatAnimationCurve) {
    const animatedObjectIndex = this.skeleton.pathToObjectIndex.get(curve.path + curve.className + curve.property);

    if (animatedObjectIndex !== undefined) {
      this.floatCurveInfos.push({
        curve,
        animatedObjectIndex,
      });
    }
  }

  private addColorCurveInfo (curve: ColorAnimationCurve) {
    const animatedObjectIndex = this.skeleton.pathToObjectIndex.get(curve.path + curve.className + curve.property);

    if (animatedObjectIndex !== undefined) {
      this.colorCurveInfos.push({
        curve,
        animatedObjectIndex,
      });
    }
  }
}
