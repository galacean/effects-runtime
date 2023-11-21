import type { vec3 } from '@galacean/effects-specification';
import { DEG2RAD } from '../constants';
import type { mat3 } from '../math';
import { mat3FromRotationZ, vec3MulMat3 } from '../math';
import { random } from '../utils';
import { getArcAngle } from './cone';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from '.';

const tempMat3 = [] as unknown as mat3;

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
    const point = [Math.cos(rh), 0, Math.sin(rh)] as vec3;
    const mat3 = mat3FromRotationZ(tempMat3, rz);
    const p = vec3MulMat3(point, point, mat3);

    return {
      position: p.map(a => a * radius),
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

