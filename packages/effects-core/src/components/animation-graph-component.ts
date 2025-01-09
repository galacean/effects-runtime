import type { GraphInstance } from '../plugins/animation-graph.ts';
import { Component } from './component.js';

export class AnimationGraphComponent extends Component {
  graph: GraphInstance | null = null;

  override onStart (): void {
  }

  override onUpdate (dt: number): void {
    if (!this.graph) {
      return;
    }

    const result = this.graph.evaluateGraph(dt / 1000);

    for (const boneName of result.pose.pathToBoneIndex) {
      const position = result.pose.parentSpaceTransforms[boneName[1]].position;
      const rotation = result.pose.parentSpaceTransforms[boneName[1]].euler;
      const scale = result.pose.parentSpaceTransforms[boneName[1]].scale;

      // TODO cache boneIndex to improve searching performance
      const targetItem = this.findTarget(boneName[0]);

      if (targetItem) {
        targetItem.transform.setPosition(position.x, position.y, position.z);
        targetItem.transform.setRotation(rotation.x, rotation.y, rotation.z);
        targetItem.transform.setScale(scale.x, scale.y, scale.z);
      }
    }
  }

  findTarget (boneName: string) {
    if (boneName === '') {
      return this.item;
    }

    const itemNames = boneName.split('/');
    let currentItem = this.item;

    for (const itemName of itemNames) {
      const target = currentItem.find(itemName);

      if (!target) {
        return null;
      }

      currentItem = target;
    }

    return currentItem;
  }
}