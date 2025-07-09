import * as spec from '@galacean/effects-specification';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { BoolValueNode, FloatValueNode, GraphNodeData } from '../graph-node';
import { nodeDataClass } from '../node-asset-type';

@nodeDataClass(spec.NodeDataType.ConstFloatNodeData)
export class ConstFloatNodeData extends GraphNodeData {
  value = 0;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ConstFloatNode, context);

    node.value = this.value;
  }

  override load (data: spec.ConstFloatNodeData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ConstFloatNode extends FloatValueNode {
  value = 0;

  override getValue<T> (context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }
}

@nodeDataClass(spec.NodeDataType.ConstBoolNodeData)
export class ConstBoolNodeData extends GraphNodeData {
  value = true;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ConstBoolNode, context);

    node.value = this.value;
  }

  override load (data: spec.ConstBoolNodeData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ConstBoolNode extends BoolValueNode {
  value = true;

  override getValue<T> (context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }
}
