import { Transform, ItemBehaviour, spec } from '@galacean/effects';
import type { TimelineComponent, VFXItemContent, Engine, Deserializer, SceneData, VFXItemProps, VFXItem } from '@galacean/effects';
import type { ModelTreeOptions, ModelTreeContent } from '../index';
import { PAnimationManager } from '../runtime';
import { getSceneManager } from './model-plugin';

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

  constructor (props: ModelTreeOptions, owner: VFXItem<VFXItemContent>) {
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

/**
 * @since 2.0.0
 * @internal
 */
export class ModelTreeComponent extends ItemBehaviour {
  content: ModelTreeItem;
  options?: ModelTreeContent;
  timeline?: TimelineComponent;

  constructor (engine: Engine, options?: ModelTreeContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  override fromData (options: ModelTreeContent): void {
    super.fromData(options);

    this.options = options;
  }

  override start () {
    this.createContent();
    this.item.type = spec.ItemType.tree;
    this.content.baseTransform.setValid(true);
    const sceneManager = getSceneManager(this);

    if (sceneManager) {
      this.content.animationManager.setSceneManager(sceneManager);
    }
  }

  override update (dt: number): void {
    // this.timeline?.getRenderData(time, true);
    // TODO: 需要使用lifetime
    this.content?.tick(dt);
  }

  override onDestroy (): void {
    this.content?.dispose();
  }

  createContent () {
    if (this.options) {
      const treeOptions = this.options.options.tree;

      this.content = new ModelTreeItem(treeOptions, this.item);
    }
  }

  getNodeTransform (itemId: string): Transform {
    if (this.content === undefined) {
      return this.transform;
    }

    const idWithSubfix = this.item.id + '^';

    if (itemId.indexOf(idWithSubfix) === 0) {
      const nodeId = itemId.substring(idWithSubfix.length);

      return this.content.getNodeTransform(nodeId);
    } else {
      return this.transform;
    }
  }
}
