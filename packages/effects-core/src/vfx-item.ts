import * as spec from '@galacean/effects-specification';
import { Euler, Quaternion, Vector3 } from '@galacean/effects-math/es/core/index';
import { HELP_LINK } from './constants';
import type { Disposable } from './utils';
import { Transform } from './transform';
import type {
  HitTestBoxParams,
  HitTestCustomParams,
  HitTestSphereParams,
  HitTestTriangleParams,
  ParticleSystem,
  SpriteItem,
  CalculateItem,
  CameraController,
  InteractItem,
  BoundingBoxData,
  SpriteRenderData,
  ParticleVFXItem,
  FilterSpriteVFXItem,
  SpriteVFXItem,
  CameraVFXItem,
} from './plugins';
import type { Composition } from './composition';
import type { CompVFXItem } from './comp-vfx-item';

export type VFXItemContent = ParticleSystem | SpriteItem | CalculateItem | CameraController | InteractItem | void;
export type VFXItemConstructor = new (props: VFXItemProps, composition: Composition) => VFXItem<VFXItemContent>;
export type VFXItemProps =
  & spec.Item
  & {
    items: any,
    startTime: number,
    relative?: boolean,
    listIndex?: number,
    refId?: string,
  }
  ;

/**
 * 所有元素的继承的抽象类
 */
export abstract class VFXItem<T extends VFXItemContent> implements Disposable {
  /**
   * 元素绑定的父元素，
   * 1. 当元素没有绑定任何父元素时，parent为空，transform.parentTransform 为 composition.transform
   * 2. 当元素绑定 nullItem 时，parent 为 nullItem, transform.parentTransform 为 nullItem.transform
   * 3. 当元素绑定 TreeItem 的node时，parent为treeItem, transform.parentTransform 为 tree.nodes[i].transform(绑定的node节点上的transform)
   * 4. 当元素绑定 TreeItem 本身时，行为表现和绑定 nullItem 相同
   */
  public parent?: VFXItem<VFXItemContent>;
  /**
   * 元素的变换包含位置、旋转、缩放。
   */
  public transform: Transform;
  /**
   * 合成属性
   */
  public composition: Composition | null;
  /**
   * 元素动画的持续时间
   */
  public duration: number;
  /**
   * 元素当前更新归一化时间，开始时为 0，结束时为 1
   */
  public lifetime: number;
  /**
   * 父元素的 id
   */
  public parentId?: string;
  /**
   * 元素动画的开始时间
   */
  public delay?: number;
  /**
   * 元素动画结束时行为（如何处理元素）
   */
  public endBehavior: spec.ItemEndBehavior | spec.ParentItemEndBehavior;
  /**
   * 元素是否可用
   */
  public ended: boolean;
  /**
   * 元素在合成中的索引
   */
  public readonly listIndex: number;
  /**
   * 元素名称
   */
  public readonly name: string;
  /**
   * 元素 id 唯一
   */
  public readonly id: string;
  /**
   * 元素动画是否开始
   */
  public started: boolean;
  /**
   * 元素优先级
   */
  _v_priority = 0;
  /**
   * 元素创建的数据图层/粒子/模型等
   */
  protected _content?: T;
  /**
   * 元素可见性，该值的改变会触发 `handleVisibleChanged` 回调
   * @protected
   */
  protected visible = true;
  /**
   * 是否允许渲染，元素生命周期开始后为 true，结束时为 false
   * @protected
   */
  protected _contentVisible = false;
  /**
   * 合成元素当前的时间，单位毫秒
   * @protected
   */
  protected timeInms = 0;
  /**
   * 合成元素当前的时间，单位秒，兼容旧 player 使用秒的时间更新数据
   * @protected
   */
  protected time = 0;
  /**
   * 元素动画持续时间，单位毫秒
   */
  protected readonly durInms: number;
  /**
  * 元素动画延迟/开始播放时间，单位毫秒
  */
  protected readonly delayInms: number;

  /**
   * 元素动画是否延迟播放
   */
  protected delaying: boolean;
  /**
   * 元素冻结属性，冻结后停止计算/更新数据
   */
  private _frozen = false;
  /**
   * 元素动画结束回调是否被调用
   */
  private callEnd: boolean;
  /**
   * 元素动画的速度
   */
  private speed: number;

  static isComposition (item: VFXItem<VFXItemContent>): item is CompVFXItem {
    return item.type === spec.ItemType.composition;
  }

  static isSprite (item: VFXItem<VFXItemContent>): item is SpriteVFXItem {
    return item.type === spec.ItemType.sprite;
  }

  static isParticle (item: VFXItem<VFXItemContent>): item is ParticleVFXItem {
    return item.type === spec.ItemType.particle;
  }

  static isFilterSprite (item: VFXItem<VFXItemContent>): item is FilterSpriteVFXItem {
    return item.type === spec.ItemType.filter;
  }

  static isNull (item: VFXItem<VFXItemContent>): item is VFXItem<void> {
    return item.type === spec.ItemType.null;
  }

  static isTree (item: VFXItem<VFXItemContent>): item is VFXItem<void> {
    return item.type === spec.ItemType.tree;
  }

  static isExtraCamera (item: VFXItem<VFXItemContent>): item is CameraVFXItem {
    return item.id === 'extra-camera' && item.name === 'extra-camera';
  }

  constructor (
    props: VFXItemProps,
    composition: Composition,
  ) {
    const {
      id, name, delay, parentId, endBehavior, transform,
      listIndex = 0,
      duration = 0,
    } = props;

    this.composition = composition;
    this.id = id;
    this.name = name;
    this.delay = delay;
    this.transform = new Transform({
      name: this.name,
      ...transform,
    }, composition.transform);
    this.parentId = parentId;
    this.duration = duration;
    this.delayInms = (delay || 0) * 1000;
    this.durInms = this.duration * 1000;
    this.endBehavior = endBehavior;
    this.lifetime = -(this.delayInms / this.durInms);
    this.listIndex = listIndex;
    this.speed = 1;
    this.onConstructed(props);

    if (duration <= 0) {
      throw Error(`Item duration can't be less than 0, see ${HELP_LINK['Item duration can\'t be less than 0']}`);
    }
  }

  /**
   * 元素内容可见性
   */
  get contentVisible (): boolean {
    return this._contentVisible && this.visible;
  }

  /**
   * 返回元素创建的数据
   */
  get content (): T {
    // @ts-expect-error
    return this._content;
  }
  /**
   * 设置元素数据
   */
  set content (t: T) {
  }

  /**
   * 播放完成后是否需要再使用，是的话生命周期结束后不会 dispose
   */
  get reusable (): boolean {
    return this.composition?.reusable ?? false;
  }

  /**
   * 获取元素类型
   */
  get type (): spec.ItemType | string {
    return spec.ItemType.base;
  }

  /**
   * 获取元素冻结属性
   */
  get frozen () {
    return this._frozen;
  }

  /**
   * 设置元素冻结属性
   */
  set frozen (v) {
    this.handleFrozenChanged(this._frozen = !!v);
  }

  /**
   * 获取元素生命周期是否开始
   */
  get lifetimeStarted () {
    return this.started && !this.delaying;
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
   * 重置元素状态属性
   */
  start () {
    if (!this.started || this.ended) {
      this.started = true;
      this.delaying = true;
      this.timeInms = 0;
      this.time = 0;
      this.callEnd = false;
      this.ended = false;
    }
  }

  /**
   * 停止播放元素动画
   */
  stop () {
    this.doStop();
    this.started = false;
  }
  doStop () {
    if (this._content && (this._content as unknown as { stop: () => void }).stop) {
      (this._content as unknown as { stop: () => void }).stop();
    }
  }

  /**
   * 创建元素内容，此函数可以在任何时间被调用
   * 第一帧渲染前会被调用
   * @returns
   */
  createContent (): T {
    if (!this._content) {
      this._content = this.doCreateContent(this.composition);
    }

    return this._content;
  }
  /**
   * 创建元素的内容
   * @override
   * @param composition
   * @returns
   */
  protected doCreateContent (composition: Composition | null): T {
    return undefined as unknown as T;
  }

  /**
   * 元素构造函数调用时将调用该函数
   * @param options
   * @override
   */
  onConstructed (options: spec.Item) {
    // OVERRIDE
  }

  /**
   * 内部使用的更新回调，请不要重写此方法，重写 `onItemUpdate` 方法
   * @param deltaTime
   */
  public onUpdate (deltaTime: number) {
    if (this.started && !this.frozen && this.composition) {
      let dt = deltaTime * this.speed;
      const time = (this.timeInms += dt);

      this.time += dt / 1000;
      const now = time - this.delayInms;

      if (this.delaying && now >= 0) {
        this.delaying = false;

        this.transform.setValid(true);
        this.createContent();
        this._contentVisible = true;
        this.onLifetimeBegin(this.composition, this.content);
        this.composition.itemLifetimeEvent(this, true);
      }
      if (!this.delaying) {
        let lifetime = now / this.durInms;
        const ended = this.isEnded(now);
        let shouldUpdate = true;

        this.transform.setValid(true);

        if (ended) {
          shouldUpdate = false;
          if (!this.callEnd) {
            this.callEnd = true;
            this.composition.itemLifetimeEvent(this, false);
            this.onEnd();
          }
          // 注意：不要定义私有变量替换 this.endBehavior，直接使用 this 上的！！！（Chrome 下会出现 endBehavior 为 5 时，能进入以下判断）
          if (this.endBehavior !== spec.END_BEHAVIOR_FORWARD && this.endBehavior !== spec.END_BEHAVIOR_RESTART) {
            this.ended = true;
            this.transform.setValid(false);
            if (
              this.endBehavior === spec.END_BEHAVIOR_PAUSE ||
              this.endBehavior === spec.END_BEHAVIOR_PAUSE_AND_DESTROY
            ) {
              this.composition.handlePlayerPause?.(this);
            } else if (this.endBehavior === spec.END_BEHAVIOR_FREEZE) {
              this.transform.setValid(true);
              shouldUpdate = true;
              lifetime = 1;
              dt = 0;
            }
            if (!this.reusable) {
              if (
                this.endBehavior === spec.END_BEHAVIOR_DESTROY ||
                this.endBehavior === spec.END_BEHAVIOR_PAUSE_AND_DESTROY ||
                this.endBehavior === spec.END_BEHAVIOR_DESTROY_CHILDREN
              ) {
                return this.dispose();
              } else if (this.endBehavior === spec.END_BEHAVIOR_PAUSE) {
                this.endBehavior = spec.END_BEHAVIOR_FORWARD;
              }
            } else if (this.endBehavior === spec.END_BEHAVIOR_DESTROY) {
              this._contentVisible = false;

              // 预合成配置 reusable 且销毁时， 需要隐藏其中的元素
              if ((this.type as spec.ItemType) === spec.ItemType.composition) {
                this.handleVisibleChanged(false);
                this.onItemUpdate(0, lifetime);
              }
            }
            lifetime = Math.min(lifetime, 1);
          } else {
            shouldUpdate = true;

            if (this.endBehavior === spec.END_BEHAVIOR_RESTART) {
              this.ended = true;
              lifetime = lifetime % 1;
            }
          }
        } else if (this.callEnd && this.reusable) {
          this.setVisible(true);
          this.callEnd = false;
        }
        this.lifetime = lifetime;

        shouldUpdate && this.onItemUpdate(dt, lifetime);
      }
    }
  }

  /**
   * 元素结束时的回调
   * @override
   * @param composition
   * @param content
   */
  protected onItemRemoved (composition: Composition, content?: T) {
    // OVERRIDE
  }

  /**
   * 元素更新函数，在 Composition 对象的 tick 函数中被调用
   * @override
   * @param dt
   * @param lifetime
   */
  onItemUpdate (dt: number, lifetime: number) {
    // OVERRIDE
  }

  /**
   * 元素 doCreateContent 函数调用后会立即调用该函数用于初始化数据
   * @override
   * @param composition
   * @param content
   */
  onLifetimeBegin (composition: Composition, content: T) {
    // OVERRIDE
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
      this.handleVisibleChanged(this.visible);
    }
  }

  /**
   * 元素显隐属性改变时调用的函数，当 visible 为 true 时，务必显示元素
   * @param visible
   * @override
   */
  protected handleVisibleChanged (visible: boolean) {
    // OVERRIDE
  }

  /**
   * 元素冻结属性改变时调用的函数
   * @param frozen
   * @override
   */
  protected handleFrozenChanged (frozen: boolean) {
    // OVERRIDE
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
   * 设置元素的在画布上的像素位置
   */
  setPositionByPixel (x: number, y: number) {
    if (this.composition) {
      const { z } = this.transform.getWorldPosition();
      const { x: rx, y: ry } = this.composition.camera.getInverseVPRatio(z);
      const width = this.composition.renderer.getWidth() / 2;
      const height = this.composition.renderer.getHeight() / 2;

      this.transform.setPosition(2 * x * rx / width, -2 * y * ry / height, z);
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
   * 获取元素的 transform、当前生命周期、可见性，当子元素需要时可继承
   * @override
   */
  getRenderData (): SpriteRenderData {
    // OVERRIDE
    return {
      transform: this.transform,
      life: 0,
      visible: this.visible,
    };
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
  protected isEnded (now: number) {
    // at least 1 ms
    return now - this.durInms > 0.001;
  }

  /**
   * 重置元素，元素创建的内容将会被销毁
   */
  reset () {
    if (this.composition) {
      this.onItemRemoved(this.composition, this._content);
      this._content = undefined;
      this._contentVisible = false;
    }
    this.started = false;
  }

  translateByPixel (x: number, y: number) {
    if (this.composition) {
      const { z } = this.transform.getWorldPosition();
      const { x: rx, y: ry } = this.composition.camera.getInverseVPRatio(z);
      const width = this.composition.renderer.getWidth() / 2;
      const height = this.composition.renderer.getHeight() / 2;

      this.transform.translate(2 * x * rx / width, -2 * y * ry / height, 0);
    }
  }

  /**
   * 销毁元素
   */
  dispose (): void {
    if (this.composition) {
      this.composition.destroyItem(this);
      this.reset();
      this.onUpdate = () => -1;
      this.composition = null;
      this._contentVisible = false;
      this.transform.setValid(false);
    }
  }
}

export namespace Item {
  export function is<T extends spec.Item> (item: spec.Item, type: spec.ItemType): item is T {
    return item.type === type;
  }

  export function isFilter (item: spec.Item): item is spec.FilterItem {
    return item.type === spec.ItemType.filter;
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
 * 根据元素的类型创建对应的 `VFXItem` 实例
 * @param props
 * @param composition
 */
export function createVFXItem (props: VFXItemProps, composition: Composition): VFXItem<any> {
  const { type } = props;
  let { pluginName } = props;

  if (!pluginName) {
    switch (type) {
      case spec.ItemType.null:
      case spec.ItemType.base:
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
      case spec.ItemType.filter:
        pluginName = 'filter';

        break;
      case spec.ItemType.text:
        pluginName = 'text';

        break;
      case spec.ItemType.tree:
        pluginName = 'tree';

        break;
      default:
        throw new Error('invalid vfx item type');
    }
  }

  return composition.pluginSystem.createPluginItem(pluginName, props, composition);
}
