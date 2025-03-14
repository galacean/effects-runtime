import type { Euler } from '@galacean/effects-math/es/core/euler';
import type { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { VFXItem } from '../../vfx-item';
import type { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import type { Transform } from '../../transform';

export interface AnimationRecordProperties {
  position: string[],
  scale: string[],
  rotation: string[],
  euler: string[],
  floats: FloatRecordProperty[],
}

export interface FloatRecordProperty {
  path: string,
  component: string,
  property: string,
}

export class ReferencePose {
  parentSpaceReferencePosition: Vector3[] = [];
  positionTransformBindings: Transform[] = [];
  pathToPositionIndex = new Map<string, number>();

  parentSpaceReferenceScale: Vector3[] = [];
  scaleTransformBindings: Transform[] = [];
  pathToScaleIndex = new Map<string, number>();

  parentSpaceReferenceRotation: Quaternion[] = [];
  rotationTransformBindings: Transform[] = [];
  pathToRotationIndex = new Map<string, number>();

  parentSpaceReferenceEuler: Euler[] = [];
  eulerTransformBindings: Transform[] = [];
  pathToEulerIndex = new Map<string, number>();

  referenceFloatPropertyValues: number[] = [];
  pathToFloatPropertyIndex = new Map<string, number>();

  rootBone: VFXItem;

  constructor (rootBone: VFXItem, recordProperties: AnimationRecordProperties) {
    this.rootBone = rootBone;
    for (const path of recordProperties.position) {
      this.addReferencePosition(path);
    }
    for (const path of recordProperties.rotation) {
      this.addReferenceRotation(path);
    }
    for (const path of recordProperties.scale) {
      this.addReferenceScale(path);
    }
    for (const path of recordProperties.euler) {
      this.addReferenceEuler(path);
    }

    // TODO float peoperties
    // for (const path of recordProperties.floats) {
    // }
  }

  private addReferencePosition (path: string) {
    if (this.pathToPositionIndex.get(path)) {
      return;
    }
    const targetBone = this.findTarget(path);

    if (!targetBone) {
      return;
    }

    const referencePosition = targetBone.transform.position;

    this.parentSpaceReferencePosition.push(referencePosition);
    this.positionTransformBindings.push(targetBone.transform);
    this.pathToPositionIndex.set(path, this.parentSpaceReferencePosition.length - 1);
  }

  private addReferenceRotation (path: string) {
    if (this.pathToRotationIndex.get(path)) {
      return;
    }
    const targetBone = this.findTarget(path);

    if (!targetBone) {
      return;
    }

    const referenceRotation = targetBone.transform.quat;

    this.parentSpaceReferenceRotation.push(referenceRotation);
    this.rotationTransformBindings.push(targetBone.transform);
    this.pathToRotationIndex.set(path, this.parentSpaceReferenceRotation.length - 1);
  }

  private addReferenceScale (path: string) {
    if (this.pathToScaleIndex.get(path)) {
      return;
    }
    const targetBone = this.findTarget(path);

    if (!targetBone) {
      return;
    }

    const referenceScale = targetBone.transform.scale;

    this.parentSpaceReferenceScale.push(referenceScale);
    this.scaleTransformBindings.push(targetBone.transform);
    this.pathToScaleIndex.set(path, this.parentSpaceReferenceScale.length - 1);
  }

  private addReferenceEuler (path: string) {
    if (this.pathToEulerIndex.get(path)) {
      return;
    }
    const targetBone = this.findTarget(path);

    if (!targetBone) {
      return;
    }

    const referenceEuler = targetBone.transform.rotation;

    this.parentSpaceReferenceEuler.push(referenceEuler);
    this.eulerTransformBindings.push(targetBone.transform);
    this.pathToEulerIndex.set(path, this.parentSpaceReferenceEuler.length - 1);
  }

  private findTarget (boneName: string) {
    if (boneName === '') {
      return this.rootBone;
    }

    const itemNames = boneName.split('/');
    let currentItem = this.rootBone;

    for (const itemName of itemNames) {
      const target = currentItem.find(itemName);

      if (!target) {
        return null;
      }

      currentItem = target;
    }

    return currentItem;
  }

}