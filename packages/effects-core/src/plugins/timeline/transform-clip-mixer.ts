import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../../vfx-item';
import type { ItemBasicTransform, TransformContribution } from './playables/transform-playable';

/** 由 CompositionComponent 持有，生命周期独立于播放图。 */
export type TransformState = {
  basePose: ItemBasicTransform,
  appliedPosition: boolean,
  appliedRotation: boolean,
  appliedScale: boolean,
};

/**
 * 对 TransformTrack 当前激活的 Transform clip contribution 做帧内合成。
 * position 与 rotation 使用增量语义，scale 使用乘子语义；结果由 flush 统一写回。
 */
export class TransformClipMixer {
  private hasContribution = false;
  private hasPosition = false;
  private hasRotation = false;
  private hasScale = false;

  private readonly outPos = new Vector3();
  private readonly outRot = new Euler();
  private readonly outScale = new Vector3(1, 1, 1);
  private readonly weightedRot = new Euler();

  resetFrame (): void {
    this.hasContribution = false;
    this.hasPosition = false;
    this.hasRotation = false;
    this.hasScale = false;
  }

  addContribution (basePose: ItemBasicTransform, contribution: TransformContribution, weight: number): void {
    if (weight <= 0) {
      return;
    }
    if (!this.hasContribution) {
      this.outPos.copyFrom(basePose.position);
      this.outRot.copyFrom(basePose.rotation);
      this.outScale.copyFrom(basePose.scale);
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

  flush (item: VFXItem, state: TransformState): void {
    const base = state.basePose;

    if (!this.hasContribution && !state.appliedPosition && !state.appliedRotation && !state.appliedScale) {
      return;
    }
    if (this.hasPosition) {
      item.transform.setPosition(this.outPos.x, this.outPos.y, this.outPos.z);
      state.appliedPosition = true;
    } else if (state.appliedPosition) {
      item.transform.setPosition(base.position.x, base.position.y, base.position.z);
      state.appliedPosition = false;
    }
    if (this.hasRotation) {
      item.transform.setRotation(this.outRot.x, this.outRot.y, this.outRot.z);
      state.appliedRotation = true;
    } else if (state.appliedRotation) {
      item.transform.setRotation(base.rotation.x, base.rotation.y, base.rotation.z);
      state.appliedRotation = false;
    }
    if (this.hasScale) {
      item.transform.setScale(this.outScale.x, this.outScale.y, this.outScale.z);
      state.appliedScale = true;
    } else if (state.appliedScale) {
      item.transform.setScale(base.scale.x, base.scale.y, base.scale.z);
      state.appliedScale = false;
    }
  }
}
