import * as spec from '@galacean/effects-specification';
import type { Ray } from '@galacean/effects-math/es/core/ray';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Camera } from './camera';
import { CompositionComponent } from './components/composition-component';
import { PLAYER_OPTIONS_ENV_EDITOR } from './constants';
import { setRayFromCamera } from './math';
import { PluginSystem } from './plugin-system';
import type { EventSystem, Region } from './plugins';
import type { Renderer } from './render';
import { RenderFrame } from './render';
import type { Scene } from './scene';
import type { Texture } from './texture';
import { TextureLoadAction } from './texture';
import type { Constructor, Disposable, LostHandler } from './utils';
import { assertExist, logger, noop } from './utils';
import { VFXItem } from './vfx-item';
import type { CompositionEvent } from './events';
import { EventEmitter } from './events';
import type { Component, PostProcessVolume } from './components';
import { SceneTicking } from './composition/scene-ticking';
import { PlayState } from './plugins/timeline/playable';

/**
 * 合成统计信息
 */
export interface CompositionStatistic {
  loadStart: number,
  /**
   * 加载耗时
   */
  loadTime: number,
  /**
   * Shader 编译耗时
   */
  compileTime: number,
  /**
   * 从加载到渲染第一帧的时间（含 Shader 编译）
   */
  firstFrameTime: number,
}

/**
 * 合成消息对象
 */
export interface MessageItem {
  /**
   * 元素 ID
   */
  id: string,
  /**
   * 元素名称
   */
  name: string,
  /**
   * 消息阶段（2：开始，1：结束）
   */
  phrase: typeof spec.MESSAGE_ITEM_PHRASE_BEGIN | typeof spec.MESSAGE_ITEM_PHRASE_END,
  /**
   * 合成 ID
   */
  compositionId: string,
}

/**
 *
 */
export interface CompositionHitTestOptions {
  /**
   *
   */
  maxCount?: number,
  /**
   *
   * @param region
   * @returns
   */
  stop?: (region: Region) => boolean,
  /**
   *
   * @param item
   * @returns
   */
  skip?: (item: VFXItem) => boolean,
}

/**
 *
 */
export interface CompositionProps {
  /**
   *
   */
  reusable?: boolean,
  /**
   *
   */
  baseRenderOrder?: number,
  /**
   *
   */
  renderer: Renderer,
  /**
   *
   * @param message
   * @returns
   */
  onItemMessage?: (message: MessageItem) => void,
  /**
   *
   */
  event?: EventSystem,
  /**
   *
   */
  width: number,
  /**
   *
   */
  height: number,
  /**
   *
   */
  speed?: number,
}

/**
 * 合成抽象类：核心对象，通常一个场景只包含一个合成，可能会有多个合成。
 * 合成中包含了相关的 Item 元素，支持对 Item 元素的创建、更新和销毁。
 * 也负责 Item 相关的动画播放控制，和持有渲染帧数据。
 */
export class Composition extends EventEmitter<CompositionEvent<Composition>> implements Disposable, LostHandler {
  renderer: Renderer;
  /**
   *
   */
  sceneTicking = new SceneTicking();
  /**
   * 当前帧的渲染数据对象
   */
  renderFrame: RenderFrame;
  /**
   * 动画播放速度
   */
  speed = 1;
  /**
   * 是否卸载纹理贴图，就是将纹理贴图大小设置为1x1
   */
  textureOffloaded: boolean;
  /*
   * 场景中视频的播放进度
   */
  videoState: (number | undefined)[];
  /**
   * 合成渲染顺序，默认按升序渲染
   */
  renderOrder: number;
  /**
   * 播放完成后是否需要再使用，是的话生命周期结束后不会自动 dispose
   */
  reusable: boolean;
  /**
   * 合成内的元素否允许点击、拖拽交互
   * @since 1.6.0
   */
  interactive: boolean;
  /**
   * 合成是否结束
   */
  isEnded = false;
  /**
   * 合成id
   */
  readonly id: string;
  /**
   * 画布宽度
   */
  readonly width: number;
  /**
   * 画布高度
   */
  readonly height: number;
  /**
   * 鼠标和触屏处理系统
   */
  readonly event?: EventSystem;
  /**
   * 当前合成名称
   */
  readonly name: string;
  /**
   * 用于保存与当前合成相关的插件数据
   */
  readonly loaderData: Record<string, any> = {};
  /**
   * 场景加载和首帧渲染时间
   */
  readonly statistic: CompositionStatistic;
  /**
   * 合成对应的 url 或者 JSON
   */
  readonly url: Scene.LoadType;
  /**
   * 合成根元素
   */
  readonly rootItem: VFXItem;
  /**
   * 预合成数组
   */
  readonly refContent: VFXItem[] = [];
  /**
   * 合成的相机对象
   */
  readonly camera: Camera;
  /**
   * 合成开始渲染的时间
   */
  readonly startTime: number = 0;
  /**
   * 后处理渲染配置
   */
  globalVolume?: PostProcessVolume;
  /**
   * 是否开启后处理
   */
  postProcessingEnabled = false;
  /**
   * 合成中消息元素创建/销毁时触发的回调
   */
  onItemMessage?: (message: MessageItem) => void;
  /**
   * 销毁状态位
   */
  protected destroyed = false;
  protected rootComposition: CompositionComponent;

  /**
   * 合成暂停/播放 标识
   */
  private paused = false;
  private isEndCalled = false;
  private _textures: Texture[] = [];
  private videos: HTMLVideoElement[] = [];

  /**
   * @internal
   * 构建父子树，同时保存到 itemCacheMap 中便于查找
   */
  static buildItemTree (compVFXItem: VFXItem) {
    const itemMap = new Map<string, VFXItem>();
    const contentItems = compVFXItem.getComponent(CompositionComponent).items;

    for (const item of contentItems) {
      itemMap.set(item.id, item);
    }

    for (const item of contentItems) {
      if (item.parentId === undefined) {
        item.setParent(compVFXItem);
      } else {
        const parent = itemMap.get(item.parentId);

        if (parent) {
          item.setParent(parent);
        } else {
          throw new Error('The element references a non-existent element, please check the data.');
        }
      }
    }
  }

  /**
   * Composition 构造函数
   * @param props - composition 的创建参数
   * @param scene
   */
  constructor (
    props: CompositionProps,
    scene: Scene,
  ) {
    super();

    const {
      reusable = false,
      speed = 1,
      baseRenderOrder = 0,
      renderer, event, width, height,
      onItemMessage,
    } = props;

    this.renderer = renderer;
    this.renderer.engine.addComposition(this);
    this._textures = scene.textures;

    for (const key of Object.keys(scene.assets)) {
      const videoAsset = scene.assets[key];

      if (videoAsset instanceof HTMLVideoElement) {
        this.videos.push(videoAsset);
      }
    }

    this.postProcessingEnabled = scene.jsonScene.renderSettings?.postProcessingEnabled ?? false;
    this.getEngine().renderLevel = scene.renderLevel;

    if (reusable) {
      scene.consumed = true;
    }

    let sourceContent: spec.CompositionData = scene.jsonScene.compositions[0];

    for (const composition of scene.jsonScene.compositions) {
      if (composition.id === scene.jsonScene.compositionId) {
        sourceContent = composition;
      }
    }

    assertExist(sourceContent);

    // Instantiate composition rootItem
    this.rootItem = new VFXItem(this.getEngine());
    this.rootItem.setInstanceId(sourceContent.id);
    this.rootItem.name = 'rootItem';
    this.rootItem.duration = sourceContent.duration;
    this.rootItem.endBehavior = sourceContent.endBehavior;
    this.rootItem.composition = this;

    // Create rootItem components
    const componentPaths = sourceContent.components;

    for (const componentPath of componentPaths) {
      const component = this.getEngine().findObject<Component>(componentPath);

      this.rootItem.components.push(component);
      component.item = this.rootItem;
    }
    this.rootComposition = this.rootItem.getComponent(CompositionComponent);

    this.width = width;
    this.height = height;
    this.renderOrder = baseRenderOrder;
    this.id = sourceContent.id;
    this.startTime = sourceContent.startTime ?? 0;
    this.renderer = renderer;
    this.event = event;
    this.statistic = {
      loadStart: scene.startTime ?? 0,
      loadTime: scene.totalTime ?? 0,
      compileTime: 0,
      firstFrameTime: 0,
    };
    this.reusable = reusable;
    this.speed = speed;
    this.name = sourceContent.name;
    this.camera = new Camera(this.name, {
      ...sourceContent?.camera,
      aspect: width / height,
      pixelWidth: width,
      pixelHeight: height,
    });
    this.url = scene.url;
    this.interactive = true;
    if (onItemMessage) {
      this.onItemMessage = onItemMessage;
    }
    this.createRenderFrame();

    Composition.buildItemTree(this.rootItem);
    this.rootComposition.setChildrenRenderOrder(0);

    PluginSystem.initializeComposition(this, scene);
  }

  /**
   * 所有合成 Item 的根变换
   */
  get transform () {
    return this.rootItem.transform;
  }

  /**
   * 获取场景中的纹理数组
   */
  get textures () {
    return this._textures;
  }

  /**
   * 获取合成中所有元素
   */
  get items (): VFXItem[] {
    return this.rootItem.getDescendants();
  }

  /**
   * 获取合成当前时间
   */
  get time () {
    return this.rootComposition.time;
  }

  /**
   * 获取销毁状态
   */
  get isDestroyed (): boolean {
    return this.destroyed;
  }

  set viewportMatrix (matrix: Matrix4) {
    this.camera.setViewportMatrix(matrix);
  }
  get viewportMatrix () {
    return this.camera.getViewportMatrix();
  }

  /**
   * 获取合成的时长
   */
  getDuration () {
    return this.rootItem.duration;
  }

  /**
   * 重新开始合成
   */
  restart () {
    this.reset();
    this.forwardTime(this.startTime);
  }

  /**
   * 设置当前合成的渲染顺序
   * @param index - 序号，大的后绘制
   */
  setIndex (index: number) {
    this.renderOrder = index;
  }

  /**
   * 获取当前合成的渲染顺序
   * @returns
   */
  getIndex (): number {
    return this.renderOrder;
  }

  /**
   * 设置合成的动画速度
   * @param speed - 速度
   */
  setSpeed (speed: number) {
    this.speed = speed;
  }

  /**
   * 设置合成的可见性
   * @since 2.0.0
   * @param visible - 是否可见
   */
  setVisible (visible: boolean) {
    this.rootItem.setVisible(visible);
  }

  /**
   * 获取合成的动画速度
   * @returns
   */
  getSpeed () {
    return this.speed;
  }

  /**
   *
   */
  play () {
    if (this.isEnded && this.reusable) {
      this.restart();
    }
    if (this.rootComposition.isStartCalled) {
      this.setTime(this.time - this.startTime);
      this.resume();
    } else {
      this.setTime(0);
      this.resume();
    }
  }

  /**
   * 暂停合成的播放
   */
  pause () {
    this.paused = true;
    this.emit('pause');
  }

  /**
   *
   * @returns
   */
  getPaused () {
    return this.paused;
  }

  /**
   * 恢复合成的播放
   */
  resume () {
    this.paused = false;
    if (this.isEnded && this.reusable) {
      this.restart();
    }
    const time = this.time;

    this.emit('play', { time });
  }

  /**
   * 跳转合成到指定时间播放
   * @param time - 相对 startTime 的时间
   */
  gotoAndPlay (time: number) {
    this.setTime(time);
    this.emit('goto', { time });
    this.resume();
  }

  /**
   * 跳转合成到指定时间并暂停
   * @param time - 相对 startTime 的时间
   */
  gotoAndStop (time: number) {
    this.setTime(time);
    this.emit('goto', { time });
    this.pause();
  }

  /**
   *
   */
  createRenderFrame () {
    this.renderFrame = new RenderFrame({
      camera: this.camera,
      renderer: this.renderer,
      globalVolume: this.globalVolume,
      postProcessingEnabled: this.postProcessingEnabled,
    });
  }

  /**
   * 跳到指定时间点（不做任何播放行为）
   * @param time - 相对 startTime 的时间
   */
  setTime (time: number) {
    const speed = this.speed;
    const pause = this.getPaused();

    if (pause) {
      this.resume();
    }
    this.setSpeed(1);
    this.forwardTime(time + this.startTime);
    this.setSpeed(speed);
    if (pause) {
      this.paused = true;
    }
  }

  addItem (item: VFXItem) {
    item.setParent(this.rootItem);
  }

  /**
   * 获取合成上某一类型的组件
   * @since 2.6.0
   * @param classConstructor - 要获取的组件类型
   * @returns 查询结果中符合类型的第一个组件
   */
  getComponent<T extends Component> (classConstructor: Constructor<T>): T {
    return this.rootItem.getComponent(classConstructor);
  }

  /**
   * 前进合成到指定时间
   * @param time - 相对0时刻的时间
   */
  private forwardTime (time: number) {
    const deltaTime = time * 1000 - this.time * 1000;
    const reverse = deltaTime < 0;
    const step = 15;
    let t = Math.abs(deltaTime);
    const ss = reverse ? -step : step;

    // FIXME Update 中可能会修改合成时间，这边需要优化更新逻辑
    for (t; t > step; t -= step) {
      this.update(ss);
    }
    this.update(reverse ? -t : t);
  }

  /**
   * 重置状态函数
   */
  protected reset () {
    this.isEnded = false;
    this.isEndCalled = false;
    this.rootComposition.time = 0;
  }

  prepareRender () { }

  /**
   * 合成更新，针对所有 item 的更新
   * @param deltaTime - 更新的时间步长
   */
  update (deltaTime: number) {
    if (this.getPaused()) {
      return;
    }

    // Scene VFXItem components lifetime function
    if (!this.rootItem.isDuringPlay) {
      this.rootItem.awake();
      this.rootItem.beginPlay();
    }

    const previousCompositionTime = this.time;

    this.updateCompositionTime(deltaTime * this.speed / 1000);
    const deltaTimeInMs = (this.time - previousCompositionTime) * 1000;

    this.sceneTicking.update.tick(deltaTimeInMs);
    this.sceneTicking.lateUpdate.tick(deltaTimeInMs);

    this.updateCamera();
    this.prepareRender();

    if (this.isEnded && !this.isEndCalled) {
      this.isEndCalled = true;
      this.emit('end', { composition: this });
    }
    if (this.shouldDispose()) {
      this.dispose();
    }
  }

  private shouldDispose () {
    return this.isEnded && this.rootItem.endBehavior === spec.EndBehavior.destroy && !this.reusable;
  }

  /**
   * 更新相机
   * @override
   */
  private updateCamera () {
    this.camera.updateMatrix();
  }

  /**
   * 更新主合成组件
   */
  private updateCompositionTime (deltaTime: number) {
    if (this.rootComposition.state === PlayState.Paused || !this.rootComposition.isActiveAndEnabled) {
      return;
    }

    // 相对于合成开始时间的时间
    let localTime = this.time + deltaTime - this.startTime;

    if (deltaTime < 0 && localTime < 0) {
      localTime = 0;
    }

    const duration = this.rootItem.duration;
    const endBehavior = this.rootItem.endBehavior;

    let isEnded = false;

    if (localTime >= duration) {

      isEnded = true;

      switch (endBehavior) {
        case spec.EndBehavior.restart: {
          localTime = localTime % duration;
          this.restart();

          break;
        }
        case spec.EndBehavior.freeze: {
          localTime = Math.min(duration, localTime);

          break;
        }
        case spec.EndBehavior.forward: {

          break;
        }
        case spec.EndBehavior.destroy: {

          break;
        }
      }
    }

    this.rootComposition.time = localTime + this.startTime;

    // end state changed, handle onEnd flags
    if (this.isEnded !== isEnded) {
      if (isEnded) {
        this.isEnded = true;
      } else {
        this.isEnded = false;
        this.isEndCalled = false;
      }
    }
  }

  /**
   * 通过名称获取元素
   * @param name - 元素名称
   * @returns 元素对象
   */
  getItemByName (name: string) {
    return this.rootItem.find(name);
  }

  /**
   * 获取指定位置和相机连成的射线
   * @param x
   * @param y
   * @returns
   */
  getHitTestRay (x: number, y: number): Ray {
    const { x: a, y: b, z: c, w: d } = this.renderFrame.editorTransform;

    return setRayFromCamera((x - c) / a, (y - d) / b, this.camera);
  }

  /**
   * 获取 engine 对象
   * @returns
   */
  getEngine () {
    return this.renderer?.engine;
  }

  /**
   * Item 求交测试，返回求交结果列表，x 和 y 是归一化到[-1, 1]区间的值，x 向右，y 向上
   * @param x - 鼠标或触点的 x，已经归一化到[-1, 1]
   * @param y - 鼠标或触点的 y，已经归一化到[-1, 1]
   * @param force - 是否强制求交，没有交互信息的 Item 也要进行求交测试
   * @param options - 最大求交数和求交时的回调
   */
  hitTest (x: number, y: number, force?: boolean, options?: CompositionHitTestOptions): Region[] {
    if (this.isDestroyed || !this.interactive) {
      return [];
    }
    const regions: Region[] = [];
    const ray = this.getHitTestRay(x, y);

    this.refContent.forEach(ref => {
      ref.getComponent(CompositionComponent)?.hitTest(ray, x, y, regions, force, options);
    });

    return regions;
  }

  /**
   * InteractItem 生命周期开始时的调用
   * @param item - 交互元素
   * @param type - 交互类型
   */
  addInteractiveItem (item: VFXItem, type: spec.InteractType) {
    if (type === spec.InteractType.MESSAGE) {
      this.onItemMessage?.({
        name: item.name,
        phrase: spec.MESSAGE_ITEM_PHRASE_BEGIN,
        id: item.id,
        compositionId: this.id,
      });
      item.emit('message', {
        name: item.name,
        phrase: spec.MESSAGE_ITEM_PHRASE_BEGIN,
        id: item.id,
      });

      return item.id;
    }
  }

  /**
   * InteractItem 生命周期结束时的调用
   * @param item - 交互元素
   * @param type - 交互类型
   */
  removeInteractiveItem (item: VFXItem, type: spec.InteractType) {
    // MESSAGE ITEM 的结束行为
    if (type === spec.InteractType.MESSAGE) {
      this.onItemMessage?.({
        name: item.name,
        phrase: spec.MESSAGE_ITEM_PHRASE_END,
        id: item.id,
        compositionId: this.id,
      });
      item.emit('message', {
        name: item.name,
        phrase: spec.MESSAGE_ITEM_PHRASE_END,
        id: item.id,
      });
    }
  }

  /**
   * 销毁 Item
   * @internal
   * @param item - 需要销毁的 item
   */
  destroyItem (item: VFXItem) {
    // 预合成元素销毁时销毁其中的item
    // if (item.type !== spec.ItemType.composition) {
    // this.content.removeItem(item);
    // 预合成中的元素移除
    // this.refContent.forEach(content => content.removeItem(item));
    // removeItem(this.items, item);
    // }
  }

  lost (e: Event): void {
    this.videoState = this.textures.map(tex => {
      if ('video' in tex.source) {
        tex.source.video.pause();

        return tex.source.video.currentTime;
      }
    });

    this.textures.map(tex => tex.dispose());
    this.dispose();
  }

  /**
   * 合成对象销毁
   */
  dispose (): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;

    for (const texture of this.textures) {
      texture.dispose();
    }
    this._textures = [];

    for (const video of this.videos) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    this.videos = [];

    this.rootItem.dispose();
    // FIXME: 注意这里增加了renderFrame销毁
    this.renderFrame.dispose();
    PluginSystem.destroyComposition(this);

    this.update = () => {
      if (!__DEBUG__) {
        logger.error(`Update disposed composition: ${this.name}.`);
      }
    };

    this.dispose = noop;
    this.renderer.engine.removeComposition(this);

    if (this.getEngine().env === PLAYER_OPTIONS_ENV_EDITOR) {
      return;
    }

    this.renderer.clear({
      stencilAction: TextureLoadAction.clear,
      clearStencil: 0,
      depthAction: TextureLoadAction.clear,
      clearDepth: 1,
      colorAction: TextureLoadAction.clear,
      clearColor: [0, 0, 0, 0],
    });
  }

  /**
   * 编辑器使用的 transform 修改方法
   * @internal
   * @param scale - 缩放比例
   * @param dx - x偏移量
   * @param dy - y偏移量
   */
  setEditorTransform (scale: number, dx: number, dy: number) {
    this.renderFrame.editorTransform.set(scale, scale, dx, dy);
  }

  /**
   * 合成整体在水平方向移动 x 像素，垂直方向移动 y 像素
   */
  translateByPixel (x: number, y: number) {
    if (!this.renderer) {
      console.warn('Renderer not assigned. Operation aborted.');

      return;
    }
    this.rootItem.translateByPixel(x, y);
  }

  /**
   * 设置合成在画布上的像素位置
   * Tips:
   *  - 坐标原点在 canvas 左上角，x 正方向水平向右， y 正方向垂直向下
   *  - 设置后会覆盖原有的位置信息
   * @param x - x 坐标
   * @param y - y 坐标
   */
  setPositionByPixel (x: number, y: number) {
    if (!this.renderer) {
      console.warn('Renderer not assigned. Operation aborted.');

      return;
    }
    this.rootItem.setPositionByPixel(x, y);
  }

  /**
   * 设置合成在 3D 坐标轴上相对当前的位移
   */
  translate (x: number, y: number, z: number) {
    this.rootItem.translate(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上相对原点的位移
   */
  setPosition (x: number, y: number, z: number) {
    this.rootItem.setPosition(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上相对当前的旋转（角度）
   */
  rotate (x: number, y: number, z: number) {
    this.rootItem.rotate(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上的相对原点的旋转（角度）
   */
  setRotation (x: number, y: number, z: number) {
    this.rootItem.setRotation(x, y, z);
  }
  /**
   * 设置合成在 3D 坐标轴上相对当前的缩放
   */
  scale (x: number, y: number, z: number) {
    this.rootItem.scale(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上的缩放
   */
  setScale (x: number, y: number, z: number) {
    this.rootItem.setScale(x, y, z);
  }

  /**
   * 卸载贴图纹理方法，减少内存
   */
  offloadTexture () {
    if (!this.textureOffloaded) {
      this.textures.forEach(tex => tex && tex.offloadData());
      this.textureOffloaded = true;
    }
  }

  /**
   * 重新加载纹理
   */
  async reloadTexture () {
    if (this.textureOffloaded) {
      await Promise.all(this.textures.map(tex => tex?.reloadData()));
      this.textureOffloaded = false;
    }
  }
}
