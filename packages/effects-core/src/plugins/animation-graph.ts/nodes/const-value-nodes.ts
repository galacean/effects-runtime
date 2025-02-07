import { NodeAssetType, nodeAssetClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';
import type { GraphNodeAssetData } from '../graph-node';
import { FloatValueNode, GraphNodeAsset } from '../graph-node';

export interface ConstFloatNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ConstFloatNodeAsset,
  value: number,
}

@nodeAssetClass(NodeAssetType.ConstFloatNodeAsset)
export class ConstFloatNodeAsset extends GraphNodeAsset {
  value = 0;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(ConstFloatNode, context);

    node.value = this.value;
  }

  override load (data: ConstFloatNodeAssetData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ConstFloatNode extends FloatValueNode {
  value = 0;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
    }

    return this.value as T;
  }
}