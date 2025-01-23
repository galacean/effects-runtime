import type { GraphContext, InstantiationContext } from './graph-context';
import type { PoseResult } from './pose-result';

export class GraphNode {
  private initializationCount = 0;

  constructor () {
  }

  isInitialized (): boolean {
    return this.initializationCount > 0;
  }

  initialize (context: GraphContext) {
    if (this.isInitialized()) {
      this.initializationCount++;
    } else {
      this.initializeInternal(context);
    }
  }

  protected initializeInternal (context: GraphContext) {
    this.initializationCount++;
  }
}

export interface GraphNodeAssetData {
  type: string,
  index: number,
}

export class GraphNodeAsset {
  index: number;

  instantiate (context: InstantiationContext) {
    // OVERRIDE
  }

  load (data: GraphNodeAssetData) {
    this.index = data.index;
  }

  protected createNode<T extends GraphNode> (nodeType: new () => T, context: InstantiationContext) {
    const node = new nodeType();

    context.nodes[this.index] = node;

    return node;
  }
}

export abstract class PoseNode extends GraphNode {
  abstract evaluate (context: GraphContext, result: PoseResult): PoseResult;
}

export abstract class ValueNode extends GraphNode {

  setValue <T>(value: T) {
    // OVERRIDE
  }

  abstract getValue<T>(): T;
}

export abstract class FloatValueNode extends ValueNode {

}

export abstract class BoolValueNode extends ValueNode {

}