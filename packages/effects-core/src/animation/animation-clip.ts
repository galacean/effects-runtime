import type { Euler } from '@galacean/effects-math/es/core/euler';
import type { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { clamp } from '@galacean/effects-math/es/core/utils';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../decorators';
import { EffectsObject } from '../effects-object';
import type { ValueGetter, Vector3Curve, BezierCurve, ColorCurve } from '../math';
import { createValueGetter } from '../math';
import type { VFXItem } from '../vfx-item';

export interface AnimationCurve {
  path: string,
  keyFrames: ValueGetter<any>,
}

export interface PositionAnimationCurve extends AnimationCurve {
  keyFrames: Vector3Curve,
}

export interface EulerAnimationCurve extends AnimationCurve {
  keyFrames: ValueGetter<Euler>,
}

export interface RotationAnimationCurve extends AnimationCurve {
  keyFrames: ValueGetter<Quaternion>,
}

export interface ScaleAnimationCurve extends AnimationCurve {
  keyFrames: Vector3Curve,
}

export interface FloatAnimationCurve extends AnimationCurve {
  property: string,
  className: string,
  keyFrames: BezierCurve,
}

export interface ColorAnimationCurve extends AnimationCurve {
  property: string,
  className: string,
  keyFrames: ColorCurve,
}

@effectsClass(spec.DataType.AnimationClip)
export class AnimationClip extends EffectsObject {
  duration = 0;
  positionCurves: PositionAnimationCurve[] = [];
  rotationCurves: RotationAnimationCurve[] = [];
  eulerCurves: EulerAnimationCurve[] = [];
  scaleCurves: ScaleAnimationCurve[] = [];
  floatCurves: FloatAnimationCurve[] = [];
  colorCurves: ColorAnimationCurve[] = [];

  sampleAnimation (vfxItem: VFXItem, time: number) {
    const life = clamp(time, 0, this.duration);

    for (const curve of this.positionCurves) {
      const value = curve.keyFrames.getValue(life);
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setPosition(value.x, value.y, value.z);
    }

    for (const curve of this.rotationCurves) {
      const value = curve.keyFrames.getValue(life);
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setQuaternion(value.x, value.y, value.z, value.w);
    }

    for (const curve of this.eulerCurves) {
      const value = curve.keyFrames.getValue(life);
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setRotation(value.x, value.y, value.z);
    }

    for (const curve of this.scaleCurves) {
      const value = curve.keyFrames.getValue(life);
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setScale(value.x, value.y, value.z);
    }

    // TODO float curves 采样
  }

  override fromData (data: spec.AnimationClipData): void {
    this.positionCurves.length = 0;
    this.scaleCurves.length = 0;
    this.rotationCurves.length = 0;
    this.eulerCurves.length = 0;
    this.floatCurves.length = 0;
    this.colorCurves.length = 0;

    let keyFramesDuration = 0;

    if (data.positionCurves) {
      for (const positionCurveData of data.positionCurves) {
        const curve: PositionAnimationCurve = {
          path: positionCurveData.path,
          keyFrames: createValueGetter(positionCurveData.keyFrames) as Vector3Curve,
        };

        keyFramesDuration = Math.max(keyFramesDuration, curve.keyFrames.getMaxTime());

        this.positionCurves.push(curve);
      }
    }

    if (data.rotationCurves) {
      for (const rotationCurveData of data.rotationCurves) {
        const curve: RotationAnimationCurve = {
          path: rotationCurveData.path,
          keyFrames: createValueGetter(rotationCurveData.keyFrames),
        };

        keyFramesDuration = Math.max(keyFramesDuration, curve.keyFrames.getMaxTime());

        this.rotationCurves.push(curve);
      }
    }

    if (data.eulerCurves) {
      for (const eulerCurvesData of data.eulerCurves) {
        const curve: EulerAnimationCurve = {
          path: eulerCurvesData.path,
          keyFrames: createValueGetter(eulerCurvesData.keyFrames),
        };

        keyFramesDuration = Math.max(keyFramesDuration, curve.keyFrames.getMaxTime());

        this.eulerCurves.push(curve);
      }
    }

    if (data.scaleCurves) {
      for (const scaleCurvesData of data.scaleCurves) {
        const curve: ScaleAnimationCurve = {
          path: scaleCurvesData.path,
          keyFrames: createValueGetter(scaleCurvesData.keyFrames) as Vector3Curve,
        };

        keyFramesDuration = Math.max(keyFramesDuration, curve.keyFrames.getMaxTime());

        this.scaleCurves.push(curve);
      }
    }

    if (data.floatCurves) {
      for (const floatCurveData of data.floatCurves) {
        const curve: FloatAnimationCurve = {
          path: floatCurveData.path,
          keyFrames: createValueGetter(floatCurveData.keyFrames) as BezierCurve,
          property: floatCurveData.property,
          className: floatCurveData.className,
        };

        keyFramesDuration = Math.max(keyFramesDuration, curve.keyFrames.getMaxTime());

        this.floatCurves.push(curve);
      }
    }

    if (data.colorCurves) {
      for (const colorCurveData of data.colorCurves) {
        const curve: ColorAnimationCurve = {
          path: colorCurveData.path,
          keyFrames: createValueGetter(colorCurveData.keyFrames) as ColorCurve,
          property: colorCurveData.property,
          className: colorCurveData.className,
        };

        keyFramesDuration = Math.max(keyFramesDuration, curve.keyFrames.getMaxTime());

        this.colorCurves.push(curve);
      }
    }

    if (data.duration !== undefined) {
      this.duration = data.duration;
    } else {
      this.duration = keyFramesDuration;
    }
  }

  private findTarget (vfxItem: VFXItem, path: string) {
    let target = vfxItem;
    const paths = path.split('.');

    for (const name of paths) {
      let findTag = false;

      for (const child of target.children) {
        if (child.name === name) {
          target = child;
          findTag = true;

          break;
        }
      }
      if (!findTag) {
        return;
      }
    }

    return target;
  }
}
