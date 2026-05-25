import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionColor } from '../../distribution/pro-distribution-color';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpColor: [number, number, number, number] = [0, 0, 0, 0];

/**
 * 给新生粒子写入初值：lifetime、起始 position、起始 color、起始 size、age=0。
 *
 * 同时把 initialColor / initialSize 备份给后续 over-life 模块用。
 *
 * 与 Niagara 的 Initialize Particle Module 对应。
 */
export class ProInitializeParticleModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  lifetime: ProDistributionFloat = ProDistributionFloat.fromRange(1, 2);
  startColor: ProDistributionColor = ProDistributionColor.fromConstant(1, 1, 1, 1);
  startSize: ProDistributionFloat = ProDistributionFloat.fromConstant(0.1);
  positionOrigin: [number, number, number] = [0, 0, 0];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: unknown = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

    if (!dataBuffer) {
      return;
    }
    const layout = ctx.emitterInstance.particleDataSet?.layout;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;
    const [px, py, pz] = this.positionOrigin;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.age.set(dataBuffer, i, 0);
      a.lifetime.set(dataBuffer, i, this.lifetime.sampleAtTime(randomStream.nextFloat(), 0));
      a.position.set(dataBuffer, i, px, py, pz);
      a.velocity.set(dataBuffer, i, 0, 0, 0);

      this.startColor.sampleAtTime(randomStream.nextFloat(), 0, tmpColor);
      a.color.set(dataBuffer, i, tmpColor[0], tmpColor[1], tmpColor[2], tmpColor[3]);
      a.initialColor.set(dataBuffer, i, tmpColor[0], tmpColor[1], tmpColor[2], tmpColor[3]);

      const s = this.startSize.sampleAtTime(randomStream.nextFloat(), 0);

      a.size.set(dataBuffer, i, s, s);
      a.initialSize.set(dataBuffer, i, s, s);
    }
  }
}
