import type { vec3 } from '@galacean/effects-specification';
import type { Burst } from './burst';
import { ParticleModule } from './particle-module';
import type { ParticleModuleContext } from './particle-module';

type BurstEmissionConfig = {
  bursts: Burst[],
  burstOffsets: Record<string, vec3[] | null>,
};

/**
 * Burst 发射模块。对齐 particle-system-pro 的 ProSpawnBurstModule。
 *
 * stage = emitterUpdate。每帧检查 burst 的 canFire 条件，
 * 向 emitter.spawnInfos 推入带 burst 引用的 SpawnInfo。
 *
 * 注意：本模块只做时机检测（canFire，只读），不消耗 burst 状态。
 * 实际的 getGeneratorOptions（消耗 cycle）在 emitter spawn 阶段
 * 确认有可用 slot 后才调用，保留 burst 在满容量时的延迟触发语义。
 */
export class BurstSpawnModule extends ParticleModule {
  override readonly stage = 'emitterUpdate' as const;

  private emission: BurstEmissionConfig;

  constructor (emission: BurstEmissionConfig) {
    super();
    this.emission = emission;
  }

  get bursts (): Burst[] {
    return this.emission.bursts;
  }

  get burstOffsets (): Record<string, vec3[] | null> {
    return this.emission.burstOffsets;
  }

  override execute (ctx: ParticleModuleContext): void {
    const bursts = this.emission.bursts;
    const emitter = ctx.emitter;

    for (let j = bursts.length - 1; j >= 0; j--) {
      const burst = bursts[j];

      if (burst.canFire(emitter.timePassed)) {
        emitter.spawnInfos.push({
          count: 0,
          timeDelta: 0,
          isBurst: true,
          burstIndex: j,
        });
      }
    }
  }
}
