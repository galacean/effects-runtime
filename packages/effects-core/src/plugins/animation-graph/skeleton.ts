import type { Color } from '@galacean/effects-math/es/core/color';
import type { VFXItem } from '../../vfx-item';
import type { Transform } from '../../transform';
import { NodeTransform } from './pose';
import type { Constructor } from '../../utils';
import type { Component } from '../../components';
import { getClass } from '../../decorators';
import type { ColorAnimationCurve, FloatAnimationCurve } from '../../animation/animation-clip';

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
  propertyPath: string,
  propertyName: string,
  target: Record<string, any>,
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

  private addReferenceTransform (itemPath: string) {
    if (this.pathToBoneIndex.get(itemPath)) {
      return;
    }
    const targetBone = this.findTarget(itemPath);

    if (!targetBone) {
      return;
    }

    this.parentSpaceTransforms.push(new NodeTransform(targetBone.transform));
    this.animatedTransforms.push(targetBone.transform);
    this.pathToBoneIndex.set(itemPath, this.parentSpaceTransforms.length - 1);
  }

  private addRecordedProperty (itemPath: string, className: string, propertyPath: string, type: AnimatedPropertyType) {
    const totalPath = itemPath + className + propertyPath;

    if (this.pathToObjectIndex.get(totalPath) !== undefined) {
      return;
    }

    const targetBone = this.findTarget(itemPath);

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
    const propertyPathSegments = propertyPath.split('.');
    const lastPropertyName = propertyPathSegments[propertyPathSegments.length - 1];
    let directTarget: Record<string, any> = animatedComponentOrItem;

    for (let i = 0; i < propertyPathSegments.length - 1; i++) {
      const property = directTarget[propertyPathSegments[i]];

      if (property === undefined) {
        console.error(`The ${propertyPathSegments[i]} property of ${directTarget} was not found.`);
      }
      directTarget = property;
    }

    const animatedObject: AnimatedObject = {
      target: animatedComponentOrItem,
      propertyPath: propertyPath,
      directTarget: directTarget,
      propertyName: lastPropertyName,
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
