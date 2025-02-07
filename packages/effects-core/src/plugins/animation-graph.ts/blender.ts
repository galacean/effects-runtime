import type { Euler, Vector3Like } from '@galacean/effects-math/es/core';
import type { Pose } from './pose';

export class Blender {
  static localBlend (sourcePose: Pose, targetPose: Pose, blendWeight: number, resultPose: Pose) {
    for (let i = 0; i < sourcePose.parentSpaceReferencePosition.length; i++) {
      const sourcePosition = sourcePose.parentSpaceReferencePosition[i];
      const targetPosition = targetPose.parentSpaceReferencePosition[i];
      const resultPosition = resultPose.parentSpaceReferencePosition[i];

      Blender.lerpVector3(sourcePosition, targetPosition, blendWeight, resultPosition);
    }
    for (let i = 0; i < sourcePose.parentSpaceReferenceRotation.length; i++) {
      const sourceRotation = sourcePose.parentSpaceReferenceRotation[i];
      const targetRotation = targetPose.parentSpaceReferenceRotation[i];
      const resultRotation = resultPose.parentSpaceReferenceRotation[i];

      resultRotation.copyFrom(sourceRotation).slerp(targetRotation, blendWeight);
    }
    for (let i = 0; i < sourcePose.parentSpaceReferenceScale.length; i++) {
      const sourceScale = sourcePose.parentSpaceReferenceScale[i];
      const targetScale = targetPose.parentSpaceReferenceScale[i];
      const resultScale = resultPose.parentSpaceReferenceScale[i];

      Blender.lerpVector3(sourceScale, targetScale, blendWeight, resultScale);
    }
    for (let i = 0; i < sourcePose.parentSpaceReferenceEuler.length; i++) {
      const sourceEuler = sourcePose.parentSpaceReferenceEuler[i];
      const targetEuler = targetPose.parentSpaceReferenceEuler[i];
      const resultEuler = resultPose.parentSpaceReferenceEuler[i];

      Blender.lerpEuler(sourceEuler, targetEuler, blendWeight, resultEuler);
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