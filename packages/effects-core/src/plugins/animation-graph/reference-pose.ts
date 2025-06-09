import type { VFXItem } from '../../vfx-item';
import type { Transform } from '../../transform';
import { NodeTransform } from './pose';
import type { Constructor } from '../../utils';
import type { Component } from '../../components';
import { getClass } from '../../decorators';

export interface AnimationRecordDatas {
  position: string[],
  scale: string[],
  rotation: string[],
  euler: string[],
  floats: FloatRecordData[],
}

export interface FloatRecordData {
  path: string,
  className: string,
  property: string,
}

export interface FloatAnimatedObject {
  target: Record<string, number>,
  property: string,
}

export const VFXItemType = 'VFXItem';

export class ReferencePose {
  floatAnimatedObjects: FloatAnimatedObject[] = [];
  defaultFloatPropertyValues: number[] = [];
  pathToObjectIndex = new Map<string, number>();

  rootBone: VFXItem;

  animatedTransforms: Transform[] = [];
  parentSpaceTransforms: NodeTransform[] = [];
  pathToBoneIndex = new Map<string, number>();

  useEuler = false;

  constructor (rootBone: VFXItem, recordedProperties: AnimationRecordDatas) {
    this.rootBone = rootBone;
    for (const path of recordedProperties.position) {
      this.addReferenceTransform(path);
    }
    for (const path of recordedProperties.rotation) {
      this.addReferenceTransform(path);
    }
    for (const path of recordedProperties.scale) {
      this.addReferenceTransform(path);
    }
    for (const path of recordedProperties.euler) {
      this.addReferenceTransform(path);
      this.useEuler = true;
    }

    for (let i = 0;i < recordedProperties.floats.length;i++) {
      const floatRecords = recordedProperties.floats[i];

      this.addFloatRecordedProperty(floatRecords.path, floatRecords.className, floatRecords.property);
    }
  }

  private addReferenceTransform (path: string) {
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

  private addFloatRecordedProperty (path: string, className: string, property: string) {
    const totalPath = path + className + property;

    if (this.pathToObjectIndex.get(totalPath)) {
      return;
    }

    const targetBone = this.findTarget(path);

    if (!targetBone) {
      return;
    }

    let animatedComponentOrItem: VFXItem | Component;

    // Find target component or VFXItem
    if (className === VFXItemType) {
      animatedComponentOrItem = targetBone;
    } else {
      animatedComponentOrItem = targetBone.getComponent(getClass(className) as Constructor<Component>);
    }

    if (!animatedComponentOrItem) {
      console.error('The ' + className + ' Component was not found');
    }

    // Find last animated object by path
    const propertyNames = property.split('.');
    const lastPropertyName = propertyNames[propertyNames.length - 1];
    let target: Record<string, any> = animatedComponentOrItem;

    for (let i = 0; i < propertyNames.length - 1; i++) {
      const property = target[propertyNames[i]];

      if (property === undefined) {
        console.error('The ' + propertyNames[i] + ' property of ' + target + ' was not found');
      }
      target = property;
    }

    const floatAnimatedObject: FloatAnimatedObject = {
      target: target,
      property: lastPropertyName,
    };

    this.floatAnimatedObjects.push(floatAnimatedObject);
    this.defaultFloatPropertyValues.push(target[lastPropertyName]);
    this.pathToObjectIndex.set(totalPath, this.floatAnimatedObjects.length - 1);
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