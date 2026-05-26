import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProEmitterInstance } from '../../simulation/emitter-instance';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProPerSourceSpawnAssignment } from '../../types/spawn-info';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProSpawnPerSourceParticleModuleProps extends ProModuleProps {
  sourceEmitterName: string,
  spawnRatePerSource: ProDistributionFloatData,
}

/**
 * Trail emitter 专用的 spawn 触发器（EmitterUpdate 阶段）。
 *
 * 与 UE Niagara `Spawn Particles From Other Emitter` 对齐：每个 source
 * 粒子（按 UniqueID 索引）独立累积 spawn 残量，每帧贡献自己的 count。
 *
 * 关键点 — 为什么不能用 `floor(ratePerSrc × numSrc × dt + globalAcc)`：
 * 低 rate 下全局残量每帧只 +0.xx，跨多帧累到 1 才 spawn 1 个粒子；
 * Sample 模块的 `(i - firstInstance) % numSrc` 给所有 spawn 出来的粒子
 * 分配到 srcIdx=0，其他 source 永远没有 ribbon。改成每 source 独立累积
 * 后，每个 source 各自跨帧攒到 1 就触发，公平分配。
 *
 * 输出：
 * - `spawnInfos.push({count: totalCount, ...})` 让 emitter 给 trail
 *   预留 totalCount 个 slot；
 * - 每条 `spawnInfo` 直接携带当前 batch 对应的 `sourceAssignment`；
 * - `sourceAssignments` 仍保留为本帧公开快照，便于调试/排查。
 *
 * 调度前提：source emitter 必须先于 trail emitter 在 system 内 addEmitter，
 * 否则本帧 numSrc / source.position 读到的是上一帧状态。
 */
export class ProSpawnPerSourceParticleModule extends ProModule {
  readonly stage = ProModuleStage.EmitterUpdate;

  sourceEmitterName = '';
  /** 每个 source 粒子每秒触发的 trail 粒子数 */
  spawnRatePerSource: ProDistributionFloat = ProDistributionFloat.fromConstant(30);

  /**
   * 本帧 spawn 分配表，按 srcIdx 升序排列。Sample 模块在 ParticleSpawn
   * 阶段读取后做累计扫描；sum(count) 必须等于本帧实际 spawn 的 trail 粒子数。
   *
   * 每帧 execute 开头清空、末尾填充，结构对外只读。
   */
  readonly sourceAssignments: ProPerSourceSpawnAssignment[] = [];

  /** 每个 source 粒子（按 UniqueID 索引）独立的残量累积器 — 跨帧持有 */
  private accumulators = new Map<number, number>();
  /**
   * 每个 source 粒子累计移动距离 — 跨帧持有。无条件按 |currPos - prevPos|
   * 递增（即使本帧没 spawn trail），保证 RibbonUVDistance 沿 source 路径
   * 单调推进，rate 抖动也不会让 UV 出现回退或骤跳
   */
  private distAccumulators = new Map<number, number>();
  private resolvedSource: ProEmitterInstance | null = null;
  private resolvedSourceName = '';
  private sourceLayout: unknown = null;
  private sourceAccessors: ProStandardAccessors | null = null;
  /** GC scratch — 重用避免每帧 alloc */
  private aliveUIDs = new Set<number>();

  override toJSON (): ProSpawnPerSourceParticleModuleProps {
    return {
      sourceEmitterName: this.sourceEmitterName,
      spawnRatePerSource: this.spawnRatePerSource.toJSON(),
    };
  }

  override fromJSON (data: ProSpawnPerSourceParticleModuleProps): void {
    if (typeof data.sourceEmitterName === 'string') {
      this.sourceEmitterName = data.sourceEmitterName;
    }
    if (data.spawnRatePerSource) {
      this.spawnRatePerSource = ProDistributionFloat.fromJSON(data.spawnRatePerSource);
    }
  }

  override execute (ctx: ProModuleContext): void {
    this.sourceAssignments.length = 0;

    if (!this.sourceEmitterName) {
      return;
    }
    if (this.resolvedSource === null || this.resolvedSourceName !== this.sourceEmitterName) {
      this.resolvedSource = ctx.systemInstance.getEmitterByName(this.sourceEmitterName);
      this.resolvedSourceName = this.sourceEmitterName;
      this.sourceLayout = null;
      this.accumulators.clear();
      this.distAccumulators.clear();
      if (this.resolvedSource) {
        const emitters = ctx.systemInstance.emitters;
        const srcIdx = emitters.indexOf(this.resolvedSource);
        const selfIdx = emitters.indexOf(ctx.emitterInstance);

        if (srcIdx > selfIdx) {
          console.warn(`[ProSpawnPerSourceParticle] source emitter "${this.sourceEmitterName}" is added after trail emitter; spawn count will lag one frame. Add source first.`);
        }
      }
    }
    const source = this.resolvedSource;

    if (!source || source === ctx.emitterInstance) {
      return;
    }
    const sourceBuffer = source.particleDataSet?.getCurrentData() ?? null;
    const numSrc = sourceBuffer?.numInstances ?? 0;

    if (!sourceBuffer || numSrc === 0) {
      // 没 source 活粒子时清空所有累积器，避免下次 source 复活后突喷
      this.accumulators.clear();
      this.distAccumulators.clear();

      return;
    }

    const layout = source.particleDataSet!.layout;

    if (this.sourceLayout !== layout) {
      this.sourceAccessors = new ProStandardAccessors(layout);
      this.sourceLayout = layout;
    }
    const sA = this.sourceAccessors!;

    const emitter = ctx.emitterInstance;
    const t = emitter.duration > 0
      ? (emitter.emitterAge % emitter.duration) / emitter.duration
      : 0;
    const ratePerSrc = Math.max(0, this.spawnRatePerSource.sampleAtTime(ctx.randomStream.nextFloat(), t));
    const dRate = ratePerSrc * ctx.deltaTime;

    this.aliveUIDs.clear();

    const tmpCurr: [number, number, number] = [0, 0, 0];
    const tmpPrev: [number, number, number] = [0, 0, 0];

    for (let i = 0; i < numSrc; i++) {
      const uid = sA.uniqueId.get(sourceBuffer, i);

      this.aliveUIDs.add(uid);

      // 距离累积：无条件每帧推进，独立于是否触发 spawn
      const distAtFrameStart = this.distAccumulators.get(uid) ?? 0;

      sA.position.get(sourceBuffer, i, tmpCurr);
      sA.previousPosition.get(sourceBuffer, i, tmpPrev);
      const dx = tmpCurr[0] - tmpPrev[0];
      const dy = tmpCurr[1] - tmpPrev[1];
      const dz = tmpCurr[2] - tmpPrev[2];
      const frameSegLen = Math.sqrt(dx * dx + dy * dy + dz * dz);

      this.distAccumulators.set(uid, distAtFrameStart + frameSegLen);

      // spawn 残量累积
      let acc = this.accumulators.get(uid) ?? 0;

      acc += dRate;
      const count = Math.floor(acc);

      acc -= count;
      this.accumulators.set(uid, acc);

      if (count > 0) {
        const intervalDt = ctx.deltaTime / count;
        const assignment: ProPerSourceSpawnAssignment = {
          srcIdx: i,
          count,
          uniqueID: uid,
          distAtFrameStart,
          frameSegLen,
        };

        this.sourceAssignments.push(assignment);
        ctx.emitterInstance.spawnInfos.push({
          count,
          interpStartDt: intervalDt * 0.5,
          intervalDt,
          sourceAssignment: assignment,
        });
      }
    }

    // GC：移除已死 source 的累积器，避免长跑下 Map 膨胀。
    // 简单 size 比较即可：alive 严格 ⊆ accumulators 的 key 集合，
    // 不等就说明有 key 已经不在 alive 里。
    if (this.accumulators.size > this.aliveUIDs.size) {
      for (const uid of this.accumulators.keys()) {
        if (!this.aliveUIDs.has(uid)) {
          this.accumulators.delete(uid);
        }
      }
    }
    if (this.distAccumulators.size > this.aliveUIDs.size) {
      for (const uid of this.distAccumulators.keys()) {
        if (!this.aliveUIDs.has(uid)) {
          this.distAccumulators.delete(uid);
        }
      }
    }

    if (this.sourceAssignments.length <= 0) {
      return;
    }
  }
}
