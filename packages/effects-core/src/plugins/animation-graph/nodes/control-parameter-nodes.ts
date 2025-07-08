import * as spec from '@galacean/effects-specification';
import { BoolValueNode } from '../..';
import { FloatValueNode, GraphNodeData, nodeDataClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';

@nodeDataClass(spec.NodeDataType.ControlParameterFloatNodeData)
export class ControlParameterFloatNodeData extends GraphNodeData {
  value = 0;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ControlParameterFloatNode, context);

    node.setValue(this.value);
  }

  override load (data: spec.ControlParameterFloatNodeData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ControlParameterFloatNode extends FloatValueNode {
  private value = 0;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }

  override setValue<T>(value: T): void {
    this.value = value as number;
  }
}

@nodeDataClass(spec.NodeDataType.ControlParameterBoolNodeData)
export class ControlParameterBoolNodeData extends GraphNodeData {
  private value = false;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ControlParameterBoolNode, context);

    node.setValue(this.value);
  }

  override load (data: spec.ControlParameterBoolNodeData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ControlParameterBoolNode extends BoolValueNode {
  private value = false;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }

  override setValue<T>(value: T): void {
    this.value = value as boolean;
  }
}

@nodeDataClass(spec.NodeDataType.ControlParameterTriggerNodeData)
export class ControlParameterTriggerNodeData extends GraphNodeData {
  override instantiate (context: InstantiationContext) {
    this.createNode(ControlParameterTriggerNode, context);
  }

  override load (data: spec.ControlParameterTriggerNodeData): void {
    super.load(data);
  }
}

export class ControlParameterTriggerNode extends BoolValueNode {
  private value = false;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }

  override setValue<T>(value: T): void {
    this.value = value as boolean;
  }
}
