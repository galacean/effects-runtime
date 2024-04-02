import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { calculateTranslation, createValueGetter, ensureVec3 } from '../../math';
import { AnimationPlayable } from './animation-playable';
import type { ItemBasicTransform, ItemLinearVelOverLifetime } from './calculate-item';
import { Playable, PlayableAsset } from './playable-graph';

const tempRot = new Euler();
const tempSize = new Vector3(1, 1, 1);
const tempPos = new Vector3();

/**
 * @since 2.0.0
 * @internal
 */
export class TransformAnimationPlayable extends AnimationPlayable {
  originalTransform: ItemBasicTransform;
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

  private velocity: Vector3;

  override processFrame (dt: number): void {
    if (this.bindingItem.composition) {
      this.sampleAnimation();
    }
  }

  /**
   * 应用时间轴K帧数据到对象
   */
  private sampleAnimation () {
    const duration = this.bindingItem.duration;
    let life = this.time / duration;

    life = life < 0 ? 0 : (life > 1 ? 1 : life);

    if (this.sizeXOverLifetime) {
      tempSize.x = this.sizeXOverLifetime.getValue(life);
      if (this.sizeSeparateAxes) {
        tempSize.y = this.sizeYOverLifetime.getValue(life);
        tempSize.z = this.sizeZOverLifetime.getValue(life);
      } else {
        tempSize.z = tempSize.y = tempSize.x;
      }
      const startSize = this.originalTransform.scale;

      this.bindingItem.transform.setScale(tempSize.x * startSize.x, tempSize.y * startSize.y, tempSize.z * startSize.z);
      // this.animationStream.setCurveValue('transform', 'scale.x', tempSize.x * startSize.x);
      // this.animationStream.setCurveValue('transform', 'scale.y', tempSize.y * startSize.y);
      // this.animationStream.setCurveValue('transform', 'scale.z', tempSize.z * startSize.z);
    }

    if (this.rotationOverLifetime) {
      const func = (v: ValueGetter<number>) => this.rotationOverLifetime.asRotation ? v.getValue(life) : v.getIntegrateValue(0, life, duration);
      const incZ = func(this.rotationOverLifetime.z!);
      const separateAxes = this.rotationOverLifetime.separateAxes;

      tempRot.x = separateAxes ? func(this.rotationOverLifetime.x!) : 0;
      tempRot.y = separateAxes ? func(this.rotationOverLifetime.y!) : 0;
      tempRot.z = incZ;
      const rot = tempRot.addEulers(this.originalTransform.rotation, tempRot);

      this.bindingItem.transform.setRotation(rot.x, rot.y, rot.z);
      // this.animationStream.setCurveValue('transform', 'rotation.x', rot.x);
      // this.animationStream.setCurveValue('transform', 'rotation.y', rot.y);
      // this.animationStream.setCurveValue('transform', 'rotation.z', rot.z);
    }

    if (this.positionOverLifetime) {
      const pos = tempPos;

      calculateTranslation(pos, this, this.gravity, this.time, duration, this.originalTransform.position, this.velocity);
      if (this.originalTransform.path) {
        pos.add(this.originalTransform.path.getValue(life));
      }
      this.bindingItem.transform.setPosition(pos.x, pos.y, pos.z);
      // this.animationStream.setCurveValue('transform', 'position.x', pos.x);
      // this.animationStream.setCurveValue('transform', 'position.y', pos.y);
      // this.animationStream.setCurveValue('transform', 'position.z', pos.z);
    }
  }

  override fromData (data: TransformAnimationData): void {
    const scale = this.bindingItem.transform.scale;

    this.originalTransform = {
      position: this.bindingItem.transform.position.clone(),
      rotation: this.bindingItem.transform.getRotation().clone(),
      // TODO 编辑器 scale 没有z轴控制
      scale: new Vector3(scale.x, scale.y, scale.x),
    };
    const positionOverLifetime = data.positionOverLifetime;
    const rotationOverLifetime = data.rotationOverLifetime;
    const sizeOverLifetime = data.sizeOverLifetime;

    // TODO: 没有 K 帧数据的不需要传 positionOverLifetime 空对象
    if (positionOverLifetime && Object.keys(positionOverLifetime).length !== 0) {
      this.positionOverLifetime = positionOverLifetime;
      if (positionOverLifetime.path) {
        this.originalTransform.path = createValueGetter(positionOverLifetime.path);
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
}

export class TransformAnimationPlayableAsset extends PlayableAsset {
  transformAnimationData: TransformAnimationData;

  override createPlayable (): Playable {
    const transformAnimationPlayable = new TransformAnimationPlayable();

    transformAnimationPlayable.fromData(this.transformAnimationData);

    return transformAnimationPlayable;
  }

  override fromData (data: TransformAnimationData): void {
    this.transformAnimationData = data;
  }
}

export interface TransformAnimationData {
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

/**
 * @since 2.0.0
 * @internal
 */
export class ActivationPlayable extends Playable {
  override onGraphStart (): void {
    this.bindingItem.transform.setValid(false);
    this.hideRendererComponents();
  }

  override onPlayablePlay (): void {
    this.bindingItem.transform.setValid(true);
    this.showRendererComponents();
  }

  override onPlayableDestroy (): void {
    this.bindingItem.transform.setValid(false);
    this.hideRendererComponents();
  }

  private hideRendererComponents () {
    for (const rendererComponent of this.bindingItem.rendererComponents) {
      if (rendererComponent.enabled) {
        rendererComponent.enabled = false;
      }
    }
  }

  private showRendererComponents () {
    for (const rendererComponent of this.bindingItem.rendererComponents) {
      if (!rendererComponent.enabled) {
        rendererComponent.enabled = true;
      }
    }
  }
}
