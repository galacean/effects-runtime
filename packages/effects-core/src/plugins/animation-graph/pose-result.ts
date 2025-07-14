import { Pose, PoseInitialType } from './pose';
import type { Skeleton } from './skeleton';

export class PoseResult {
  pose: Pose;

  constructor (skeleton: Skeleton, initialType: PoseInitialType = PoseInitialType.ReferencePose) {
    this.pose = new Pose(skeleton, initialType);
  }
}