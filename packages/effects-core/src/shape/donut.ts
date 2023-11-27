import { DEG2RAD, Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';
import { random } from '../utils';
import { getArcAngle } from './cone';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from './shape';

const tempMat4 = new Matrix4();

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
    const rot = tempMat4.setFromRotationZ(arc);
    const direction = new Vector3(Math.cos(angle), Math.sin(angle), 0);
    const position = new Vector3(center + Math.cos(angle) * dradius, 0, Math.sin(angle) * dradius);

    return {
      direction: rot.transformNormal(direction),
      position: rot.transformPoint(position),
    };
  }

}
