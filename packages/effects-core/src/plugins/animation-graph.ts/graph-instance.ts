import { GraphContext } from './graph-context';
import type { PoseNode } from './graph-node';
import { PoseResult } from './pose-result';

export class GraphInstance {
  private rootNode: PoseNode;
  private context = new GraphContext();
  private result = new PoseResult();

  evaluateGraph () {
    this.result = this.rootNode.evaluate(this.context, this.result);
  }
}