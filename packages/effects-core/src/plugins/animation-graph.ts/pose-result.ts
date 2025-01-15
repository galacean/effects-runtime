import { Pose } from './pose';
import type { Skeleton } from './skeleton';

export class PoseResult {
  pose: Pose;

  constructor (skeleton: Skeleton) {
    this.pose = new Pose(skeleton);
  }
}