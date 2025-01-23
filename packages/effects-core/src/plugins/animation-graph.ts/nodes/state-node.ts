import { PoseNode } from '../..';
import type { GraphContext } from '../graph-context';
import type { PoseResult } from '../pose-result';

export class StateNode extends PoseNode {
  override evaluate (context: GraphContext, result: PoseResult): PoseResult {
    throw new Error('Method not implemented.');
  }

}