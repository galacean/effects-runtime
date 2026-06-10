import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import { VFXItem } from '../../../vfx-item';
import type { FrameContext } from '../playable';
import type { TrackBlendMode } from './transform-playable';
import { isContributingTransform } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

const tempQuat = new Quaternion();
const tempAccQuat = new Quaternion();

type BasePose = {
  position: Vector3,
  quat: Quaternion,
  scale: Vector3,
};

const cloneBasePose = (item: VFXItem): BasePose => {
  const scale = item.transform.scale;

  return {
    position: item.transform.position.clone(),
    quat: item.transform.getQuaternion().clone(),
    scale: new Vector3(scale.x, scale.y, scale.x),
  };
};

/**
 * Transform 多 clip 混合 mixer。
 *
 * 职责：同一条 track 内按当前 active clip 求值并输出混合结果。
 * 当前不支持同 track 多 clip overlap 混合。
 * 跨 track 的合成由 TransformLayerMixer 负责。
 */
export class TransformMixerPlayable extends TrackMixerPlayable {
  trackBlendMode: TrackBlendMode = 'override';

  private basePose?: BasePose;
  private boundInstanceId?: string;

  private readonly blendedPos = new Vector3();
  private readonly blendedQuat = new Quaternion();
  private readonly blendedScale = new Vector3(1, 1, 1);

  override evaluate (context: FrameContext): void {
    const item = context.output.getUserData();

    if (!(item instanceof VFXItem)) {
      return;
    }

    // base pose 懒采集
    if (!this.basePose || this.boundInstanceId !== item.getInstanceId()) {
      this.basePose = cloneBasePose(item);
      this.boundInstanceId = item.getInstanceId();
    }

    // 收集 active contributions
    let activeCount = 0;
    let hasPositionAny = false;
    let hasRotationAny = false;
    let hasScaleAny = false;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      if (!weight || weight <= 0) {
        continue;
      }
      const playable = this.clipPlayables[i];

      if (!isContributingTransform(playable)) {
        continue;
      }
      const contribution = playable.getContribution();

      activeCount++;
      hasPositionAny = hasPositionAny || contribution.hasPosition;
      hasRotationAny = hasRotationAny || contribution.hasRotation;
      hasScaleAny = hasScaleAny || contribution.hasScale;
    }

    if (activeCount === 0) {
      return;
    }

    const layerMixer = context.layerMixerMap?.get(item.getInstanceId());

    if (layerMixer) {
      if (this.trackBlendMode === 'override') {
        this.computeBlended(hasPositionAny, hasRotationAny, hasScaleAny);
        layerMixer.submitOverride(item, this.blendedPos, this.blendedQuat, this.blendedScale);
      } else {
        for (let i = 0; i < this.clipPlayables.length; i++) {
          const weight = this.clipWeights[i];

          if (!weight || weight <= 0) {
            continue;
          }
          const playable = this.clipPlayables[i];

          if (!isContributingTransform(playable)) {
            continue;
          }
          layerMixer.submitAdditive(item, playable.getContribution(), weight);
        }
      }

      return;
    }

    // 无 layerMixer：单 track 直写路径
    this.computeBlended(hasPositionAny, hasRotationAny, hasScaleAny);
    if (hasPositionAny) {
      item.transform.setPosition(this.blendedPos.x, this.blendedPos.y, this.blendedPos.z);
    }
    if (hasScaleAny) {
      item.transform.setScale(this.blendedScale.x, this.blendedScale.y, this.blendedScale.z);
    }
    if (hasRotationAny) {
      item.transform.setQuaternion(this.blendedQuat.x, this.blendedQuat.y, this.blendedQuat.z, this.blendedQuat.w);
    }
  }

  private computeBlended (
    hasPositionAny: boolean,
    hasRotationAny: boolean,
    hasScaleAny: boolean,
  ): void {
    const base = this.basePose!;
    let posSumW = 0;
    let rotSumW = 0;
    let scaleSumW = 0;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      if (!weight || weight <= 0) {
        continue;
      }
      const playable = this.clipPlayables[i];

      if (!isContributingTransform(playable)) {
        continue;
      }
      const contribution = playable.getContribution();

      if (contribution.hasPosition) { posSumW += weight; }
      if (contribution.hasRotation) { rotSumW += weight; }
      if (contribution.hasScale) { scaleSumW += weight; }
    }

    if (hasPositionAny) {
      const posNorm = posSumW > 1 ? 1 / posSumW : 1;
      let px = base.position.x;
      let py = base.position.y;
      let pz = base.position.z;

      for (let i = 0; i < this.clipPlayables.length; i++) {
        const weight = this.clipWeights[i];

        if (!weight || weight <= 0) {
          continue;
        }
        const playable = this.clipPlayables[i];

        if (!isContributingTransform(playable)) {
          continue;
        }
        const contribution = playable.getContribution();

        if (!contribution.hasPosition) {
          continue;
        }
        const ww = weight * posNorm;

        px += contribution.position.x * ww;
        py += contribution.position.y * ww;
        pz += contribution.position.z * ww;
      }
      this.blendedPos.set(px, py, pz);
    } else {
      this.blendedPos.copyFrom(base.position);
    }

    if (hasScaleAny) {
      const scaleNorm = scaleSumW > 1 ? 1 / scaleSumW : 1;
      let normScaleSumW = 0;
      let mx = 0;
      let my = 0;
      let mz = 0;

      for (let i = 0; i < this.clipPlayables.length; i++) {
        const weight = this.clipWeights[i];

        if (!weight || weight <= 0) {
          continue;
        }
        const playable = this.clipPlayables[i];

        if (!isContributingTransform(playable)) {
          continue;
        }
        const contribution = playable.getContribution();

        if (!contribution.hasScale) {
          continue;
        }
        const ww = weight * scaleNorm;

        mx += contribution.scale.x * ww;
        my += contribution.scale.y * ww;
        mz += contribution.scale.z * ww;
        normScaleSumW += ww;
      }
      const wBase = Math.max(0, 1 - normScaleSumW);

      this.blendedScale.set(
        base.scale.x * (mx + wBase),
        base.scale.y * (my + wBase),
        base.scale.z * (mz + wBase),
      );
    } else {
      this.blendedScale.copyFrom(base.scale);
    }

    if (hasRotationAny) {
      const rotNorm = rotSumW > 1 ? 1 / rotSumW : 1;

      tempAccQuat.identity();
      let rotAcc = 0;

      for (let i = 0; i < this.clipPlayables.length; i++) {
        const weight = this.clipWeights[i];

        if (!weight || weight <= 0) {
          continue;
        }
        const playable = this.clipPlayables[i];

        if (!isContributingTransform(playable)) {
          continue;
        }
        const contribution = playable.getContribution();

        if (!contribution.hasRotation) {
          continue;
        }
        const ww = weight * rotNorm;

        rotAcc += ww;
        const slerpT = rotAcc > 0 ? ww / rotAcc : 1;

        tempAccQuat.slerp(contribution.quat, slerpT);
      }
      tempQuat.copyFrom(base.quat).multiply(tempAccQuat);
      this.blendedQuat.set(tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w);
    } else {
      this.blendedQuat.copyFrom(base.quat);
    }
  }
}
