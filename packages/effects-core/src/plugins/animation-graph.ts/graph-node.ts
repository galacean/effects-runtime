import type { GraphContext } from './graph-context';
import type { PoseResult } from './pose-result';

export class GraphNode {
}

export abstract class PoseNode extends GraphNode {
  abstract evaluate (context: GraphContext, result: PoseResult): PoseResult;
}

export abstract class ValueNode extends GraphNode {

}