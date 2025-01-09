import type { VFXItem } from '../../vfx-item';
import { Pose } from './pose';

export class PoseResult {
  pose: Pose;

  constructor (rootBone: VFXItem) {
    this.pose = new Pose(rootBone);
  }
}