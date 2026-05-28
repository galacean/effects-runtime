import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps } from '../module';

export interface ProRotateAroundPointModuleProps extends ProModuleProps {
  rate: ProDistributionFloatData,
  radiusScale: ProDistributionFloatData,
  phase: ProDistributionFloatData,
  origin: [number, number, number],
}

const tmpInitPos: [number, number, number] = [0, 0, 0];

const DEG2RAD = Math.PI / 180;

/**
 * 轨道运动：粒子绕 `origin` 在 XZ 平面做圆周运动。
 *
 * 与 UE Niagara Stateful RotateAroundPoint 对齐 —— 位置由 **绝对公式**
 * 给出，不是每帧增量累加：
 *
 * ```
 * offset = initialPosition - origin          // spawn 时的相对位置
 * baseRadius = length(offset.xz)
 * baseAngle = atan2(offset.z, offset.x)
 * angle = baseAngle + (rate * age + phase) * DEG2RAD
 * position = origin + RotMatrix(angle) * baseRadius_scaled
 * ```
 *
 * radiusScale 默认 1（沿用 spawn 时半径）；调成其它值时按 baseRadius * scale。
 * 这样每帧都是 deterministic 的 absolute position，避免旧实现 `position += sin/cos*r`
 * 形式的线性外推螺旋。
 *
 * **Y 轴不变** —— 与 UE 一致只绕单轴。如需任意轴需另写模块。
 */
export class ProRotateAroundPointModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromConstant(180);
  /** 半径缩放系数。1 = 沿用 spawn 时位置；>1 外扩；<1 内收。基础半径由粒子 InitialPosition 决定 */
  radiusScale: ProDistributionFloat = ProDistributionFloat.fromConstant(1);
  phase: ProDistributionFloat = ProDistributionFloat.fromRange(0, 360);
  /** 轨道中心（世界单位）。粒子绕这个点旋转 */
  origin: [number, number, number] = [0, 0, 0];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProRotateAroundPointModuleProps {
    return {
      rate: this.rate.toJSON(),
      radiusScale: this.radiusScale.toJSON(),
      phase: this.phase.toJSON(),
      origin: [...this.origin],
    };
  }

  override fromJSON (data: ProRotateAroundPointModuleProps): void {
    if (data.rate) { this.rate = ProDistributionFloat.fromJSON(data.rate); }
    if (data.radiusScale) { this.radiusScale = ProDistributionFloat.fromJSON(data.radiusScale); }
    if (data.phase) { this.phase = ProDistributionFloat.fromJSON(data.phase); }
    if (data.origin && data.origin.length === 3) {
      this.origin = [data.origin[0], data.origin[1], data.origin[2]];
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
    // Y 不参与（与 UE 一致只绕 Y 轴），用 _ 前缀让 lint 知道是故意丢弃
    const [ox, _oy, oz] = this.origin;

    for (let i = firstInstance; i < lastInstance; i++) {
      const seed = a.randomSeed.get(dataBuffer, i);
      // 每属性独立 salt — 避免 rate/radius/phase 完全相关；hashSeed 拆出 3 个子随机
      const pRate = hashSeed(seed, ParticleRandSalts.Rate);
      const pRadius = hashSeed(seed, ParticleRandSalts.Radius);
      const pPhase = hashSeed(seed, ParticleRandSalts.Phase);

      const rateVal = this.rate.sampleAtTime(pRate, 0);
      const scaleVal = this.radiusScale.sampleAtTime(pRadius, 0);
      const phaseVal = this.phase.sampleAtTime(pPhase, 0);

      a.initialPosition.get(dataBuffer, i, tmpInitPos);
      const dx = tmpInitPos[0] - ox;
      const dz = tmpInitPos[2] - oz;
      const baseR = Math.hypot(dx, dz);

      // 退化情形：粒子 spawn 在 origin 上时 baseR=0，旋转无意义，跳过保留原 position
      if (baseR < 1e-6) {
        continue;
      }
      const baseAngle = Math.atan2(dz, dx);
      const age = a.age.get(dataBuffer, i);
      const angle = baseAngle + (rateVal * age + phaseVal) * DEG2RAD;
      const r = baseR * scaleVal;

      a.position.set(
        dataBuffer, i,
        ox + Math.cos(angle) * r,
        tmpInitPos[1], // Y 不变 — 与 UE 一致只绕 Y 轴
        oz + Math.sin(angle) * r,
      );
    }
  }
}

