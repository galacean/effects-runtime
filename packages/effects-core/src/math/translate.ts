import type { ValueGetter } from './value-getter';
import { Euler, Matrix4, Vector3 } from '@galacean/effects-math/es/core/index';

export function translatePoint (x: number, y: number): number[] {
  const origin = [-.5, .5, -.5, -.5, .5, .5, .5, -.5];

  for (let i = 0; i < 8; i += 2) {
    origin[i] += x;
    origin[i + 1] += y;
  }

  return origin;
}

const tempEuler = new Euler();
const tempMat4 = new Matrix4();

export interface TranslateTarget {
  speedOverLifetime?: ValueGetter<number>,
  gravityModifier?: ValueGetter<number>,
  linearVelOverLifetime?: any,
  orbitalVelOverLifetime?: any,
}

export function calculateTranslation (
  out: Vector3,
  target: TranslateTarget,
  acc: Vector3,
  time: number,
  duration: number,
  posData: Vector3,
  velData: Vector3,
): Vector3 {
  const ret = out;
  const lifetime = time / duration;
  let speedIntegrate = time;
  const speedOverLifetime = target.speedOverLifetime;

  if (speedOverLifetime) {
    speedIntegrate = speedOverLifetime.getIntegrateValue(0, time, duration);
  }

  const d = target.gravityModifier ? target.gravityModifier.getIntegrateByTime(0, time) : 0;

  ret.copyFrom(posData);
  ret.addScaledVector(velData, speedIntegrate);
  ret.addScaledVector(acc, d);

  const linearVelocityOverLifetime = target.linearVelOverLifetime || {};
  const orbVelOverLifetime = target.orbitalVelOverLifetime || {};
  const map = ['x', 'y', 'z'];

  if (orbVelOverLifetime.enabled) {
    const center = new Vector3();

    if (orbVelOverLifetime.center) {
      center.setFromArray(orbVelOverLifetime.center);
    }
    const pos = ret.clone().subtract(center);
    const asRotation = orbVelOverLifetime.asRotation;
    const orbVel = map.map(pro => {
      const value = orbVelOverLifetime[pro];

      if (value) {
        return (asRotation ? value.getValue(lifetime) : value.getIntegrateValue(0, time, duration));
      }

      return 0;
    });

    tempEuler.setFromArray(orbVel).negate();
    tempMat4.setFromEuler(tempEuler);
    const rot = tempMat4.transformPoint(pos);

    ret.addVectors(center, rot);
  }
  if (linearVelocityOverLifetime.enabled) {
    const asMovement = linearVelocityOverLifetime.asMovement;

    for (let i = 0; i < 3; i++) {
      const pro = linearVelocityOverLifetime[map[i]];

      if (pro) {
        const val = asMovement ? pro.getValue(lifetime) : pro.getIntegrateValue(0, time, duration);

        ret.setElement(i, ret.getElement(i) + val);
      }
    }
  }

  return ret;
}
