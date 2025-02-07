import type { GraphNodeAssetData } from '../..';
import { NodeAssetType } from '../..';
import { FloatValueNode, GraphNodeAsset, nodeAssetClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';

export interface ControlParameterFloatNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ControlParameterFloatNodeAsset,
  value: number,
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