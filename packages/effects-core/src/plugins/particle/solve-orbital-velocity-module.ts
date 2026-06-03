import { Euler, Matrix4 } from '@galacean/effects-math/es/core/index';
import type { ValueGetter } from '../../math';
import { BezierCurve } from '../../math';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';
import type { SolveOrbitalModuleData } from './parse-spec';

const tempEuler = new Euler();
const tempMat4 = new Matrix4();

// GPU-matching bezier evaluation (replicates shader's binarySearchT + cubicBezier)
function gpuCubicBezier (t: number, y1: number, y2: number, y3: number, y4: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const omt = 1 - t;
  const omt2 = omt * omt;
  const omt3 = omt2 * omt;

  return omt3 * y1 + 3 * omt2 * t * y2 + 3 * omt * t2 * y3 + t3 * y4;
}

function gpuBinarySearchT (x: number, x1: number, x2: number, x3: number, x4: number): number {
  let left = 0;
  let right = 1;
  let mid = 0;

  for (let i = 0; i < 8; i++) {
    mid = (left + right) * 0.5;
    const computedX = gpuCubicBezier(mid, x1, x2, x3, x4);

    if (Math.abs(computedX - x) < 0.0001) {
      break;
    }
    if (computedX > x) {
      right = mid;
    } else {
      left = mid;
    }
  }

  return mid;
}

function gpuCalculateMovement (
  t: number, p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number,
): number {
  const h = (t - p1x) * 0.05;
  let movement = 0;

  for (let i = 0; i <= 20; i++) {
    const sampleT = i * h;
    const nt = gpuBinarySearchT(sampleT, p1x, p2x, p3x, p4x);
    const y = gpuCubicBezier(nt, p1y, p2y, p3y, p4y);
    const weight = (i === 0 || i === 20) ? 1 : (i % 2 === 1) ? 4 : 2;

    movement += weight * y;
  }

  return movement * h / 3;
}

function gpuIntegrateBezierCurve (life: number, keys: number[][]): number {
  let ret = 0;

  for (let i = 0; i < keys.length; i += 2) {
    const k0 = keys[i];
    const k1 = keys[i + 1];

    if (i === 0 && life < k0[0]) {
      return ret;
    }
    const p1x = k0[0], p1y = k0[1], p2x = k0[2], p2y = k0[3];
    const p4x = k1[0], p4y = k1[1], p3x = k1[2], p3y = k1[3];

    if (life >= p4x) {
      ret += gpuCalculateMovement(p4x, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y);
    }
    if (life >= p1x && life < p4x) {
      return ret + gpuCalculateMovement(life, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y);
    }
  }

  return ret;
}

function gpuMatchingIntegrate (curve: ValueGetter<number>, life: number, time: number, duration: number, asRotation?: boolean): number {
  if (asRotation) {
    return curve.getValue(life);
  }
  if (curve instanceof BezierCurve) {
    return gpuIntegrateBezierCurve(life, curve.keys) * duration;
  }

  return curve.getIntegrateValue(0, time, duration);
}

/**
 * 轨道速度模块。将 shader 中的 calOrbitalMov 搬到 CPU。
 *
 * 对 BezierCurve 类型的曲线，复刻 GPU shader 的 binarySearchT + cubicBezier
 * + Simpson 20 段积分算法，确保与原 shader 计算结果一致。
 */
export class SolveOrbitalVelocityModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private data: SolveOrbitalModuleData;

  constructor (data: SolveOrbitalModuleData) {
    super();
    this.data = data;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const currentTime = ctx.currentTime;
    const orb = this.data;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i3 = i * 3;
      const delay = db.delay[i];

      if (!orb.enabled || delay >= currentTime) {
        db.finalOffset[i3] = db.translation[i3] + db.linearMove[i3];
        db.finalOffset[i3 + 1] = db.translation[i3 + 1] + db.linearMove[i3 + 1];
        db.finalOffset[i3 + 2] = db.translation[i3 + 2] + db.linearMove[i3 + 2];

        continue;
      }

      const time = currentTime - delay;
      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);

      const cx = orb.center?.[0] ?? 0;
      const cy = orb.center?.[1] ?? 0;
      const cz = orb.center?.[2] ?? 0;

      const ox = orb.x ? gpuMatchingIntegrate(orb.x, life, time, duration, orb.asRotation) : 0;
      const oy = orb.y ? gpuMatchingIntegrate(orb.y, life, time, duration, orb.asRotation) : 0;
      const oz = orb.z ? gpuMatchingIntegrate(orb.z, life, time, duration, orb.asRotation) : 0;

      tempEuler.set(-ox, -oy, -oz);
      tempMat4.setFromEuler(tempEuler);
      const e = tempMat4.elements;
      const px = db.position[i3] + db.translation[i3] - cx;
      const py = db.position[i3 + 1] + db.translation[i3 + 1] - cy;
      const pz = db.position[i3 + 2] + db.translation[i3 + 2] - cz;

      db.finalOffset[i3] = e[0] * px + e[4] * py + e[8] * pz + e[12] + cx - db.position[i3] + db.linearMove[i3];
      db.finalOffset[i3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13] + cy - db.position[i3 + 1] + db.linearMove[i3 + 1];
      db.finalOffset[i3 + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14] + cz - db.position[i3 + 2] + db.linearMove[i3 + 2];
    }
  }
}
