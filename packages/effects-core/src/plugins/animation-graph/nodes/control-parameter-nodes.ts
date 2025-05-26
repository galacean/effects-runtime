import type { GraphNodeAssetData } from '../..';
import { NodeAssetType } from '../..';
import { FloatValueNode, GraphNodeAsset, nodeDataClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';

export interface ControlParameterFloatNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ControlParameterFloatNodeAsset,
  value: number,
}

export interface ControlParameterBoolNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ControlParameterBoolNodeAsset,
  value: boolean,
}

@nodeDataClass(NodeAssetType.ControlParameterFloatNodeAsset)
export class ControlParameterFloatNodeAsset extends GraphNodeAsset {
  value = 0;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ControlParameterFloatNode, context);

    node.setValue(this.value);
  }

  override load (data: ControlParameterFloatNodeAssetData): void {
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

@nodeDataClass(NodeAssetType.ControlParameterBoolNodeAsset)
export class ControlParameterBoolNodeAsset extends GraphNodeAsset {
  private value = false;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ControlParameterBoolNode, context);

    node.setValue(this.value);
  }

  override load (data: ControlParameterBoolNodeAssetData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ControlParameterBoolNode extends FloatValueNode {
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