import type { NodeAssetType } from '../..';
import type { InstantiationContext } from '../graph-context';
import type { GraphNodeAssetData } from '../graph-node';
import { FloatValueNode, GraphNodeAsset } from '../graph-node';

export interface ConstFloatNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.ConstFloatNodeAsset,
  value: number,
}

export class ConstFloatNodeAsset extends GraphNodeAsset {
  value = 0;

  override instantiate (context: InstantiationContext) {
    const node = context.createNode(ConstFloatNode, this);

    node.value = this.value;
  }

  override load (data: ConstFloatNodeAssetData): void {
    super.load(data);
    this.value = data.value;
  }
}

export class ConstFloatNode extends FloatValueNode {
  value = 0;

  override getValue<T>(): T {
    return this.value as T;
  }
}