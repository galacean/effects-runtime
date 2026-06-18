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
 * 汇总单个 VFXItem 上多条 TransformTrack 的贡献，additive 合成：
 * - position / rotation：base + Σ(deltaᵢ · weightᵢ)
 * - scale：base · Π(cᵢ)
 *
 * weight 为 clip crossfade 权重，当前无 clip overlap，恒为 1。
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
   * 返回 base 位置。orbital position 的 delta 依赖真实起点，由此处统一提供，
   * 避免 mixer 与 playable 各持一份 base 快照。
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
      // 乘子连乘 out *= pow(c, weight)；weight 恒为 1 时 pow(c,1)===c，
      // 与 position/rotation 的 *weight 语义统一，支持未来 crossfade。
      this.outScale.x *= Math.pow(contribution.scale.x, weight);
      this.outScale.y *= Math.pow(contribution.scale.y, weight);
      this.outScale.z *= Math.pow(contribution.scale.z, weight);
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
