import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import { calculateTranslation, createValueGetter, ensureVec3 } from '../../math';
import { AnimationPlayable } from './animation-playable';
import type { ItemBasicTransform, ItemLinearVelOverLifetime } from './calculate-item';
import type { FrameContext, PlayableGraph } from './playable-graph';
import { Playable, PlayableAsset } from './playable-graph';
import { EffectsObject } from '../../effects-object';
import { VFXItem } from '../../vfx-item';
import { effectsClass } from '../../decorators';
import type { Pose } from '../animation-graph.ts/pose';

const tempRot = new Euler();
const tempSize = new Vector3(1, 1, 1);
const tempPos = new Vector3();

/**
 * @since 2.0.0
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
  data: TransformPlayableAssetData;
  private velocity: Vector3;
  private boundObject: VFXItem;

  start (): void {
    const boundItem = this.boundObject;
    const scale = boundItem.transform.scale;

    this.originalTransform = {
      position: boundItem.transform.position.clone(),
      rotation: boundItem.transform.getRotation().clone(),
      // TODO 编辑器 scale 没有z轴控制
      scale: new Vector3(scale.x, scale.y, scale.x),
    };
    const positionOverLifetime = this.data.positionOverLifetime;
    const rotationOverLifetime = this.data.rotationOverLifetime;
    const sizeOverLifetime = this.data.sizeOverLifetime;

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

  override processFrame (context: FrameContext): void {
    if (!this.boundObject) {
      const boundObject = context.output.getUserData();

      if (boundObject instanceof VFXItem) {
        this.boundObject = boundObject;
        this.start();
      }
    }
    if (this.boundObject && this.boundObject.composition) {
      this.sampleAnimation();
    }
  }

  /**
   * 应用时间轴K帧数据到对象
   */
  private sampleAnimation () {
    const boundItem = this.boundObject;
    const duration = boundItem.duration;
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

      boundItem.transform.setScale(tempSize.x * startSize.x, tempSize.y * startSize.y, tempSize.z * startSize.z);
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

      boundItem.transform.setRotation(rot.x, rot.y, rot.z);
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
      boundItem.transform.setPosition(pos.x, pos.y, pos.z);
      // this.animationStream.setCurveValue('transform', 'position.x', pos.x);
      // this.animationStream.setCurveValue('transform', 'position.y', pos.y);
      // this.animationStream.setCurveValue('transform', 'position.z', pos.z);
    }
  }
}

@effectsClass(spec.DataType.TransformPlayableAsset)
export class TransformPlayableAsset extends PlayableAsset {
  transformAnimationData: TransformPlayableAssetData;

  override createPlayable (graph: PlayableGraph): Playable {
    const transformAnimationPlayable = new TransformAnimationPlayable(graph);

    transformAnimationPlayable.data = this.transformAnimationData;

    return transformAnimationPlayable;
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

/**
 * @since 2.0.0
 */
export class ActivationPlayable extends Playable {

  override processFrame (context: FrameContext): void {
    const vfxItem = context.output.getUserData();

    if (!(vfxItem instanceof VFXItem)) {
      return;
    }

    vfxItem.time = this.time;
  }
}

@effectsClass(spec.DataType.ActivationPlayableAsset)
export class ActivationPlayableAsset extends PlayableAsset {
  override createPlayable (graph: PlayableGraph): Playable {
    return new ActivationPlayable(graph);
  }
}

export interface PositionCurve {
  path: string,
  keyFrames: ValueGetter<Vector3>,
}

export interface EulerCurve {
  path: string,
  keyFrames: ValueGetter<Euler>,
}

export interface RotationCurve {
  path: string,
  keyFrames: ValueGetter<Quaternion>,
}

export interface ScaleCurve {
  path: string,
  keyFrames: ValueGetter<Vector3>,
}

export interface FloatCurve {
  path: string,
  property: string,
  className: string,
  keyFrames: ValueGetter<number>,
}

@effectsClass(spec.DataType.AnimationClip)
export class AnimationClip extends EffectsObject {
  duration = 0;
  positionCurves: PositionCurve[] = [];
  rotationCurves: RotationCurve[] = [];
  eulerCurves: EulerCurve[] = [];
  scaleCurves: ScaleCurve[] = [];
  floatCurves: FloatCurve[] = [];

  sampleAnimation (vfxItem: VFXItem, time: number) {
    const duration = vfxItem.duration;
    let life = time / duration;

    life = life < 0 ? 0 : (life > 1 ? 1 : life);

    for (const curve of this.positionCurves) {
      const value = curve.keyFrames.getValue(life);
      // @ts-expect-error
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setPosition(value.x, value.y, value.z);
    }

    for (const curve of this.rotationCurves) {
      const value = curve.keyFrames.getValue(life);
      // @ts-expect-error
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setQuaternion(value.x, value.y, value.z, value.w);
    }

    for (const curve of this.eulerCurves) {
      const value = curve.keyFrames.getValue(life);
      // @ts-expect-error
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setRotation(value.x, value.y, value.z);
    }

    for (const curve of this.scaleCurves) {
      const value = curve.keyFrames.getValue(life);
      // @ts-expect-error
      const target = this.findTarget(vfxItem, curve.path);

      target?.transform.setScale(value.x, value.y, value.z);
    }

    // TODO float curves 采样
  }

  override fromData (data: spec.AnimationClipData): void {
    this.positionCurves.length = 0;
    this.scaleCurves.length = 0;
    this.floatCurves.length = 0;

    for (const positionCurveData of data.positionCurves) {
      const curve: PositionCurve = {
        path: positionCurveData.path,
        keyFrames: createValueGetter(positionCurveData.keyFrames),
      };

      this.duration = Math.max(this.duration, curve.keyFrames.getMaxTime());

      this.positionCurves.push(curve);
    }
    for (const rotationCurveData of data.rotationCurves) {
      const curve: RotationCurve = {
        path: rotationCurveData.path,
        keyFrames: createValueGetter(rotationCurveData.keyFrames),
      };

      this.duration = Math.max(this.duration, curve.keyFrames.getMaxTime());

      this.rotationCurves.push(curve);
    }

    //@ts-expect-error TODO 更新 spec
    if (data.eulerCurves) {
      //@ts-expect-error
      for (const eulerCurvesData of data.eulerCurves) {
        const curve: EulerCurve = {
          path: eulerCurvesData.path,
          keyFrames: createValueGetter(eulerCurvesData.keyFrames),
        };

        this.duration = Math.max(this.duration, curve.keyFrames.getMaxTime());

        this.eulerCurves.push(curve);
      }
    }
    for (const scaleCurvesData of data.scaleCurves) {
      const curve: ScaleCurve = {
        path: scaleCurvesData.path,
        keyFrames: createValueGetter(scaleCurvesData.keyFrames),
      };

      this.duration = Math.max(this.duration, curve.keyFrames.getMaxTime());

      this.scaleCurves.push(curve);
    }
    for (const floatCurveData of data.floatCurves) {
      const curve: FloatCurve = {
        path: floatCurveData.path,
        keyFrames: createValueGetter(floatCurveData.keyFrames),
        property: floatCurveData.property,
        className: floatCurveData.className,
      };

      this.duration = Math.max(this.duration, curve.keyFrames.getMaxTime());

      this.floatCurves.push(curve);
    }
  }

  getPose (time: number, outPose: Pose) {
    let life = time / this.duration;

    life = life < 0 ? 0 : (life > 1 ? 1 : life);

    for (const curve of this.positionCurves) {
      const value = curve.keyFrames.getValue(life);

      outPose.setPosition(curve.path, value);
    }

    for (const curve of this.rotationCurves) {
      const value = curve.keyFrames.getValue(life);

      outPose.setRotation(curve.path, value);
    }

    for (const curve of this.eulerCurves) {
      const value = curve.keyFrames.getValue(life);

      outPose.setEuler(curve.path, value);
    }

    for (const curve of this.scaleCurves) {
      const value = curve.keyFrames.getValue(life);

      outPose.setScale(curve.path, value);
    }
  }

  private findTarget (vfxItem: VFXItem, path: string[]) {
    let target = vfxItem;

    for (const name of path) {
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

export class AnimationClipPlayable extends Playable {
  clip: AnimationClip;

  override processFrame (context: FrameContext): void {
    const boundObject = context.output.getUserData();

    if (!(boundObject instanceof VFXItem)) {
      return;
    }
    if (boundObject.composition) {
      this.clip.sampleAnimation(boundObject, this.time);
    }
  }
}
