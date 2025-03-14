import { Pose } from './pose';
import type { ReferencePose } from './reference-pose';

export class PoseResult {
  pose: Pose;

  constructor (referencePose: ReferencePose) {
    this.pose = new Pose(referencePose);
  }
}