import { Euler } from '@galacean/effects-math/es/core/euler';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import type { VFXItemData } from './asset-loader';
import type { Component, RendererComponent, ItemBehaviour } from './components';
import { EffectComponent } from './components';
import type { Composition } from './composition';
import { HELP_LINK } from './constants';
import { effectsClass, serialize } from './decorators';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import type {
  BoundingBoxData, CameraController, HitTestBoxParams, HitTestCustomParams, HitTestSphereParams,
  HitTestTriangleParams, InteractComponent, ParticleSystem, SpriteComponent,
} from './plugins';
import { Transform } from './transform';
import type { Constructor, Disposable } from './utils';
import { removeItem } from './utils';

export type VFXItemContent = ParticleSystem | SpriteComponent | CameraController | InteractComponent | undefined | {};
export type VFXItemConstructor = new (engine: Engine, props: VFXItemProps, composition: Composition) => VFXItem;
export type VFXItemProps =
  & spec.Item
  & {
    items: VFXItemProps[],
    startTime: number,
    relative?: boolean,
    listIndex?: number,
    refId?: string,
  }
  ;

/**
 * 所有元素的继承的抽象类
 */
@effectsClass(spec.DataType.VFXItemData)
export class VFXItem extends EffectsObject implements Disposable {
  /**
   * 元素绑定的父元素，
   * 1. 当元素没有绑定任何父元素时，parent为空，transform.parentTransform 为 composition.transform
   * 2. 当元素绑定 nullItem 时，parent 为 nullItem, transform.parentTransform 为 nullItem.transform
   * 3. 当元素绑定 TreeItem 的node时，parent为treeItem, transform.parentTransform 为 tree.nodes[i].transform(绑定的node节点上的transform)
   * 4. 当元素绑定 TreeItem 本身时，行为表现和绑定 nullItem 相同
   */
  parent?: VFXItem;

  children: VFXItem[] = [];
  /**
   * 元素的变换包含位置、旋转、缩放。
   */
  transform: Transform = new Transform();
  /**
   * 合成属性
   */
  composition: Composition | null;
  /**
   * 元素动画的持续时间
   */
  duration = 0;
  /**
   * 父元素的 id
   */
  parentId?: string;
  /**
   * 元素动画的开始时间
   */
  start = 0;
  /**
   * 元素动画结束时行为（如何处理元素）
   */
  endBehavior: spec.EndBehavior | spec.ParentItemEndBehavior;
  /**
   * 元素是否可用
   */
  ended = false;
  /**
   * 元素名称
   */
  name: string;
  /**
   * 元素 id 唯一
   */
  id: string;

  // TODO: 2.0 编辑器测试用变量，后续移除
  oldId: string;
  /**
   * 元素创建的数据图层/粒子/模型等
   */
  _content?: VFXItemContent;
  reusable = false;
  type: spec.ItemType = spec.ItemType.base;
  props: VFXItemProps;

  @serialize()
  components: Component[] = [];
  itemBehaviours: ItemBehaviour[] = [];
  rendererComponents: RendererComponent[] = [];

  /**
   * 元素可见性，该值的改变会触发 `handleVisibleChanged` 回调
   * @protected
   */
  protected visible = true;
  /**
   * 元素动画的速度
   */
  private speed = 1;
  private listIndex = 0;

  static isComposition (item: VFXItem) {
    return item.type === spec.ItemType.composition;
  }

  static isSprite (item: VFXItem) {
    return item.type === spec.ItemType.sprite;
  }

  static isParticle (item: VFXItem) {
    return item.type === spec.ItemType.particle;
  }

  static isNull (item: VFXItem) {
    return item.type === spec.ItemType.null;
  }

  static isTree (item: VFXItem) {
    return item.type === spec.ItemType.tree;
  }

  static isCamera (item: VFXItem) {
    return item.type === spec.ItemType.camera;
  }

  static isExtraCamera (item: VFXItem) {
    return item.id === 'extra-camera' && item.name === 'extra-camera';
  }

  constructor (
    engine: Engine,
    props?: VFXItemProps,
  ) {
    super(engine);
    this.name = 'VFXItem';
    this.transform.name = this.name;
    this.transform.engine = engine;
    if (props) {
      this.fromData(props as VFXItemData);
    }
  }

  /**
   * 返回元素创建的数据
   */
  get content (): VFXItemContent {
    return this._content;
  }

  /**
   * 播放完成后是否需要再使用，是的话生命周期结束后不会 dispose
   */
  get compositionReusable (): boolean {
    return this.composition?.reusable ?? false;
  }

  /**
   * 元素在合成中的索引
   */
  get renderOrder () {
    return this.listIndex;
  }
  set renderOrder (value: number) {
    if (this.listIndex !== value) {
      this.listIndex = value;
      for (const rendererComponent of this.rendererComponents) {
        rendererComponent.priority = value;
      }
    }
  }

  /**
   * 设置元素的动画速度
   * @param speed - 速度
   */
  setSpeed (speed: number) {
    this.speed = speed;
  }

  /**
   * 获取元素的动画速度
   * @returns
   */
  getSpeed () {
    return this.speed;
  }

  /**
   * 添加组件
   * @param classConstructor - 要添加的组件类型
   */
  addComponent<T extends Component> (classConstructor: Constructor<T>): T {
    const newComponent = new classConstructor(this.engine);

    this.components.push(newComponent);
    newComponent.item = this;
    newComponent.onAttached();

    return newComponent;
  }

  /**
   * 获取某一类型的组件。如果当前元素绑定了多个同类型的组件只返回第一个
   * @param classConstructor - 要获取的组件类型
   * @returns 查询结果中符合类型的第一个组件
   */
  getComponent<T extends Component> (classConstructor: Constructor<T>): T {
    let res;

    for (const com of this.components) {
      if (com instanceof classConstructor) {
        res = com;

        break;
      }
    }

    return res as T;
  }

  /**
   * 获取某一类型的所有组件
   * @param classConstructor - 要获取的组件
   * @returns 一个组件列表，包含所有符合类型的组件
   */
  getComponents<T extends Component> (classConstructor: Constructor<T>) {
    const res = [];

    for (const com of this.components) {
      if (com instanceof classConstructor) {
        res.push(com);
      }
    }

    return res;
  }

  setParent (vfxItem: VFXItem) {
    if (vfxItem === this) {
      return;
    }
    if (this.parent) {
      removeItem(this.parent.children, this);
    }
    this.parent = vfxItem;
    if (vfxItem) {
      if (!VFXItem.isCamera(this)) {
        this.transform.parentTransform = vfxItem.transform;
      }
      vfxItem.children.push(this);
      if (!this.composition) {
        this.composition = vfxItem.composition;
      }
    }
  }

  /**
   * 元素动画结束播放时回调函数
   * @override
   */
  onEnd () {
    // OVERRIDE
  }

  /**
   * 通过指定 r、g、b、a 值设置元素的颜色
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @param {number} a
   * @internal
   */
  setColor (r: number, g: number, b: number, a: number) {

  }

  /**
   * 设置元素的透明度
   * @param opacity - 透明度值，范围 [0,1]
   */

  setOpacity (opacity: number) {

  }

  /**
   * 获取元素显隐属性
   */
  getVisible () {
    return this.visible;
  }

  /**
   * 设置元素显隐属性 会触发 `handleVisibleChanged` 回调
   */
  setVisible (visible: boolean) {
    if (this.visible !== visible) {
      this.visible = !!visible;
    }
  }

  /**
   * 获取元素变换包括位置、旋转、缩放
   * @param transform 将元素变换拷贝到该对象，并将其作为返回值
   * @returns 元素变换的拷贝
   */
  getWorldTransform (transform?: Transform): Transform {
    const tf = transform ?? new Transform({
      valid: true,
    });

    tf.cloneFromMatrix(this.transform.getWorldMatrix());

    return tf;
  }

  /**
   * 获取元素内部节点的变换，目前只有场景树元素在使用
   * @param itemId 元素id信息，如果带^就返回内部节点变换，否则返回自己的变换
   * @returns 元素变换或内部节点变换
   */
  getNodeTransform (itemId: string): Transform {
    for (let i = 0; i < this.components.length; i++) {
      const comp = this.components[1];

      // @ts-expect-error
      if (comp.getNodeTransform) {
        // @ts-expect-error
        return comp.getNodeTransform(itemId);
      }
    }

    return this.transform;
  }

  /**
   * 设置元素在 3D 坐标轴上相对移动
   */
  translate (x: number, y: number, z: number) {
    this.transform.translate(x, y, z);
  }
  /**
   * 设置元素在 3D 坐标轴上相对旋转（角度）
   */
  rotate (x: number, y: number, z: number) {
    const euler = new Euler(x, y, z);
    const q = Quaternion.fromEuler(euler);

    q.conjugate();
    this.transform.rotateByQuat(q);
  }
  /**
   * 设置元素在 3D 坐标轴上相对缩放
   */
  scale (x: number, y: number, z: number) {
    this.transform.scaleBy(x, y, z);
  }

  /**
   * 设置元素在画布上的像素位置
   * Tips:
   *  - 坐标原点在 canvas 左上角，x 正方向水平向右， y 正方向垂直向下
   *  - 设置后会覆盖原有的位置信息
   * @param x - x 坐标
   * @param y - y 坐标
   */
  setPositionByPixel (x: number, y: number) {
    if (this.composition) {
      const { z } = this.transform.getWorldPosition();
      const { x: rx, y: ry } = this.composition.camera.getInverseVPRatio(z);
      const width = this.composition.renderer.getWidth() / 2;
      const height = this.composition.renderer.getHeight() / 2;

      this.transform.setPosition((2 * x / width - 1) * rx, (1 - 2 * y / height) * ry, z);
    }
  }
  /**
   * 设置元素在 3D 坐标轴的位置
   */
  setPosition (x: number, y: number, z: number) {
    this.transform.setPosition(x, y, z);
  }
  /**
   * 设置元素在 3D 坐标轴的角度
   */
  setRotation (x: number, y: number, z: number) {
    this.transform.setRotation(x, y, z);
  }
  /**
   * 设置元素在 3D 坐标轴的缩放
   */
  setScale (x: number, y: number, z: number) {
    this.transform.setScale(x, y, z);
  }

  /**
   * 获取元素包围盒
   * @override
   */
  getBoundingBox (): void | BoundingBoxData {
    // OVERRIDE
  }

  /**
   * 获取元素用于计算光线投射的面片类型和参数
   * @override
   * @param force 元素没有开启交互也返回参数
   */
  getHitTestParams (force?: boolean): void | HitTestBoxParams | HitTestTriangleParams | HitTestSphereParams | HitTestCustomParams {
    // OVERRIDE
  }

  /**
   * 获取元素当前世界坐标
   */
  getCurrentPosition (): Vector3 {
    const pos = new Vector3();

    this.transform.assignWorldTRS(pos);

    return pos;
  }

  /**
   * 是否到达元素的结束时间
   * @param now
   * @returns
   */
  isEnded (now: number) {
    // at least 1 ms
    return now - this.duration > 0.001;
  }

  find (name: string): VFXItem | undefined {
    if (this.name === name) {
      return this;
    }
    for (const child of this.children) {
      if (child.name === name) {
        return child;
      }
    }
    for (const child of this.children) {
      const res = child.find(name);

      if (res) {
        return res;
      }
    }

    return undefined;
  }

  override fromData (data: VFXItemData): void {
    super.fromData(data);
    const {
      id, name, delay, parentId, endBehavior, transform,
      listIndex = 0,
      duration = 0,
    } = data;

    this.props = data;
    //@ts-expect-error
    this.type = data.type;
    this.id = id.toString(); // TODO 老数据 id 是 number，需要转换
    this.name = name;
    this.start = delay ? delay : this.start;

    if (transform) {
      //@ts-expect-error TODO 数据改造后移除 expect-error
      transform.position = new Vector3().copyFrom(transform.position);
      // FIXME: transform.rotation待删除
      if (transform.quat) {
        //@ts-expect-error
        transform.quat = new Quaternion(transform.quat.x, transform.quat.y, transform.quat.z, transform.quat.w);
      } else {
        //@ts-expect-error
        transform.rotation = new Euler().copyFrom(transform.eulerHint ?? transform.rotation);
      }
      //@ts-expect-error
      transform.scale = new Vector3().copyFrom(transform.scale);
      //@ts-expect-error
      if (transform.size) {
        //@ts-expect-error
        transform.size = new Vector2().copyFrom(transform.size);
      }
      //@ts-expect-error
      if (transform.anchor) {
        //@ts-expect-error
        transform.anchor = new Vector2().copyFrom(transform.anchor);
      }
      this.transform.setTransform(transform);
    }

    this.transform.name = this.name;
    this.transform.engine = this.engine;
    this.parentId = parentId;
    this.duration = duration;
    this.endBehavior = endBehavior;
    //@ts-expect-error
    this.oldId = data.oldId;

    if (!data.content) {
      data.content = { options: {} };
    }

    if (duration <= 0) {
      throw new Error(`Item duration can't be less than 0, see ${HELP_LINK['Item duration can\'t be less than 0']}.`);
    }

    for (const component of this.components) {
      component.item = this;
      component.onAttached();
    }
    // renderOrder 在 component 初始化后设置。确保能拿到 rendererComponent。
    this.renderOrder = listIndex;
  }

  override toData (): void {
    this.taggedProperties.id = this.guid;
    this.taggedProperties.transform = this.transform.toData();
    this.taggedProperties.dataType = spec.DataType.VFXItemData;
    if (this.parent?.name !== 'rootItem') {
      this.taggedProperties.parentId = this.parent?.guid;
    }

    // TODO 统一 sprite 等其他组件的序列化逻辑
    if (!this.taggedProperties.components) {
      this.taggedProperties.components = [];
      for (const component of this.components) {
        if (component instanceof EffectComponent) {
          this.taggedProperties.components.push(component);
        }
      }
    }
    this.taggedProperties.content = {};
  }

  translateByPixel (x: number, y: number) {
    if (this.composition) {
      // @ts-expect-error
      const { width, height } = this.composition.renderer.canvas.getBoundingClientRect();
      const { z } = this.transform.getWorldPosition();
      const { x: rx, y: ry } = this.composition.camera.getInverseVPRatio(z);

      this.transform.translate(2 * x * rx / width, -2 * y * ry / height, 0);
    }
  }

  /**
   * 销毁元素
   */
  override dispose (): void {
    this.resetChildrenParent();

    if (this.composition) {
      this.composition.destroyItem(this);
      // component 调用 dispose() 会将自身从 this.components 数组删除，slice() 避免迭代错误
      for (const component of this.components.slice()) {
        component.dispose();
      }
      this.components = [];
      this._content = undefined;
      this.composition = null;
      this.transform.setValid(false);
    }
  }

  private resetChildrenParent () {

    // GE 父元素销毁子元素继承逻辑
    // 如果有父对象，销毁时子对象继承父对象。
    for (const child of this.children) {
      if (this.parent) {
        child.setParent(this.parent);
      }
    }
    if (this.parent) {
      removeItem(this.parent?.children, this);
    }
    // const contentItems = compositonVFXItem.getComponent(CompositionComponent)!.items;

    // contentItems.splice(contentItems.indexOf(this), 1);

    // else {
    //   // 普通元素正常销毁逻辑, 子元素不继承
    // if (this.parent) {
    //   removeItem(this.parent?.children, this);
    // }
    // }
  }
}

export namespace Item {
  export function is<T extends spec.Item> (item: spec.Item, type: spec.ItemType): item is T {
    return item.type === type;
  }

  export function isComposition (item: spec.Item): item is spec.CompositionItem {
    return item.type === spec.ItemType.composition;
  }

  export function isParticle (item: spec.Item): item is spec.ParticleItem {
    return item.type === spec.ItemType.particle;
  }

  export function isNull (item: spec.Item): item is spec.NullItem {
    return item.type === spec.ItemType.null;
  }
}

/**
 * (待废弃) 根据元素的类型创建对应的 `VFXItem` 实例
 * @param props
 * @param composition
 */
export function createVFXItem (props: VFXItemProps, composition: Composition): VFXItem {
  const { type } = props;
  let { pluginName } = props;

  if (!pluginName) {
    switch (type) {
      case spec.ItemType.null:
        pluginName = 'cal';

        break;
      case spec.ItemType.sprite:
        pluginName = 'sprite';

        break;
      case spec.ItemType.particle:
        pluginName = 'particle';

        break;
      case spec.ItemType.interact:
        pluginName = 'interact';

        break;
      case spec.ItemType.camera:
        pluginName = 'camera';

        break;
      case spec.ItemType.text:
        pluginName = 'text';

        break;
      case spec.ItemType.tree:
        pluginName = 'tree';

        break;
      default:
        throw new Error('Invalid vfx item type.');
    }
  }

  return composition.pluginSystem.createPluginItem(pluginName, props, composition);
}
