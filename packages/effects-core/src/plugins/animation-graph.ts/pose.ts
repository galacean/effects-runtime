import { Euler } from '@galacean/effects-math/es/core/euler';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import type { Transform } from '../../transform';
import type { VFXItem } from '../../vfx-item';

export class PoseTransform {
  position = new Vector3();
  rotation = new Quaternion();
  scale = new Vector3();
  euler = new Euler();
}

export class Pose {
  parentSpaceTransforms: PoseTransform[] = [];
  pathToBoneIndex = new Map<string, number>();

  constructor (rootBone: VFXItem) {
    this.buildParentSpaceTransformsWithRoot(rootBone);
  }

  setPosition (path: string, position: Vector3) {
    const boneIndex = this.pathToBoneIndex.get(path);

    if (boneIndex) {
      this.parentSpaceTransforms[boneIndex].position.copyFrom(position);
    }
  }

  setRotation (path: string, rotation: Quaternion) {
    const boneIndex = this.pathToBoneIndex.get(path);

    if (boneIndex) {
      this.parentSpaceTransforms[boneIndex].rotation.copyFrom(rotation);
    }
  }

  setEuler (path: string, euler: Euler) {
    const boneIndex = this.pathToBoneIndex.get(path);

    if (boneIndex) {
      this.parentSpaceTransforms[boneIndex].euler.copyFrom(euler);
    }
  }

  setScale (path: string, scale: Vector3) {
    const boneIndex = this.pathToBoneIndex.get(path);

    if (boneIndex) {
      this.parentSpaceTransforms[boneIndex].scale.copyFrom(scale);
    }
  }

  getTransform (path: string): PoseTransform | null {
    const boneIndex = this.pathToBoneIndex.get(path);

    if (boneIndex) {
      return this.parentSpaceTransforms[boneIndex];
    }

    return null;
  }

  private copyReferenceTranform (sourceTransform: Transform, targetPoseTransform: PoseTransform) {
    targetPoseTransform.position.copyFrom(sourceTransform.position);
    targetPoseTransform.euler.copyFrom(sourceTransform.rotation);
    targetPoseTransform.rotation.copyFrom(sourceTransform.quat);
    targetPoseTransform.scale.copyFrom(sourceTransform.scale);
  }

  private addBoneTransform (path: string, sourceTransform: Transform) {
    const poseTransform = new PoseTransform();

    this.copyReferenceTranform(sourceTransform, poseTransform);
    this.parentSpaceTransforms.push(poseTransform);
    this.pathToBoneIndex.set(path, this.parentSpaceTransforms.length - 1);
  }

  private buildParentSpaceTransformsWithRoot (rootBone: VFXItem) {
    const path = '';

    this.addBoneTransform(path, rootBone.transform);

    for (const child of rootBone.children) {
      this.buildParentSpaceTransforms(child, path);
    }
  }

  private buildParentSpaceTransforms (bone: VFXItem, path: string) {
    path = path + bone.name;

    this.addBoneTransform(path, bone.transform);

    for (const child of bone.children) {
      this.buildParentSpaceTransforms(child, path + '/');
    }
  }
}