import type { GraphNodeAssetData } from '../..';
import { NodeAssetType } from '../..';
import { FloatValueNode, GraphNodeAsset, nodeAssetClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';

export interface ControlParameterFloatNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ControlParameterFloatNodeAsset,
  value: number,
}

export interface ControlParameterBoolNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ControlParameterBoolNodeAsset,
  value: boolean,
}

@nodeAssetClass(NodeAssetType.ControlParameterFloatNodeAsset)
export class ControlParameterFloatNodeAsset extends GraphNodeAsset {
  value = 0;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ControlParameterFloatNode, context);

    node.value = this.value;
  }

  override load (data: ControlParameterFloatNodeAssetData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ControlParameterFloatNode extends FloatValueNode {
  value = 0;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }
}

@nodeAssetClass(NodeAssetType.ControlParameterBoolNodeAsset)
export class ControlParameterBoolNodeAsset extends GraphNodeAsset {
  value = false;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ControlParameterBoolNode, context);

    node.value = this.value;
  }

  override load (data: ControlParameterBoolNodeAssetData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ControlParameterBoolNode extends FloatValueNode {
  value = false;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }
}