import { Transform, ItemBehaviour, spec, effectsClass } from '@galacean/effects';
import type { TimelineComponent, VFXItemContent, Engine, VFXItem } from '@galacean/effects';
import { type ModelTreeOptions, type ModelTreeContent } from '../index';
import { PAnimationManager } from '../runtime';
import { getSceneManager } from './model-plugin';
import { ModelDataType } from './model-item';

/**
 * 场景树节点描述
 */
export interface ModelTreeNode {
  /**
   * 名称
   */
  name?: string,
  /**
   * 变换
   */
  transform: Transform,
  /**
   * 子节点
   */
  children: ModelTreeNode[],
  /**
   * 索引
   */
  id: string,
  /**
   * 场景树元素
   */
  tree: ModelTreeItem,
}

/**
 * 场景树元素类，支持插件中节点树相关的动画能力
 */
export class ModelTreeItem {
  private allNodes: ModelTreeNode[];
  private nodes: ModelTreeNode[];
  private cacheMap: Record<string, ModelTreeNode>;
  /**
   * 基础变换
   */
  readonly baseTransform: Transform;
  /**
   * 动画管理器
   */
  animationManager: PAnimationManager;

  /**
   * 构造函数，创建场景树结构
   * @param props - 场景树数据
   * @param owner - 场景树元素
   */
  constructor (props: ModelTreeOptions, owner: VFXItem<VFXItemContent>) {
    this.baseTransform = owner.transform;
    this.animationManager = new PAnimationManager(props, owner);
    this.build(props);
  }

  /**
   * 场景树更新，主要是动画更新
   * @param dt - 时间间隔
   */
  tick (dt: number) {
    this.animationManager.tick(dt);
  }

  /**
   * 获取所有节点
   * @returns
   */
  getNodes () {
    return this.nodes;
  }

  /**
   * 根据节点编号，查询节点
   * @param nodeId - 节点编号
   * @returns
   */
  getNodeById (nodeId: string | number): ModelTreeNode | undefined {
    const cache = this.cacheMap;

    if (!cache[nodeId]) {
      const index = `^${nodeId}`;

      // @ts-expect-error
      cache[nodeId] = this.allNodes.find(node => node.id === index);
    }

    return cache[nodeId];
  }

  /**
   * 根据节点名称，查询节点
   * @param name - 名称
   * @returns
   */
  getNodeByName (name: string): ModelTreeNode | undefined {
    const cache = this.cacheMap;

    if (!cache[name]) {
      // @ts-expect-error
      cache[name] = this.allNodes.find(node => node.name === name);
    }

    return cache[name];
  }

  /**
   * 根据节点 id 查询节点变换，如果查询不到节点就直接返回基础变换
   * @param nodeId - 节点 id
   * @returns
   */
  getNodeTransform (nodeId: string): Transform {
    const node = this.getNodeById(nodeId);

    return node ? node.transform : this.baseTransform;
  }

  /**
   * 销毁场景树对象
   */
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
 * 插件场景树组件类，实现 3D 场景树功能
 * @since 2.0.0
 * @internal
 */
@effectsClass(ModelDataType.TreeComponent)
export class ModelTreeComponent extends ItemBehaviour {
  /**
   * 内部节点树元素
   */
  content: ModelTreeItem;
  /**
   * 参数
   */
  options?: ModelTreeContent;
  /**
   * 时间轴组件
   */
  timeline?: TimelineComponent;

  /**
   * 构造函数，创建节点树元素
   * @param engine
   * @param options
   */
  constructor (engine: Engine, options?: ModelTreeContent) {
    super(engine);
    if (options) {
      this.fromData(options);
    }
  }

  /**
   * 反序列化，保存入参和创建节点树元素
   * @param options
   */
  override fromData (options: ModelTreeContent): void {
    super.fromData(options);
    this.options = options;
    this.createContent();
  }

  /**
   * 组件开始，查询合成中场景管理器并设置到动画管理器中
   */
  override start () {
    this.item.type = spec.ItemType.tree;
    this.content.baseTransform.setValid(true);
    const sceneManager = getSceneManager(this);

    if (sceneManager) {
      this.content.animationManager.setSceneManager(sceneManager);
    }
  }

  /**
   * 组件更新，内部对象更新
   * @param dt
   */
  override update (dt: number): void {
    // this.timeline?.getRenderData(time, true);
    // TODO: 需要使用lifetime
    this.content?.tick(dt);
  }

  /**
   * 组件销毁，内部对象销毁
   */
  override onDestroy (): void {
    this.content?.dispose();
  }

  /**
   * 创建内部场景树元素
   */
  createContent () {
    if (this.options) {
      const treeOptions = this.options.options.tree;

      this.content = new ModelTreeItem(treeOptions, this.item);
    }
  }

  /**
   * 获取元素的变换
   * @param itemId - 元素索引
   * @returns
   */
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
