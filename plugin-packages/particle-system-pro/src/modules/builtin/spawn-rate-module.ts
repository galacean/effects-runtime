import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProSpawnRateModuleProps extends ProModuleProps {
  rate: ProDistributionFloatData,
}

/**
 * 按速率每秒生成粒子。
 *
 * rate 是 ProDistributionFloat，支持 Constant / Range / Curve：
 * - Constant：固定速率
 * - Range：**每个 loop 采样一次**，loop 内保持稳定（不再每帧抖动）
 * - Curve：在 loop 起点评估一次（曲线模式时间锁定到 t=0）
 *
 * 在 emitterUpdate 阶段写入 SpawnInfo。残量累计到下一帧，保证低帧率也不丢粒子。
 *
 * 对齐 UE Niagara Stateless `FActiveSpawnRate.Rate` —— `InitSpawnInfosForLoop` 在
 * 每个 loop 起点一次性 `SampleRandRange` 写入 cached rate，整个 loop 内消费缓存值。
 * 旧实现每帧重采样，Range 模式 spawn 节奏忽快忽慢。
 */
export class ProSpawnRateModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromConstant(10);

  private accumulator = 0;
  /** 缓存的 per-loop rate；-1 表示尚未采样 */
  private cachedRate = -1;
  /** 上次采样所在 loop；与 currentLoop 不同时重新采样 */
  private cachedLoopIdx = -1;
  /** 用于探测 emitter reset（emitterAge 单调递增；变小说明被 reset 了） */
  private lastSeenAge = 0;

  override toJSON (): ProSpawnRateModuleProps {
    return { rate: this.rate.toJSON() };
  }

  override fromJSON (data: ProSpawnRateModuleProps): void {
    if (data.rate) {
      this.rate = ProDistributionFloat.fromJSON(data.rate);
    }
  }

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;
    // emitter.reset() 会把 emitterAge 拉回 0；用倒退判定让缓存失效
    const wasReset = emitter.emitterAge < this.lastSeenAge;

    if (wasReset || this.cachedRate < 0 || this.cachedLoopIdx !== emitter.currentLoop) {
      const t = emitter.duration > 0
        ? Math.min(emitter.loopAge / emitter.duration, 1)
        : 0;

      this.cachedRate = Math.max(0, this.rate.sampleAtTime(ctx.randomStream.nextFloat(), t));
      this.cachedLoopIdx = emitter.currentLoop;
      if (wasReset) {
        this.accumulator = 0;
      }
    }
    this.lastSeenAge = emitter.emitterAge;
    const currentRate = this.cachedRate;

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
    });
  }
}
