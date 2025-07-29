import type { Color } from '@galacean/effects-math/es/core/color';
import type { VFXItem } from '../../vfx-item';
import type { Transform } from '../../transform';
import { NodeTransform } from './pose';
import type { Constructor } from '../../utils';
import type { Component } from '../../components';
import { getClass } from '../../decorators';
import type { ColorAnimationCurve, FloatAnimationCurve } from '../cal/calculate-vfx-item';

export interface AnimationRecordData {
  position: string[],
  scale: string[],
  rotation: string[],
  euler: string[],
  floats: FloatAnimationCurve[],
  colors: ColorAnimationCurve[],
}

export enum AnimatedPropertyType {
  Float,
  Color,
}

export interface AnimatedObject {
  target: Record<string, any>,
  targetPath: string[],
  directTargetPath: string,
  directTarget: Record<string, any>,
}

export const VFXItemType = 'VFXItem';

export class Skeleton {
  useEuler = false;

  pathToObjectIndex = new Map<string, number>();

  floatAnimatedObjects: AnimatedObject[] = [];
  defaultFloatPropertyValues: number[] = [];

  colorAnimatedObjects: AnimatedObject[] = [];
  defaultColorPropertyValues: Color[] = [];

  animatedTransforms: Transform[] = [];
  parentSpaceTransforms: NodeTransform[] = [];
  pathToBoneIndex = new Map<string, number>();

  constructor (
    public rootBone: VFXItem,
    recordedProperties: AnimationRecordData,
  ) {
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

    for (let i = 0; i < recordedProperties.floats.length; i++) {
      const floatRecords = recordedProperties.floats[i];

      this.addRecordedProperty(floatRecords.path, floatRecords.className, floatRecords.property, AnimatedPropertyType.Float);
    }

    for (let i = 0; i < recordedProperties.colors.length; i++) {
      const colorRecords = recordedProperties.colors[i];

      this.addRecordedProperty(colorRecords.path, colorRecords.className, colorRecords.property, AnimatedPropertyType.Color);
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

  private addRecordedProperty (path: string, className: string, property: string, type: AnimatedPropertyType) {
    const totalPath = path + className + property;

    if (this.pathToObjectIndex.get(totalPath) !== undefined) {
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
      console.error(`The ${className} Component was not found.`);
    }

    // Find last animated object by path
    const propertyNames = property.split('.');
    const lastPropertyName = propertyNames[propertyNames.length - 1];
    let directTarget: Record<string, any> = animatedComponentOrItem;

    for (let i = 0; i < propertyNames.length - 1; i++) {
      const property = directTarget[propertyNames[i]];

      if (property === undefined) {
        console.error(`The ${propertyNames[i]} property of ${directTarget} was not found.`);
      }
      directTarget = property;
    }

    const animatedObject: AnimatedObject = {
      target: animatedComponentOrItem,
      targetPath: propertyNames,
      directTarget: directTarget,
      directTargetPath: lastPropertyName,
    };

    switch (type) {
      case AnimatedPropertyType.Float:
        this.floatAnimatedObjects.push(animatedObject);
        this.defaultFloatPropertyValues.push(directTarget[lastPropertyName]);
        this.pathToObjectIndex.set(totalPath, this.floatAnimatedObjects.length - 1);

        break;
      case AnimatedPropertyType.Color:
        this.colorAnimatedObjects.push(animatedObject);
        this.defaultColorPropertyValues.push(directTarget[lastPropertyName]);
        this.pathToObjectIndex.set(totalPath, this.colorAnimatedObjects.length - 1);
    }
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
