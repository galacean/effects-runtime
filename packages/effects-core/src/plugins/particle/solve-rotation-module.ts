import { Matrix3 } from '@galacean/effects-math/es/core/matrix3';
import type { ValueGetter } from '../../math';
import { RandomValue } from '../../math';
import type { ParticleDataBuffer } from './particle-data-buffer';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

type RotationOverLifetimeConfig = {
  asRotation?: boolean,
  x?: ValueGetter<number>,
  y?: ValueGetter<number>,
  z?: ValueGetter<number>,
};

/**
 * 旋转矩阵计算模块。对应老代码 ParticleMesh.applyRotation。
 *
 * 每帧对所有存活粒子：
 * 1. 读取初始欧拉角 + rotationOverLifetime 修正
 * 2. 构建 3x3 旋转矩阵 (Rz·Ry·Rx) 列主序
 * 3. 写入 rotMatrix 通道
 */
export class SolveRotationModule extends ParticleModule {
  override readonly stage = 'particleUpdate' as const;

  private rotationOverLifetime?: RotationOverLifetimeConfig;

  constructor (opts: {
    rotationOverLifetime?: RotationOverLifetimeConfig,
  }) {
    super();
    this.rotationOverLifetime = opts.rotationOverLifetime;
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const currentTime = ctx.currentTime;
    const d2r = Math.PI / 180;
    const rol = this.rotationOverLifetime;
    const rotMat = tempRotMat;
    const tempMat = tempRotMat2;

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i3 = i * 3;
      const i9 = i * 9;
      const time = currentTime - db.delay[i];
      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);
      const seed = db.seed[i];

      let rx = db.rotation[i3];
      let ry = db.rotation[i3 + 1];
      let rz = db.rotation[i3 + 2];

      if (rol) {
        if (rol.x) {
          rx += rol.x instanceof RandomValue ? rol.x.getValue(life, seed) : rol.x.getValue(life);
        }
        if (rol.y) {
          ry += rol.y instanceof RandomValue ? rol.y.getValue(life, seed) : rol.y.getValue(life);
        }
        if (rol.z) {
          rz += rol.z instanceof RandomValue ? rol.z.getValue(life, seed) : rol.z.getValue(life);
        }
      }

      if (rx === 0 && ry === 0 && rz === 0) {
        writeIdentity(db, i9);

        continue;
      }

      const rxr = rx * d2r;
      const ryr = ry * d2r;
      const rzr = rz * d2r;

      const sx = Math.sin(rxr);
      const cx = Math.cos(rxr);
      const sy = Math.sin(ryr);
      const cy = Math.cos(ryr);
      const sz = Math.sin(rzr);
      const cz = Math.cos(rzr);

      // 复刻老代码的 Matrix3 运算链，保持完全相同的浮点中间值
      rotMat.set(cz, -sz, 0, sz, cz, 0, 0, 0, 1);
      rotMat.multiply(tempMat.set(cy, 0, sy, 0, 1, 0, -sy, 0, cy));
      rotMat.multiply(tempMat.set(1, 0, 0, 0, cx, -sx, 0, sx, cx));

      const e = rotMat.elements;

      for (let c = 0; c < 9; c++) {
        db.rotMatrix[i9 + c] = e[c];
      }
    }
  }
}

const tempRotMat = new Matrix3();
const tempRotMat2 = new Matrix3();

function writeIdentity (db: ParticleDataBuffer, offset: number): void {
  db.rotMatrix[offset] = 1;
  db.rotMatrix[offset + 1] = 0;
  db.rotMatrix[offset + 2] = 0;
  db.rotMatrix[offset + 3] = 0;
  db.rotMatrix[offset + 4] = 1;
  db.rotMatrix[offset + 5] = 0;
  db.rotMatrix[offset + 6] = 0;
  db.rotMatrix[offset + 7] = 0;
  db.rotMatrix[offset + 8] = 1;
}
