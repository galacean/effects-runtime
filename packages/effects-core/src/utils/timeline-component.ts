import * as spec from '@galacean/effects-specification';
import { Euler, Vector3 } from '@galacean/effects-math/es/core/index';
import type { ValueGetter } from '../math';
import { ensureVec3, calculateTranslation, createValueGetter } from '../math';
import type { Transform } from '../transform';
import type { VFXItem } from '../vfx-item';
import type { SpriteItemOptions, ItemBasicTransform, ItemLinearVelOverLifetime, SpriteRenderData } from '../plugins';

export interface TimelineComponentOptions {
  sizeOverLifetime?: spec.SizeOverLifetime,
  rotationOverLifetime?: spec.RotationOverLifetime,
  positionOverLifetime?: spec.PositionOverLifetime,
}

const tempRot = new Euler();
const tempSize = new Vector3(1, 1, 1);
const tempPos = new Vector3(0, 0, 0);

export class TimelineComponent {
  options: Omit<SpriteItemOptions, 'delay'>;
  sizeSeparateAxes: boolean;
  speedOverLifetime?: ValueGetter<number>;
  basicTransform: ItemBasicTransform;
  gravityModifier: ValueGetter<number>;

  readonly transform: Transform;
  readonly linearVelOverLifetime: ItemLinearVelOverLifetime;
  readonly orbitalVelOverLifetime: {
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
    center: [x: number, y: number, z: number],
    asRotation?: boolean,
    enabled?: boolean,
  };

  private velocity: Vector3;
  private readonly rotationOverLifetime: {
    asRotation?: boolean,
    separateAxes?: boolean,
    enabled?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  };
  private readonly sizeXOverLifetime: ValueGetter<number>;
  private readonly sizeYOverLifetime: ValueGetter<number>;
  private readonly sizeZOverLifetime: ValueGetter<number>;
  private readonly positionOverLifetime: spec.PositionOverLifetime;

  constructor (options: TimelineComponentOptions, ownerItem: VFXItem<any>) {
    const { positionOverLifetime = {} } = options;
    const { transform, duration, endBehavior } = ownerItem;
    const scale = transform.scale;

    this.transform = transform;
    this.basicTransform = {
      position: transform.position.clone(),
      rotation: transform.getRotation(),
      scale,
    };
    if (positionOverLifetime.path) {
      this.basicTransform.path = createValueGetter(positionOverLifetime.path);
    }
    this.positionOverLifetime = positionOverLifetime;
    this.options = {
      startSpeed: positionOverLifetime.startSpeed || 0,
      startSize: scale && scale.x || 1,
      sizeAspect: scale && (scale.x / (scale.y || 1)) || 1,
      startColor: [1, 1, 1, 1],
      duration: duration || 0,
      looping: endBehavior && endBehavior === spec.ItemEndBehavior.loop,
      gravity: Vector3.fromArray(positionOverLifetime.gravity || []),
      gravityModifier: createValueGetter(positionOverLifetime.gravityOverLifetime ?? 0),
      direction: positionOverLifetime.direction ? Vector3.fromArray(positionOverLifetime.direction).normalize() : new Vector3(),
      endBehavior: endBehavior || spec.END_BEHAVIOR_DESTROY,
    };

    const sizeOverLifetime = options.sizeOverLifetime;

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

    const rot = options.rotationOverLifetime;

    if (rot) {
      this.rotationOverLifetime = {
        asRotation: rot.asRotation,
        separateAxes: rot.separateAxes,
        z: createValueGetter(rot.z || 0),
      };
      if (rot.separateAxes) {
        const rotLt = this.rotationOverLifetime;

        rotLt.x = createValueGetter(rot.x || 0);
        rotLt.y = createValueGetter(rot.y || 0);
      }
    }

    this.gravityModifier = this.options.gravityModifier;
  }

  private getVelocity () {
    if (!this.velocity) {
      this.velocity = this.options.direction.clone().multiply(this.options.startSpeed);
    }

    return this.velocity;
  }

  private willTranslate () {
    return !!((this.linearVelOverLifetime && this.linearVelOverLifetime.enabled) ||
      (this.orbitalVelOverLifetime && this.orbitalVelOverLifetime.enabled) ||
      (this.options.gravityModifier && !this.options.gravity.isZero()) ||
      (this.options.startSpeed && !this.options.direction.isZero()));
  }

  updatePosition (x: number, y: number, z: number) {
    this.basicTransform.position.set(x, y, z);
  }

  updateRotation (x: number, y: number, z: number) {
    this.basicTransform.rotation.set(x, y, z);
  }

  getRenderData (_time: number, init?: boolean): SpriteRenderData {
    const options = this.options;
    const sizeInc = tempSize.setFromNumber(1);
    const rotInc = tempRot.set(0, 0, 0);
    let sizeChanged, rotChanged;
    const time = _time < 0 ? _time : Math.max(_time, 0.);
    const duration = options.duration;
    let life = time / duration;

    const ret: SpriteRenderData = {
      life,
      transform: this.transform,
      startSize: this.basicTransform.scale.clone(),
    };
    const transform = this.basicTransform;

    life = life < 0 ? 0 : (life > 1 ? 1 : life);
    if (this.sizeXOverLifetime) {
      sizeInc.x = this.sizeXOverLifetime.getValue(life);
      if (this.sizeSeparateAxes) {
        sizeInc.y = this.sizeYOverLifetime.getValue(life);
        sizeInc.z = this.sizeZOverLifetime.getValue(life);
      } else {
        sizeInc.z = sizeInc.y = sizeInc.x;
      }
      sizeChanged = true;
    }
    if (sizeChanged || init) {
      ret.transform.setScale(sizeInc.x, sizeInc.y, sizeInc.z);
    }
    const rotationOverLifetime = this.rotationOverLifetime;

    if (rotationOverLifetime) {
      const func = (v: ValueGetter<number>) => rotationOverLifetime.asRotation ? v.getValue(life) : v.getIntegrateValue(0, life, duration);
      const incZ = func(rotationOverLifetime.z!);
      const separateAxes = rotationOverLifetime.separateAxes;

      rotInc.x = separateAxes ? func(rotationOverLifetime.x!) : 0;
      rotInc.y = separateAxes ? func(rotationOverLifetime.y!) : 0;
      rotInc.z = incZ;
      rotChanged = true;
    }

    if (rotChanged || init) {
      const rot = tempRot.addEulers(transform.rotation, rotInc);

      ret.transform.setRotation(rot.x, rot.y, rot.z);
    }

    let pos: Vector3 | undefined;

    if (this.willTranslate() || init) {
      const out = tempSize.setFromNumber(0);

      pos = calculateTranslation(out, this, options.gravity, time, duration, transform.position, this.getVelocity());
    }
    if (transform.path) {
      if (!pos) {
        pos = tempPos.copyFrom(transform.position);
      }
      pos.add(transform.path.getValue(life));
    }
    if (pos) {
      ret.transform.setPosition(pos.x, pos.y, pos.z);
    }

    if (ret.startSize) {
      const scaling = ret.transform.scale;

      ret.transform.setScale(scaling.x * ret.startSize.x, scaling.y * ret.startSize.y, scaling.z * ret.startSize.z);
    }

    return ret;
  }
}
