import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ItemLinearVelOverLifetime, ValueGetter } from '../../../math';
import { calculateTranslation, createValueGetter, ensureVec3 } from '../../../math';
import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import { Playable, PlayableAsset } from '../playable';

const tempRot = new Euler();
const tempPos = new Vector3();

/**
 * 基础位移属性数据
 */
export type ItemBasicTransform = {
  position: Vector3,
  rotation: Euler,
  scale: Vector3,
  path?: ValueGetter<Vector3>,
};

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
  hasPosition: boolean,
  sizeSeparateAxes: boolean,
  sizeXOverLifetime?: ValueGetter<number>,
  sizeYOverLifetime?: ValueGetter<number>,
  sizeZOverLifetime?: ValueGetter<number>,
  rotationOverLifetime?: {
    asRotation?: boolean,
    separateAxes?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  },
  orbitalVelOverLifetime?: {
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
    center: [x: number, y: number, z: number],
    asRotation?: boolean,
    enabled?: boolean,
  },
  linearVelOverLifetime?: ItemLinearVelOverLifetime,
  pathGetter?: ValueGetter<Vector3>,
}

/**
 * @since 2.0.0
 */
export class TransformPlayable extends Playable {
  originalTransform: ItemBasicTransform;
  curves: TransformAnimationCurves;

  private readonly contribution: TransformContribution = createEmptyContribution();

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!this.originalTransform && boundObject instanceof VFXItem) {
      this.captureOriginalTransform(boundObject);
    }
  }

  /**
   * 采样当前帧相对 base pose 的 transform contribution。
   * 返回值为内部复用对象，调用方应在当前帧同步消费，不应缓存。
   * @param basePosition - orbital position 计算 contribution 时使用的参考位置。
   */
  getContribution (basePosition?: Vector3): TransformContribution {
    this.sampleAnimation(basePosition);

    return this.contribution;
  }

  private sampleAnimation (basePosition?: Vector3) {
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
    } else {
      out.hasScale = false;
    }

    const rotationOverLifetime = curves.rotationOverLifetime;

    if (rotationOverLifetime) {
      out.hasRotation = true;
      const func = (v: ValueGetter<number>) => rotationOverLifetime.asRotation ? v.getValue(life) : v.getIntegrateValue(0, life, duration);
      const incZ = func(rotationOverLifetime.z!);
      const separateAxes = rotationOverLifetime.separateAxes;

      tempRot.x = separateAxes ? func(rotationOverLifetime.x!) : 0;
      tempRot.y = separateAxes ? func(rotationOverLifetime.y!) : 0;
      tempRot.z = incZ;
      out.rotation.copyFrom(tempRot);
    } else {
      out.hasRotation = false;
    }

    if (curves.hasPosition) {
      out.hasPosition = true;
      // Orbital position 依赖参考位置；普通 position 可直接从零向量采样位移贡献。
      const orbitalEnabled = !!curves.orbitalVelOverLifetime?.enabled;

      if (orbitalEnabled && basePosition) {
        calculateTranslation(out.position, curves, undefined, this.time, duration, basePosition);
        if (curves.pathGetter) {
          out.position.add(curves.pathGetter.getValue(life));
        }
        out.position.subtract(basePosition);
      } else {
        tempPos.set(0, 0, 0);
        calculateTranslation(out.position, curves, undefined, this.time, duration, tempPos);
        if (curves.pathGetter) {
          out.position.add(curves.pathGetter.getValue(life));
        }
      }
    } else {
      out.hasPosition = false;
    }
  }

  private captureOriginalTransform (boundItem: VFXItem): void {
    const scale = boundItem.transform.scale;

    this.originalTransform = {
      position: boundItem.transform.position.clone(),
      rotation: boundItem.transform.getRotation().clone(),
      // TODO 编辑器 scale 没有z轴控制
      scale: new Vector3(scale.x, scale.y, scale.x),
    };
    if (this.curves.pathGetter) {
      this.originalTransform.path = this.curves.pathGetter;
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
      hasPosition: !!positionOverLifetime && Object.keys(positionOverLifetime).length !== 0,
      sizeSeparateAxes: !!sizeOverLifetime?.separateAxes,
    };

    // TODO: 没有 K 帧数据的不需要传 positionOverLifetime 空对象
    if (positionOverLifetime && curves.hasPosition) {
      if (positionOverLifetime.path) {
        curves.pathGetter = createValueGetter(positionOverLifetime.path);
      }
      const linearVelEnable = positionOverLifetime.linearX || positionOverLifetime.linearY || positionOverLifetime.linearZ;

      if (linearVelEnable) {
        curves.linearVelOverLifetime = {
          x: positionOverLifetime.linearX && createValueGetter(positionOverLifetime.linearX),
          y: positionOverLifetime.linearY && createValueGetter(positionOverLifetime.linearY),
          z: positionOverLifetime.linearZ && createValueGetter(positionOverLifetime.linearZ),
          asMovement: positionOverLifetime.asMovement,
          enabled: !!linearVelEnable,
        };
      }

      const orbitalVelEnable = positionOverLifetime.orbitalX || positionOverLifetime.orbitalY || positionOverLifetime.orbitalZ;

      if (orbitalVelEnable) {
        curves.orbitalVelOverLifetime = {
          x: positionOverLifetime.orbitalX && createValueGetter(positionOverLifetime.orbitalX),
          y: positionOverLifetime.orbitalY && createValueGetter(positionOverLifetime.orbitalY),
          z: positionOverLifetime.orbitalZ && createValueGetter(positionOverLifetime.orbitalZ),
          center: ensureVec3(positionOverLifetime.orbCenter),
          asRotation: positionOverLifetime.asRotation,
          enabled: !!orbitalVelEnable,
        };
      }
    }

    if (sizeOverLifetime) {
      if (sizeOverLifetime.separateAxes) {
        curves.sizeXOverLifetime = createValueGetter(sizeOverLifetime.x || 1);
        curves.sizeYOverLifetime = createValueGetter(sizeOverLifetime.y || 1);
        curves.sizeZOverLifetime = createValueGetter(sizeOverLifetime.z || 1);
      } else {
        curves.sizeXOverLifetime = createValueGetter(sizeOverLifetime.size || 1);
      }
    }

    if (rotationOverLifetime) {
      curves.rotationOverLifetime = {
        asRotation: rotationOverLifetime.asRotation,
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
