import * as spec from '@galacean/effects-specification';
import type { vec3 } from '@galacean/effects-specification';
import { DEG2RAD } from '../constants';
import { vecDot, vecNormalize } from '../math';
import { random } from '../utils';
import type { Shape, ShapeGeneratorOptions, ShapeParticle } from './index';

export class Cone implements Shape {
  radius: number;
  angle: number;
  arc: number;
  arcMode: number;

  constructor (props: Record<string, any>) {
    Object.keys(props).forEach(key => {
      this[key as keyof Shape] = props[key];
    });
  }

  generate (opt: ShapeGeneratorOptions): ShapeParticle {
    const arc = getArcAngle(this.arc, this.arcMode, opt);
    const a = arc * DEG2RAD;
    const x = Math.cos(a) * this.radius;
    const y = Math.sin(a) * this.radius;

    const position = [x, y, 0];
    const l = Math.tan(this.angle * DEG2RAD);
    const dir = vecDot([], position, l) as vec3;

    // dir + [0,0,1]
    dir[2] += 1;

    return {
      position: vecDot(position, position, random(0, 1)) as vec3,
      direction: vecNormalize(dir, dir),
    };
  }
}

export function getArcAngle (arc: number, arcMode: spec.ShapeArcMode, opt: ShapeGeneratorOptions): number {
  if (arcMode === spec.ShapeArcMode.RANDOM) {
    arc = random(0, arc);
  } else if (arcMode === spec.ShapeArcMode.UNIDIRECTIONAL_CYCLE) {
    const d = opt.index % (opt.total + 1);

    arc = arc / opt.total * d;
  } else if (arcMode === spec.ShapeArcMode.BIDIRECTIONAL_CYCLE) {
    const d = opt.index / (opt.total + 1);
    const i = d - Math.floor(d);

    arc = arc * ((Math.floor(d) % 2) ? (1 - i) : i);
  } else if (arcMode === spec.ShapeArcMode.UNIFORM_BURST) {
    arc = arc * opt.burstIndex / opt.burstCount;
  }

  return arc;
}
