import type { GraphInstance } from '../plugins/animation-graph';
import type { Transform } from '../transform.js';
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

    let animatedTransforms: Transform[];

    animatedTransforms = this.graph.skeleton.positionTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const position = result.pose.parentSpaceReferencePosition[i];

      animatedTransforms[i].setPosition(position.x, position.y, position.z);
    }

    animatedTransforms = this.graph.skeleton.rotationTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const rotation = result.pose.parentSpaceReferenceRotation[i];

      animatedTransforms[i].setQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    }

    animatedTransforms = this.graph.skeleton.scaleTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const scale = result.pose.parentSpaceReferenceScale[i];

      animatedTransforms[i].setScale(scale.x, scale.y, scale.z);
    }

    animatedTransforms = this.graph.skeleton.eulerTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const euler = result.pose.parentSpaceReferenceEuler[i];

      animatedTransforms[i].setRotation(euler.x, euler.y, euler.z);
    }

    // TODO float curves
  }
}