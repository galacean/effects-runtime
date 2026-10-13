import { Euler } from '@galacean/effects-math/es/core/euler';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../../vfx-item';
import type { TransformContribution } from './playables/transform-playable';

/** Mix absolute attributes and write them directly to the bound item. */
export class TransformClipMixer {
  private positionWeight = 0;
  private rotationWeight = 0;
  private scaleWeight = 0;

  private readonly outPos = new Vector3();
  private readonly outRot = new Euler();
  private readonly outScale = new Vector3();

  resetFrame (): void {
    this.positionWeight = this.rotationWeight = this.scaleWeight = 0;
    this.outPos.set(0, 0, 0);
    this.outRot.set(0, 0, 0);
    this.outScale.set(0, 0, 0);
  }

  addContribution (contribution: TransformContribution, weight: number): void {
    if (!Number.isFinite(weight) || weight <= 0) {
      return;
    }
    if (contribution.hasPosition) {
      this.positionWeight += weight;
      this.outPos.addScaledVector(contribution.position, weight);
    }
    if (contribution.hasRotation) {
      this.rotationWeight += weight;
      this.outRot.x += contribution.rotation.x * weight;
      this.outRot.y += contribution.rotation.y * weight;
      this.outRot.z += contribution.rotation.z * weight;
    }
    if (contribution.hasScale) {
      this.scaleWeight += weight;
      this.outScale.addScaledVector(contribution.scale, weight);
    }
  }

  flush (item: VFXItem): void {
    if (this.positionWeight) {
      const weight = this.positionWeight;

      item.transform.setPosition(this.outPos.x / weight, this.outPos.y / weight, this.outPos.z / weight);
    }
    if (this.rotationWeight) {
      const weight = this.rotationWeight;

      item.transform.setRotation(this.outRot.x / weight, this.outRot.y / weight, this.outRot.z / weight);
    }
    if (this.scaleWeight) {
      const weight = this.scaleWeight;

      item.transform.setScale(this.outScale.x / weight, this.outScale.y / weight, this.outScale.z / weight);
    }
  }
}
