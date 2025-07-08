import type { FloatValueNode, ValueNode } from '../..';
import * as spec from '@galacean/effects-specification';
import { BoolValueNode, GraphNodeData, InvalidIndex } from '../..';
import type { GraphContext, InstantiationContext } from '../graph-context';
import { nodeDataClass } from '../node-asset-type';

@nodeDataClass(spec.NodeDataType.EqualNodeData)
export class EqualNodeData extends GraphNodeData {
  private inputValueNodeIndex = InvalidIndex;
  private comparandValueNodeIndex = InvalidIndex;

  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(EqualNode, context);

    node.inputValueNode = context.getNode<ValueNode>(this.inputValueNodeIndex);
    node.comparandValueNode = context.getNode<ValueNode>(this.comparandValueNodeIndex);
  }

  override load (data: spec.EqualNodeData): void {
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
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);
      if (this.inputValueNode && this.comparandValueNode) {
        const a = this.inputValueNode.getValue(context);
        const b = this.comparandValueNode.getValue(context);

        this.result = (a === b);
      }
    }

    return this.result as T;
  }
}

//-------------------------------------------------------------------------

export abstract class FloatComparisonNodeData extends GraphNodeData {
  protected inputValueNodeIndex = InvalidIndex;
  protected comparandValueNodeIndex = InvalidIndex;

  override load (data: spec.FloatComparisonNodeData): void {
    super.load(data);
    this.inputValueNodeIndex = data.inputValueNodeIndex;
    this.comparandValueNodeIndex = data.comparandValueNodeIndex;
  }
}

enum Comparison {
  GreaterThan,
  LessThan,
}

export class FloatComparisonNode extends BoolValueNode {
  inputValueNode: FloatValueNode | null = null;
  comparandValueNode: FloatValueNode | null = null;
  comparison = Comparison.GreaterThan;

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
    if (!this.isUpdated(context)) {
      this.markNodeActive(context);

      if (this.inputValueNode && this.comparandValueNode) {
        const a = this.inputValueNode.getValue<number>(context);
        const b = this.comparandValueNode.getValue<number>(context);

        switch (this.comparison) {
          case Comparison.GreaterThan:
            this.result = a > b;

            break;
          case Comparison.LessThan:
            this.result = a < b;

            break;
        }
      }
    }

    return this.result as T;
  }
}

//-------------------------------------------------------------------------

@nodeDataClass(spec.NodeDataType.GreaterNodeData)
export class GreaterNodeData extends FloatComparisonNodeData {
  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(FloatComparisonNode, context);

    node.comparison = Comparison.GreaterThan;
    node.inputValueNode = context.getNode<ValueNode>(this.inputValueNodeIndex);
    node.comparandValueNode = context.getNode<ValueNode>(this.comparandValueNodeIndex);
  }
}

//-------------------------------------------------------------------------

@nodeDataClass(spec.NodeDataType.LessNodeData)
export class LessNodeData extends FloatComparisonNodeData {
  override instantiate (context: InstantiationContext): void {
    const node = this.createNode(FloatComparisonNode, context);

    node.comparison = Comparison.LessThan;
    node.inputValueNode = context.getNode<ValueNode>(this.inputValueNodeIndex);
    node.comparandValueNode = context.getNode<ValueNode>(this.comparandValueNodeIndex);
  }
}
