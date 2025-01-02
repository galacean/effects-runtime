import { GraphInstance } from '../plugins/animation-graph.ts';
import { Component } from './component.js';

export class AnimationGraphComponent extends Component {
  graph = new GraphInstance();

  override onUpdate (dt: number): void {
    const result = this.graph.evaluateGraph(dt / 1000);

    const position = result.pose.parentSpaceTransforms[''].position.scale(10);

    this.transform.setPosition(position.x, position.y, position.z);
  }
}