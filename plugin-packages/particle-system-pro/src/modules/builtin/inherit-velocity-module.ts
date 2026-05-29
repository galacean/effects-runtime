import { math } from '@galacean/effects';
import { ProStandardAccessors } from '../../builtin/standard-accessors';
import { ProStandardVariableNames as V } from '../../builtin/standard-variables';
import type { ProDataSetLayout } from '../../data/data-set-layout';
import { ProVariableTypes as T, createProVariable } from '../../types/variable';
import type { ProModuleContext } from '../module-context';
import { ProModuleStage } from '../stage';
import { ProModule } from '../module';
import type { ProModuleProps, ProVariableDeclaration } from '../module';

export interface ProInheritVelocityModuleProps extends ProModuleProps {
  velocityScale: [number, number, number],
}

const tmpVel: [number, number, number] = [0, 0, 0];
const invWorld = new math.Matrix4();

/**
 * Inherit Velocity 模块（ParticleSpawn）。
 *
 * 让新粒子继承「发射器自身在世界空间的平移速度」乘以 velocityScale，对齐
 * UE Niagara 的 Inherit Velocity。典型用途：移动的火把拖出的火星应该带着
 * 火把的运动方向甩出去。
 *
 * **仅 world simulation space 生效**：world 模式下 ParticleSpawn 写入的速度
 * 是「局部空间值」，会在 bakeNewParticlesToWorld 里被 worldMatrix 旋转到世界
 * 空间。所以这里先把世界空间的 emitterVelocity（按 velocityScale 缩放后）用
 * worldMatrix 的逆旋回局部空间再累加，bake 之后正好落到世界空间。
 *
 * local 模式下粒子被 renderer 每帧乘 worldMatrix 刚性跟随发射器，再继承一次
 * 速度会重复计运动，因此 no-op。
 *
 * 语义为 **累加**（+=），需放在设置速度的模块（AddVelocity 等）之后。
 */
export class ProInheritVelocityModule extends ProModule {
  readonly stage = ProModuleStage.ParticleSpawn;

  velocityScale: [number, number, number] = [1, 1, 1];

  private accessors: ProStandardAccessors | null = null;
  private cachedLayout: ProDataSetLayout | null = null;

  override declareVariables (): ProVariableDeclaration[] {
    return [
      { variable: createProVariable(V.Velocity, T.Vec3), access: 'readwrite' },
    ];
  }

  override execute (ctx: ProModuleContext): void {
    const emitter = ctx.emitterInstance;
    const { dataBuffer, firstInstance, lastInstance } = ctx;

    // 只在 world 模式继承；local 模式粒子已刚性跟随发射器
    if (!dataBuffer || emitter.simulationSpace !== 'world') {
      return;
    }
    const [ex, ey, ez] = emitter.emitterVelocity;

    // 未移动 / 首帧：emitterVelocity 全 0，无需继承
    if (ex === 0 && ey === 0 && ez === 0) {
      return;
    }
    const layout = emitter.particleDataSet?.layout ?? null;

    if (!layout) {
      return;
    }
    if (this.cachedLayout !== layout) {
      this.accessors = new ProStandardAccessors(layout);
      this.cachedLayout = layout;
    }
    const a = this.accessors!;

    // 先在世界空间按 velocityScale 缩放，再用 worldMatrix 的逆旋回局部空间；
    // bake 会再用 worldMatrix 旋回世界 → 净效果 = 世界空间继承速度
    const wx = ex * this.velocityScale[0];
    const wy = ey * this.velocityScale[1];
    const wz = ez * this.velocityScale[2];

    invWorld.copyFrom(emitter.worldMatrix).invert();
    const m = invWorld.elements;
    const lx = m[0] * wx + m[4] * wy + m[8] * wz;
    const ly = m[1] * wx + m[5] * wy + m[9] * wz;
    const lz = m[2] * wx + m[6] * wy + m[10] * wz;

    for (let i = firstInstance; i < lastInstance; i++) {
      a.velocity.get(dataBuffer, i, tmpVel);
      a.velocity.set(dataBuffer, i, tmpVel[0] + lx, tmpVel[1] + ly, tmpVel[2] + lz);
    }
  }

  override toJSON (): ProInheritVelocityModuleProps {
    return { velocityScale: [...this.velocityScale] };
  }

  override fromJSON (data: ProInheritVelocityModuleProps): void {
    if (data.velocityScale && data.velocityScale.length === 3) {
      this.velocityScale = [data.velocityScale[0], data.velocityScale[1], data.velocityScale[2]];
    }
  }
}
