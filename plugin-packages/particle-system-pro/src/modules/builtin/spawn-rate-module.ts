import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

/**
 * 按速率每秒生成粒子。
 *
 * rate 是 ProDistributionFloat，支持 Constant / Range / Curve：
 * - Constant：固定速率
 * - Range：每帧 randomStream 采样一个速率（用于"忽快忽慢"效果）
 * - Curve：按 emitter normalized age 评估速率（曲线模式只在 loop/once 有限 duration 下有意义）
 *
 * 在 emitterUpdate 阶段写入 SpawnInfo。残量累计到下一帧，保证低帧率也不丢粒子。
 *
 * 与 Niagara 的 SpawnRate Module 行为一致（小数粒子拖到下一帧）。
 */
export class ProSpawnRateModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromConstant(10);

  private accumulator = 0;

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;
    const t = emitter.duration > 0
      ? (emitter.emitterAge % emitter.duration) / emitter.duration
      : 0;
    const currentRate = Math.max(0, this.rate.sampleAtTime(ctx.randomStream.nextFloat(), t));

    this.accumulator += currentRate * ctx.deltaTime;
    const count = Math.floor(this.accumulator);

    if (count <= 0) {
      return;
    }
    this.accumulator -= count;
    ctx.emitterInstance.spawnInfos.push({
      count,
      interpStartDt: 0,
      intervalDt: currentRate > 0 ? 1 / currentRate : 0,
      spawnGroup: 0,
    });
  }
}
