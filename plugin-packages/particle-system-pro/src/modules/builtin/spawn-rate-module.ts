import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

/**
 * 按速率每秒生成 rate 个粒子。
 *
 * 在 emitterUpdate 阶段写入 SpawnInfo。残量累计到下一帧，保证低帧率也不丢粒子。
 *
 * 与 Niagara 的 SpawnRate Module 行为一致（小数粒子拖到下一帧）。
 */
export class ProSpawnRateModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  rate = 10;

  private accumulator = 0;

  override execute (ctx: ProModuleContext): void {
    this.accumulator += this.rate * ctx.deltaTime;
    const count = Math.floor(this.accumulator);

    if (count <= 0) {
      return;
    }
    this.accumulator -= count;
    ctx.emitterInstance.spawnInfos.push({
      count,
      interpStartDt: 0,
      intervalDt: this.rate > 0 ? 1 / this.rate : 0,
      spawnGroup: 0,
    });
  }
}
