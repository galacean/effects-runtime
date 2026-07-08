import type * as spec from '@galacean/effects-specification';
import type { AnimationGraphAsset, StateMachineNode } from '../plugins/animation-graph';
import { GraphInstance } from '../plugins/animation-graph';
import type { PoseResult } from '../plugins/animation-graph/pose-result';
import type { AnimationGraphRuntimeTimeComponent } from '../plugins/animation-graph/runtime-time-component';
import { VFXItem } from '../vfx-item';
import { Component } from './component.js';
import { effectsClass } from '../decorators';

/**
 * @since 2.6.0
 */
@effectsClass('Animator')
export class Animator extends Component {
  /**
   * @internal
   */
  graphInstance: GraphInstance | null = null;
  private graphAsset: AnimationGraphAsset | null = null;
  private animationGraphTimedItems = new Set<VFXItem>();

  /**
   * 设置布尔类型参数
   * @param name - 参数名
   * @param value - 参数值
   * @since 2.7.0
   */
  setBool (name: string, value: boolean) {
    if (this.graphInstance) {
      this.graphInstance.setBool(name, value);
    }
  }

  /**
   * 设置浮点类型参数
   * @param name - 参数名
   * @param value - 参数值
   * @since 2.7.0
   */
  setFloat (name: string, value: number) {
    if (this.graphInstance) {
      this.graphInstance.setFloat(name, value);
    }
  }

  /**
   * 设置触发器参数
   * @since 2.7.0
   * @param name - 参数名
   */
  setTrigger (name: string) {
    if (this.graphInstance) {
      this.graphInstance.setTrigger(name);
    }
  }

  /**
   * 重置触发器参数
   * @since 2.7.0
   * @param name - 参数名
   */
  resetTrigger (name: string) {
    if (this.graphInstance) {
      this.graphInstance.resetTrigger(name);
    }
  }

  /**
   * 获取状态机节点
   * @param machineName - 状态机名称
   * @since 2.7.0
   * @returns 状态机节点
   */
  getStateMachineNode (machineName: string): StateMachineNode | null {
    let result: StateMachineNode | null = null;

    if (this.graphInstance) {
      result = this.graphInstance.getStateMachineNode(machineName);
    }

    return result;
  }

  override onStart (): void {
    if (this.graphAsset) {
      this.graphInstance = new GraphInstance(this.graphAsset, this.item);
    }
  }

  override onUpdate (dt: number): void {
    if (!this.graphInstance) {
      return;
    }

    const deltaTime = dt / 1000;
    const result = this.graphInstance.evaluateGraph(deltaTime);

    this.applyItemTimeRecords(result);

    // Apply transform animation
    //-------------------------------------------------------------------------
    const animatedTransforms = this.graphInstance.skeleton.animatedTransforms;

    for (let i = 0; i < animatedTransforms.length; i++) {
      const position = result.pose.parentSpaceTransforms[i].position;
      const rotation = result.pose.parentSpaceTransforms[i].rotation;
      const scale = result.pose.parentSpaceTransforms[i].scale;
      const euler = result.pose.parentSpaceTransforms[i].euler;

      animatedTransforms[i].setPosition(position.x, position.y, position.z);
      animatedTransforms[i].setScale(scale.x, scale.y, scale.z);

      if (this.graphInstance.skeleton.useEuler) {
        animatedTransforms[i].setRotation(euler.x, euler.y, euler.z);
      } else {
        animatedTransforms[i].setQuaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    }

    // Apply property animation
    //-------------------------------------------------------------------------
    const floatAnimatedObjects = this.graphInstance.skeleton.floatAnimatedObjects;

    for (let i = 0; i < floatAnimatedObjects.length; i++) {
      const animatedObject = floatAnimatedObjects[i];
      const property = animatedObject.propertyName;

      animatedObject.directTarget[property] = result.pose.floatPropertyValues[i];

      if (animatedObject.target instanceof Component) {
        animatedObject.target.onApplyAnimationProperties();
      }
    }

    const colorAnimatedObjects = this.graphInstance.skeleton.colorAnimatedObjects;

    for (let i = 0; i < colorAnimatedObjects.length; i++) {
      const animatedObject = colorAnimatedObjects[i];
      const property = animatedObject.propertyName;

      animatedObject.directTarget[property] = result.pose.colorPropertyValues[i];

      if (animatedObject.target instanceof Component) {
        animatedObject.target.onApplyAnimationProperties();
      }
    }

    // Trigger animation events
    //-------------------------------------------------------------------------
    for (const eventReference of this.graphInstance.activeEvents) {
      const eventInfo = eventReference.data;
      const event = eventInfo.event;

      event.onEvent(this.item, eventReference);
    }
  }

  override onDisable (): void {
    super.onDisable();
    this.resetItemTimeRecords();
  }

  override onDestroy (): void {
    super.onDestroy();
    this.resetItemTimeRecords();
  }

  override fromData (data: spec.AnimatorData): void {
    this.graphAsset = this.engine.findObject<AnimationGraphAsset>(data.graphAsset);
  }

  private applyItemTimeRecords (result: PoseResult): void {
    if (!this.graphInstance) {
      return;
    }

    const activeTimedItems = new Set<VFXItem>();
    const records = result.pose.itemTimeRecords;
    const animatedObjects = this.graphInstance.skeleton.floatAnimatedObjects;

    for (const record of records) {
      if (!record || record.activeValue <= 0) {
        continue;
      }

      const animatedObject = animatedObjects[record.animatedObjectIndex];
      const item = animatedObject?.target;

      if (item instanceof VFXItem) {
        item.time = record.time;
        this.setRuntimeTime(item, record.duration, record.activeValue);
        activeTimedItems.add(item);
      }
    }

    for (const item of this.animationGraphTimedItems) {
      if (!activeTimedItems.has(item)) {
        this.clearRuntimeTime(item);
      }
    }

    this.animationGraphTimedItems = activeTimedItems;
  }

  private resetItemTimeRecords (): void {
    for (const item of this.animationGraphTimedItems) {
      this.clearRuntimeTime(item);
    }

    this.animationGraphTimedItems.clear();
  }

  private setRuntimeTime (item: VFXItem, duration: number, activeValue: number): void {
    for (const component of item.components) {
      if (this.isRuntimeTimeComponent(component)) {
        component.setAnimationGraphRuntimeTime(duration, activeValue);
      }
    }
  }

  private clearRuntimeTime (item: VFXItem): void {
    for (const component of item.components) {
      if (this.isRuntimeTimeComponent(component)) {
        component.clearAnimationGraphRuntimeTime();
      }
    }
  }

  private isRuntimeTimeComponent (component: Component): component is Component & AnimationGraphRuntimeTimeComponent {
    const candidate = component as Partial<AnimationGraphRuntimeTimeComponent>;

    return (
      typeof candidate.setAnimationGraphRuntimeTime === 'function' &&
      typeof candidate.clearAnimationGraphRuntimeTime === 'function'
    );
  }
}
