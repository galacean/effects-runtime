import { Euler } from '@galacean/effects-math/es/core/euler';
import type { Ray } from '@galacean/effects-math/es/core/ray';
import { Quaternion } from '@galacean/effects-math/es/core/quaternion';
import { Vector2 } from '@galacean/effects-math/es/core/vector2';
import { Vector3 } from '@galacean/effects-math/es/core/vector3';
import * as spec from '@galacean/effects-specification';
import type { Component } from './components';
import { EffectComponent, RendererComponent } from './components';
import type { Composition, CompositionHitTestOptions } from './composition';
import { HELP_LINK } from './constants';
import { effectsClass } from './decorators';
import { EffectsObject } from './effects-object';
import type { Engine } from './engine';
import type { EventEmitterListener, EventEmitterOptions, ItemEvent } from './events';
import { EventEmitter } from './events';
import type { Maskable } from './material';
import type {
  BoundingBoxData, HitTestBoxParams, HitTestCustomParams, HitTestSphereParams,
  HitTestTriangleParams, Region,
} from './plugins';
import { HitTestType, ParticleSystem } from './plugins';
import { Transform } from './transform';
import type { Constructor, Disposable } from './utils';
import { generateGUID, removeItem } from './utils';

/**
 * VFX 元素，包含元素的变换、组件、子元素等信息。
 */
@effectsClass(spec.DataType.VFXItemData)
export class VFXItem extends EffectsObject implements Disposable {
  /**
   * 元素绑定的父元素
   */
  parent?: VFXItem;
  /**
   * 元素的子元素列表
   */
  children: VFXItem[] = [];
  /**
   * 元素的变换包含位置、旋转、缩放。
   */
  transform: Transform = new Transform();
  /**
   * 元素动画的当前时间
   */
  time = -1;
  /**
   * 元素动画的持续时间
   */
  duration = 0;
  /**
   * 父元素的 id
   */
  parentId?: string;
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
   * @deprecated 2.7.0 Please use `getInstanceId` instead
   */
  id: string;
  /**
   * 元素类型
   */
  type: spec.ItemType = spec.ItemType.base;
  /**
   * @deprecated 2.9.0 Please use `definition` instead
   */
  props: spec.VFXItemData;
  /**
   * 元素绑定的组件列表
   */
  components: Component[] = [];
  /**
   * @internal
   */
  isDuringPlay = false;
  /**
   * 元素渲染顺序是否由用户手动设置，手动设置后会覆盖默认的渲染顺序
   * @internal
   */
  isManuallySetRenderOrder = false;
  /**
   * 元素是否激活
   */
  private active = true;
  /**
   * 元素组件是否显示，用于批量开关元素组件
   */
  private visible = true;
  private listIndex = 0;
  private isEnabled = false;
  private eventProcessor: EventEmitter<ItemEvent> = new EventEmitter();
  private _composition: Composition | null;

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
    props?: spec.Item,
  ) {
    super(engine);
    this.name = 'VFXItem';
    this.transform.name = this.name;
    this.transform.engine = engine;
    if (props) {
      this.fromData(props as spec.VFXItemData);
    }
  }

  /**
   * 获取元素的合成
   */
  get composition (): Composition | null {
    return this._composition;
  }

  /**
   * 设置元素的合成
   */
  set composition (value: Composition) {
    this._composition = value;

    for (const child of this.children) {
      if (!child.composition) {
        child.composition = value;
      }
    }
  }

  /**
   * 播放完成后是否需要再使用，是的话生命周期结束后不会 dispose
   * @deprecated
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
    this.listIndex = value;
    this.isManuallySetRenderOrder = true;
    this.setRendererComponentOrder(value);
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
   * 添加组件
   * @param classConstructor - 要添加的组件
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

  getDescendants (directDescendantsOnly?: boolean, predicate?: (node: VFXItem) => boolean): VFXItem[] {
    const results: VFXItem[] = [];

    this.getDescendantsInternal(results, directDescendantsOnly, predicate);

    return results;
  }

  setParent (vfxItem: VFXItem) {
    if (vfxItem === this && !vfxItem) {
      return;
    }

    if (this.parent) {
      removeItem(this.parent.children, this);
    }

    this.parent = vfxItem;
    this.transform.parentTransform = vfxItem.transform;
    vfxItem.children.push(this);

    if (!this.composition && vfxItem.composition) {
      this.composition = vfxItem.composition;
    }

    this.onParentChanged();

    if (!this.isDuringPlay && vfxItem.isDuringPlay) {
      this.awake();
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
   * @deprecated 2.6.0 Please use `Component.setColor` instead
   */
  setColor (r: number, g: number, b: number, a: number) {
  }

  /**
   * 设置元素的透明度
   * @param opacity - 透明度值，范围 [0,1]
   * @internal
   * @deprecated 2.6.0 Please use `Component.setColor` instead
   */
  setOpacity (opacity: number) {
  }

  /**
   * 激活或停用 VFXItem
   */
  setActive (value: boolean) {
    if (this.active !== !!value) {
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
   * @since 2.6.0
   */
  set isActive (value: boolean) {
    this.setActive(value);
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
   * 设置本地坐标位置
   */
  setPosition (x: number, y: number, z: number) {
    this.transform.setPosition(x, y, z);
  }
  /**
   * 设置本地坐标欧拉旋转
   */
  setRotation (x: number, y: number, z: number) {
    this.transform.setRotation(x, y, z);
  }
  /**
   * 设置本地坐标缩放
   */
  setScale (x: number, y: number, z: number) {
    this.transform.setScale(x, y, z);
  }

  /**
   * 设置世界坐标位置
   * @param x - 世界坐标 x
   * @param y - 世界坐标 y
   * @param z - 世界坐标 z
   */
  setWorldPosition (x: number, y: number, z: number) {
    this.transform.setWorldPosition(x, y, z);
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
      const { width, height } = this.composition.engine.canvas.getBoundingClientRect();

      this.transform.setPosition((2 * x / width - 1) * rx, (1 - 2 * y / height) * ry, z);
    }
  }

  translateByPixel (x: number, y: number) {
    if (this.composition) {
      const { width, height } = this.composition.engine.canvas.getBoundingClientRect();
      const { z } = this.transform.getWorldPosition();
      const { x: rx, y: ry } = this.composition.camera.getInverseVPRatio(z);

      this.transform.translate(2 * x * rx / width, -2 * y * ry / height, 0);
    }
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
   * 对当前元素及其子节点进行射线命中测试
   *
   * @param ray - 射线
   * @param x - 归一化屏幕坐标 x
   * @param y - 归一化屏幕坐标 y
   * @param regions - 命中结果收集数组
   * @param hitPositions - 共享的命中位置数组，所有 region 共享同一引用
   * @param force - 是否强制测试无交互信息的元素
   * @param options - 额外选项（maxCount、stop、skip）
   * @returns 是否有任何命中
   */
  hitTest (
    ray: Ray,
    x: number,
    y: number,
    regions: Region[],
    hitPositions: Vector3[],
    force?: boolean,
    options?: CompositionHitTestOptions,
  ): boolean {
    if (!this.isActive) {
      return false;
    }

    let hitTestSuccess = false;
    const maxCount = options?.maxCount;
    const hitParams = this.getHitTestParams(force);

    // 1. 测试自身
    if (hitParams) {
      const clipMasks = hitParams.clipMasks;
      let clipPassed = true;

      if (clipMasks.length > 0 && !hitTestMask(ray, clipMasks)) {
        clipPassed = false;
      }

      if (clipPassed) {
        let success = false;
        const intersectPoint = new Vector3();

        if (hitParams.type === HitTestType.triangle) {
          const { triangles, backfaceCulling } = hitParams;

          for (let j = 0; j < triangles.length; j++) {
            if (ray.intersectTriangle(triangles[j], intersectPoint, backfaceCulling)) {
              success = true;
              hitPositions.push(intersectPoint);

              break;
            }
          }
        } else if (hitParams.type === HitTestType.box) {
          const { center, size } = hitParams;
          const boxMin = center.clone().addScaledVector(size, 0.5);
          const boxMax = center.clone().addScaledVector(size, -0.5);

          if (ray.intersectBox({ min: boxMin, max: boxMax }, intersectPoint)) {
            success = true;
            hitPositions.push(intersectPoint);
          }
        } else if (hitParams.type === HitTestType.sphere) {
          const { center, radius } = hitParams;

          if (ray.intersectSphere({ center, radius }, intersectPoint)) {
            success = true;
            hitPositions.push(intersectPoint);
          }
        } else if (hitParams.type === HitTestType.custom) {
          const tempPosition = hitParams.collect(ray, new Vector2(x, y));

          if (tempPosition && tempPosition.length > 0) {
            tempPosition.forEach(pos => {
              hitPositions.push(pos);
            });
            success = true;
          }
        }

        if (success) {
          const region: Region = {
            id: this.getInstanceId(),
            name: this.name,
            position: hitPositions[hitPositions.length - 1],
            parentId: this.parentId,
            hitPositions,
            behavior: hitParams.behavior,
            item: this,
            composition: this.composition as Composition,
          };

          regions.push(region);
          hitTestSuccess = true;

          if (options?.stop?.(region)) {
            return true;
          }
        }
      }
    }

    // 2. 递归测试子节点
    for (const child of this.children) {
      if (maxCount !== undefined && regions.length >= maxCount) {
        break;
      }
      if (options?.skip?.(child)) {
        continue;
      }
      if (child.hitTest(ray, x, y, regions, hitPositions, force, options)) {
        hitTestSuccess = true;
      }
    }

    // 3. composition 元素：子元素命中时，将自身也加入结果（根元素除外）
    if (VFXItem.isComposition(this) && hitTestSuccess && this !== this.composition?.rootItem) {
      regions.push({
        id: this.getInstanceId(),
        name: this.name,
        position: hitPositions[hitPositions.length - 1],
        parentId: this.parentId,
        hitPositions,
        behavior: spec.InteractBehavior.NONE,
        item: this,
        composition: this.composition as Composition,
      });
    }

    return hitTestSuccess;
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
   * 复制 VFXItem，返回一个新的 VFXItem
   * @since 2.4.0
   * @returns 复制的新 VFXItem
   */
  duplicate () {
    const previousObjectIDMap: Map<EffectsObject, string> = new Map();

    this.gatherPreviousObjectID(previousObjectIDMap);
    // 重新设置当前元素和组件的 ID 以及子元素和子元素组件的 ID，避免实例化新的对象时产生碰撞
    this.refreshGUIDRecursive();
    const newItem = this.engine.findObject<VFXItem>({ id: this.definition.id });

    newItem.refreshGUIDRecursive();
    this.refreshGUIDRecursive(previousObjectIDMap);

    if (this.composition) {
      newItem.setParent(this.composition.rootItem);
    }

    return newItem;
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
  awake () {
    for (const component of this.components) {
      if (!component.isAwakeCalled) {
        component.onAwake();
        component.isAwakeCalled = true;
      }
    }
    for (const child of this.children) {
      child.awake();
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

  private onParentChanged () {
    for (const component of this.components) {
      component.onParentChanged();
    }

    for (const child of this.children) {
      child.onParentChanged();
    }
  }

  /**
   * @internal
   */
  setRendererComponentOrder (renderOrder: number) {
    for (const component of this.components) {
      if (component instanceof RendererComponent) {
        component.priority = renderOrder;
      }
    }
  }

  override fromData (data: spec.VFXItemData): void {
    super.fromData(data);
    const {
      id, name, parentId, endBehavior, transform,
      duration = 0, visible = true,
    } = data;

    this.type = data.type;
    this.props = data;
    this.id = id.toString(); // TODO 老数据 id 是 number，需要转换
    this.parentId = parentId;
    this.components.length = 0;

    if (VFXItem.isComposition(this)) {
      const refId = (this.definition as spec.CompositionItem).content.options.refId;
      const compositionData = this.engine.findEffectsObjectData(refId) as unknown as spec.CompositionData;

      if (!compositionData) {
        throw new Error(`Referenced precomposition with Id: ${refId} does not exist.`);
      }

      this.instantiatePreComposition(compositionData);
    }

    // 在预合成实例化后赋值，覆盖预合成的属性值
    this.name = name;
    this.duration = duration;
    this.endBehavior = endBehavior;

    if (transform) {
      this.transform.fromData(transform);
    }

    this.transform.name = this.name;
    this.transform.engine = this.engine;

    if (!data.content) {
      data.content = { options: {} };
    }

    if (duration < 0) {
      throw new Error(`Item duration can't be less than 0, see ${HELP_LINK['Item duration can\'t be less than 0']}.`);
    }

    if (data.components) {
      for (const componentPath of data.components) {
        const component = this.engine.findObject<Component>(componentPath);

        this.components.push(component);
        // TODO ParticleSystemRenderer 现在是动态生成的，后面需要在 json 中单独表示为一个组件
        if (component instanceof ParticleSystem) {
          if (!this.components.includes(component.renderer)) {
            this.components.push(component.renderer);
          }
        }
      }
    }

    for (const child of data.children ?? []) {
      const childItem = this.engine.findObject<VFXItem>(child);

      childItem.setParent(this);
    }

    this.setVisible(visible);
  }

  override toData (): void {
    this.definition.id = this.guid;
    this.definition.transform = this.transform.toData();
    this.definition.dataType = spec.DataType.VFXItemData;
    if (this.parent?.name !== 'rootItem') {
      this.definition.parentId = this.parent?.guid;
    }

    // TODO 统一 sprite 等其他组件的序列化逻辑
    if (!this.definition.components) {
      this.definition.components = [];
      for (const component of this.components) {
        if (component instanceof EffectComponent) {
          this.definition.components.push(component);
        }
      }
    }
    this.definition.content = {};
  }

  /**
   * 销毁元素
   */
  override dispose (): void {

    if (this.composition) {
      this.composition.destroyItem(this);
      // component 调用 dispose() 会将自身从 this.components 数组删除，slice() 避免迭代错误
      for (const component of this.components.slice()) {
        component.dispose();
      }
      this.components = [];
      this._composition = null;
      this.transform.setValid(false);
    }

    this.resetChildrenParent();

    super.dispose();
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
  }

  /**
   * @internal
   */
  instantiatePreComposition (compositionData: spec.CompositionData, refreshId = true) {
    this.name = compositionData.name;
    this.duration = compositionData.duration;
    this.endBehavior = compositionData.endBehavior;

    const prevInstanceId = this.getInstanceId();

    // Set the current preComposition item id to the referenced composition id to prevent the composition component from not finding the correct item
    this.setInstanceId(compositionData.id);

    for (const componentPath of compositionData.components) {
      const component = this.engine.findObject<Component>(componentPath);

      component.item = this;
      this.components.push(component);
    }

    for (const child of compositionData.children ?? []) {
      const childItem = this.engine.findObject<VFXItem>(child);

      childItem.setParent(this);
    }

    if (refreshId) {
      for (const component of this.components) {
        component.setInstanceId(generateGUID());
      }

      for (const child of this.children) {
        child.refreshGUIDRecursive();
      }
    }

    this.setInstanceId(prevInstanceId);
  }

  /**
   * @internal
   */
  refreshGUIDRecursive (previousObjectIDMap?: Map<EffectsObject, string>) {
    const itemGUID = previousObjectIDMap?.get(this) ?? generateGUID();

    this.setInstanceId(itemGUID);
    for (const component of this.components) {
      const componentGUID = previousObjectIDMap?.get(component) ?? generateGUID();

      component.setInstanceId(componentGUID);
    }

    for (const child of this.children) {
      child.refreshGUIDRecursive(previousObjectIDMap);
    }
  }

  private gatherPreviousObjectID (previousObjectIDMap: Map<EffectsObject, string>) {
    previousObjectIDMap.set(this, this.getInstanceId());
    for (const component of this.components) {
      previousObjectIDMap.set(component, component.getInstanceId());
    }

    for (const child of this.children) {
      child.gatherPreviousObjectID(previousObjectIDMap);
    }
  }

  private getDescendantsInternal (
    results: VFXItem[],
    directDescendantsOnly = false,
    predicate?: (node: VFXItem) => boolean,
  ): void {
    if (!this.children) {
      return;
    }

    for (let index = 0; index < this.children.length; index++) {
      const item = this.children[index];

      if (!predicate || predicate(item)) {
        results.push(item);
      }

      if (!directDescendantsOnly) {
        item.getDescendantsInternal(results, false, predicate);
      }
    }
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
 * 遮罩命中测试：检查射线是否通过所有遮罩区域
 * 根据每个遮罩的 transform（size、scale、position、rotation、anchor）构建世界空间矩形，
 * 然后检测射线是否与该矩形相交。所有遮罩都必须通过才算测试通过。
 * @param ray - 射线
 * @param clipMasks - 遮罩列表
 * @returns 射线是否通过所有遮罩测试
 */
function hitTestMask (ray: Ray, clipMasks: Maskable[]): boolean {
  for (const mask of clipMasks) {
    const item = mask.item;

    if (!item.isActive || !item.transform.getValid()) {
      continue;
    }

    const transform = item.transform;
    const worldMatrix = transform.getWorldMatrix();
    const sx = transform.size.x;
    const sy = transform.size.y;

    // 将遮罩矩形的四个顶点从本地空间变换到世界空间
    // 本地空间顶点为单位矩形 (-0.5, -0.5) 到 (0.5, 0.5)，按 size 缩放
    const p0 = new Vector3(-0.5 * sx, 0.5 * sy, 0).applyMatrix(worldMatrix);
    const p1 = new Vector3(-0.5 * sx, -0.5 * sy, 0).applyMatrix(worldMatrix);
    const p2 = new Vector3(0.5 * sx, 0.5 * sy, 0).applyMatrix(worldMatrix);
    const p3 = new Vector3(0.5 * sx, -0.5 * sy, 0).applyMatrix(worldMatrix);

    // 矩形由两个三角形组成，检测射线与任一三角形的相交
    const triangle1 = { p0, p1, p2 };
    const triangle2 = { p0: p2, p1, p2: p3 };

    if (!ray.intersectTriangle(triangle1) && !ray.intersectTriangle(triangle2)) {
      return false;
    }
  }

  return true;
}
