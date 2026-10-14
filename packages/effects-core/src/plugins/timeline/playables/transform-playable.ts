import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ValueGetter } from '../../../math';
import { createValueGetter } from '../../../math';
import { Playable, PlayableAsset } from '../playable';

function createOptionalCurve (data: spec.FixedNumberExpression | undefined): ValueGetter<number> | undefined {
  return data === undefined ? undefined : createValueGetter(data);
}

export type TransformContribution = {
  /** Position XYZ, Euler rotation XYZ and scale XYZ. */
  values: number[],
  /** Whether each of the nine channels has a sampled value. */
  validChannels: boolean[],
};

/** TransformPlayableAsset 反序列化生成的曲线和采样参数，由 playable 共享读取。 */
export interface TransformAnimationCurves {
  validChannels: boolean[],
  sizeSeparateAxes: boolean,
  sizeXOverLifetime?: ValueGetter<number>,
  sizeYOverLifetime?: ValueGetter<number>,
  sizeZOverLifetime?: ValueGetter<number>,
  rotationOverLifetime?: {
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  },
  pathGetter?: ValueGetter<Vector3 | number[]>,
}

/**
 * @since 2.0.0
 */
export class TransformPlayable extends Playable {
  curves: TransformAnimationCurves;

  private readonly contribution: TransformContribution = {
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    validChannels: [false, false, false, false, false, false, false, false, false],
  };

  /**
   * 采样当前帧的绝对局部 transform 属性。
   * 返回值为内部复用对象，调用方应在当前帧同步消费，不应缓存。
   */
  getContribution (): TransformContribution {
    this.sampleAnimation();

    return this.contribution;
  }

  private sampleAnimation () {
    const out = this.contribution;
    const curves = this.curves;

    out.validChannels.fill(false);

    const duration = this.getDuration();

    if (duration <= 0) {
      return;
    }
    const life = Math.max(0, this.time / duration);
    const { sizeXOverLifetime, sizeYOverLifetime, sizeZOverLifetime, rotationOverLifetime, pathGetter } = curves;

    if (curves.sizeSeparateAxes) {
      if (sizeXOverLifetime) { out.values[6] = sizeXOverLifetime.getValue(life); }
      if (sizeYOverLifetime) { out.values[7] = sizeYOverLifetime.getValue(life); }
      if (sizeZOverLifetime) { out.values[8] = sizeZOverLifetime.getValue(life); }
    } else if (sizeXOverLifetime) {
      const size = sizeXOverLifetime.getValue(life);

      for (let channel = 6; channel < 9; channel++) {
        out.values[channel] = size;
      }
    }

    if (rotationOverLifetime?.x) { out.values[3] = rotationOverLifetime.x.getValue(life); }
    if (rotationOverLifetime?.y) { out.values[4] = rotationOverLifetime.y.getValue(life); }
    if (rotationOverLifetime?.z) { out.values[5] = rotationOverLifetime.z.getValue(life); }

    if (pathGetter) {
      const position = pathGetter.getValue(life);

      // Constant and linear paths return arrays; Bezier paths return Vector3.
      if (Array.isArray(position)) {
        out.values[0] = position[0];
        out.values[1] = position[1];
        out.values[2] = position[2];
      } else {
        out.values[0] = position.x;
        out.values[1] = position.y;
        out.values[2] = position.z;
      }
    }
    for (let channel = 0; channel < 9; channel++) {
      out.validChannels[channel] = curves.validChannels[channel];
    }
  }
}

@effectsClass(spec.DataType.TransformPlayableAsset)
export class TransformPlayableAsset extends PlayableAsset {
  transformAnimationData: TransformPlayableAssetData;
  curves: TransformAnimationCurves;

  override createPlayable (): TransformPlayable {
    const transformPlayable = new TransformPlayable();

    transformPlayable.curves = this.curves;

    return transformPlayable;
  }

  override fromData (data: TransformPlayableAssetData): void {
    super.fromData(data);
    this.transformAnimationData = data;

    const path = data.positionOverLifetime?.path;
    const rotationOverLifetime = data.rotationOverLifetime;
    const sizeOverLifetime = data.sizeOverLifetime;
    const curves: TransformAnimationCurves = {
      validChannels: [],
      sizeSeparateAxes: !!sizeOverLifetime?.separateAxes,
      sizeXOverLifetime: createOptionalCurve(sizeOverLifetime?.separateAxes ? sizeOverLifetime.x : sizeOverLifetime?.size),
      sizeYOverLifetime: createOptionalCurve(sizeOverLifetime?.separateAxes ? sizeOverLifetime.y : undefined),
      sizeZOverLifetime: createOptionalCurve(sizeOverLifetime?.separateAxes ? sizeOverLifetime.z : undefined),
      rotationOverLifetime: {
        x: createOptionalCurve(rotationOverLifetime?.separateAxes ? rotationOverLifetime.x : undefined),
        y: createOptionalCurve(rotationOverLifetime?.separateAxes ? rotationOverLifetime.y : undefined),
        z: createOptionalCurve(rotationOverLifetime?.z),
      },
      pathGetter: path ? createValueGetter(path) : undefined,
    };

    curves.validChannels = [
      !!curves.pathGetter,
      !!curves.pathGetter,
      !!curves.pathGetter,
      !!curves.rotationOverLifetime?.x,
      !!curves.rotationOverLifetime?.y,
      !!curves.rotationOverLifetime?.z,
      !!curves.sizeXOverLifetime,
      curves.sizeSeparateAxes ? !!curves.sizeYOverLifetime : !!curves.sizeXOverLifetime,
      curves.sizeSeparateAxes ? !!curves.sizeZOverLifetime : !!curves.sizeXOverLifetime,
    ];
    this.curves = curves;
  }
}

export interface TransformPlayableAssetData extends spec.EffectsObjectData {
  /**
   * 元素大小变化属性
   */
  sizeOverLifetime?: spec.SizeOverLifetime,
  /**
   * 元素旋转变化属性
   */
  rotationOverLifetime?: spec.RotationOverLifetime,
  /**
   * 元素位置变化属性
   */
  positionOverLifetime?: spec.PositionOverLifetime,
}
