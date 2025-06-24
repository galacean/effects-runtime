import type * as spec from '@galacean/effects-specification';
import type { AnimationGraphAsset } from '../plugins/animation-graph';
import { GraphInstance } from '../plugins/animation-graph';
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

  setBool (name: string, value: boolean) {
    if (this.graph) {
      this.graph.setBool(name, value);
    }
  }

  setFloat (name: string, value: number) {
    if (this.graph) {
      this.graph.setFloat(name, value);
    }
  }

  setTrigger (name: string) {
    if (this.graph) {
      this.graph.setTrigger(name);
    }
  }

  resetTrigger (name: string) {
    if (this.graph) {
      this.graph.resetTrigger(name);
    }
  }

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

    // Apply transform animation
    //-------------------------------------------------------------------------

    const animatedTransforms = this.graph.skeleton.animatedTransforms;

    for (let i = 0;i < animatedTransforms.length;i++) {
      const position = result.pose.parentSpaceTransforms[i].position;
      const rotation = result.pose.parentSpaceTransforms[i].rotation;
      const scale = result.pose.parentSpaceTransforms[i].scale;
      const euler = result.pose.parentSpaceTransforms[i].euler;

      animatedTransforms[i].setPosition(position.x, position.y, position.z);
      animatedTransforms[i].setScale(scale.x, scale.y, scale.z);

      if (this.graph.skeleton.useEuler) {
        animatedTransforms[i].setRotation(euler.x, euler.y, euler.z);
      } else {
        animatedTransforms[i].setQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    }

    // Apply property animation
    //-------------------------------------------------------------------------

    const floatAnimatedObjects = this.graph.skeleton.floatAnimatedObjects;

    for (let i = 0;i < floatAnimatedObjects.length;i++) {
      const animatedObject = floatAnimatedObjects[i];
      const property = animatedObject.property;

      animatedObject.target[property] = result.pose.floatPropertyValues[i];
    }

    const colorAnimatedObjects = this.graph.skeleton.colorAnimatedObjects;

    for (let i = 0;i < colorAnimatedObjects.length;i++) {
      const animatedObject = colorAnimatedObjects[i];
      const property = animatedObject.property;

      animatedObject.target[property] = result.pose.colorPropertyValues[i];
    }
  }

  override fromData (data: AnimatorData): void {
    this.graphAsset = this.engine.findObject<AnimationGraphAsset>(data.graphAsset);
  }
}
