import { Euler } from '@galacean/effects-math/es/core/euler';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import type { VFXItemData } from './asset-loader';
import type { Component } from './components';
import { RendererComponent, EffectComponent } from './components';
import type { Composition } from './composition';
import { HELP_LINK } from './constants';
import { effectsClass, serialize } from './decorators';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import type {
  BoundingBoxData, CameraController, HitTestBoxParams, HitTestCustomParams, HitTestSphereParams,
  HitTestTriangleParams, InteractComponent, SpriteComponent,
} from './plugins';
import { ParticleSystem } from './plugins';
import { Transform } from './transform';
import type { Constructor, Disposable } from './utils';
import { removeItem } from './utils';
import type { EventEmitterListener, EventEmitterOptions, ItemEvent } from './events';
import { EventEmitter } from './events';

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
   * 元素动画的当前时间
   */
  time = 0;
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
  endBehavior: spec.EndBehavior = spec.EndBehavior.forward;
  /**
   * 元素名称
   */
  name: string;
  /**
   * 元素 id 唯一
   */
  id: string;

  /**
   * 元素创建的数据图层/粒子/模型等
   */
  _content?: VFXItemContent;
  type: spec.ItemType = spec.ItemType.base;
  props: VFXItemProps;
  isDuringPlay = false;

  @serialize()
  components: Component[] = [];
  rendererComponents: RendererComponent[] = [];

  /**
   * 元素是否激活
   */
  private active = true;
  /**
   * 元素组件是否显示，用于批量开关元素组件
   */
  private visible = true;
  /**
   * 元素动画的速度
   */
  private speed = 1;
  private listIndex = 0;
  private isEnabled = false;
  private eventProcessor: EventEmitter<ItemEvent> = new EventEmitter();

  /**
   *
   * @param item
   * @returns
   */
  static isComposition (item: VFXItem) {
    return item.type === spec.ItemType.composition;
  }

  /**
   *
   * @param item
   * @returns
   */
  static isSprite (item: VFXItem) {
    return item.type === spec.ItemType.sprite;
  }

  /**
   *
   * @param item
   * @returns
   */
  static isParticle (item: VFXItem) {
    return item.type === spec.ItemType.particle;
  }

  /**
   *
   * @param item
   * @returns
   */
  static isNull (item: VFXItem) {
    return item.type === spec.ItemType.null;
  }

  /**
   *
   * @param item
   * @returns
   */
  static isTree (item: VFXItem) {
    return item.type === spec.ItemType.tree;
  }

  /**
   *
   * @param item
   * @returns
   */
  static isCamera (item: VFXItem) {
    return item.type === spec.ItemType.camera;
  }

  /**
   *
   * @param ancestorCandidate
   * @param descendantCandidate
   * @returns
   */
  static isAncestor (
    ancestorCandidate: VFXItem,
    descendantCandidate: VFXItem,
  ) {
    let current = descendantCandidate.parent;

    while (current) {
      if (current === ancestorCandidate) {
        return true;
      }
      current = current.parent;
    }

    return false;
  }

  /**
   *
   * @param engine
   * @param props
   */
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
   * 元素监听事件
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   * @param options - 事件监听器选项
   * @returns
   */
  on<E extends keyof ItemEvent> (
    eventName: E,
    listener: EventEmitterListener<ItemEvent[E]>,
    options?: EventEmitterOptions,
  ) {
    this.eventProcessor.on(eventName, listener, options);
  }

  /**
   * 移除事件监听器
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   * @returns
   */
  off<E extends keyof ItemEvent> (
    eventName: E,
    listener: EventEmitterListener<ItemEvent[E]>,
  ) {
    this.eventProcessor.off(eventName, listener);
  }

  /**
   * 一次性监听事件
   * @param eventName - 事件名称
   * @param listener - 事件监听器
   */
  once<E extends keyof ItemEvent> (
    eventName: E,
    listener: EventEmitterListener<ItemEvent[E]>,
  ) {
    this.eventProcessor.once(eventName, listener);
  }

  /**
   * 触发事件
   * @param eventName - 事件名称
   * @param args - 事件参数
   */
  emit<E extends keyof ItemEvent> (
    eventName: E,
    ...args: ItemEvent[E]
  ) {
    this.eventProcessor.emit(eventName, ...args);
  }

  /**
   * 获取事件名称对应的所有监听器
   * @param eventName - 事件名称
   * @returns - 返回事件名称对应的所有监听器
   */
  getListeners<E extends keyof ItemEvent> (eventName: E) {
    return this.eventProcessor.getListeners(eventName);
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
    newComponent.setVFXItem(this);

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
    if (vfxItem === this && !vfxItem) {
      return;
    }
    if (this.parent) {
      removeItem(this.parent.children, this);
    }
    this.parent = vfxItem;
    if (!VFXItem.isCamera(this)) {
      this.transform.parentTransform = vfxItem.transform;
    }
    vfxItem.children.push(this);
    if (!this.composition) {
      this.composition = vfxItem.composition;
    }
    if (!this.isDuringPlay && vfxItem.isDuringPlay) {
      this.beginPlay();
    }
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
   * 激活或停用 VFXItem
   */
  setActive (value: boolean) {
    if (this.active !== value) {
      this.active = !!value;
      this.onActiveChanged();
    }
  }

  /**
   * 当前 VFXItem 是否激活
   */
  get isActive () {
    return this.active;
  }

  /**
   * 设置元素的显隐，该设置会批量开关元素组件
   */
  setVisible (visible: boolean) {
    for (const component of this.components) {
      component.enabled = visible;
    }
    this.visible = visible;
  }

  /**
   * 元素组件显隐状态
   */
  get isVisible () {
    return this.visible;
  }

  /**
   * 元素组件显隐状态
   * @deprecated use isVisible instead
   */
  getVisible () {
    return this.visible;
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
   * @param force - 元素没有开启交互也返回参数
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

  find (name: string): VFXItem | undefined {
    if (this.name === name) {
      return this;
    }

    const queue: VFXItem[] = [];

    queue.push(...this.children);
    let index = 0;

    while (index < queue.length) {
      const item = queue[index];

      index++;
      if (item.name === name) {
        return item;
      }
      queue.push(...item.children);
    }

    return undefined;
  }

  /**
   * @internal
   */
  beginPlay () {
    this.isDuringPlay = true;

    if (this.composition && this.active && !this.isEnabled) {
      this.onEnable();
    }

    for (const child of this.children) {
      if (!child.isDuringPlay) {
        child.beginPlay();
      }
    }

  }

  /**
   * @internal
   */
  onActiveChanged () {
    if (!this.isEnabled) {
      this.onEnable();
    } else {
      this.onDisable();
    }
  }

  /**
   * @internal
   */
  onEnable () {
    this.isEnabled = true;
    for (const component of this.components) {
      if (component.enabled && !component.isStartCalled) {
        component.onStart();
        component.isStartCalled = true;
      }
    }
    for (const component of this.components) {
      if (component.enabled && !component.isEnableCalled) {
        component.enable();
      }
    }
  }

  /**
   * @internal
   */
  onDisable () {
    this.isEnabled = false;
    for (const component of this.components) {
      if (component.enabled && component.isEnableCalled) {
        component.disable();
      }
    }
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
    // TODO spec endbehavior 类型修正
    this.endBehavior = endBehavior as spec.EndBehavior;

    if (!data.content) {
      data.content = { options: {} };
    }

    if (duration <= 0) {
      throw new Error(`Item duration can't be less than 0, see ${HELP_LINK['Item duration can\'t be less than 0']}.`);
    }

    this.rendererComponents.length = 0;
    for (const component of this.components) {
      component.item = this;
      if (component instanceof RendererComponent) {
        this.rendererComponents.push(component);
      }
      // TODO ParticleSystemRenderer 现在是动态生成的，后面需要在 json 中单独表示为一个组件
      if (component instanceof ParticleSystem) {
        if (!this.components.includes(component.renderer)) {
          this.components.push(component.renderer);
        }
        this.rendererComponents.push(component.renderer);
      }
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
