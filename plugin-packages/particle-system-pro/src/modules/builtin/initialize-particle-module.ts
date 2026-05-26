import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionColor } from '../../distribution/pro-distribution-color';
import type { ProDistributionColorData } from '../../distribution/pro-distribution-color';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import { ProDistributionVector2 } from '../../distribution/pro-distribution-vector2';
import type { ProDistributionVector2Data } from '../../distribution/pro-distribution-vector2';
import { ProDistributionVector3 } from '../../distribution/pro-distribution-vector3';
import type { ProDistributionVector3Data } from '../../distribution/pro-distribution-vector3';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProInitializeParticleModuleProps extends ProModuleProps {
  lifetime: ProDistributionFloatData,
  startColor: ProDistributionColorData,
  startSize: ProDistributionVector2Data,
  mass: ProDistributionFloatData,
  positionOrigin: ProDistributionVector3Data,
}

const tmpColor: [number, number, number, number] = [0, 0, 0, 0];
const tmpSize: [number, number] = [0, 0];
const tmpPos: [number, number, number] = [0, 0, 0];

/** 把任意 uint 通过乘大素数 + 截断到 [0,1)。比 sin-based hash 更稳，无浮点精度坑 */
function hashFloat (x: number): number {
  // 强制 32-bit，避开 V8 SMI 升级，结果分布更均匀
  const y = (Math.imul(x | 0, 1664525) + 1013904223) >>> 0;

  return (y & 0xffffff) / 0x1000000;
}

/**
 * 给新生粒子写入初值：lifetime、起始 position、起始 color、起始 size、age=0。
 *
 * 同时把 initialColor / initialSize 备份给后续 over-life 模块用。
 *
 * 与 Niagara 的 Initialize Particle Module 对应。
 */
export class ProInitializeParticleModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  lifetime: ProDistributionFloat = ProDistributionFloat.fromRange(1, 2);
  startColor: ProDistributionColor = ProDistributionColor.fromConstant(1, 1, 1, 1);
  /** X/Y 独立的初始尺寸；uniform 模式（默认）下 X=Y 等比 */
  startSize: ProDistributionVector2 = ProDistributionVector2.fromUniformConstant(0.1);
  mass: ProDistributionFloat = ProDistributionFloat.fromConstant(1);
  /** spawn 时的初始位置中心 — Range 模式下每个粒子在 box 内均匀随机出生（对齐 UE
   *  FNiagaraDistributionRangeVector3）。ShapeLocation 模块运行后会覆盖 */
  positionOrigin: ProDistributionVector3 = ProDistributionVector3.fromConstant(0, 0, 0);

  override toJSON (): ProInitializeParticleModuleProps {
    return {
      lifetime: this.lifetime.toJSON(),
      startColor: this.startColor.toJSON(),
      startSize: this.startSize.toJSON(),
      mass: this.mass.toJSON(),
      positionOrigin: this.positionOrigin.toJSON(),
    };
  }

  override fromJSON (data: ProInitializeParticleModuleProps): void {
    if (data.lifetime) {
      this.lifetime = ProDistributionFloat.fromJSON(data.lifetime);
    }
    if (data.startColor) {
      this.startColor = ProDistributionColor.fromJSON(data.startColor);
    }
    if (data.startSize) {
      this.startSize = ProDistributionVector2.fromJSON(data.startSize);
    }
    if (data.mass) {
      this.mass = ProDistributionFloat.fromJSON(data.mass);
    }
    if (data.positionOrigin) {
      this.positionOrigin = ProDistributionVector3.fromJSON(data.positionOrigin);
    }
  }

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: unknown = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

    if (!dataBuffer) {
      return;
    }
    const layout = ctx.emitterInstance.particleDataSet?.layout;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;
    // 全局 spawn 计数尚未把本批加上，作为本批起始基准
    const linkOrderBase = ctx.emitterInstance.totalSpawnedParticles;
    const idTable = ctx.emitterInstance.idTable;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.age.set(dataBuffer, i, 0);
      a.lifetime.set(dataBuffer, i, this.lifetime.sampleAtTime(randomStream.nextFloat(), 0));
      // positionOrigin 现在是 ProDistributionVector3 — Range 模式下每个粒子单独
      // 在 box 内出生，对齐 UE FNiagaraDistributionRangeVector3 的 spawn 散布
      this.positionOrigin.sampleAtTime(randomStream.nextFloat(), 0, tmpPos);
      const px = tmpPos[0], py = tmpPos[1], pz = tmpPos[2];

      a.position.set(dataBuffer, i, px, py, pz);
      a.previousPosition.set(dataBuffer, i, px, py, pz);
      // InitialPosition 这里只设一个占位（=positionOrigin），真正值由 emitter-instance
      // 在所有 ParticleSpawn 模块（ShapeLocation / Sample... 等可能改 position 的模块）
      // 跑完之后再 capture 一次。这样 RotateAroundPoint 等模块拿到的是最终 spawn 位置
      a.initialPosition.set(dataBuffer, i, px, py, pz);
      a.velocity.set(dataBuffer, i, 0, 0, 0);
      a.mass.set(dataBuffer, i, Math.max(1e-6, this.mass.sampleAtTime(randomStream.nextFloat(), 0)));
      // 单调递增，给 Ribbon Renderer 当主排序键
      a.ribbonLinkOrder.set(dataBuffer, i, linkOrderBase + (i - firstInstance));
      // RibbonWidth 重置为 0（哨兵值）— 没装 ProRibbonWidthModule 时 renderer
      // 走 Size.x * widthScale 回退路径；装了则后续 spawn 模块覆盖
      a.ribbonWidth.set(dataBuffer, i, 0);
      a.initialRibbonWidth.set(dataBuffer, i, 0);
      // RibbonUVDistance 重置为 0；后续 spawn 模块（trail）会覆盖
      a.ribbonUVDistance.set(dataBuffer, i, 0);
      // 全局唯一 ID — 仅取 acquireTag（永不复用，比 slot index 更适合做跨 emitter 引用）
      const uid = idTable.acquire().acquireTag;

      a.uniqueId.set(dataBuffer, i, uid);
      // per-particle 随机种子：所有 update 模块共享这个 rand；用 randomStream 抽取
      // 保证 reseed 一致性，避免老的 (i * GOLDEN_RATIO) % 1 slot hash 缺陷
      a.randomSeed.set(dataBuffer, i, randomStream.nextFloat());
      // NoiseOffset：让 CurlNoise 等模块在噪声场不同采样点上避免粒子堆叠到同一流线。
      // 用 uniqueId 做 hash 而非 randomStream — 保证粒子在多次 tick 间偏移稳定
      const h1 = hashFloat(uid * 2654435761 + 1);
      const h2 = hashFloat(uid * 2246822519 + 13);
      const h3 = hashFloat(uid * 3266489917 + 29);

      a.noiseOffset.set(dataBuffer, i, h1 * 1000, h2 * 1000, h3 * 1000);

      this.startColor.sampleAtTime(randomStream.nextFloat(), 0, tmpColor);
      a.color.set(dataBuffer, i, tmpColor[0], tmpColor[1], tmpColor[2], tmpColor[3]);
      a.initialColor.set(dataBuffer, i, tmpColor[0], tmpColor[1], tmpColor[2], tmpColor[3]);

      // uniform 时 X/Y 共用同一个 random；否则两轴独立
      if (this.startSize.uniform) {
        this.startSize.sampleAtTime(randomStream.nextFloat(), 0, tmpSize);
      } else {
        tmpSize[0] = this.startSize.x.sampleAtTime(randomStream.nextFloat(), 0);
        tmpSize[1] = this.startSize.y.sampleAtTime(randomStream.nextFloat(), 0);
      }
      a.size.set(dataBuffer, i, tmpSize[0], tmpSize[1]);
      a.initialSize.set(dataBuffer, i, tmpSize[0], tmpSize[1]);
    }
  }
}
