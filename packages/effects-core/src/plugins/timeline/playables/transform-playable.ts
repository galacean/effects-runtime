import { Euler } from '@galacean/effects-math/es/core/euler';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import { effectsClass } from '../../../decorators';
import type { ItemLinearVelOverLifetime, ValueGetter } from '../../../math';
import { calculateTranslation, createValueGetter, ensureVec3 } from '../../../math';
import type { FrameContext } from '../playable';
import { Playable, PlayableAsset } from '../playable';

const tempRot = new Euler();
const tempPos = new Vector3();

/**
 * Track 混合模式，与 Unity AnimationLayer 的 Override / Additive 语义一致。
 * - override：contribution 表达"应当如何变化"，由 mixer 在 base pose 上叠加
 * - additive：contribution 是相对 base 的纯增量，由 layer mixer 在 override 结果上再叠加
 *
 * TODO: spec 发版后替换为 spec.TrackBlendMode
 */
export type TrackBlendMode = 'override' | 'additive';

/**
 * Transform 单帧贡献。每个字段语义：
 * - position：相对 base 的位移 delta（base = 0,0,0）
 * - quat：相对 base 的旋转 delta（base = identity）
 * - scale：相对 base 的缩放 multiplier（base = 1,1,1）
 */
export type TransformContribution = {
  hasPosition: boolean,
  position: Vector3,
  hasRotation: boolean,
  quat: Quaternion,
  hasScale: boolean,
  scale: Vector3,
};

/**
 * 任何向 TransformMixerPlayable 输出贡献的 playable 必须实现此接口。
 */
export type IContributesTransform = {
  getContribution: () => TransformContribution,
  getBlendMode: () => TrackBlendMode,
};

// clipPlayables 类型是 Playable[]，不一定都是 TransformPlayable；运行时检查是否能输出 contribution
export const isContributingTransform = (p: object): p is IContributesTransform => {
  return typeof (p as IContributesTransform).getContribution === 'function';
};

const createEmptyContribution = (): TransformContribution => ({
  hasPosition: false,
  position: new Vector3(),
  hasRotation: false,
  quat: new Quaternion(),
  hasScale: false,
  scale: new Vector3(1, 1, 1),
});

/**
 * @since 2.0.0
 */
export class TransformPlayable extends Playable implements IContributesTransform {
  protected sizeSeparateAxes: boolean;
  protected sizeXOverLifetime: ValueGetter<number>;
  protected sizeYOverLifetime: ValueGetter<number>;
  protected sizeZOverLifetime: ValueGetter<number>;
  protected rotationOverLifetime: {
    asRotation?: boolean,
    separateAxes?: boolean,
    enabled?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  };
  gravityModifier: ValueGetter<number>;
  orbitalVelOverLifetime: {
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
    center: [x: number, y: number, z: number],
    asRotation?: boolean,
    enabled?: boolean,
  };
  speedOverLifetime?: ValueGetter<number>;
  linearVelOverLifetime: ItemLinearVelOverLifetime;
  positionOverLifetime: spec.PositionOverLifetime;
  gravity: Vector3;
  direction: Vector3;
  startSpeed: number;
  pathGetter?: ValueGetter<Vector3>;
  data: TransformPlayableAssetData;
  blendMode: TrackBlendMode = 'override';

  private velocity: Vector3;
  private started = false;
  private readonly contribution: TransformContribution = createEmptyContribution();

  /**
   * 初始化 ValueGetter；不再依赖 boundObject（base pose 由 mixer 管理）
   */
  start (): void {
    const positionOverLifetime = this.data.positionOverLifetime;
    const rotationOverLifetime = this.data.rotationOverLifetime;
    const sizeOverLifetime = this.data.sizeOverLifetime;

    // TODO: 没有 K 帧数据的不需要传 positionOverLifetime 空对象
    if (positionOverLifetime && Object.keys(positionOverLifetime).length !== 0) {
      this.positionOverLifetime = positionOverLifetime;
      if (positionOverLifetime.path) {
        this.pathGetter = createValueGetter(positionOverLifetime.path);
      }
      const linearVelEnable = positionOverLifetime.linearX || positionOverLifetime.linearY || positionOverLifetime.linearZ;

      if (linearVelEnable) {
        this.linearVelOverLifetime = {
          x: positionOverLifetime.linearX && createValueGetter(positionOverLifetime.linearX),
          y: positionOverLifetime.linearY && createValueGetter(positionOverLifetime.linearY),
          z: positionOverLifetime.linearZ && createValueGetter(positionOverLifetime.linearZ),
          asMovement: positionOverLifetime.asMovement,
          enabled: !!linearVelEnable,
        };
      }

      const orbitalVelEnable = positionOverLifetime.orbitalX || positionOverLifetime.orbitalY || positionOverLifetime.orbitalZ;

      if (orbitalVelEnable) {
        this.orbitalVelOverLifetime = {
          x: positionOverLifetime.orbitalX && createValueGetter(positionOverLifetime.orbitalX),
          y: positionOverLifetime.orbitalY && createValueGetter(positionOverLifetime.orbitalY),
          z: positionOverLifetime.orbitalZ && createValueGetter(positionOverLifetime.orbitalZ),
          center: ensureVec3(positionOverLifetime.orbCenter),
          asRotation: positionOverLifetime.asRotation,
          enabled: !!orbitalVelEnable,
        };
      }
      this.speedOverLifetime = positionOverLifetime.speedOverLifetime && createValueGetter(positionOverLifetime.speedOverLifetime);
    }

    if (sizeOverLifetime) {
      if (sizeOverLifetime.separateAxes) {
        this.sizeSeparateAxes = true;
        this.sizeXOverLifetime = createValueGetter(sizeOverLifetime.x || 1);
        this.sizeYOverLifetime = createValueGetter(sizeOverLifetime.y || 1);
        this.sizeZOverLifetime = createValueGetter(sizeOverLifetime.z || 1);
      } else {
        this.sizeXOverLifetime = createValueGetter(sizeOverLifetime.size || 1);
      }
    }

    if (rotationOverLifetime) {
      this.rotationOverLifetime = {
        asRotation: rotationOverLifetime.asRotation,
        separateAxes: rotationOverLifetime.separateAxes,
        z: createValueGetter(rotationOverLifetime.z || 0),
      };
      if (rotationOverLifetime.separateAxes) {
        const rotLt = this.rotationOverLifetime;

        rotLt.x = createValueGetter(rotationOverLifetime.x || 0);
        rotLt.y = createValueGetter(rotationOverLifetime.y || 0);
      }
    }
    this.gravity = Vector3.fromArray(positionOverLifetime?.gravity || []);
    this.gravityModifier = createValueGetter(positionOverLifetime?.gravityOverLifetime ?? 0);
    this.direction = positionOverLifetime?.direction ? Vector3.fromArray(positionOverLifetime.direction).normalize() : new Vector3();
    this.startSpeed = positionOverLifetime?.startSpeed || 0;

    this.velocity = this.direction.clone();
    this.velocity.multiply(this.startSpeed);
  }

  override processFrame (context: FrameContext): void {
    if (!this.started) {
      this.start();
      this.started = true;
    }
    this.sampleAnimation();
  }

  getContribution (): TransformContribution {
    return this.contribution;
  }

  getBlendMode (): TrackBlendMode {
    return this.blendMode;
  }

  /**
   * 计算本帧贡献，写入 this.contribution。不直接写 transform，由 mixer 统一合成。
   */
  private sampleAnimation (): void {
    const duration = this.getDuration();
    let life = this.time / duration;

    life = life < 0 ? 0 : life;

    const out = this.contribution;

    // scale：multiplier，base = 1
    if (this.sizeXOverLifetime) {
      out.hasScale = true;
      out.scale.x = this.sizeXOverLifetime.getValue(life);
      if (this.sizeSeparateAxes) {
        out.scale.y = this.sizeYOverLifetime.getValue(life);
        out.scale.z = this.sizeZOverLifetime.getValue(life);
      } else {
        out.scale.z = out.scale.y = out.scale.x;
      }
    } else {
      out.hasScale = false;
    }

    // rotation：delta quat，base = identity
    if (this.rotationOverLifetime) {
      out.hasRotation = true;
      const func = (v: ValueGetter<number>) => this.rotationOverLifetime.asRotation ? v.getValue(life) : v.getIntegrateValue(0, life, duration);
      const incZ = func(this.rotationOverLifetime.z!);
      const separateAxes = this.rotationOverLifetime.separateAxes;

      tempRot.x = separateAxes ? func(this.rotationOverLifetime.x!) : 0;
      tempRot.y = separateAxes ? func(this.rotationOverLifetime.y!) : 0;
      tempRot.z = incZ;
      out.quat.setFromEuler(tempRot);
      // GE 四元数右手左螺旋约定，与 Transform.setRotation 的 conjugate 一致
      out.quat.conjugate();
    } else {
      out.hasRotation = false;
    }

    // position contribution 只支持 path 类数据。
    // orbital/物理仿真依赖真实 posData，多轨 contribution 语义下无法正确产出 delta。
    if (this.positionOverLifetime) {
      out.hasPosition = true;
      if (this.blendMode === 'additive') {
        out.position.set(0, 0, 0);
        if (this.pathGetter) {
          out.position.copyFrom(this.pathGetter.getValue(life));
        }
      } else {
        tempPos.set(0, 0, 0);
        calculateTranslation(out.position, this, this.gravity, this.time, duration, tempPos, this.velocity);
        if (this.pathGetter) {
          out.position.add(this.pathGetter.getValue(life));
        }
      }
    } else {
      out.hasPosition = false;
    }

  }
}

@effectsClass(spec.DataType.TransformPlayableAsset)
export class TransformPlayableAsset extends PlayableAsset {
  transformAnimationData: TransformPlayableAssetData;

  override createPlayable (): Playable {
    const transformPlayable = new TransformPlayable();

    transformPlayable.data = this.transformAnimationData;

    return transformPlayable;
  }

  override fromData (data: TransformPlayableAssetData): void {
    this.transformAnimationData = data;
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
