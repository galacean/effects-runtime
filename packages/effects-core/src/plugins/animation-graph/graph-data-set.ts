import type { AnimationClip } from '../cal/calculate-vfx-item';

export class GraphDataSet {
  resources: AnimationClip[] = [];

  getResource (index: number): AnimationClip | null {
    return this.resources[index];
  }
}