import type { Color, Vector3 } from '@galacean/effects-math/es/core';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import type { Pose } from './pose';

const tempQuaternion = new Quaternion();

export abstract class BlendFunction {
  abstract blendVector3 (source: Vector3, target: Vector3, weight: number, result: Vector3): void;
  abstract blendQuaternion (source: Quaternion, target: Quaternion, weight: number, result: Quaternion): void;
  abstract blendEuler (source: Vector3, target: Vector3, weight: number, result: Vector3): void;
  abstract blendColor (source: Color, target: Color, weight: number, result: Color): void;
  abstract blendFloat (source: number, target: number, weight: number): number;
}

export class NormalBlend extends BlendFunction {
  override blendVector3 (source: Vector3, target: Vector3, weight: number, result: Vector3): void {
    result.x = source.x + (target.x - source.x) * weight;
    result.y = source.y + (target.y - source.y) * weight;
    result.z = source.z + (target.z - source.z) * weight;
  }

  override blendQuaternion (source: Quaternion, target: Quaternion, weight: number, result: Quaternion): void {
    result.copyFrom(source).slerp(target, weight);
  }

  override blendEuler (source: Vector3, target: Vector3, weight: number, result: Vector3): void {
    this.lerpEuler(source, target, weight, result);
  }

  override blendFloat (source: number, target: number, weight: number): number {
    return source + (target - source) * weight;
  }

  override blendColor (source: Color, target: Color, weight: number, result: Color): void {
    result.r = source.r + (target.r - source.r) * weight;
    result.g = source.g + (target.g - source.g) * weight;
    result.b = source.b + (target.b - source.b) * weight;
    result.a = source.a + (target.a - source.a) * weight;
  }

  private lerpEuler (from: Vector3, to: Vector3, t: number, res: Vector3): void {
    res.x = this.lerpAngle(from.x, to.x, t);
    res.y = this.lerpAngle(from.y, to.y, t);
    res.z = this.lerpAngle(from.z, to.z, t);
  }

  private normalizeAngle (angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  /**
   * 计算两个角度之间的最短路径差
   */
  private shortestAngleDiff (from: number, to: number): number {
    let diff = this.normalizeAngle(to) - this.normalizeAngle(from);

    if (diff > 180) { diff -= 360; }
    if (diff < -180) { diff += 360; }

    return diff;
  }

  private lerpAngle (fromAngle: number, toAngle: number, t: number): number {
    const diff = this.shortestAngleDiff(fromAngle, toAngle);

    return this.normalizeAngle(fromAngle + diff * t);
  }
}

export class AdditiveBlend extends BlendFunction {
  override blendVector3 (source: Vector3, target: Vector3, weight: number, result: Vector3): void {
    result.x = source.x + (target.x * weight);
    result.y = source.y + (target.y * weight);
    result.z = source.z + (target.z * weight);
  }

  override blendQuaternion (source: Quaternion, target: Quaternion, weight: number, result: Quaternion): void {
    const targetQuaternion = tempQuaternion.copyFrom(source).multiply(target);

    result.copyFrom(source).slerp(targetQuaternion, weight);
  }

  override blendEuler (source: Vector3, target: Vector3, weight: number, result: Vector3): void {
    this.blendVector3(source, target, weight, result);
  }

  override blendFloat (source: number, target: number, weight: number): number {
    return source + (target * weight);
  }

  override blendColor (source: Color, target: Color, weight: number, result: Color): void {
    result.r = source.r + (target.r * weight);
    result.g = source.g + (target.g * weight);
    result.b = source.b + (target.b * weight);
    result.a = source.a + (target.a * weight);
  }
}

export class Blender {
  private static normalBlendFunction = new NormalBlend();
  private static additiveBlendFunction = new AdditiveBlend();

  static localBlend (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {
    Blender.localBlendInternal(sourcePose, targetPose, blendWeight, resultPose, Blender.normalBlendFunction);
  }

  static additiveBlend (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {
    Blender.localBlendInternal(sourcePose, targetPose, blendWeight, resultPose, Blender.additiveBlendFunction);
  }

  private static localBlendInternal (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose, blendFunction: BlendFunction): void {

    // Blend transform
    //-------------------------------------------------------------------------

    for (let i = 0; i < sourcePose.parentSpaceTransforms.length; i++) {
      const sourceTransform = sourcePose.parentSpaceTransforms[i];
      const targetTransform = targetPose.parentSpaceTransforms[i];
      const resultTransform = resultPose.parentSpaceTransforms[i];

      const sourcePosition = sourceTransform.position;
      const targetPosition = targetTransform.position;
      const resultPosition = resultTransform.position;

      blendFunction.blendVector3(sourcePosition, targetPosition, blendWeight, resultPosition);

      const sourceRotation = sourceTransform.rotation;
      const targetRotation = targetTransform.rotation;
      const resultRotation = resultTransform.rotation;

      blendFunction.blendQuaternion(sourceRotation, targetRotation, blendWeight, resultRotation);

      const sourceScale = sourceTransform.scale;
      const targetScale = targetTransform.scale;
      const resultScale = resultTransform.scale;

      blendFunction.blendVector3(sourceScale, targetScale, blendWeight, resultScale);

      const sourceEuler = sourceTransform.euler;
      const targetEuler = targetTransform.euler;
      const resultEuler = resultTransform.euler;

      blendFunction.blendEuler(sourceEuler, targetEuler, blendWeight, resultEuler);
    }

    // Blend float value
    //-------------------------------------------------------------------------

    for (let i = 0; i < sourcePose.floatPropertyValues.length; i++) {
      const sourceFloat = sourcePose.floatPropertyValues[i];
      const targetFloat = targetPose.floatPropertyValues[i];

      resultPose.floatPropertyValues[i] = blendFunction.blendFloat(sourceFloat, targetFloat, blendWeight);
    }

    // Blend color value
    //-------------------------------------------------------------------------

    for (let i = 0; i < sourcePose.colorPropertyValues.length; i++) {
      const sourceColor = sourcePose.colorPropertyValues[i];
      const targetColor = targetPose.colorPropertyValues[i];
      const resultColor = resultPose.colorPropertyValues[i];

      blendFunction.blendColor(sourceColor, targetColor, blendWeight, resultColor);
    }
  }
}