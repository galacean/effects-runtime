import * as spec from '@galacean/effects-specification';
import type { InstantiationContext, GraphContext } from '../graph-context';
import { nodeDataClass } from '../node-asset-type';
import { BoolValueNode, GraphNodeData, InvalidIndex } from '../graph-node';

@nodeDataClass(spec.NodeDataType.AndNodeData)
export class AndNodeData extends GraphNodeData {
  private conditionNodeIndices: number[] = [];

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(AndNode, context);

    for (const conditionNodeIndex of this.conditionNodeIndices) {
      node.conditionNodes.push(context.getNode<BoolValueNode>(conditionNodeIndex));
    }
  }

  override load (data: spec.AndNodeData): void {
    super.load(data);
    this.conditionNodeIndices = data.conditionNodeIndices;
  }
}

export class AndNode extends BoolValueNode {
  conditionNodes: BoolValueNode[] = [];

  private result = false;

  override getValue<T> (context: GraphContext): T {
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

@nodeDataClass(spec.NodeDataType.OrNodeData)
export class OrNodeData extends GraphNodeData {
  private conditionNodeIndices: number[] = [];

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(OrNode, context);

    for (const conditionNodeIndex of this.conditionNodeIndices) {
      node.conditionNodes.push(context.getNode<BoolValueNode>(conditionNodeIndex));
    }
  }

  override load (data: spec.OrNodeAssetData): void {
    super.load(data);
    this.conditionNodeIndices = data.conditionNodeIndices;
  }
}

export class OrNode extends BoolValueNode {
  conditionNodes: BoolValueNode[] = [];

  private result = false;

  override getValue<T> (context: GraphContext): T {
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

@nodeDataClass(spec.NodeDataType.NotNodeData)
export class NotNodeData extends GraphNodeData {
  private inputValueNodeIndex = InvalidIndex;

  override instantiate (context: InstantiationContext) {
    const node = this.createNode(NotNode, context);

    node.inputValueNode = context.getNode<BoolValueNode>(this.inputValueNodeIndex);
  }

  override load (data: spec.NotNodeAssetData): void {
    super.load(data);
    this.inputValueNodeIndex = data.inputValueNodeIndex;
  }
}

export class NotNode extends BoolValueNode {
  inputValueNode: BoolValueNode | null = null;

  private result = false;

  override getValue<T> (context: GraphContext): T {
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
