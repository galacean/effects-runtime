import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

/**
 * 在指定时刻一次性 spawn 一批粒子。
 *
 * 与 Niagara 的 Spawn Burst Instantaneous 对应：用 emitter.emitterAge 触发，
 * 只触发一次（除非 reset）。
 */
export class ProSpawnBurstModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  count = 32;
  spawnTime = 0;

  private fired = false;

  override execute (ctx: ProModuleContext): void {
    if (this.fired) {
      return;
    }
    if (ctx.emitterInstance.emitterAge < this.spawnTime) {
      return;
    }
    this.fired = true;
    if (this.count <= 0) {
      return;
    }
    ctx.emitterInstance.spawnInfos.push({
      count: this.count,
      interpStartDt: 0,
      intervalDt: 0,
      spawnGroup: 1,
    });
  }

  reset (): void {
    this.fired = false;
  }
}
