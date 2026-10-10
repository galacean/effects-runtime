import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../../vfx-item';
import type { ItemBasicTransform, TransformContribution } from './playables/transform-playable';

/**
 * 对 TransformTrack 当前激活的 Transform clip contribution 做帧内合成。
 * 每次采样从 base pose 开始，position 与 rotation 使用增量语义，scale 使用乘子语义。
 * 即使没有 clip contribution，flush 也会写回完整姿态。
 */
export class TransformClipMixer {
  private readonly outPos = new Vector3();
  private readonly outRot = new Euler();
  private readonly outScale = new Vector3(1, 1, 1);
  private readonly weightedRot = new Euler();

  resetFrame (basePose: ItemBasicTransform): void {
    this.outPos.copyFrom(basePose.position);
    this.outRot.copyFrom(basePose.rotation);
    // TODO 编辑器 scale 没有z轴控制；兼容处理只影响采样结果，不修改原始属性缓存。
    this.outScale.set(basePose.scale.x, basePose.scale.y, basePose.scale.x);
  }

  addContribution (contribution: TransformContribution, weight: number): void {
    if (weight <= 0) {
      return;
    }
    if (contribution.hasPosition) {
      this.outPos.x += contribution.position.x * weight;
      this.outPos.y += contribution.position.y * weight;
      this.outPos.z += contribution.position.z * weight;
    }
    if (contribution.hasRotation) {
      this.weightedRot.set(
        contribution.rotation.x * weight,
        contribution.rotation.y * weight,
        contribution.rotation.z * weight,
        contribution.rotation.order,
      );
      this.outRot.addEulers(this.outRot, this.weightedRot);
    }
    if (contribution.hasScale) {
      // Scale contribution 使用乘子语义，weight 用于支持 clip blend/crossfade。
      this.outScale.x *= Math.pow(contribution.scale.x, weight);
      this.outScale.y *= Math.pow(contribution.scale.y, weight);
      this.outScale.z *= Math.pow(contribution.scale.z, weight);
    }
  }

  flush (item: VFXItem): void {
    item.transform.setPosition(this.outPos.x, this.outPos.y, this.outPos.z);
    item.transform.setRotation(this.outRot.x, this.outRot.y, this.outRot.z);
    item.transform.setScale(this.outScale.x, this.outScale.y, this.outScale.z);
  }
}
