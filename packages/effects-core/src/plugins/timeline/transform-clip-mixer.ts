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
 * 对 TransformTrack 当前激活的 Transform clip contribution 做帧内合成。
 * position 与 rotation 使用增量语义，scale 使用乘子语义；结果由 flush 统一写回。
 */
export class TransformClipMixer {
  private basePose?: BasePose;
  private boundInstanceId?: string;

  private hasContribution = false;
  private hasPosition = false;
  private hasRotation = false;
  private hasScale = false;
  private appliedPosition = false;
  private appliedRotation = false;
  private appliedScale = false;

  private readonly outPos = new Vector3();
  private readonly outRot = new Euler();
  private readonly outScale = new Vector3(1, 1, 1);
  private readonly weightedRot = new Euler();

  captureBasePose (item: VFXItem): void {
    this.ensureBasePose(item);
  }

  /**
   * orbital position 的 contribution 依赖 base position。
   * 这里返回 mixer 持有的 base，确保采样和合成使用同一份参考姿态。
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
      this.weightedRot.set(
        contribution.rotation.x * weight,
        contribution.rotation.y * weight,
        contribution.rotation.z * weight,
        contribution.rotation.order,
      );
      this.outRot.addEulers(this.outRot, this.weightedRot);
    }
    if (contribution.hasScale) {
      this.hasScale = true;
      // Scale contribution 使用乘子语义，weight 用于支持 clip blend/crossfade。
      this.outScale.x *= Math.pow(contribution.scale.x, weight);
      this.outScale.y *= Math.pow(contribution.scale.y, weight);
      this.outScale.z *= Math.pow(contribution.scale.z, weight);
    }
  }

  flush (item: VFXItem): void {
    const base = this.basePose;

    if (!base || (!this.hasContribution && !this.appliedPosition && !this.appliedRotation && !this.appliedScale)) {
      return;
    }
    if (this.hasPosition) {
      item.transform.setPosition(this.outPos.x, this.outPos.y, this.outPos.z);
      this.appliedPosition = true;
    } else if (this.appliedPosition) {
      item.transform.setPosition(base.position.x, base.position.y, base.position.z);
      this.appliedPosition = false;
    }
    if (this.hasRotation) {
      item.transform.setRotation(this.outRot.x, this.outRot.y, this.outRot.z);
      this.appliedRotation = true;
    } else if (this.appliedRotation) {
      item.transform.setRotation(base.rotation.x, base.rotation.y, base.rotation.z);
      this.appliedRotation = false;
    }
    if (this.hasScale) {
      item.transform.setScale(this.outScale.x, this.outScale.y, this.outScale.z);
      this.appliedScale = true;
    } else if (this.appliedScale) {
      item.transform.setScale(base.scale.x, base.scale.y, base.scale.z);
      this.appliedScale = false;
    }
  }

  dispose (): void {
    this.basePose = undefined;
    this.boundInstanceId = undefined;
    this.appliedPosition = false;
    this.appliedRotation = false;
    this.appliedScale = false;
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
      this.appliedPosition = false;
      this.appliedRotation = false;
      this.appliedScale = false;
    }
  }
}
