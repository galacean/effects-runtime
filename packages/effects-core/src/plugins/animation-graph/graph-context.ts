import type { GraphNode, GraphNodeData } from '..';
import type { GraphDataSet } from './graph-data-set';
import type { Skeleton } from './skeleton';

// Used to signify if a node or node output is coming from an active state (i.e. a state we are not transitioning away from)
export enum BranchState
  {
  Active,
  Inactive,
}

export class GraphContext {
  deltaTime = 0;
  updateID = 0;
  skeleton: Skeleton;
  branchState = BranchState.Active;

  update (deltaTime: number) {
    this.deltaTime = deltaTime;
    this.updateID++;
    this.branchState = BranchState.Active;
  }
}

export class InstantiationContext {
  nodeDatas: GraphNodeData[] = [];
  nodes: GraphNode[] = [];
  dataSet: GraphDataSet;

  getNode <T extends GraphNode>(index: number): T {
    if (this.nodes[index]) {
      return this.nodes[index] as T;
    }
    if (!this.nodeDatas[index]) {
      return null as unknown as T;
    }
    this.nodeDatas[index].instantiate(this);
    this.nodes[index].asset = this.nodeDatas[index];

    return this.nodes[index] as T;
  }
}