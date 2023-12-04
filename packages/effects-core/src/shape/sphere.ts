import { DEG2RAD, Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import { random } from '../utils';
import { getArcAngle } from './cone';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from '.';

const tempMat4 = new Matrix4();

export class Sphere implements Shape {
  arc: number;
  radius: number;
  arcMode: number;

  constructor (props: Record<string, any>) {
    Object.keys(props).forEach(key => {
      this[key as keyof Shape] = props[key];
    });
  }

  getHorizontalAngle () {
    return random(-90, 90);
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const rz = getArcAngle(this.arc, this.arcMode, opt) * DEG2RAD;
    const rh = this.getHorizontalAngle() * DEG2RAD;
    const radius = this.radius;
    const point = new Vector3(Math.cos(rh), 0, Math.sin(rh));
    const mat4 = tempMat4.setFromRotationZ(rz);
    const p = mat4.transformNormal(point);

    return {
      position: p.clone().multiply(radius),
      direction: p,
    };
  }
}

export class Hemisphere extends Sphere {
  override arc: number;
  override radius: number;
  override arcMode: number;

  override getHorizontalAngle () {
    return random(0, 90);
  }
}

