import type * as spec from '@galacean/effects-specification';
import type { AnimationGraphAsset } from '../plugins/animation-graph';
import { GraphInstance } from '../plugins/animation-graph';
import type { Transform } from '../transform.js';
import { Component } from './component.js';
import { effectsClass } from '../decorators';

export interface AnimatorData extends spec.ComponentData {
  graphAsset: spec.DataPath,
}

@effectsClass('Animator')
export class Animator extends Component {
  /**
   * @internal
   */
  graph: GraphInstance | null = null;
  private graphAsset: AnimationGraphAsset | null = null;

  override onStart (): void {
    if (this.graphAsset) {
      this.graph = new GraphInstance(this.graphAsset, this.item);
    }
  }

  override onUpdate (dt: number): void {
    if (!this.graph) {
      return;
    }

    const result = this.graph.evaluateGraph(dt / 1000);

    let animatedTransforms: Transform[];

    animatedTransforms = this.graph.referencePose.positionTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const position = result.pose.parentSpaceReferencePosition[i];

      animatedTransforms[i].setPosition(position.x, position.y, position.z);
    }

    animatedTransforms = this.graph.referencePose.rotationTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const rotation = result.pose.parentSpaceReferenceRotation[i];

      animatedTransforms[i].setQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    }

    animatedTransforms = this.graph.referencePose.scaleTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const scale = result.pose.parentSpaceReferenceScale[i];

      animatedTransforms[i].setScale(scale.x, scale.y, scale.z);
    }

    animatedTransforms = this.graph.referencePose.eulerTransformBindings;
    for (let i = 0;i < animatedTransforms.length;i++) {
      const euler = result.pose.parentSpaceReferenceEuler[i];

      animatedTransforms[i].setRotation(euler.x, euler.y, euler.z);
    }

    // TODO float curves
  }

  override fromData (data: AnimatorData): void {
    this.graphAsset = this.engine.findObject<AnimationGraphAsset>(data.graphAsset);
  }
}