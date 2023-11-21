import type { vec3 } from '@galacean/effects-specification';
import { DEG2RAD } from '../constants';
import type { mat3 } from '../math';
import { mat3FromRotationZ, vec3MulMat3 } from '../math';
import { random } from '../utils';
import { getArcAngle } from './cone';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from './shape';

const tempMat3 = [] as unknown as mat3;

export class Donut implements Shape {
  radius: number;
  donutRadius: number;
  arc: number;
  arcMode: number;

  constructor (props: Record<string, any>) {
    Object.keys(props).forEach(key => {
      this[key as keyof Shape] = props[key];
    });
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const dradius = this.donutRadius;
    const center = this.radius - dradius;
    const angle = random(0, Math.PI * 2);
    const arc = getArcAngle(this.arc, this.arcMode, opt) * DEG2RAD;
    const rot = mat3FromRotationZ(tempMat3, arc);
    const direction = [Math.cos(angle), Math.sin(angle), 0] as vec3;
    const position = [center + Math.cos(angle) * dradius, 0, Math.sin(angle) * dradius] as vec3;

    return {
      direction: vec3MulMat3(direction, direction, rot),
      position: vec3MulMat3(position, position, rot),
    };
  }

}
