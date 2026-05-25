import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpPos: [number, number, number] = [0, 0, 0];

/**
 * 在球面/球体内随机分布粒子位置。
 *
 * - radius：球半径
 * - onSurface：true 时只在球面上分布；false 时在球体内均匀分布
 * - center：相对 emitter 局部偏移
 *
 * 把 InitializeParticle 写的 position 覆盖掉，所以执行顺序必须在 InitializeParticle 之后。
 */
export class ProSphereLocationModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  radius = 1;
  onSurface = false;
  center: [number, number, number] = [0, 0, 0];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

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
    const [cx, cy, cz] = this.center;

    for (let i = firstInstance; i < lastInstance; i++) {
      // 球面均匀采样：cos(theta) 在 [-1, 1] 均匀，phi 在 [0, 2pi] 均匀
      const cosTheta = randomStream.nextFloat() * 2 - 1;
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const phi = randomStream.nextFloat() * Math.PI * 2;
      const r = this.onSurface ? this.radius : this.radius * Math.cbrt(randomStream.nextFloat());

      // 累加到 InitializeParticle 写的 origin（center 当作额外偏移）
      a.position.get(dataBuffer, i, tmpPos);
      a.position.set(
        dataBuffer, i,
        tmpPos[0] + cx + r * sinTheta * Math.cos(phi),
        tmpPos[1] + cy + r * sinTheta * Math.sin(phi),
        tmpPos[2] + cz + r * cosTheta,
      );
    }
  }
}
