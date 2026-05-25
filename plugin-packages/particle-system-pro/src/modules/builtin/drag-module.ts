import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProCurveFloat } from '../../curves/pro-curve-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpVel: [number, number, number] = [0, 0, 0];

/**
 * 线性 drag：每帧把速度按 (1 - dragCurve.evaluate(t) * dt) 衰减。
 * dragCurve 按 normalizedAge 采样，支持随生命周期变化的阻力。
 */
export class ProDragModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  dragCurve: ProCurveFloat = ProCurveFloat.constant(1);

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

    for (let i = firstInstance; i < lastInstance; i++) {
      const lifetime = a.lifetime.get(dataBuffer, i);
      const t = lifetime > 0 ? Math.min(a.age.get(dataBuffer, i) / lifetime, 1) : 1;
      const drag = this.dragCurve.evaluate(t);
      const factor = Math.max(0, 1 - drag * deltaTime);

      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(dataBuffer, i, tmpVel[0] * factor, tmpVel[1] * factor, tmpVel[2] * factor);
    }
  }
}
