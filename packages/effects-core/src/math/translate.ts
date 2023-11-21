import type { vec3 } from '@galacean/effects-specification';
import type { mat3 } from './types';
import type { ValueGetter } from './value-getter';
import { mat3FromRotation, vec3MulMat3, vecAdd } from './vec';

export function translatePoint (x: number, y: number): number[] {
  const origin = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];

  for (let i = 0; i < 8; i += 2) {
    origin[i] += x;
    origin[i + 1] += y;
  }

  return origin;
}

const tempRot: mat3 = [] as unknown as mat3;

export interface TranslateTarget {
  speedOverLifetime?: ValueGetter<number>,
  gravityModifier?: ValueGetter<number>,
  linearVelOverLifetime?: any,
  orbitalVelOverLifetime?: any,
}

export function calculateTranslation (
  out: vec3,
  target: TranslateTarget,
  acc: vec3,
  time: number,
  duration: number,
  posData: number[] | Float32Array,
  velData: Float32Array | number[],
  posStartIndex?: number,
  velStartIndex?: number
): vec3 {
  let ret = out;
  const lifetime = time / duration;
  let speedIntegrate = time;
  const speedOverLifetime = target.speedOverLifetime;

  if (speedOverLifetime) {
    speedIntegrate = speedOverLifetime.getIntegrateValue(0, time, duration);
  }

  const d = target.gravityModifier ? target.gravityModifier.getIntegrateByTime(0, time) : 0;

  posStartIndex = posStartIndex || 0;
  velStartIndex = velStartIndex || 0;
  for (let i = 0; i < 3; i++) {
    ret[i] = posData[posStartIndex + i] + velData[velStartIndex + i] * speedIntegrate + acc[i] * d;
  }

  const linearVelocityOverLifetime = target.linearVelOverLifetime || {};
  const orbVelOverLifetime = target.orbitalVelOverLifetime || {};
  const map = ['x', 'y', 'z'];

  if (orbVelOverLifetime.enabled) {
    const center = orbVelOverLifetime.center || [0, 0, 0];
    const pos: vec3 = [ret[0] - center[0], ret[1] - center[1], ret[2] - center[2]];
    const asRotation = orbVelOverLifetime.asRotation;
    const rot = vec3MulMat3(pos, pos, mat3FromRotation(tempRot, map.map(pro => {
      const value = orbVelOverLifetime[pro];

      if (value) {
        return (asRotation ? value.getValue(lifetime) : value.getIntegrateValue(0, time, duration));
      }

      return 0;
    }) as vec3));

    ret = vecAdd(ret, center, rot);
  }
  if (linearVelocityOverLifetime.enabled) {
    const asMovement = linearVelocityOverLifetime.asMovement;

    for (let i = 0; i < 3; i++) {
      const pro = linearVelocityOverLifetime[map[i]];

      if (pro) {
        ret[i] += asMovement ? pro.getValue(lifetime) : pro.getIntegrateValue(0, time, duration);
      }
    }
  }

  return ret;
}
