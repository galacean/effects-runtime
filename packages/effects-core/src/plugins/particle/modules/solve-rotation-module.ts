import type * as spec from '@galacean/effects-specification';
import type { ValueGetter } from '../../../math';
import { createValueGetter, RandomValue } from '../../../math';
import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext } from '../core/particle-module';

export type SolveRotationModuleData = {
  rotationOverLifetime?: {
    asRotation?: boolean,
    x?: spec.NumberExpression | number,
    y?: spec.NumberExpression | number,
    z?: spec.NumberExpression | number,
  },
};

/**
 * 旋转模块。每帧覆写 db.rotation = initialRotation + rotationOverLifetime。
 *
 * shader 内从 euler 角构建旋转矩阵。
 */
export class SolveRotationModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleUpdate;

  private rotationOverLifetime?: {
    asRotation?: boolean,
    x?: ValueGetter<number>,
    y?: ValueGetter<number>,
    z?: ValueGetter<number>,
  };

  override fromJSON (data: SolveRotationModuleData): void {
    if (data.rotationOverLifetime) {
      this.rotationOverLifetime = {
        asRotation: data.rotationOverLifetime.asRotation,
        x: data.rotationOverLifetime.x ? createValueGetter(data.rotationOverLifetime.x) : undefined,
        y: data.rotationOverLifetime.y ? createValueGetter(data.rotationOverLifetime.y) : undefined,
        z: data.rotationOverLifetime.z ? createValueGetter(data.rotationOverLifetime.z) : undefined,
      };
    }
  }

  override execute (ctx: ParticleModuleContext): void {
    const db = ctx.dataBuffer;
    const rol = this.rotationOverLifetime;

    if (!rol) {
      return;
    }

    for (let i = ctx.firstIndex; i < ctx.lastIndex; i++) {
      const i3 = i * 3;
      const time = db.age[i];
      const duration = db.lifetime[i];
      const life = Math.min(Math.max(time / duration, 0), 1);
      const seed = db.seed[i];

      let rx = db.initialRotation[i3];
      let ry = db.initialRotation[i3 + 1];
      let rz = db.initialRotation[i3 + 2];

      if (rol.x) {
        rx += rol.x instanceof RandomValue ? rol.x.getValue(life, seed) : rol.x.getValue(life);
      }
      if (rol.y) {
        ry += rol.y instanceof RandomValue ? rol.y.getValue(life, seed) : rol.y.getValue(life);
      }
      if (rol.z) {
        rz += rol.z instanceof RandomValue ? rol.z.getValue(life, seed) : rol.z.getValue(life);
      }

      db.rotation[i3] = rx;
      db.rotation[i3 + 1] = ry;
      db.rotation[i3 + 2] = rz;
    }
  }
}
