import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProInitializeRibbonIDModuleProps extends ProModuleProps {
  ribbonId: number,
}

/**
 * 给新生粒子写入 RibbonID，用于 Ribbon Renderer 分组。
 */
export class ProInitializeRibbonIDModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  ribbonId = 0;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProInitializeRibbonIDModuleProps {
    return { ribbonId: this.ribbonId };
  }

  override fromJSON (data: ProInitializeRibbonIDModuleProps): void {
    if (typeof data.ribbonId === 'number') { this.ribbonId = data.ribbonId; }
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

    for (let i = firstInstance; i < lastInstance; i++) {
      a.ribbonId.set(dataBuffer, i, this.ribbonId);
    }
  }
}
