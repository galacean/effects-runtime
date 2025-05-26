import type { GraphNodeAssetData } from '../..';
import { NodeAssetType, nodeAssetClass, GraphNodeAsset, BoolValueNode, InvalidIndex } from '../..';
import type { InstantiationContext, GraphContext } from '../graph-context';

export interface NotNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.NotNodeAsset,
  inputValueNodeIndex: number,
}

@nodeAssetClass(NodeAssetType.NotNodeAsset)
export class NotNodeAsset extends GraphNodeAsset {
  private inputValueNodeIndex = InvalidIndex;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(NotNode, context);

    node.inputValueNode = context.getNode<BoolValueNode>(this.inputValueNodeIndex);
  }

  override load (data: NotNodeAssetData): void {
    super.load(data);
    this.inputValueNodeIndex = data.inputValueNodeIndex;
  }
}

export class NotNode extends BoolValueNode {
  inputValueNode: BoolValueNode | null = null;

  private result = false;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
      if (this.inputValueNode) {
        this.result = !this.inputValueNode.getValue<boolean>(context);
      }
    }

    return this.result as T;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);
    this.inputValueNode?.initialize(context);
    this.result = false;
  }

  protected override shutdownInternal (context: GraphContext): void {
    this.inputValueNode?.shutdown(context);
    super.shutdownInternal(context);
  }
}