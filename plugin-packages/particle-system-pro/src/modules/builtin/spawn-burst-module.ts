import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProSpawnBurstEntry {
  /** 触发时间（秒，相对于 emitter loop 起点） */
  time: number,
  /** 触发时一次性 spawn 的数量 */
  count: number,
}

export interface ProSpawnBurstModuleProps extends ProModuleProps {
  bursts: ProSpawnBurstEntry[],
  spawnProbability: number,
}

/**
 * 在指定时刻一次性 spawn 一批粒子。
 *
 * bursts 支持多个时间点；每个 entry 在 emitter 当前 loop 内只触发一次。
 * Loop 模式下 emitter 进入新一轮时所有 burst 重新可触发。
 *
 * **infinite + duration > 0 也会循环触发** —— 用 `emitterAge % duration` 计算
 * loop 内偏移；emitter-instance 在 infinite 模式下根本不推进 loopAge，所以这里
 * 不能依赖 loopAge，必须自己取 modulus。
 *
 * **duration <= 0**（无界 emitter）每条 burst 只触发一次 — 没有 loop 概念，
 * t=0 burst 在启动瞬间 fire，t=5 burst 5 秒后 fire，之后不再重复（与 UE 一致：
 * 无 LoopDuration 时整段 emitter 视为单条永久 loop）。
 *
 * 对应 Niagara Spawn Burst Instantaneous，但允许配置多个 burst 时刻。
 *
 * 兼容旧 API：保留 `count` / `spawnTime` getter/setter，写入时折叠到 bursts[0]。
 */
export class ProSpawnBurstModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  bursts: ProSpawnBurstEntry[] = [{ time: 0, count: 32 }];
  spawnProbability = 1;

  // 已触发标记数组，长度跟 bursts 一致；每个 loop 起点重置
  private fired: boolean[] = [];
  private lastLoopAge = 0;

  /** 兼容旧 API：返回首个 burst 的 count；写入时折叠到 bursts[0] */
  get count (): number { return this.bursts[0]?.count ?? 0; }
  set count (v: number) {
    if (this.bursts.length === 0) {
      this.bursts.push({ time: 0, count: v });
    } else {
      this.bursts[0].count = v;
    }
  }
  /** 兼容旧 API：返回首个 burst 的 time；写入时折叠到 bursts[0] */
  get spawnTime (): number { return this.bursts[0]?.time ?? 0; }
  set spawnTime (v: number) {
    if (this.bursts.length === 0) {
      this.bursts.push({ time: v, count: 32 });
    } else {
      this.bursts[0].time = v;
    }
  }

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;
    // duration > 0：用 (emitterAge % duration) 计算 loop 内偏移 —— infinite 模式
    // 下 loopAge 永远 0，不能依赖它；duration <= 0：无 loop 概念，age 单调递增，
    // 每条 burst 只触发一次（emitterAge 与 lastLoopAge 永不倒退 → fired 不会重置）
    const age = emitter.duration > 0
      ? emitter.emitterAge % emitter.duration
      : emitter.emitterAge;

    // 新一轮 loop 开始 → 重置已触发标记
    if (age < this.lastLoopAge) {
      this.fired.length = 0;
    }
    this.lastLoopAge = age;

    if (this.fired.length < this.bursts.length) {
      this.fired.length = this.bursts.length;
      for (let i = 0; i < this.fired.length; i++) {
        this.fired[i] ??= false;
      }
    }

    for (let i = 0; i < this.bursts.length; i++) {
      if (this.fired[i]) { continue; }
      const burst = this.bursts[i];

      if (age < burst.time) { continue; }
      this.fired[i] = true;
      let count = burst.count;

      if (count <= 0) { continue; }
      if (this.spawnProbability < 1) {
        let accepted = 0;

        for (let j = 0; j < count; j++) {
          if (ctx.randomStream.nextFloat() < this.spawnProbability) { accepted++; }
        }
        count = accepted;
        if (count <= 0) { continue; }
      }
      emitter.spawnInfos.push({
        count,
        interpStartDt: 0,
        intervalDt: 0,
      });
    }
  }

  reset (): void {
    this.fired.length = 0;
    this.lastLoopAge = 0;
  }

  override toJSON (): ProSpawnBurstModuleProps {
    return {
      bursts: this.bursts.map(b => ({ time: b.time, count: b.count })),
      spawnProbability: this.spawnProbability,
    };
  }

  override fromJSON (data: ProSpawnBurstModuleProps): void {
    if (data.bursts) {
      this.bursts = data.bursts.map(b => ({ time: b.time ?? 0, count: b.count ?? 0 }));
    }
    if (typeof data.spawnProbability === 'number') { this.spawnProbability = data.spawnProbability; }
  }
}
