import type { VFXItem } from '../../vfx-item';
import type { Transform } from '../../transform';
import { NodeTransform } from './pose';

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
  referenceFloatPropertyValues: number[] = [];
  pathToFloatPropertyIndex = new Map<string, number>();

  rootBone: VFXItem;

  animatedTransforms: Transform[] = [];
  parentSpaceTransforms: NodeTransform[] = [];
  pathToBoneIndex = new Map<string, number>();

  useEuler = false;

  constructor (rootBone: VFXItem, recordProperties: AnimationRecordProperties) {
    this.rootBone = rootBone;
    for (const path of recordProperties.position) {
      this.addReferenceTransform(path);
    }
    for (const path of recordProperties.rotation) {
      this.addReferenceTransform(path);
    }
    for (const path of recordProperties.scale) {
      this.addReferenceTransform(path);
    }
    for (const path of recordProperties.euler) {
      this.addReferenceTransform(path);
      this.useEuler = true;
    }

    // TODO float peoperties
    // for (const path of recordProperties.floats) {
    // }
  }

  addReferenceTransform (path: string) {
    if (this.pathToBoneIndex.get(path)) {
      return;
    }
    const targetBone = this.findTarget(path);

    if (!targetBone) {
      return;
    }

    this.parentSpaceTransforms.push(new NodeTransform(targetBone.transform));
    this.animatedTransforms.push(targetBone.transform);
    this.pathToBoneIndex.set(path, this.parentSpaceTransforms.length - 1);
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