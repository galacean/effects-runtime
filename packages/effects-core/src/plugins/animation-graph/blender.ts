import type { Color, Euler, Vector3Like } from '@galacean/effects-math/es/core';
import type { Pose } from './pose';

export class Blender {
  static localBlend (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {

    // Blend transform
    //-------------------------------------------------------------------------

    for (let i = 0;i < sourcePose.parentSpaceTransforms.length;i++) {
      const sourceTransform = sourcePose.parentSpaceTransforms[i];
      const targetTransform = targetPose.parentSpaceTransforms[i];
      const resultTransform = resultPose.parentSpaceTransforms[i];

      const sourcePosition = sourceTransform.position;
      const targetPosition = targetTransform.position;
      const resultPosition = resultTransform.position;

      Blender.lerpVector3(sourcePosition, targetPosition, blendWeight, resultPosition);

      const sourceRotation = sourceTransform.rotation;
      const targetRotation = targetTransform.rotation;
      const resultRotation = resultTransform.rotation;

      resultRotation.copyFrom(sourceRotation).slerp(targetRotation, blendWeight);

      const sourceScale = sourceTransform.scale;
      const targetScale = targetTransform.scale;
      const resultScale = resultTransform.scale;

      Blender.lerpVector3(sourceScale, targetScale, blendWeight, resultScale);

      const sourceEuler = sourceTransform.euler;
      const targetEuler = targetTransform.euler;
      const resultEuler = resultTransform.euler;

      Blender.lerpEuler(sourceEuler, targetEuler, blendWeight, resultEuler);
    }

    // Blend float value
    //-------------------------------------------------------------------------

    for (let i = 0;i < sourcePose.floatPropertyValues.length;i++) {
      const sourceFloat = sourcePose.floatPropertyValues[i];
      const targetFloat = targetPose.floatPropertyValues[i];

      resultPose.floatPropertyValues[i] = sourceFloat + (targetFloat - sourceFloat) * blendWeight;
    }

    // Blend color value
    //-------------------------------------------------------------------------

    for (let i = 0;i < sourcePose.colorPropertyValues.length;i++) {
      const sourceColor = sourcePose.colorPropertyValues[i];
      const targetColor = targetPose.colorPropertyValues[i];
      const resultColor = resultPose.colorPropertyValues[i];

      Blender.lerpColor(sourceColor, targetColor, blendWeight, resultColor);
    }
  }

  static lerpEuler (from: Euler, to: Euler, t: number, res: Euler): Euler {
    res.x = Blender.lerpAngle(from.x, to.x, t);
    res.y = Blender.lerpAngle(from.y, to.y, t);
    res.z = Blender.lerpAngle(from.z, to.z, t);

    return res;
  }

  static lerpVector3 (from: Vector3Like, to: Vector3Like, t: number, result: Vector3Like) {
    result.x = from.x + (to.x - from.x) * t;
    result.y = from.y + (to.y - from.y) * t;
    result.z = from.z + (to.z - from.z) * t;

    return result;
  }

  static lerpColor (from: Color, to: Color, t: number, result: Color) {
    result.r = from.r + (to.r - from.r) * t;
    result.g = from.g + (to.g - from.g) * t;
    result.b = from.b + (to.b - from.b) * t;
    result.a = from.a + (to.a - from.a) * t;

    return result;
  }

  private static normalizeAngle (angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  /**
   * 计算两个角度之间的最短路径差
   */
  private static shortestAngleDiff (from: number, to: number): number {
    let diff = Blender.normalizeAngle(to) - Blender.normalizeAngle(from);

    if (diff > 180) { diff -= 360; }
    if (diff < -180) { diff += 360; }

    return diff;
  }

  private static lerpAngle (fromAngle: number, toAngle: number, t: number): number {
    const diff = Blender.shortestAngleDiff(fromAngle, toAngle);

    return Blender.normalizeAngle(fromAngle + diff * t);
  }

}