import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProBoxLocationModuleProps extends ProModuleProps {
  extents: [number, number, number],
}

const tmpPos: [number, number, number] = [0, 0, 0];

/**
 * 在轴对齐 box 内均匀分布粒子位置（相对 InitializeParticle 写的 origin 偏移）。
 *
 * extents 是 box 半宽（即 [-x, +x] × [-y, +y] × [-z, +z]）。
 */
export class ProBoxLocationModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  extents: [number, number, number] = [0.5, 0.5, 0.5];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProBoxLocationModuleProps {
    return { extents: [...this.extents] };
  }

  override fromJSON (data: ProBoxLocationModuleProps): void {
    if (data.extents && data.extents.length === 3) {
      this.extents = [data.extents[0], data.extents[1], data.extents[2]];
    }
  }

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
    const [ex, ey, ez] = this.extents;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.position.get(dataBuffer, i, tmpPos);
      a.position.set(
        dataBuffer, i,
        tmpPos[0] + (randomStream.nextFloat() * 2 - 1) * ex,
        tmpPos[1] + (randomStream.nextFloat() * 2 - 1) * ey,
        tmpPos[2] + (randomStream.nextFloat() * 2 - 1) * ez,
      );
    }
  }
}
