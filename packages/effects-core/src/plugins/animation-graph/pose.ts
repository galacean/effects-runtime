import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Skeleton } from './skeleton';
import type { Transform } from '../../transform';
import type { Color } from '@galacean/effects-math/es/core/color';

export class NodeTransform {
  position = new Vector3();
  rotation = new Quaternion();
  scale = new Vector3();
  euler = new Vector3();

  constructor (transform?: Transform) {
    if (transform) {
      this.position.copyFrom(transform.position);
      this.rotation.copyFrom(transform.quat);
      this.scale.copyFrom(transform.scale);
      this.euler.copyFrom(transform.rotation);
    }
  }

  copyFrom (transform: NodeTransform) {
    this.position.copyFrom(transform.position);
    this.rotation.copyFrom(transform.rotation);
    this.scale.copyFrom(transform.scale);
    this.euler.copyFrom(transform.euler);

    return this;
  }
}

export class Pose {
  skeleton: Skeleton;
  parentSpaceTransforms: NodeTransform[] = [];
  floatPropertyValues: number[] = [];
  colorPropertyValues: Color[] = [];

  constructor (skeleton: Skeleton) {
    this.skeleton = skeleton;

    for (const transform of skeleton.parentSpaceTransforms) {
      this.parentSpaceTransforms.push(new NodeTransform().copyFrom(transform));
    }

    for (const defaultFloat of skeleton.defaultFloatPropertyValues) {
      this.floatPropertyValues.push(defaultFloat);
    }

    for (const defaultColor of skeleton.defaultColorPropertyValues) {
      this.colorPropertyValues.push(defaultColor);
    }
  }

  setPosition (path: string, position: Vector3) {
    const boneIndex = this.skeleton.pathToBoneIndex.get(path);

    if (boneIndex !== undefined) {
      this.parentSpaceTransforms[boneIndex].position.copyFrom(position);
    }
  }

  setRotation (path: string, rotation: Quaternion) {
    const boneIndex = this.skeleton.pathToBoneIndex.get(path);

    if (boneIndex !== undefined) {
      this.parentSpaceTransforms[boneIndex].rotation.copyFrom(rotation);
    }
  }

  setEuler (path: string, euler: Vector3) {
    const boneIndex = this.skeleton.pathToBoneIndex.get(path);

    if (boneIndex !== undefined) {
      this.parentSpaceTransforms[boneIndex].euler.copyFrom(euler);
    }
  }

  setScale (path: string, scale: Vector3) {
    const boneIndex = this.skeleton.pathToBoneIndex.get(path);

    if (boneIndex !== undefined) {
      this.parentSpaceTransforms[boneIndex].scale.copyFrom(scale);
    }
  }

  setFloat (path: string, value: number) {
    const animatedObjectIndex = this.skeleton.pathToObjectIndex.get(path);

    if (animatedObjectIndex !== undefined) {
      this.floatPropertyValues[animatedObjectIndex] = value;
    }
  }
}