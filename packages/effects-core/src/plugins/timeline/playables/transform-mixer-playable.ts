import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { FrameContext } from '../playable';
import { VFXItem } from '../../../vfx-item';
import { TransformPlayable } from './transform-playable';
import { TrackMixerPlayable } from './track-mixer-playable';

/** Mix absolute transform samples, filling remaining weight with the first active transform. */
export class TransformMixerPlayable extends TrackMixerPlayable {
  private initialTransform?: {
    position: Vector3,
    rotation: Vector3,
    scale: Vector3,
  };
  private hasPosition = false;
  private hasRotation = false;
  private hasScale = false;

  private readonly position = new Vector3();
  private readonly rotation = new Vector3();
  private readonly scale = new Vector3();

  override evaluate (boundObject: object, context: FrameContext): void {
    const item = boundObject;

    if (!(item instanceof VFXItem)) {
      return;
    }
    const position = this.position.set(0, 0, 0);
    const rotation = this.rotation.set(0, 0, 0);
    const scale = this.scale.set(0, 0, 0);
    let positionWeight = 0;
    let rotationWeight = 0;
    let scaleWeight = 0;

    for (let i = 0; i < this.clipPlayables.length; i++) {
      const weight = this.clipWeights[i];

      if (!(weight > 0)) {
        continue;
      }
      const playable = this.clipPlayables[i];

      if (!(playable instanceof TransformPlayable)) {
        continue;
      }

      const contribution = playable.getContribution();

      if (!(contribution.hasPosition || contribution.hasRotation || contribution.hasScale)) {
        continue;
      }
      if (!this.initialTransform) {
        const initialRotation = item.transform.getRotation();

        this.initialTransform = {
          position: item.transform.position.clone(),
          rotation: new Vector3(initialRotation.x, initialRotation.y, initialRotation.z),
          scale: item.transform.scale.clone(),
        };
      }
      if (contribution.hasPosition) {
        this.hasPosition = true;
        positionWeight += weight;
        position.addScaledVector(contribution.position, weight);
      }
      if (contribution.hasRotation) {
        this.hasRotation = true;
        rotationWeight += weight;
        rotation.x += contribution.rotation.x * weight;
        rotation.y += contribution.rotation.y * weight;
        rotation.z += contribution.rotation.z * weight;
      }
      if (contribution.hasScale) {
        this.hasScale = true;
        scaleWeight += weight;
        scale.addScaledVector(contribution.scale, weight);
      }
    }

    const initial = this.initialTransform;

    if (!initial) {
      return;
    }
    // Keep unrelated attributes untouched; animated attributes fall back at zero weight.
    if (this.hasPosition) {
      position.addScaledVector(initial.position, Math.max(0, 1 - positionWeight)).scale(1 / Math.max(1, positionWeight));
      item.transform.setPosition(position.x, position.y, position.z);
    }
    if (this.hasRotation) {
      rotation.addScaledVector(initial.rotation, Math.max(0, 1 - rotationWeight)).scale(1 / Math.max(1, rotationWeight));
      item.transform.setRotation(rotation.x, rotation.y, rotation.z);
    }
    if (this.hasScale) {
      scale.addScaledVector(initial.scale, Math.max(0, 1 - scaleWeight)).scale(1 / Math.max(1, scaleWeight));
      item.transform.setScale(scale.x, scale.y, scale.z);
    }
  }
}
