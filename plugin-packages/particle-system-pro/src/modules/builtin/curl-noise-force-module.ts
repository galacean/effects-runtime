import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpPos: [number, number, number] = [0, 0, 0];

/**
 * Curl Noise 力场：使用 3D simplex noise 的旋度作为力场方向。
 *
 * velocity += curlNoise(position * frequency) * amplitude * dt
 *
 * 对齐 Niagara Stateless 的 CurlNoiseForce 模块（JacobNoise 模式简化版）。
 */
export class ProCurlNoiseForceModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  amplitude = 2.0;
  frequency = 1.0;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, deltaTime, firstInstance, lastInstance } = ctx;

    if (!dataBuffer) {
      return;
    }
    const layout = ctx.emitterInstance.particleDataSet?.layout ?? null;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;
    const freq = this.frequency;
    const amp = this.amplitude * deltaTime;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.position.get(dataBuffer, i, tmpPos);
      const px = tmpPos[0] * freq;
      const py = tmpPos[1] * freq;
      const pz = tmpPos[2] * freq;

      // Curl via finite differences of 3D noise
      const eps = 0.01;
      const nx = noise3D(px + eps, py, pz) - noise3D(px - eps, py, pz);
      const ny = noise3D(px, py + eps, pz) - noise3D(px, py - eps, pz);
      const nz = noise3D(px, py, pz + eps) - noise3D(px, py, pz - eps);

      // curl = (dNz/dy - dNy/dz, dNx/dz - dNz/dx, dNy/dx - dNx/dy)
      // Approximated with offset noise samples for each component
      const n2x = noise3D(px + 31.416, py + eps, pz) - noise3D(px + 31.416, py - eps, pz);
      const n2z = noise3D(px + 31.416, py, pz + eps) - noise3D(px + 31.416, py, pz - eps);
      const n3x = noise3D(px + 62.832, py + eps, pz) - noise3D(px + 62.832, py - eps, pz);
      // const n3y = noise3D(px + 62.832, py, pz + eps) - noise3D(px + 62.832, py, pz - eps);

      const curlX = (n2z - ny) / (2 * eps);
      const curlY = (nz - n2x) / (2 * eps);
      const curlZ = (nx - n3x) / (2 * eps);

      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(
        dataBuffer, i,
        tmpVel[0] + curlX * amp,
        tmpVel[1] + curlY * amp,
        tmpVel[2] + curlZ * amp,
      );
    }
  }
}

// ─── Simplex 3D Noise (compact implementation) ──────────────────────────────

const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;

const grad3: ReadonlyArray<[number, number, number]> = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const perm = new Uint8Array(512);
const p = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
  119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
  218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
  222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; }

function noise3D (x: number, y: number, z: number): number {
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3;
  const y2 = y0 - j2 + 2 * G3;
  const z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3;
  const y3 = y0 - 1 + 3 * G3;
  const z3 = z0 - 1 + 3 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  let n = 0;
  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;

  if (t0 > 0) {
    t0 *= t0;
    const gi = perm[ii + perm[jj + perm[kk]]] % 12;

    n += t0 * t0 * (grad3[gi][0] * x0 + grad3[gi][1] * y0 + grad3[gi][2] * z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;

  if (t1 > 0) {
    t1 *= t1;
    const gi = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12;

    n += t1 * t1 * (grad3[gi][0] * x1 + grad3[gi][1] * y1 + grad3[gi][2] * z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;

  if (t2 > 0) {
    t2 *= t2;
    const gi = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12;

    n += t2 * t2 * (grad3[gi][0] * x2 + grad3[gi][1] * y2 + grad3[gi][2] * z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;

  if (t3 > 0) {
    t3 *= t3;
    const gi = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12;

    n += t3 * t3 * (grad3[gi][0] * x3 + grad3[gi][1] * y3 + grad3[gi][2] * z3);
  }

  return 32 * n;
}
