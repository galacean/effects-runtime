import { ProStandardAccessors } from '../../builtin/standard-accessors';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProDistributionVector2 } from '../../distribution/pro-distribution-vector2';
import type { ProDistributionVector2Data } from '../../distribution/pro-distribution-vector2';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProScaleSizeBySpeedModuleProps extends ProModuleProps {
  scaleDistribution: ProDistributionVector2Data,
  /** 把 speed² 归一到 [0,1] 的缩放因子（典型 = 1 / maxSpeed²）。<=0 视为禁用 */
  velocityNorm: number,
  /** sample 时间索引固定；这里只暴露 0（速度直接当 curve 的 t） */
  sampleAtAge?: boolean,
}

const tmpVel: [number, number, number] = [0, 0, 0];
const tmpSize: [number, number] = [0, 0];
const tmpScale: [number, number] = [0, 0];

/**
 * 按粒子速度对 initialSize 做缩放（与 UE Stateless ScaleSpriteSizeBySpeed 对齐）。
 *
 * UE 算法：
 * ```
 * t = clamp(speedSq * velocityNorm, 0, 1)
 * scale = scaleDistribution.sample(t)   // Vec2 curve / range
 * size = initialSize * scale
 * ```
 *
 * - `scaleDistribution` 是 Vec2 分布（X/Y 可独立曲线），t 由 speed² 归一化得到
 * - `velocityNorm` 通常配置为 `1 / maxSpeed²`，把速度上限映射到曲线尾端
 * - 速度大于上限时 t 被 clamp 到 1，曲线尾值即上限缩放
 *
 * 旧实现（`factor = clamp(speed/refSpeed) + intensity` 自创算法）与 UE 完全不同，
 * 已删除 intensity / maxFactor / referenceSpeed 三个参数 — 改 schema 但符合 UE
 * 设计意图（曲线 + 平方归一化更适合"速度越快缩放越夸张"的非线性表现）。
 */
export class ProScaleSizeBySpeedModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  /** 默认：速度全程 X/Y 都 1.0（无效缩放）；用户通过曲线/range 自定义 */
  scaleDistribution: ProDistributionVector2 = ProDistributionVector2.fromConstant(1, 1);

  /** 1 / maxSpeed²；<=0 时 t 始终 0，模块退化为输出 scaleDistribution.sample(0) */
  velocityNorm = 1;

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProScaleSizeBySpeedModuleProps {
    return {
      scaleDistribution: this.scaleDistribution.toJSON(),
      velocityNorm: this.velocityNorm,
    };
  }

  override fromJSON (data: ProScaleSizeBySpeedModuleProps): void {
    if (data.scaleDistribution) {
      this.scaleDistribution = ProDistributionVector2.fromJSON(data.scaleDistribution);
    }
    if (typeof data.velocityNorm === 'number') {
      this.velocityNorm = data.velocityNorm;
    }
  }

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance } = ctx;

    if (!dataBuffer) {
      return;
    }
    const layout = ctx.emitterInstance.particleDataSet?.layout ?? null;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;
    const vn = this.velocityNorm;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.velocity.get(dataBuffer, i, tmpVel);
      const speedSq = tmpVel[0] * tmpVel[0] + tmpVel[1] * tmpVel[1] + tmpVel[2] * tmpVel[2];
      const t = vn > 0 ? Math.min(speedSq * vn, 1) : 0;

      // random 项不参与（与 UE 一致 — by-speed 缩放是 deterministic）
      this.scaleDistribution.sampleAtTime(0, t, tmpScale);

      a.initialSize.get(dataBuffer, i, tmpSize);
      a.size.set(dataBuffer, i, tmpSize[0] * tmpScale[0], tmpSize[1] * tmpScale[1]);
    }
  }
}
