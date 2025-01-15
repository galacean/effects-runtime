import { Euler } from '@galacean/effects-math/es/core/euler';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Skeleton } from './skeleton';

export class NodeTransform {
  position = new Vector3();
  rotation = new Quaternion();
  scale = new Vector3();
  euler = new Euler();
}

export class Pose {
  skeleton: Skeleton;

  parentSpaceReferencePosition: Vector3[] = [];
  parentSpaceReferenceScale: Vector3[] = [];
  parentSpaceReferenceRotation: Quaternion[] = [];
  parentSpaceReferenceEuler: Euler[] = [];

  constructor (skeleton: Skeleton) {
    this.skeleton = skeleton;

    for (const position of skeleton.parentSpaceReferencePosition) {
      this.parentSpaceReferencePosition.push(position.clone());
    }
    for (const rotation of skeleton.parentSpaceReferenceRotation) {
      this.parentSpaceReferenceRotation.push(rotation.clone());
    }
    for (const scale of skeleton.parentSpaceReferenceScale) {
      this.parentSpaceReferenceScale.push(scale.clone());
    }
    for (const euler of skeleton.parentSpaceReferenceEuler) {
      this.parentSpaceReferenceEuler.push(euler.clone());
    }
  }

  setPosition (path: string, position: Vector3) {
    const boneIndex = this.skeleton.pathToPositionIndex.get(path);

    if (boneIndex) {
      this.parentSpaceReferencePosition[boneIndex].copyFrom(position);
    }
  }

  setRotation (path: string, rotation: Quaternion) {
    const boneIndex = this.skeleton.pathToRotationIndex.get(path);

    if (boneIndex) {
      this.parentSpaceReferenceRotation[boneIndex].copyFrom(rotation);
    }
  }

  setEuler (path: string, euler: Euler) {
    const boneIndex = this.skeleton.pathToEulerIndex.get(path);

    if (boneIndex) {
      this.parentSpaceReferenceEuler[boneIndex].copyFrom(euler);
    }
  }

  setScale (path: string, scale: Vector3) {
    const boneIndex = this.skeleton.pathToScaleIndex.get(path);

    if (boneIndex) {
      this.parentSpaceReferenceScale[boneIndex].copyFrom(scale);
    }
  }
}