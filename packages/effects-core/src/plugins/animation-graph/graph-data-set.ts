import type { AnimationClip } from '../../animation/animation-clip';

export class GraphDataSet {
  resources: AnimationClip[] = [];

  getResource (index: number): AnimationClip | null {
    return this.resources[index];
  }
}