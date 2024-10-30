import * as spec from '@galacean/effects-specification';
import type { Ray } from '@galacean/effects-math/es/core/ray';
import type { Matrix4 } from '@galacean/effects-math/es/core/matrix4';
import { Camera } from './camera';
import { CompositionComponent } from './comp-vfx-item';
import { CompositionSourceManager } from './composition-source-manager';
import { PLAYER_OPTIONS_ENV_EDITOR } from './constants';
import { setRayFromCamera } from './math';
import type { PluginSystem } from './plugin-system';
import type { EventSystem, Plugin, Region } from './plugins';
import type { MeshRendererOptions, Renderer } from './render';
import { RenderFrame } from './render';
import type { Scene } from './scene';
import type { Texture } from './texture';
import { TextureLoadAction, TextureSourceType } from './texture';
import type { Disposable, LostHandler } from './utils';
import { assertExist, logger, noop, removeItem } from './utils';
import type { VFXItemProps } from './vfx-item';
import { VFXItem } from './vfx-item';
import type { CompositionEvent } from './events';
import { EventEmitter } from './events';
import type { PostProcessVolume } from './components';
import { SceneTicking } from './composition/scene-ticking';
import { SerializationHelper } from './serialization-helper';

/**
 * 合成统计信息
 */
export interface CompositionStatistic {
  loadStart: number,
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
  id: string,
  name: string,
  phrase: number,
  compositionId: string,
}

/**
 *
 */
export interface CompositionHitTestOptions {
  maxCount?: number,
  stop?: (region: Region) => boolean,
  skip?: (item: VFXItem) => boolean,
}

/**
 *
 */
export interface CompositionProps {
  reusable?: boolean,
  baseRenderOrder?: number,
  renderer: Renderer,
  handleItemMessage: (message: MessageItem) => void,
  event?: EventSystem,
  width: number,
  height: number,
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
   * 是否播放完成后销毁 texture 对象
   */
  keepResource: boolean;
  /**
   * 合成内的元素否允许点击、拖拽交互
   * @since 1.6.0
   */
  interactive: boolean;

  /**
   * 合成是否结束
   */
  isEnded = false;

  compositionSourceManager: CompositionSourceManager;
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
   * 插件系统，保存当前加载的插件对象，负责插件事件和创建插件的 Item 对象
   */
  readonly pluginSystem: PluginSystem;
  /**
   * 是否在合成结束时自动销毁引用的纹理，合成重播时不销毁
   */
  readonly autoRefTex: boolean;
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
   * 预合成的合成属性，在 content 中会被其元素属性覆盖
   */
  readonly refCompositionProps: Map<string, spec.CompositionData> = new Map();
  /**
   * 合成的相机对象
   */
  readonly camera: Camera;
  /**
   * 后处理渲染配置
   */
  globalVolume?: PostProcessVolume;
  /**
   * 是否开启后处理
   */
  postProcessingEnabled = false;

  protected rendererOptions: MeshRendererOptions | null;
  // TODO: 待优化
  protected assigned = false;
  /**
   * 销毁状态位
   */
  protected destroyed = false;
  /**
   * 是否是否每次渲染时清除 RenderFrame 颜色缓存
   */
  protected readonly keepColorBuffer: boolean;
  protected rootComposition: CompositionComponent;
  protected readonly postLoaders: Plugin[] = [];

  /**
   * 合成暂停/播放 标识
   */
  private paused = false;
  private lastVideoUpdateTime = 0;
  private isEndCalled = false;

  private readonly texInfo: Record<string, number>;
  /**
   * 合成中消息元素创建/销毁时触发的回调
   */
  private handleItemMessage: (message: MessageItem) => void;

  /**
   * Composition 构造函数
   * @param props - composition 的创建参数
   * @param scene
   * @param compositionSourceManager
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
      handleItemMessage,
    } = props;

    this.compositionSourceManager = new CompositionSourceManager(scene, renderer.engine);

    if (reusable) {
      this.keepResource = true;
      scene.textures = undefined;
      scene.consumed = true;
    }
    const { sourceContent, pluginSystem, imgUsage, totalTime, refCompositionProps } = this.compositionSourceManager;

    this.postProcessingEnabled = scene.jsonScene.renderSettings?.postProcessingEnabled ?? false;

    assertExist(sourceContent);
    this.renderer = renderer;
    this.refCompositionProps = refCompositionProps;

    this.rootItem = new VFXItem(this.getEngine(), sourceContent as unknown as VFXItemProps);
    this.rootItem.name = 'rootItem';
    this.rootItem.composition = this;

    // Spawn rootCompositionComponent
    this.rootComposition = this.rootItem.addComponent(CompositionComponent);

    this.width = width;
    this.height = height;
    this.renderOrder = baseRenderOrder;
    this.id = sourceContent.id;
    this.renderer = renderer;
    this.texInfo = !reusable ? imgUsage : {};
    this.event = event;
    this.statistic = {
      loadStart: scene.startTime ?? 0,
      loadTime: totalTime ?? 0,
      compileTime: 0,
      firstFrameTime: 0,
    };
    this.reusable = reusable;
    this.speed = speed;
    this.autoRefTex = !this.keepResource && this.texInfo && this.rootItem.endBehavior !== spec.EndBehavior.restart;
    this.name = sourceContent.name;
    this.pluginSystem = pluginSystem as PluginSystem;
    this.pluginSystem.initializeComposition(this, scene);
    this.camera = new Camera(this.name, {
      ...sourceContent?.camera,
      aspect: width / height,
    });
    this.url = scene.url;
    this.assigned = true;
    this.interactive = true;
    this.handleItemMessage = handleItemMessage;
    this.createRenderFrame();
    this.rendererOptions = null;
    SerializationHelper.deserialize(sourceContent as unknown as spec.EffectsObjectData, this.rootComposition);
    this.rootComposition.createContent();

    this.buildItemTree(this.rootItem);
    this.pluginSystem.resetComposition(this, this.renderFrame);
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
    return this.compositionSourceManager.textures;
  }

  /**
   * 获取合成中所有元素
   */
  get items (): VFXItem[] {
    return this.rootComposition.items;
  }

  /**
   * 获取合成开始渲染的时间
   */
  get startTime () {
    return this.rootComposition.startTime;
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
    this.items.forEach(item => {
      item.setVisible(visible);
    });
  }

  /**
   * 获取合成的动画速度
   * @returns
   */
  getSpeed () {
    return this.speed;
  }

  play () {
    if (this.isEnded && this.reusable) {
      this.restart();
    }
    if (this.rootComposition.isStartCalled) {
      this.gotoAndPlay(this.time - this.startTime);
    } else {
      this.gotoAndPlay(0);
    }
  }

  /**
   * 暂停合成的播放
   */
  pause () {
    this.paused = true;
  }

  getPaused () {
    return this.paused;
  }

  /**
   * 恢复合成的播放
   */
  resume () {
    this.paused = false;
  }

  /**
   * 跳转合成到指定时间播放
   * @param time - 相对 startTime 的时间
   */
  gotoAndPlay (time: number) {
    this.setTime(time);
    this.resume();
  }

  /**
   * 跳转合成到指定时间并暂停
   * @param time - 相对 startTime 的时间
   */
  gotoAndStop (time: number) {
    this.setTime(time);
    this.pause();
  }

  /**
   *
   */
  createRenderFrame () {
    this.renderFrame = new RenderFrame({
      camera: this.camera,
      renderer: this.renderer,
      keepColorBuffer: this.keepColorBuffer,
      globalVolume: this.globalVolume,
      postProcessingEnabled: this.postProcessingEnabled,
    });
    // TODO 考虑放到构造函数
    this.renderFrame.cachedTextures = this.textures;
  }

  /**
   * 跳到指定时间点（不做任何播放行为）
   * @param time - 相对 startTime 的时间
   */
  setTime (time: number) {
    const speed = this.speed;
    const pause = this.paused;

    if (pause) {
      this.resume();
    }
    if (!this.rootComposition.isStartCalled) {
      this.rootComposition.onStart();
      this.rootComposition.isStartCalled = true;
    }
    this.setSpeed(1);
    this.forwardTime(time + this.startTime);
    this.setSpeed(speed);
    if (pause) {
      this.pause();
    }
  }

  addItem (item: VFXItem) {
    this.items.push(item);
    item.setParent(this.rootItem);
  }

  /**
   * 前进合成到指定时间
   * @param time - 相对0时刻的时间
   */
  private forwardTime (time: number) {
    const deltaTime = time * 1000 - this.rootComposition.time * 1000;
    const reverse = deltaTime < 0;
    const step = 15;
    let t = Math.abs(deltaTime);
    const ss = reverse ? -step : step;

    for (t; t > step; t -= step) {
      this.update(ss);
    }
    this.update(reverse ? -t : t);
  }

  /**
   * 重置状态函数
   */
  protected reset () {
    this.rendererOptions = null;
    this.isEnded = false;
    this.isEndCalled = false;
    this.rootComposition.time = 0;
    this.pluginSystem.resetComposition(this, this.renderFrame);
  }

  prepareRender () {
    const frame = this.renderFrame;

    frame._renderPasses[0].meshes.length = 0;

    this.postLoaders.length = 0;
    this.pluginSystem.plugins.forEach(loader => {
      if (loader.prepareRenderFrame(this, frame)) {
        this.postLoaders.push(loader);
      }
    });

    this.gatherRendererComponent(this.rootItem, frame);
    this.postLoaders.forEach(loader => loader.postProcessFrame(this, frame));
  }

  protected gatherRendererComponent (vfxItem: VFXItem, renderFrame: RenderFrame) {
    for (const rendererComponent of vfxItem.rendererComponents) {
      if (rendererComponent.isActiveAndEnabled) {
        renderFrame.addMeshToDefaultRenderPass(rendererComponent);
      }
    }

    for (const item of vfxItem.children) {
      this.gatherRendererComponent(item, renderFrame);
    }
  }

  /**
   * 合成更新，针对所有 item 的更新
   * @param deltaTime - 更新的时间步长
   */
  update (deltaTime: number) {
    if (!this.assigned || this.paused) {
      return;
    }

    const dt = this.getUpdateTime(deltaTime * this.speed);

    this.updateRootComposition(dt / 1000);
    this.updateVideo();
    // 更新 model-tree-plugin
    this.updatePluginLoaders(deltaTime);

    // scene VFXItem components lifetime function.
    if (!this.rootItem.isDuringPlay) {
      this.callAwake(this.rootItem);
      this.rootItem.beginPlay();
    }
    this.sceneTicking.update.tick(dt);
    this.sceneTicking.lateUpdate.tick(dt);

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

  private getUpdateTime (t: number) {
    const startTimeInMs = this.startTime * 1000;
    const now = this.rootComposition.time * 1000;

    if (t < 0 && (now + t) < startTimeInMs) {
      return startTimeInMs - now;
    }

    return t;
  }

  private callAwake (item: VFXItem) {
    for (const component of item.components) {
      if (!component.isAwakeCalled) {
        component.onAwake();
        component.isAwakeCalled = true;
      }
    }
    for (const child of item.children) {
      this.callAwake(child);
    }
  }

  /**
   * 构建父子树，同时保存到 itemCacheMap 中便于查找
   */
  private buildItemTree (compVFXItem: VFXItem) {
    if (!compVFXItem.composition) {
      return;
    }

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
          item.parent = parent;
          item.transform.parentTransform = parent.transform;
          parent.children.push(item);
        } else {
          throw new Error('The element references a non-existent element, please check the data.');
        }
      }
    }

    for (const item of contentItems) {
      if (VFXItem.isComposition(item)) {
        this.buildItemTree(item);
      }
    }
  }

  /**
   * 更新视频数据到纹理
   * @override
   */
  updateVideo () {
    const now = performance.now();

    // 视频固定30帧更新
    if (now - this.lastVideoUpdateTime > 33) {
      (this.textures ?? []).forEach(tex => tex?.uploadCurrentVideoFrame());
      this.lastVideoUpdateTime = now;
    }
  }

  /**
   * 更新相机
   * @override
   */
  private updateCamera () {
    this.camera.updateMatrix();
  }

  /**
   * 插件更新，来自 CompVFXItem 的更新调用
   * @param deltaTime - 更新的时间步长
   */
  private updatePluginLoaders (deltaTime: number) {
    this.pluginSystem.plugins.forEach(loader => loader.onCompositionUpdate(this, deltaTime));
  }

  /**
   * 更新主合成组件
   */
  private updateRootComposition (deltaTime: number) {
    if (this.rootComposition.isActiveAndEnabled) {

      let localTime = this.time + deltaTime - this.rootItem.start;
      let isEnded = false;

      const duration = this.rootItem.duration;
      const endBehavior = this.rootItem.endBehavior;

      if (localTime - duration > 0.001) {

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

      this.rootComposition.time = localTime;

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
   * Item 求交测试，返回求交结果列表，x 和 y 是归一化到[-1, 1]区间的值，原点在左上角
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

    this.rootItem.getComponent(CompositionComponent)?.hitTest(ray, x, y, regions, force, options);
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
      this.handleItemMessage({
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
      this.handleItemMessage({
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
   * 销毁插件 Item 中保存的纹理数组
   * @internal
   * @param textures - 需要销毁的数组
   */
  destroyTextures (textures: (Texture | null | undefined)[]) {
    for (let i = 0; i < textures.length; i++) {
      const texture: Texture | null | undefined = textures[i];

      if (!texture) {
        continue;
      }
      if (texture.sourceType === TextureSourceType.data && !(this.texInfo[texture.getInstanceId()])) {
        if (
          texture !== this.rendererOptions?.emptyTexture &&
          texture !== this.renderFrame.transparentTexture &&
          texture !== this.getEngine().emptyTexture
        ) {
          texture.dispose();
        }
        continue;
      }
      if (this.autoRefTex) {
        // texInfo的类型有点不明确，改成<string, number>不会提前删除texture
        const c = --this.texInfo[texture.getInstanceId()];

        if (!c) {
          if (__DEBUG__) {
            console.debug(`Destroy no ref texture: ${texture?.id}.`);
            if (isNaN(c)) {
              logger.error(`Texture ${texture?.id} not found usage.`);
            }
          }
          texture.dispose();
        }
      }
    }
  }

  /**
   * 销毁 Item
   * @internal
   * @param item - 需要销毁的 item
   */
  destroyItem (item: VFXItem) {
    // 预合成元素销毁时销毁其中的item
    if (item.type == spec.ItemType.composition) {
      if (item.endBehavior !== spec.EndBehavior.freeze) {
        const contentItems = item.getComponent(CompositionComponent).items;

        contentItems.forEach(it => this.pluginSystem.plugins.forEach(loader => loader.onCompositionItemRemoved(this, it)));
      }
    } else {
      // this.content.removeItem(item);
      // 预合成中的元素移除
      // this.refContent.forEach(content => content.removeItem(item));
      removeItem(this.items, item);
      this.pluginSystem.plugins.forEach(loader => loader.onCompositionItemRemoved(this, item));
    }
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

    const textureDisposes: Record<string, () => void> = {};
    const textures = this.textures;

    if (textures) {
      if (this.keepResource) {
        textures.forEach(tex => {
          if (tex?.dispose) {
            textureDisposes[tex.id] = tex.dispose;
            tex.dispose = noop;
          }
        });
      } else {
        // textures.forEach(tex => tex && tex.dispose());
      }
    }
    this.rootItem.dispose();
    // FIXME: 注意这里增加了renderFrame销毁
    this.renderFrame.dispose();
    this.rendererOptions?.emptyTexture.dispose();
    this.pluginSystem?.destroyComposition(this);
    this.update = () => {
      if (!__DEBUG__) {
        logger.error(`Update disposed composition: ${this.name}.`);
      }
    };
    this.dispose = noop;
    if (textures && this.keepResource) {
      textures.forEach(tex => tex.dispose = textureDisposes[tex.id]);
    }
    this.compositionSourceManager.dispose();
    this.refCompositionProps.clear();

    if (this.renderer.env === PLAYER_OPTIONS_ENV_EDITOR) {
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

  getRendererOptions (): MeshRendererOptions {
    if (!this.rendererOptions) {
      this.rendererOptions = {
        emptyTexture: this.renderFrame.emptyTexture,
        cachePrefix: '-',
      };
    }

    return this.rendererOptions;
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
