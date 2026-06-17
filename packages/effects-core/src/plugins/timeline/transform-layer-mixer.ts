import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../../vfx-item';
import type { TransformContribution } from './playables/transform-playable';

type BasePose = {
  position: Vector3,
  rotation: Euler,
  scale: Vector3,
};

/**
 * 汇总单个 VFXItem 上所有 TransformTrack 的贡献，统一为 additive 叠加：
 * - position: base + Σ(delta_i * weight_i)
 * - rotation: base Euler + Σ(delta_i * weight_i)（逐分量）
 * - scale:    base * Π(c_i)（乘子连乘）
 *
 * weight 来自 clip 的 crossfade 权重。当前不支持同 track clip overlap，
 * 故运行时 weight 恒为 1：position/rotation 的 `delta * 1` 浮点精确，
 * scale 直接连乘亦精确。单 track 场景下三者均逐位等价旧的直写实现。
 */
export class TransformLayerMixer {
  private basePose?: BasePose;
  private boundInstanceId?: string;

  private hasContribution = false;
  private hasPosition = false;
  private hasRotation = false;
  private hasScale = false;

  private readonly outPos = new Vector3();
  private readonly outRot = new Euler();
  private readonly outScale = new Vector3(1, 1, 1);

  captureBasePose (item: VFXItem): void {
    this.ensureBasePose(item);
  }

  /**
   * 返回 base pose 的位置。orbital 类 position 的 delta 依赖真实起点，
   * 需要由唯一的 base 来源（本 mixer）提供，避免出现第二份 base 快照。
   */
  getBasePosition (): Vector3 | undefined {
    return this.basePose?.position;
  }

  resetFrame (): void {
    this.hasContribution = false;
    this.hasPosition = false;
    this.hasRotation = false;
    this.hasScale = false;
  }

  addContribution (item: VFXItem, contribution: TransformContribution, weight: number): void {
    if (weight <= 0) {
      return;
    }
    this.ensureBasePose(item);

    if (!this.hasContribution) {
      const base = this.basePose!;

      this.outPos.copyFrom(base.position);
      this.outRot.copyFrom(base.rotation);
      this.outScale.copyFrom(base.scale);
      this.hasContribution = true;
    }

    if (contribution.hasPosition) {
      this.hasPosition = true;
      this.outPos.x += contribution.position.x * weight;
      this.outPos.y += contribution.position.y * weight;
      this.outPos.z += contribution.position.z * weight;
    }
    if (contribution.hasRotation) {
      this.hasRotation = true;
      this.outRot.x += contribution.rotation.x * weight;
      this.outRot.y += contribution.rotation.y * weight;
      this.outRot.z += contribution.rotation.z * weight;
    }
    if (contribution.hasScale) {
      this.hasScale = true;
      // scale 为乘子连乘：out = base * Π(c_i)。当前不支持同 track clip overlap，
      // weight 恒为 1，故直接连乘——单 track 时精确退化为 base * c（与旧实现逐位一致）。
      // 未来支持 crossfade（weight<1）时，此处应改为 out *= pow(c, weight)。
      this.outScale.x *= contribution.scale.x;
      this.outScale.y *= contribution.scale.y;
      this.outScale.z *= contribution.scale.z;
    }
  }

  flush (item: VFXItem): void {
    if (!this.hasContribution) {
      return;
    }
    if (this.hasPosition) {
      item.transform.setPosition(this.outPos.x, this.outPos.y, this.outPos.z);
    }
    if (this.hasRotation) {
      item.transform.setRotation(this.outRot.x, this.outRot.y, this.outRot.z);
    }
    if (this.hasScale) {
      item.transform.setScale(this.outScale.x, this.outScale.y, this.outScale.z);
    }
  }

  dispose (): void {
    this.basePose = undefined;
    this.boundInstanceId = undefined;
    this.resetFrame();
  }

  private ensureBasePose (item: VFXItem): void {
    if (!this.basePose || this.boundInstanceId !== item.getInstanceId()) {
      const scale = item.transform.scale;

      this.basePose = {
        position: item.transform.position.clone(),
        rotation: item.transform.getRotation().clone(),
        scale: new Vector3(scale.x, scale.y, scale.x),
      };
      this.boundInstanceId = item.getInstanceId();
    }
  }
}
