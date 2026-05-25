import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProDistributionFloat } from '../../distribution/pro-distribution-float';
import { ProDistributionVector3 } from '../../distribution/pro-distribution-vector3';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';

const tmpPos: [number, number, number] = [0, 0, 0];
const tmpVel: [number, number, number] = [0, 0, 0];

export type ProVelocityType = 'linear' | 'inCone' | 'fromPoint';

/**
 * 统一速度初始化模块，支持三种模式（对齐 Niagara AddVelocity）：
 * - linear: 直接指定方向速度（DistributionVector3）
 * - inCone: 锥形随机速度
 * - fromPoint: 从某个原点向外辐射
 */
export class ProAddVelocityInConeModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  velocityType: ProVelocityType = 'inCone';

  // Linear
  linearVelocity: ProDistributionVector3 = ProDistributionVector3.fromConstant(0, 1, 0);

  // InCone
  speed: ProDistributionFloat = ProDistributionFloat.fromRange(1, 2);
  coneAxis: [number, number, number] = [0, 1, 0];
  coneAngle = Math.PI / 6;

  // FromPoint
  pointSpeed: ProDistributionFloat = ProDistributionFloat.fromRange(1, 2);
  pointOrigin: [number, number, number] = [0, 0, 0];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override execute (ctx: ProModuleContext): void {
    const { dataBuffer } = ctx;

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

    switch (this.velocityType) {
      case 'linear':
        this.executeLinear(a, ctx);

        break;
      case 'inCone':
        this.executeInCone(a, ctx);

        break;
      case 'fromPoint':
        this.executeFromPoint(a, ctx);

        break;
    }
  }

  private executeLinear (a: ProStandardAccessors, ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;

    for (let i = firstInstance; i < lastInstance; i++) {
      this.linearVelocity.sampleAtTime(randomStream.nextFloat(), 0, tmpVel);
      a.velocity.set(dataBuffer!, i, tmpVel[0], tmpVel[1], tmpVel[2]);
    }
  }

  private executeInCone (a: ProStandardAccessors, ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;
    const [ax, ay, az] = this.coneAxis;
    const cosHalfAngle = Math.cos(this.coneAngle);

    const helper = Math.abs(ay) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let t1x = ay * helper[2] - az * helper[1];
    let t1y = az * helper[0] - ax * helper[2];
    let t1z = ax * helper[1] - ay * helper[0];
    const t1len = Math.hypot(t1x, t1y, t1z) || 1;

    t1x /= t1len; t1y /= t1len; t1z /= t1len;
    const t2x = ay * t1z - az * t1y;
    const t2y = az * t1x - ax * t1z;
    const t2z = ax * t1y - ay * t1x;

    for (let i = firstInstance; i < lastInstance; i++) {
      const cosTheta = cosHalfAngle + (1 - cosHalfAngle) * randomStream.nextFloat();
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
      const phi = randomStream.nextFloat() * Math.PI * 2;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const dx = ax * cosTheta + t1x * sinTheta * cosPhi + t2x * sinTheta * sinPhi;
      const dy = ay * cosTheta + t1y * sinTheta * cosPhi + t2y * sinTheta * sinPhi;
      const dz = az * cosTheta + t1z * sinTheta * cosPhi + t2z * sinTheta * sinPhi;
      const spd = this.speed.sampleAtTime(randomStream.nextFloat(), 0);

      a.velocity.set(dataBuffer!, i, dx * spd, dy * spd, dz * spd);
    }
  }

  private executeFromPoint (a: ProStandardAccessors, ctx: ProModuleContext): void {
    const { dataBuffer, firstInstance, lastInstance, randomStream } = ctx;
    const [ox, oy, oz] = this.pointOrigin;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.position.get(dataBuffer!, i, tmpPos);
      let dx = tmpPos[0] - ox;
      let dy = tmpPos[1] - oy;
      let dz = tmpPos[2] - oz;
      const len = Math.hypot(dx, dy, dz) || 1;

      dx /= len; dy /= len; dz /= len;
      const spd = this.pointSpeed.sampleAtTime(randomStream.nextFloat(), 0);

      a.velocity.set(dataBuffer!, i, dx * spd, dy * spd, dz * spd);
    }
  }
}

export { ProAddVelocityInConeModule as ProAddVelocityModule };
