import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';

export class PoseTransform {
  position = new Vector3();
  rotation = new Quaternion();
  scale = new Vector3();
}

export class Pose {
  parentSpaceTransforms: Record<string, PoseTransform> = {};

  setPosition (path: string, position: Vector3) {
    this.checkTransform(path);

    this.parentSpaceTransforms[path].position.copyFrom(position);
  }

  setRotation (path: string, rotation: Quaternion) {
    this.checkTransform(path);

    this.parentSpaceTransforms[path].rotation.copyFrom(rotation);
  }

  setScale (path: string, scale: Vector3) {
    this.checkTransform(path);

    this.parentSpaceTransforms[path].scale.copyFrom(scale);
  }

  private checkTransform (path: string) {
    if (!this.parentSpaceTransforms[path]) {
      this.parentSpaceTransforms[path] = new PoseTransform();
    }
  }
}