import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ValueGetter } from '../../../math';
import { createValueGetter } from '../../../math';
import { Playable, PlayableAsset } from '../playable';

export type TransformContribution = {
  hasPosition: boolean,
  position: Vector3,
  hasRotation: boolean,
  rotation: Euler,
  hasScale: boolean,
  scale: Vector3,
};

const createEmptyContribution = (): TransformContribution => ({
  hasPosition: false,
  position: new Vector3(),
  hasRotation: false,
  rotation: new Euler(),
  hasScale: false,
  scale: new Vector3(1, 1, 1),
});

/** TransformPlayableAsset 反序列化生成的曲线和采样参数，由 playable 共享读取。 */
export interface TransformAnimationCurves {
  sizeSeparateAxes: boolean,
  sizeXOverLifetime?: ValueGetter<number>,
  sizeYOverLifetime?: ValueGetter<number>,
  sizeZOverLifetime?: ValueGetter<number>,
  rotationOverLifetime?: {
    separateAxes?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  },
  pathGetter?: ValueGetter<Vector3>,
}

/**
 * @since 2.0.0
 */
export class TransformPlayable extends Playable {
  curves: TransformAnimationCurves;

  private readonly contribution: TransformContribution = createEmptyContribution();

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

    out.hasPosition = false;
    out.hasRotation = false;
    out.hasScale = false;

    const duration = this.getDuration();

    if (duration <= 0) {
      return;
    }
    let life = this.time / duration;

    life = life < 0 ? 0 : life;

    if (curves.sizeXOverLifetime) {
      out.hasScale = true;
      out.scale.x = curves.sizeXOverLifetime.getValue(life);
      if (curves.sizeSeparateAxes) {
        out.scale.y = curves.sizeYOverLifetime!.getValue(life);
        out.scale.z = curves.sizeZOverLifetime!.getValue(life);
      } else {
        out.scale.z = out.scale.y = out.scale.x;
      }
    }

    const rotationOverLifetime = curves.rotationOverLifetime;

    if (rotationOverLifetime) {
      out.hasRotation = true;
      const separateAxes = rotationOverLifetime.separateAxes;

      out.rotation.set(
        separateAxes ? rotationOverLifetime.x!.getValue(life) : 0,
        separateAxes ? rotationOverLifetime.y!.getValue(life) : 0,
        rotationOverLifetime.z!.getValue(life),
      );
    }

    if (curves.pathGetter) {
      out.hasPosition = true;
      out.position.set(0, 0, 0).add(curves.pathGetter.getValue(life));
    }
  }
}

@effectsClass(spec.DataType.TransformPlayableAsset)
export class TransformPlayableAsset extends PlayableAsset {
  transformAnimationData: TransformPlayableAssetData;
  curves: TransformAnimationCurves;

  override createPlayable (): Playable {
    const transformPlayable = new TransformPlayable();

    transformPlayable.curves = this.curves;

    return transformPlayable;
  }

  override fromData (data: TransformPlayableAssetData): void {
    super.fromData(data);
    this.transformAnimationData = data;

    const positionOverLifetime = data.positionOverLifetime;
    const rotationOverLifetime = data.rotationOverLifetime;
    const sizeOverLifetime = data.sizeOverLifetime;
    const curves: TransformAnimationCurves = {
      sizeSeparateAxes: !!sizeOverLifetime?.separateAxes,
    };

    if (positionOverLifetime?.path) {
      curves.pathGetter = createValueGetter(positionOverLifetime.path);
    }

    if (sizeOverLifetime) {
      if (sizeOverLifetime.separateAxes) {
        curves.sizeXOverLifetime = createValueGetter(sizeOverLifetime.x ?? 1);
        curves.sizeYOverLifetime = createValueGetter(sizeOverLifetime.y ?? 1);
        curves.sizeZOverLifetime = createValueGetter(sizeOverLifetime.z ?? 1);
      } else {
        curves.sizeXOverLifetime = createValueGetter(sizeOverLifetime.size ?? 1);
      }
    }

    if (rotationOverLifetime) {
      curves.rotationOverLifetime = {
        separateAxes: rotationOverLifetime.separateAxes,
        z: createValueGetter(rotationOverLifetime.z || 0),
      };
      if (rotationOverLifetime.separateAxes) {
        const rotLt = curves.rotationOverLifetime;

        rotLt.x = createValueGetter(rotationOverLifetime.x || 0);
        rotLt.y = createValueGetter(rotationOverLifetime.y || 0);
      }
    }

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
