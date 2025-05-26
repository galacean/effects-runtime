import type { GraphNodeAssetData } from '../..';
import { NodeAssetType, nodeAssetClass, GraphNodeAsset, BoolValueNode, InvalidIndex } from '../..';
import type { InstantiationContext, GraphContext } from '../graph-context';

export interface AndNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.AndNodeAsset,
  conditionNodeIndices: number[],
}

@nodeAssetClass(NodeAssetType.AndNodeAsset)
export class AndNodeAsset extends GraphNodeAsset {
  private conditionNodeIndices: number[] = [];

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(AndNode, context);

    for (const conditionNodeIndex of this.conditionNodeIndices) {
      node.conditionNodes.push(context.getNode<BoolValueNode>(conditionNodeIndex));
    }
  }

  override load (data: AndNodeAssetData): void {
    super.load(data);
    this.conditionNodeIndices = data.conditionNodeIndices;
  }
}

export class AndNode extends BoolValueNode {
  conditionNodes: BoolValueNode[] = [];

  private result = false;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
      this.result = true;
      for (const condition of this.conditionNodes) {
        if (!condition.getValue<boolean>(context)) {
          this.result = false;

          break;
        }
      }
    }

    return this.result as T;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    for (const node of this.conditionNodes) {
      node.initialize(context);
    }

    this.result = false;
  }

  protected override shutdownInternal (context: GraphContext): void {
    for (const node of this.conditionNodes) {
      node.shutdown(context);
    }

    super.shutdownInternal(context);
  }
}

//-------------------------------------------------------------------------

export interface OrNodeAssetData extends GraphNodeAssetData {
  type: NodeAssetType.OrNodeAsset,
  conditionNodeIndices: number[],
}

@nodeAssetClass(NodeAssetType.OrNodeAsset)
export class OrNodeAsset extends GraphNodeAsset {
  private conditionNodeIndices: number[] = [];

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(OrNode, context);

    for (const conditionNodeIndex of this.conditionNodeIndices) {
      node.conditionNodes.push(context.getNode<BoolValueNode>(conditionNodeIndex));
    }
  }

  override load (data: OrNodeAssetData): void {
    super.load(data);
    this.conditionNodeIndices = data.conditionNodeIndices;
  }
}

export class OrNode extends BoolValueNode {
  conditionNodes: BoolValueNode[] = [];

  private result = false;

  override getValue<T>(context: GraphContext): T {
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
      this.result = false;
      for (const condition of this.conditionNodes) {
        if (condition.getValue<boolean>(context)) {
          this.result = true;

          break;
        }
      }
    }

    return this.result as T;
  }

  protected override initializeInternal (context: GraphContext): void {
    super.initializeInternal(context);

    for (const node of this.conditionNodes) {
      node.initialize(context);
    }

    this.result = false;
  }

  protected override shutdownInternal (context: GraphContext): void {
    for (const node of this.conditionNodes) {
      node.shutdown(context);
    }

    super.shutdownInternal(context);
  }
}

//-------------------------------------------------------------------------

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