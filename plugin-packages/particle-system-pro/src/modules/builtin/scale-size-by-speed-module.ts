import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProScaleSizeBySpeedModuleProps extends ProModuleProps {
  referenceSpeed: number,
  intensity: number,
  maxFactor: number,
}

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpSize: [number, number] = [0, 0];

/**
 * 按粒子速度对 initialSize 做缩放。
 *
 * factor = clamp(speed / referenceSpeed, 0, maxFactor)
 * size = initialSize * (1 + (factor - 1) * intensity)
 *
 * referenceSpeed 是把 factor 归一到 1 的参考速度；intensity = 0 时无效果。
 * 与 Niagara 的 Scale Size By Particle Speed 对应。
 */
export class ProScaleSizeBySpeedModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  referenceSpeed = 1;
  intensity = 0.5;
  maxFactor = 4;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProScaleSizeBySpeedModuleProps {
    return {
      referenceSpeed: this.referenceSpeed,
      intensity: this.intensity,
      maxFactor: this.maxFactor,
    };
  }

  override fromJSON (data: ProScaleSizeBySpeedModuleProps): void {
    if (typeof data.referenceSpeed === 'number') { this.referenceSpeed = data.referenceSpeed; }
    if (typeof data.intensity === 'number') { this.intensity = data.intensity; }
    if (typeof data.maxFactor === 'number') { this.maxFactor = data.maxFactor; }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance } = ctx;

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
    const refSpeed = this.referenceSpeed > 0 ? this.referenceSpeed : 1;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.velocity.get(dataBuffer, i, tmpVel);
      const speed = Math.hypot(tmpVel[0], tmpVel[1], tmpVel[2]);
      const factor = Math.min(speed / refSpeed, this.maxFactor);
      const mul = 1 + (factor - 1) * this.intensity;

      a.initialSize.get(dataBuffer, i, tmpSize);
      a.size.set(dataBuffer, i, tmpSize[0] * mul, tmpSize[1] * mul);
    }
  }
}
