import * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../math';
import {
  calculateTranslation,
  createValueGetter,
  ensureVec3, isZeroVec,
  vecAdd,
  vecAssign,
  vecFill, vecMulScalar,
  vecNormalize,
} from '../../math';
import type { Transform } from '../../transform';
import type { VFXItem, VFXItemContent } from '../../vfx-item';
import type { SpriteRenderData } from '../sprite/sprite-mesh';

/**
 * 基础位移属性数据
 */
export type ItemBasicTransform = {
  position: [x: number, y: number, z: number],
  rotation: [x: number, y: number, z: number],
  scale: [x: number, y: number, z: number],
  path?: ValueGetter<spec.vec3>,
};

export type ItemLinearVelOverLifetime = {
  asMovement?: boolean,
  x?: ValueGetter<number>,
  y?: ValueGetter<number>,
  z?: ValueGetter<number>,
  enabled?: boolean,
};

export interface CalculateItemOptions {
  delay: number,
  startSpeed: number,
  direction: spec.vec3,
  startSize: number,
  sizeAspect: number,
  duration: number,
  looping: boolean,
  endBehavior: number,
  reusable?: boolean,
  gravity: spec.vec3,
  gravityModifier: ValueGetter<number>,
  startRotation?: number,
  start3DRotation?: number,
}
const tempRot: spec.vec3 = [0, 0, 0];
const tempSize: spec.vec3 = [1, 1, 1];
const tempPos: spec.vec3 = [0, 0, 0];

export class CalculateItem {
  renderData: SpriteRenderData;
  id: string;
  active = false;
  name: string;
  visible: boolean;
  time: number;
  protected options: CalculateItemOptions;
  protected basicTransform: ItemBasicTransform;
  protected transform: Transform;
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
  positionOverLifetime: ValueGetter<number>;
  linearVelOverLifetime: ItemLinearVelOverLifetime;

  /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
  // protected colorOverLifetime: { stop: number, color: any }[];
  // protected opacityOverLifetime: ValueGetter<number>;
  // readonly startColor: vec4 = [1, 1, 1, 1];
  /*****************/

  private _velocity: spec.vec3;
  constructor (
    props: spec.NullContent,
    protected vfxItem: VFXItem<VFXItemContent>,
  ) {
    this.transform = vfxItem.transform;
    const scale = this.transform.scale;

    this.basicTransform = {
      position: [...this.transform.position],
      rotation: [...this.transform.getRotation()],
      scale: [scale[0], scale[1], scale[0]],
    };

    const { rotationOverLifetime, sizeOverLifetime, positionOverLifetime = {} } = props;

    if (positionOverLifetime) {
      if (positionOverLifetime.path) {
        this.basicTransform.path = createValueGetter(positionOverLifetime.path);
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

    /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
    // const colorOverLifetime = props.colorOverLifetime;
    //
    // if (colorOverLifetime) {
    //   this.opacityOverLifetime = createValueGetter(colorOverLifetime.opacity ?? 1);
    //   if (colorOverLifetime.color && colorOverLifetime.color[0] === spec.ValueType.GRADIENT_COLOR) {
    //     this.colorOverLifetime = colorStopsFromGradient(colorOverLifetime.color[1]);
    //   }
    // }
    /**************************8*/
    this.options = {
      reusable: !!vfxItem.reusable,
      delay: vfxItem.delay || 0,
      startSpeed: positionOverLifetime.startSpeed || 0,
      startSize: scale && scale[0] || 1,
      sizeAspect: scale && (scale[0] / (scale[1] || 1)) || 1,
      duration: vfxItem.duration || 0,
      looping: vfxItem.endBehavior && vfxItem.endBehavior === spec.ItemEndBehavior.loop,
      endBehavior: vfxItem.endBehavior || spec.END_BEHAVIOR_DESTROY,
      gravity: ensureVec3(positionOverLifetime.gravity),
      gravityModifier: createValueGetter(positionOverLifetime.gravityOverLifetime ?? 0),
      direction: positionOverLifetime.direction ? vecNormalize([], positionOverLifetime.direction) : ensureVec3(),
      /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
      // startColor: props.options.startColor || [1, 1, 1, 1],
      /*********************/
    };

    this.id = vfxItem.id;
    this.time = 0;
    this.name = vfxItem.name;
    this.visible = vfxItem.getVisible();
  }

  get ended () {
    return this.time > this.options.duration && !this.options.looping && !this.options.reusable;
  }

  get startSize () {
    return this.basicTransform.scale;
  }

  set startSize (scale: [x: number, y: number, z: number]) {
    this.basicTransform.scale = scale;
  }

  get velocity () {
    if (!this._velocity) {
      this._velocity = vecMulScalar([] as unknown as spec.vec3, this.options.direction, this.options.startSpeed);
    }

    return this._velocity;
  }

  getWillTranslate (): boolean {
    return !!((this.linearVelOverLifetime && this.linearVelOverLifetime.enabled) ||
      (this.orbitalVelOverLifetime && this.orbitalVelOverLifetime.enabled) ||
      (this.options.gravityModifier && !isZeroVec(this.options.gravity)) ||
      (this.options.startSpeed && !isZeroVec(this.options.direction)));
  }

  updateTime (globalTime: number) {
    const time = globalTime - this.options.delay;
    const duration = this.options.duration;

    if (time >= duration && this.options.looping) {
      let start = time - duration;

      while (start > duration) {
        start -= duration;
      }
      this.time = start;
    } else {
      const freeze = this.options.endBehavior === spec.END_BEHAVIOR_FREEZE;

      this.time = freeze ? Math.min(duration, time) : time;
    }
  }

  getRenderData (_time: number, init?: boolean): SpriteRenderData {
    const options = this.options;
    const sizeInc = vecFill(tempSize, 1);
    const rotInc = vecFill(tempRot, 0);
    let sizeChanged = false, rotChanged = false;
    const time = _time < 0 ? _time : Math.max(_time, 0.);
    const duration = options.duration;
    let life = time / duration;

    const ret: SpriteRenderData = {
      life,
      transform: this.transform,
    };

    life = life < 0 ? 0 : (life > 1 ? 1 : life);

    if (this.sizeXOverLifetime) {
      sizeInc[0] = this.sizeXOverLifetime.getValue(life);
      if (this.sizeSeparateAxes) {
        sizeInc[1] = this.sizeYOverLifetime.getValue(life);
        sizeInc[2] = this.sizeZOverLifetime.getValue(life);
      } else {
        sizeInc[2] = sizeInc[1] = sizeInc[0];
      }
      sizeChanged = true;
    }

    this.calculateScaling(sizeChanged, sizeInc, init);
    const rotationOverLifetime = this.rotationOverLifetime;

    if (rotationOverLifetime) {
      const func = (v: ValueGetter<number>) => rotationOverLifetime.asRotation ? v.getValue(life) : v.getIntegrateValue(0, life, duration);
      const incZ = func(rotationOverLifetime.z!);
      const separateAxes = rotationOverLifetime.separateAxes;

      rotInc[0] = separateAxes ? func(rotationOverLifetime.x!) : 0;
      rotInc[1] = separateAxes ? func(rotationOverLifetime.y!) : 0;
      rotInc[2] = incZ;
      rotChanged = true;
    }

    if (rotChanged || init) {
      const rot = vecAdd(tempRot, this.basicTransform.rotation, rotInc);

      ret.transform.setRotation(rot[0], rot[1], rot[2]);
    }

    let pos: spec.vec3 | undefined;

    if (this.getWillTranslate() || init) {
      pos = [0, 0, 0];
      calculateTranslation(pos, this, this.options.gravity, time, duration, this.basicTransform.position, this.velocity);
    }

    if (this.basicTransform.path) {
      if (!pos) {
        pos = vecAssign(tempPos, this.basicTransform.position, 3);
      }
      vecAdd(pos, pos, this.basicTransform.path.getValue(life));
    }
    if (pos) {
      this.transform.setPosition(pos[0], pos[1], pos[2]);
    }

    /* 要过包含父节点颜色/透明度变化的动画的帧对比 打开这段兼容代码 */
    // let colorInc = vecFill(tempColor, 1);
    // let colorChanged;
    // const opacityOverLifetime = this.opacityOverLifetime;
    // const colorOverLifetime = this.colorOverLifetime;
    //
    // if (colorOverLifetime) {
    //   colorInc = getColorFromGradientStops(colorOverLifetime, life, true) as vec4;
    //   colorChanged = true;
    // }
    // if (opacityOverLifetime) {
    //   colorInc[3] *= opacityOverLifetime.getValue(life);
    //   colorChanged = true;
    // }
    //
    // if (colorChanged || init) {
    //   // @ts-expect-error
    //   ret.color = vecMulCombine<vec4>(this.startColor, colorInc, this.options.startColor);
    // }
    /*************************/
    ret.active = this.active;

    return ret;
  }

  protected calculateScaling (sizeChanged: boolean, sizeInc: spec.vec3, init?: boolean) {
    this.transform.setScale(sizeInc[0] * this.startSize[0], sizeInc[1] * this.startSize[1], sizeInc[2] * this.startSize[2]);
  }

}
