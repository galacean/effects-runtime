import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpPos: [number, number, number] = [0, 0, 0];
const tmpPrev: [number, number, number] = [0, 0, 0];

/**
 * 从位移反算真实速度：velocity = (position - previousPosition) / dt。
 *
 * previousPosition 由 emitter tick 在 ParticleUpdate 前自动备份；
 * 加入到 ParticleUpdate 流水线末尾，可以让"显示用的速度"反映所有上游
 * 力 / 轨道 / SolveForces 的合成效果，而不是单一模块写入的瞬时值。
 *
 * 典型使用：Sprite 的 velocity-aligned billboard 需要"看起来正确的"速度，
 * 而不是 Force 模块累计但还未积分的中间值。
 *
 * 对应 UE Niagara Stateless CalculateAccurateVelocity 模块。
 */
export class ProCalculateAccurateVelocityModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, deltaTime, firstInstance, lastInstance } = ctx;

    if (!dataBuffer || deltaTime <= 0) {
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
    const inv = 1 / deltaTime;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.position.get(dataBuffer, i, tmpPos);
      a.previousPosition.get(dataBuffer, i, tmpPrev);
      a.velocity.set(
        dataBuffer, i,
        (tmpPos[0] - tmpPrev[0]) * inv,
        (tmpPos[1] - tmpPrev[1]) * inv,
        (tmpPos[2] - tmpPrev[2]) * inv,
      );
    }
  }
}
