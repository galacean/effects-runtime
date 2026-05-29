import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import type { ProDistributionFloatData } from '../../distribution/pro-distribution-float';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ParticleRandSalts, hashSeed } from '../../utils/per-particle-rand';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';

export interface ProRotateAroundPointModuleProps extends ProModuleProps {
  rate: ProDistributionFloatData,
  radius: ProDistributionFloatData,
  phase: ProDistributionFloatData,
  center: [number, number, number],
  rotationAxis: [number, number, number],
}

const tmpInitPos: [number, number, number] = [0, 0, 0];

const DEG2RAD = Math.PI / 180;

/**
 * 轨道运动模块。对齐 UE Niagara Stateless RotateAroundPoint。
 *
 * Position = InitialPosition + Center + RotateByEuler(cos(time), 0, sin(time)) * Radius
 * 其中 time = (Phase + NormalizedAge * Rate) * DEG2RAD
 *
 * - Rate：度/生命周期（默认 360 → 一圈/生命周期）。对齐 UE 用 NormalizedAge 驱动
 * - Radius：轨道半径（世界单位，Distribution）
 * - Phase：初始相位（度，Distribution）
 * - Center：轨道中心偏移（世界单位）
 * - RotationAxis：欧拉角（度），旋转轨道平面。默认 (0,0,0) → XZ 平面轨道（Y-up）
 *
 * 在我们的有状态模型中，轨道位置是**绝对公式**（每帧从 InitialPosition+offset 重算），
 * 不是增量累加。这与 UE 的解析积分 + 加法偏移等价：UE 的 Position 也是每帧从 Age
 * 重新算出的，RotateAroundPoint 只是再加一个偏移。
 */
export class ProRotateAroundPointModule extends ProModule {
  readonly stage = ProModuleStage.ParticleUpdate;

  rate: ProDistributionFloat = ProDistributionFloat.fromConstant(360);
  radius: ProDistributionFloat = ProDistributionFloat.fromConstant(1);
  phase: ProDistributionFloat = ProDistributionFloat.fromRange(0, 360);
  center: [number, number, number] = [0, 0, 0];
  rotationAxis: [number, number, number] = [0, 0, 0];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override toJSON (): ProRotateAroundPointModuleProps {
    return {
      rate: this.rate.toJSON(),
      radius: this.radius.toJSON(),
      phase: this.phase.toJSON(),
      center: [...this.center],
      rotationAxis: [...this.rotationAxis],
    };
  }

  override fromJSON (data: ProRotateAroundPointModuleProps): void {
    if (data.rate) { this.rate = ProDistributionFloat.fromJSON(data.rate); }
    if (data.radius) { this.radius = ProDistributionFloat.fromJSON(data.radius); }
    if (data.phase) { this.phase = ProDistributionFloat.fromJSON(data.phase); }
    if (data.center && data.center.length === 3) {
      this.center = [data.center[0], data.center[1], data.center[2]];
    }
    if (data.rotationAxis && data.rotationAxis.length === 3) {
      this.rotationAxis = [data.rotationAxis[0], data.rotationAxis[1], data.rotationAxis[2]];
    }
  }

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.RandomSeed, T.Float), access: 'read' },
      { variable: createProVariable(V.InitialPosition, T.Vec3), access: 'read' },
      { variable: createProVariable(V.Age, T.Float), access: 'read' },
      { variable: createProVariable(V.Lifetime, T.Float), access: 'read' },
      { variable: createProVariable(V.Position, T.Vec3), access: 'write' },
    ];
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
    const [cx, cy, cz] = this.center;

    // 预算欧拉旋转矩阵（Y-up 系的 ZYX 顺序），帧间不变所以提到循环外
    const rx = this.rotationAxis[0] * DEG2RAD;
    const ry = this.rotationAxis[1] * DEG2RAD;
    const rz = this.rotationAxis[2] * DEG2RAD;
    const cosRx = Math.cos(rx), sinRx = Math.sin(rx);
    const cosRy = Math.cos(ry), sinRy = Math.sin(ry);
    const cosRz = Math.cos(rz), sinRz = Math.sin(rz);
    // R = Rz * Ry * Rx — 旋转轨道平面的 (ox, 0, oz) 偏移量
    const r00 = cosRy * cosRz, r01 = sinRx * sinRy * cosRz - cosRx * sinRz, r02 = cosRx * sinRy * cosRz + sinRx * sinRz;
    const r10 = cosRy * sinRz, r11 = sinRx * sinRy * sinRz + cosRx * cosRz, r12 = cosRx * sinRy * sinRz - sinRx * cosRz;
    const r20 = -sinRy, r21 = sinRx * cosRy, r22 = cosRx * cosRy;

    for (let i = firstInstance; i < lastInstance; i++) {
      const seed = a.randomSeed.get(dataBuffer, i);
      const pRate = hashSeed(seed, ParticleRandSalts.Rate);
      const pRadius = hashSeed(seed, ParticleRandSalts.Radius);
      const pPhase = hashSeed(seed, ParticleRandSalts.Phase);

      const rateVal = this.rate.sampleAtTime(pRate, 0);
      const radiusVal = this.radius.sampleAtTime(pRadius, 0);
      const phaseVal = this.phase.sampleAtTime(pPhase, 0);

      const age = a.age.get(dataBuffer, i);
      const lifetime = a.lifetime.get(dataBuffer, i);
      const normalizedAge = lifetime > 0 ? Math.min(age / lifetime, 1) : 0;

      // time = (phase + normalizedAge * rate) → 弧度
      const time = (phaseVal + normalizedAge * rateVal) * DEG2RAD;

      // 轨道偏移（Y-up 坐标系下 XZ 平面：cos→X, sin→Z）
      const ox = Math.cos(time) * radiusVal;
      const oy = 0;
      const oz = Math.sin(time) * radiusVal;

      // 用欧拉旋转矩阵旋转轨道偏移
      const rotX = r00 * ox + r01 * oy + r02 * oz;
      const rotY = r10 * ox + r11 * oy + r12 * oz;
      const rotZ = r20 * ox + r21 * oy + r22 * oz;

      a.initialPosition.get(dataBuffer, i, tmpInitPos);
      a.position.set(
        dataBuffer, i,
        tmpInitPos[0] + cx + rotX,
        tmpInitPos[1] + cy + rotY,
        tmpInitPos[2] + cz + rotZ,
      );
    }
  }
}
