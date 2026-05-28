import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProSpawnRateModuleProps extends ProModuleProps {
  rate: ProDistributionFloatData,
  spawnProbability: number,
}

/**
 * 按速率每秒生成粒子。
 *
 * 对齐 UE Niagara Stateful SpawnRate：每帧直接从 distribution 采样当前 rate，
 * 编辑器改值下帧即生效，无需缓存。
 *
 * 残量累计到下一帧，保证低帧率也不丢粒子。
 */
export class ProSpawnRateModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromConstant(10);
  spawnProbability = 1;

  private accumulator = 0;

  override toJSON (): ProSpawnRateModuleProps {
    return { rate: this.rate.toJSON(), spawnProbability: this.spawnProbability };
  }

  override fromJSON (data: ProSpawnRateModuleProps): void {
    if (data.rate) {
      this.rate = ProDistributionFloat.fromJSON(data.rate);
    }
    if (typeof data.spawnProbability === 'number') { this.spawnProbability = data.spawnProbability; }
  }

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;
    const t = emitter.duration > 0
      ? Math.min(emitter.loopAge / emitter.duration, 1)
      : 0;
    const currentRate = Math.max(0, this.rate.sampleAtTime(ctx.randomStream.nextFloat(), t));

    this.accumulator += currentRate * ctx.deltaTime;
    let count = Math.floor(this.accumulator);

    if (count <= 0) {
      return;
    }
    this.accumulator -= count;

    if (this.spawnProbability < 1) {
      let accepted = 0;

      for (let j = 0; j < count; j++) {
        if (ctx.randomStream.nextFloat() < this.spawnProbability) { accepted++; }
      }
      count = accepted;
      if (count <= 0) {
        return;
      }
    }

    ctx.emitterInstance.spawnInfos.push({
      count,
      interpStartDt: 0,
      intervalDt: currentRate > 0 ? 1 / currentRate : 0,
    });
  }
}
