import type { GraphNode, GraphNodeAsset } from '..';
import type { VFXItem } from '../../vfx-item';
import type { GraphDataSet } from './graph-data-set';

export class GraphContext {
  deltaTime = 0;
  rootBone: VFXItem;
}

export class InstantiationContext {
  nodeAsset: GraphNodeAsset[] = [];
  nodes: GraphNode[] = [];
  dataSet: GraphDataSet;

  getNode <T extends GraphNode>(index: number): T | null {
    if (this.nodes[index]) {
      return this.nodes[index] as T;
    }
    if (!this.nodeAsset[index]) {
      return null;
    }
    this.nodeAsset[index].instantiate(this);

    return this.nodes[index] as T;
  }

  createNode<T extends GraphNode> (nodeType: new () => T, nodeAsset: GraphNodeAsset) {
    const node = new nodeType();

    this.nodes[nodeAsset.index] = node;

    return node;
  }
}