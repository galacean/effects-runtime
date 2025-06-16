import { Pose } from './pose';
import type { Skeleton } from './reference-pose';

export class PoseResult {
  pose: Pose;

  constructor (skeleton: Skeleton) {
    this.pose = new Pose(skeleton);
  }
}