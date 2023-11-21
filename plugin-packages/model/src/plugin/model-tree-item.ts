import { Transform } from '@galacean/effects';
import { PAnimationManager } from '../runtime';
import type { ModelTreeVFXItem } from './model-tree-vfx-item';
import type { ModelTreeOptions } from '../index';

export interface ModelTreeNode {
  name?: string,
  transform: Transform,
  children: ModelTreeNode[],
  id: string,
  tree: ModelTreeItem,
}

export class ModelTreeItem {
  private allNodes: ModelTreeNode[];
  private nodes: ModelTreeNode[];
  private cacheMap: Record<string, ModelTreeNode>;
  readonly baseTransform: Transform;
  animationManager: PAnimationManager;

  constructor (props: ModelTreeOptions, owner: ModelTreeVFXItem) {
    this.baseTransform = owner.transform;
    this.animationManager = new PAnimationManager(props, owner);
    this.build(props);
  }

  tick (dt: number) {
    this.animationManager.tick(dt);
  }

  getNodes () {
    return this.nodes;
  }

  getNodeById (nodeId: string | number): ModelTreeNode | undefined {
    const cache = this.cacheMap;

    if (!cache[nodeId]) {
      const index = `^${nodeId}`;

      // @ts-expect-error
      cache[nodeId] = this.allNodes.find(node => node.id === index);
    }

    return cache[nodeId];
  }

  getNodeByName (name: string): ModelTreeNode | undefined {
    const cache = this.cacheMap;

    if (!cache[name]) {
      // @ts-expect-error
      cache[name] = this.allNodes.find(node => node.name === name);
    }

    return cache[name];
  }

  /**
   * if node id not found,use tree.transform
   * @param nodeId
   */
  getNodeTransform (nodeId: string): Transform {
    const node = this.getNodeById(nodeId);

    return node ? node.transform : this.baseTransform;
  }

  dispose () {
    this.allNodes = [];
    this.nodes = [];
    this.cacheMap = {};
    // @ts-expect-error
    this.baseTransform = null;
    this.animationManager?.dispose();
    // @ts-expect-error
    this.animationManager = null;
  }

  private build (options: ModelTreeOptions) {
    const topTransform = this.baseTransform;
    const nodes: ModelTreeNode[] = options.nodes.map((node, i) => ({
      name: node.name || node.id || (i + ''),
      transform: new Transform({
        ...node.transform,
        valid: true,
      }, topTransform),
      id: `^${node.id || i}`,
      children: [],
      tree: this,
    }));

    this.cacheMap = {};
    nodes.forEach((node, i) => {
      const children = options.nodes[i].children;

      // @ts-expect-error
      node.transform.name = node.name;
      node.transform.setValid(true);
      if (children) {
        children.forEach(function (index) {
          const child = nodes[index];

          if (child && child !== node) {
            if (child.transform.parentTransform !== topTransform) {
              console.error('Node parent has been set.');
            }
            child.transform.parentTransform = node.transform;
            node.children.push(child);
          }
        });
      }
    });
    this.allNodes = nodes;
    this.nodes = options.children.map(i => nodes[i]);
  }
}
