import * as spec from '@galacean/effects-specification';
import { DEG2RAD, Vector3 } from '@galacean/effects-math/es/core/index';
import { random } from '../utils';
import { getArcAngle } from './cone';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from './shape';

export class Circle implements Shape {
  radius: number;
  arc: number;
  arcMode: number;

  constructor (props: Record<string, any>) {
    Object.keys(props).forEach(key => {
      this[key as keyof Shape] = props[key];
    });
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const arc = getArcAngle(this.arc, this.arcMode, opt) * DEG2RAD;
    const direction = new Vector3(Math.cos(arc), Math.sin(arc), 0);
    const radius = this.radius;

    return {
      direction,
      position: direction.clone().multiply(radius),
    };
  }
}

export class Rectangle implements Shape {
  _d: number;
  _h: number;

  constructor (arg: any) {
    this._d = (arg.width || 1) / 2;
    this._h = (arg.height || 1) / 2;
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const x = random(-this._d, this._d);
    const y = random(-this._h, this._h);

    return {
      direction: new Vector3(0, 0, 1),
      position: new Vector3(x, y, 0),
    };
  }

}

export class RectangleEdge implements Shape {
  width: number;
  height: number;
  arcMode: number;
  arc: number;
  _d: number;
  _h: number;

  constructor (arg: any) {
    this._d = (arg.width || 1) / 2;
    this._h = (arg.height || 1) / 2;
    this.arcMode = arg.arcMode;
    this.arc = arg.arc;
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const arc = getArcAngle(this.arc, this.arcMode, opt) * DEG2RAD;
    const direction = new Vector3(Math.cos(arc), Math.sin(arc), 0);
    const w = this._d;
    const h = this._h;
    const r0 = Math.atan2(h, w);
    const tan = Math.tan(arc);
    const position = new Vector3();

    if (arc < r0) {
      position.set(w, w * tan, 0);
    } else if (arc >= r0 && arc < Math.PI - r0) {
      position.set(h / tan, h, 0);
    } else if (arc < Math.PI + r0) {
      position.set(-w, -w * tan, 0);
    } else if (arc < Math.PI * 2 - r0) {
      position.set(-h / tan, -h, 0);
    } else {
      position.set(w, w * tan, 0);
    }

    return {
      direction,
      position,
    };
  }
}

export class Edge implements Shape {
  width: number;

  arcMode: spec.ShapeArcMode;
  _d: number;

  constructor (args: any) {
    this._d = args.width || 1;
    this.arcMode = args.arcMode;
  }

  generate (options: ShapeGeneratorOptions): ShapeParticle {
    const x = this.arcMode === spec.ShapeArcMode.UNIFORM_BURST ? ((options.burstIndex % options.burstCount) / (options.burstCount - 1)) : random(0, 1);

    return {
      direction: new Vector3(0, 1, 0),
      position: new Vector3(this._d * (x - 0.5), 0, 0),
    };
  }
}
