import { ParticleModule, ParticleModuleStage } from '../core/particle-module';
import type { ParticleModuleContext } from '../core/particle-module';
import type { ParticleDataBuffer } from '../core/particle-data-buffer';
import type { ParticleEmitter } from '../emitter/particle-emitter';
import type { ValueGetter } from '../../../math';
import { createValueGetter } from '../../../math';
import type * as spec from '@galacean/effects-specification';

export type SampleFromSourceModuleData = {
  lifetime: spec.NumberExpression | number,
  inheritParticleColor: boolean,
  sizeAffectsWidth: boolean,
};

/**
 * trail 新粒子初始化模块（现场 Sequential 采 source）。
 *
 * 不预存 source→trail 绑定列表。每批新粒子（slotIndices）与本帧存活 source 一一对应：
 * 第 k 个新粒子采第 k 个存活 source（按 sourceDb 遍历顺序），采其 position/id/color/size
 * 初始化。这等价于原先 SpawnPerSource 预存 sourceAssignments + SampleFromSource 按列表采
 * 的逐帧结果（顺序与绑定关系一致），但消除了跨模块中间产物 sourceAssignments，对齐成熟
 * 实现的现场采样思路。
 *
 * LinkOrder 不显式写：ribbon 渲染器按 uniqueId 当 LinkOrder（对应成熟实现的回退机制）。
 */
export class SampleFromSourceModule extends ParticleModule {
  override readonly stage = ParticleModuleStage.ParticleSpawn;

  private trailLifetime: ValueGetter<number>;
  private inheritParticleColor = false;
  private sizeAffectsWidth = false;

  // source emitter 由 setSource 在构造后注入
  private sourceEmitter!: ParticleEmitter;

  override fromJSON (data: SampleFromSourceModuleData): void {
    this.trailLifetime = createValueGetter(data.lifetime) as ValueGetter<number>;
    this.inheritParticleColor = data.inheritParticleColor;
    this.sizeAffectsWidth = data.sizeAffectsWidth;
  }

  setSource (source: ParticleEmitter): void {
    this.sourceEmitter = source;
  }

  private get sourceDb (): ParticleDataBuffer {
    return this.sourceEmitter.dataBuffer;
  }

  override execute (ctx: ParticleModuleContext): void {
    if (!ctx.spawnBatch || ctx.spawnBatch.slotIndices.length === 0) {
      return;
    }
    const { slotIndices } = ctx.spawnBatch;
    const db = ctx.dataBuffer;
    const sourceDb = this.sourceDb;

    // 现场 Sequential:第 k 个新粒子采第 k 个存活 source（按 sourceDb 遍历顺序）。
    // slotIndices.length 由 SpawnPerSource 的 count 决定 = 存活 source 数,一一对应。
    let cursor = 0;
    let srcIdx = 0;

    while (cursor < slotIndices.length && srcIdx < sourceDb.numInstances) {
      // 跳过 age<=0 的 source(未激活)。
      while (srcIdx < sourceDb.numInstances && sourceDb.age[srcIdx] <= 0) {
        srcIdx++;
      }
      if (srcIdx >= sourceDb.numInstances) {
        break;
      }
      const slot = slotIndices[cursor];

      this.initTrailParticle(db, slot, srcIdx, ctx);
      cursor++;
      srcIdx++;
    }
  }

  private initTrailParticle (
    db: ParticleDataBuffer, slot: number, src: number,
    ctx: ParticleModuleContext,
  ): void {
    const sourceDb = this.sourceDb;
    const s3 = src * 3;
    const d3 = slot * 3;

    db.simulatedPosition[d3] = sourceDb.position[s3];
    db.simulatedPosition[d3 + 1] = sourceDb.position[s3 + 1];
    db.simulatedPosition[d3 + 2] = sourceDb.position[s3 + 2];
    db.position[d3] = sourceDb.position[s3];
    db.position[d3 + 1] = sourceDb.position[s3 + 1];
    db.position[d3 + 2] = sourceDb.position[s3 + 2];

    const ribbonId = sourceDb.uniqueId[src];

    db.ribbonId[slot] = ribbonId;
    db.lifetime[slot] = this.trailLifetime.getValue(ctx.emitterLifetime);
    db.age[slot] = 0;
    db.alive[slot] = 1;
    db.seed[slot] = Math.random();
    const uid = ctx.emitter.uniqueIndexOffset++;

    db.uniqueId[slot] = uid;
    ctx.emitter.aliveUniqueIds.add(uid);
    // LinkOrder 不显式写:ribbon 渲染器按 uniqueId 当 LinkOrder(回退机制),值与本模块 uniqueId 同源。
    // 存 source 粒子在 spawn 时刻的 age；ribbon renderer 用 (sourceAgeAtSpawn + trail.age) 推算 elapsed
    db.spawnSourceAge[slot] = sourceDb.age[src];

    const s4 = src * 4;
    const d4 = slot * 4;

    if (this.inheritParticleColor) {
      db.color[d4] = sourceDb.initialColor[s4];
      db.color[d4 + 1] = sourceDb.initialColor[s4 + 1];
      db.color[d4 + 2] = sourceDb.initialColor[s4 + 2];
      db.color[d4 + 3] = sourceDb.initialColor[s4 + 3];
    } else {
      db.color[d4] = 1; db.color[d4 + 1] = 1;
      db.color[d4 + 2] = 1; db.color[d4 + 3] = 1;
    }
    db.initialColor[d4] = db.color[d4];
    db.initialColor[d4 + 1] = db.color[d4 + 1];
    db.initialColor[d4 + 2] = db.color[d4 + 2];
    db.initialColor[d4 + 3] = db.color[d4 + 3];

    const d2 = slot * 2;

    if (this.sizeAffectsWidth) {
      db.size[d2] = sourceDb.initialSize[src * 2];
      db.size[d2 + 1] = db.size[d2];
    } else {
      db.size[d2] = 1; db.size[d2 + 1] = 1;
    }
    db.initialSize[d2] = db.size[d2];
    db.initialSize[d2 + 1] = db.size[d2 + 1];
  }
}
