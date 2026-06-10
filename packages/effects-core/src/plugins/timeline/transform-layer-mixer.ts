import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../../vfx-item';
import type { TransformContribution } from './playables/transform-playable';

type BasePose = {
  position: Vector3,
  quat: Quaternion,
  scale: Vector3,
};

const tempQuat = new Quaternion();

/**
 * 同一 VFXItem 被多条 TransformTrack 影响时的求值汇总器。
 *
 * 设计语义：
 *   - Override track（最多一条生效）：mixer 内部完成 crossfade 混合后，
 *     将最终结果直接提交给 layerMixer，作为 additive pass 的基底。
 *     多条 override track 同时存在时，最后提交的覆盖前面的。
 *   - Additive track（N 条）：在 override 结果之上 post-multiply 叠加。
 *
 * 求值顺序（每帧）：
 *   1. resetFrame：清空状态
 *   2. 各 TransformMixerPlayable.evaluate 调用 submitOverride / submitAdditive
 *   3. flush：以 override 结果（或 base pose）为基底，叠加所有 additive
 */
export class TransformLayerMixer {
  private basePose?: BasePose;
  private boundInstanceId?: string;

  private hasOverride = false;
  private readonly overridePos = new Vector3();
  private readonly overrideQuat = new Quaternion();
  private readonly overrideScale = new Vector3(1, 1, 1);

  private additiveContributions: TransformContribution[] = [];
  private additiveWeights: number[] = [];

  private readonly outPos = new Vector3();
  private readonly outQuat = new Quaternion();
  private readonly outScale = new Vector3();

  resetFrame (): void {
    this.hasOverride = false;
    this.additiveContributions.length = 0;
    this.additiveWeights.length = 0;
  }

  /**
   * Override track 的 mixer 内部完成 crossfade 混合后，提交最终结果。
   * 多条 override track 时，最后提交的覆盖前面的。
   */
  submitOverride (item: VFXItem, pos: Vector3, quat: Quaternion, scale: Vector3): void {
    this.ensureBasePose(item);
    this.hasOverride = true;
    this.overridePos.copyFrom(pos);
    this.overrideQuat.copyFrom(quat);
    this.overrideScale.copyFrom(scale);
  }

  submitAdditive (item: VFXItem, contribution: TransformContribution, weight: number): void {
    this.ensureBasePose(item);
    this.additiveContributions.push(contribution);
    this.additiveWeights.push(weight);
  }

  flush (item: VFXItem): void {
    if (!this.basePose) {
      return;
    }
    const additiveCount = this.additiveContributions.length;

    if (!this.hasOverride && additiveCount === 0) {
      return;
    }

    const base = this.basePose;
    const outPos = this.outPos;
    const outQuat = this.outQuat;
    const outScale = this.outScale;

    if (this.hasOverride) {
      outPos.copyFrom(this.overridePos);
      outQuat.copyFrom(this.overrideQuat);
      outScale.copyFrom(this.overrideScale);
    } else {
      outPos.copyFrom(base.position);
      outQuat.copyFrom(base.quat);
      outScale.copyFrom(base.scale);
    }

    // ---------- additive pass (local-space post-multiply) ----------
    for (let i = 0; i < additiveCount; i++) {
      const contribution = this.additiveContributions[i];
      const weight = this.additiveWeights[i];

      if (contribution.hasPosition) {
        outPos.x += contribution.position.x * weight;
        outPos.y += contribution.position.y * weight;
        outPos.z += contribution.position.z * weight;
      }
      if (contribution.hasRotation) {
        tempQuat.identity().slerp(contribution.quat, weight);
        outQuat.multiply(tempQuat);
      }
      if (contribution.hasScale) {
        outScale.x *= 1 + (contribution.scale.x - 1) * weight;
        outScale.y *= 1 + (contribution.scale.y - 1) * weight;
        outScale.z *= 1 + (contribution.scale.z - 1) * weight;
      }
    }

    item.transform.setPosition(outPos.x, outPos.y, outPos.z);
    item.transform.setQuaternion(outQuat.x, outQuat.y, outQuat.z, outQuat.w);
    item.transform.setScale(outScale.x, outScale.y, outScale.z);
  }

  dispose (): void {
    this.basePose = undefined;
    this.boundInstanceId = undefined;
    this.additiveContributions.length = 0;
    this.additiveWeights.length = 0;
  }

  private ensureBasePose (item: VFXItem): void {
    if (!this.basePose || this.boundInstanceId !== item.getInstanceId()) {
      const scale = item.transform.scale;

      this.basePose = {
        position: item.transform.position.clone(),
        quat: item.transform.getQuaternion().clone(),
        scale: new Vector3(scale.x, scale.y, scale.x),
      };
      this.boundInstanceId = item.getInstanceId();
    }
  }
}
