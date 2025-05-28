import type { GraphNodeAssetData, ValueNode } from '../..';
import { NodeAssetType } from '../..';
import { BoolValueNode, GraphNodeAsset, InvalidIndex, nodeDataClass } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';

export interface EqualNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.EqualNodeAsset,
  inputValueNodeIndex: number,
  comparandValueNodeIndex: number,
}

@nodeDataClass(NodeAssetType.EqualNodeAsset)
export class EqualNodeAsset extends GraphNodeAsset {
  private inputValueNodeIndex = InvalidIndex;
  private comparandValueNodeIndex = InvalidIndex;

  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(EqualNode, context);

    node.inputValueNode = context.getNode<ValueNode>(this.inputValueNodeIndex);
    node.comparandValueNode = context.getNode<ValueNode>(this.comparandValueNodeIndex);
  }

  override load (data: EqualNodeAssetData): void {
    super.load(data);
    this.inputValueNodeIndex = data.inputValueNodeIndex;
    this.comparandValueNodeIndex = data.comparandValueNodeIndex;
  }
}

class EqualNode extends BoolValueNode {
  inputValueNode: ValueNode | null = null;
  comparandValueNode: ValueNode | null = null;

  private result = false;

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    if (this.inputValueNode) {
      this.inputValueNode.initialize(context);
    }

    if (this.comparandValueNode) {
      this.comparandValueNode.initialize(context);
    }
  }

  protected override shutdownInternal (context: GraphContext): void {
    if (this.inputValueNode) {
      this.inputValueNode.shutdown(context);
    }

    if (this.comparandValueNode) {
      this.comparandValueNode.shutdown(context);
    }

    super.shutdownInternal(context);
  }

  override getValue<T>(context: GraphContext): T {
    if (this.inputValueNode && this.comparandValueNode) {
      this.result = this.inputValueNode.getValue(context) === this.comparandValueNode.getValue(context);
    }

    return this.result as T;
  }
}