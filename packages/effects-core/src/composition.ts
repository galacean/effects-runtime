import * as spec from '@galacean/effects-specification';
import type { Ray } from '@galacean/effects-math/es/core/index';
import { LOG_TYPE } from './config';
import type { JSONValue } from './downloader';
import type { Scene } from './scene';
import type { Disposable, LostHandler } from './utils';
import { assertExist, noop } from './utils';
import { Transform } from './transform';
import type { VFXItem, VFXItemContent, VFXItemProps } from './vfx-item';
import type { ItemNode } from './comp-vfx-item';
import { CompVFXItem } from './comp-vfx-item';
import type { InteractVFXItem, Plugin, EventSystem } from './plugins';
import type { PluginSystem } from './plugin-system';
import type { MeshRendererOptions, Renderer, GlobalVolume } from './render';
import type { Texture } from './texture';
import { TextureSourceType } from './texture';
import { RenderFrame } from './render';
import { Camera } from './camera';
import { setRayFromCamera } from './math';
import type { Region } from './plugins';
import { CompositionSourceManager } from './composition-source-manager';

export interface CompositionStatistic {
  loadTime: number,
  loadStart: number,
  firstFrameTime: number,
}

export interface MessageItem {
  id: string,
  name: string,
  phrase: number,
  compositionId: number,
}

/**
 *
 */
export interface CompositionHitTestOptions {
  maxCount?: number,
  stop?: (region: Region) => boolean,
  skip?: (item: VFXItem<VFXItemContent>) => boolean,
}

export interface CompositionProps {
  reusable?: boolean,
  baseRenderOrder?: number,
  renderer: Renderer,
  handlePlayerPause?: (item: VFXItem<any>) => void,
  handleMessageItem?: (item: MessageItem) => void,
  handleEnd?: (composition: Composition) => void,
  event?: EventSystem,
  width: number,
  height: number,
  speed?: number,
}

let seed = 1;

/**
 * 合成抽象类：核心对象，通常一个场景只包含一个合成，可能会有多个合成。
 * 合成中包含了相关的 Item 元素，支持对 Item 元素的创建、更新和销毁。
 * 也负责 Item 相关的动画播放控制，和持有渲染帧数据。
 */
export class Composition implements Disposable, LostHandler {
  renderer: Renderer;
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

  compositionSourceManager: CompositionSourceManager;
  /**
   * 合成渲染顺序，默认按升序渲染
   */
  renderOrder: number;
  /**
   * 所有合成 Item 的根变换
   */
  transform: Transform;
  /**
   * 播放完成后是否需要再使用，是的话生命周期结束后不会自动 dispose
   */
  reusable: boolean;
  /**
   * 是否播放完成后销毁 texture 对象
   */
  keepResource: boolean;
  /**
   * 合成结束行为是 spec.END_BEHAVIOR_PAUSE 或 spec.END_BEHAVIOR_PAUSE_AND_DESTROY 时执行的回调
   */
  handlePlayerPause?: (item: VFXItem<any>) => void;
  /**
   * 单个合成结束时的回调
   */
  handleEnd?: (composition: Composition) => void;
  /**
   * 合成id
   */
  readonly id: number;
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
  autoRefTex: boolean;
  /**
   * 当前合成名称
   */
  readonly name: string;
  /**
   * 用于保存与当前合成相关的插件数据
   */
  readonly loaderData: Record<string, any> = {};
  /**
   * 渲染等级：S，A+，A，B+，B
   */
  readonly renderLevel?: spec.RenderLevel;
  /**
   * 场景加载和首帧渲染时间
   */
  readonly statistic: CompositionStatistic;
  /**
   * 合成对应的 url 或者 JSON
   */
  readonly url: string | JSONValue;
  /**
   * 合成对象
   */
  readonly content: CompVFXItem;
  /**
   * 预合成数组
   */
  readonly refContent: CompVFXItem[] = [];
  /**
   * 预合成的合成属性，在 content 中会被其元素属性覆盖
   */
  refCompositionProps: Map<string, VFXItemProps> = new Map();
  /**
   * 合成的相机对象
   */
  readonly camera: Camera;

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

  /**
   * 合成暂停/播放 标识
   */
  private paused = false;
  private lastVideoUpdateTime = 0;
  /**
   * 后处理渲染配置
   */
  private readonly globalVolume: GlobalVolume;
  // private readonly event: EventSystem;
  // texInfo的类型有点不明确，改成<string, number>不会提前删除texture
  private readonly texInfo: Record<string, number>;
  private readonly postLoaders: Plugin[] = [];
  private readonly handleMessageItem?: (item: MessageItem) => void;

  /**
   * Composition 构造函数
   * @param props - composition 的创建参数
   */
  constructor (props: CompositionProps, scene: Scene) {
    const {
      reusable = false,
      speed = 1,
      baseRenderOrder = 0, renderer,
      handlePlayerPause, handleMessageItem, handleEnd,
      event, width, height,
    } = props;

    this.compositionSourceManager = new CompositionSourceManager(scene, renderer.engine);

    scene.jsonScene.imgUsage = undefined;

    if (reusable) {
      this.keepResource = true;
      scene.textures = undefined;
      scene.consumed = true;
    }
    const { sourceContent, pluginSystem, imgUsage, totalTime, renderLevel, refCompositionProps } = this.compositionSourceManager;

    assertExist(sourceContent);

    this.refCompositionProps = refCompositionProps;
    const vfxItem = new CompVFXItem(sourceContent as unknown as VFXItemProps, this);
    const imageUsage = (!reusable && imgUsage) as unknown as Record<string, number>;

    this.transform = new Transform({
      name: this.name,
    });
    vfxItem.transform = this.transform;
    this.globalVolume = sourceContent.globalVolume;
    this.width = width;
    this.height = height;
    this.renderOrder = baseRenderOrder;
    this.id = seed++;
    this.renderer = renderer;
    this.texInfo = imageUsage ?? {};
    this.event = event;
    this.statistic = { loadTime: totalTime ?? 0, loadStart: scene.startTime ?? 0, firstFrameTime: 0 };
    this.reusable = reusable;
    this.speed = speed;
    this.renderLevel = renderLevel;
    this.autoRefTex = !this.keepResource && imageUsage && vfxItem.endBehavior !== spec.END_BEHAVIOR_RESTART;
    this.content = vfxItem;
    this.name = vfxItem.name;
    this.pluginSystem = pluginSystem as PluginSystem;
    this.pluginSystem.initializeComposition(this, scene);
    this.camera = new Camera(this.name, {
      ...sourceContent?.camera,
      aspect: width / height,
    });
    this.url = scene.url;
    this.assigned = true;
    this.handlePlayerPause = handlePlayerPause;
    this.handleMessageItem = handleMessageItem;
    this.handleEnd = handleEnd;
    this.createRenderFrame();
    this.reset();
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
  get items (): VFXItem<VFXItemContent>[] {
    return this.content.items;
  }

  /**
   * 获取合成开始时间
   */
  get startTime () {
    return this.content.startTime ?? 0;
  }

  /**
   * 获取合成当前时间
   */
  get time () {
    return this.content.timeInms / 1000;
  }

  /**
   * 获取销毁状态
   */
  get isDestroyed (): boolean {
    return this.destroyed;
  }

  /**
   * 获取合成的时长
   */
  getDuration () {
    return this.content.duration;
  }

  /**
   * 重新开始合成
   */
  restart () {
    this.content.reset();
    this.prepareRender();
    this.reset();
    this.transform.setValid(true);
    this.content.start();
    this.forwardTime(this.startTime);
    this.content.onUpdate(0);
    this.loaderData.spriteGroup.onUpdate(0);
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
   * 获取合成的动画速度
   * @returns
   */
  getSpeed () {
    return this.speed;
  }

  play () {
    if (this.content.ended && this.reusable) {
      this.restart();
    }
    this.gotoAndPlay(this.time);
  }

  /**
   * 暂停合成的播放
   */
  pause () {
    this.paused = true;
  }

  /**
   * 恢复合成的播放
   */
  resume () {
    this.paused = false;
  }

  gotoAndPlay (time: number) {
    this.resume();
    if (!this.content.started) {
      this.content.start();
      this.forwardTime(this.startTime);
    }
    this.forwardTime(time);
  }

  gotoAndStop (time: number) {
    this.gotoAndPlay(time);
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
    });
    // TODO 考虑放到构造函数
    this.renderFrame.cachedTextures = this.textures;

  }

  /**
   * 跳到指定时间点（不做任何播放行为）
   * @param time - 指定的时间
   */
  setTime (time: number) {
    const pause = this.paused;

    if (pause) {
      this.resume();
    }
    this.forwardTime(time, true);

    if (pause) {
      this.pause();
    }
  }

  private forwardTime (time: number, skipRender = false) {
    const deltaTime = (this.startTime + Math.max(0, time)) * 1000 - this.content.timeInms;
    const reverse = deltaTime < 0;
    const step = 15;
    let t = Math.abs(deltaTime);
    const ss = reverse ? -step : step;

    for (t; t > step; t -= step) {
      this.update(ss, skipRender);
    }
    this.update(reverse ? -t : t, skipRender);
  }

  /**
   * 重置状态函数
   */
  protected reset () {
    this.rendererOptions = null;
    this.pluginSystem.plugins.forEach(p => p.onCompositionWillReset(this, this.renderFrame));
    this.content.createContent();
    this.content.onEnd = () => {
      window.setTimeout(() => {
        this.handleEnd?.(this);
      }, 0);
    };
    this.pluginSystem.resetComposition(this, this.renderFrame);
  }

  private prepareRender () {
    const frame = this.renderFrame;

    this.postLoaders.length = 0;
    this.pluginSystem.plugins.forEach(loader => {
      if (loader.prepareRenderFrame(this, frame)) {
        this.postLoaders.push(loader);
      }
    });
    this.postLoaders.forEach(loader => loader.postProcessFrame(this, frame));
  }

  /**
   * 是否合成需要重新播放
   * @returns 重新播放合成标志位
   */
  private shouldRestart () {
    const { ended, endBehavior } = this.content;

    return ended && endBehavior === spec.END_BEHAVIOR_RESTART;
  }

  /**
   * 是否合成需要销毁
   * @returns 销毁合成标志位
   */
  private shouldDispose () {
    if (this.reusable) {
      return false;
    }
    const { ended, endBehavior } = this.content;

    return ended && (!endBehavior || endBehavior === spec.END_BEHAVIOR_PAUSE_AND_DESTROY);
  }

  /**
   * 合成更新，针对所有 item 的更新
   * @param deltaTime - 更新的时间步长
   * @param skipRender - 是否需要渲染
   */
  update (deltaTime: number, skipRender = false) {
    if (!this.assigned || this.paused) {
      return;
    }
    if (this.shouldRestart()) {
      this.restart();
      // restart then tick to avoid flicker
    }
    const time = this.content.getUpdateTime(deltaTime * this.speed);

    this.updateVideo();
    this.content.onUpdate(time);
    this.loaderData.spriteGroup.onUpdate(time);
    this.updateCamera();

    if (this.shouldDispose()) {
      this.dispose();
    } else {
      if (!skipRender) {
        this.prepareRender();
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
  updateCamera () {
    this.camera.updateMatrix();
  }

  /**
   * 插件更新，来自 CompVFXItem 的更新调用
   * @param deltaTime - 更新的时间步长
   */
  updatePluginLoaders (deltaTime: number) {
    this.pluginSystem.plugins.forEach(loader => loader.onCompositionUpdate(this, deltaTime));
  }

  /**
   * 通过名称获取元素
   * @param name - 元素名称
   * @param type - 元素类型
   * @returns 元素对象
   */
  getItemByName (name: string, type?: spec.ItemType) {
    if (this.content && this.content.items) {
      return this.content.getItemByName(name)[0];
    }
  }

  /**
   * 通过 id 获取元素
   * @param id - 元素 id
   * @return
   */
  getItemByID (id: string): VFXItem<VFXItemContent> | null {
    const items = this.content && this.content.items;

    if (items && this.content.itemCacheMap.has(id)) {
      return (this.content.itemCacheMap.get(id) as ItemNode).item;
    }

    return null;
  }

  /**
   * 获取指定元素当前时刻真正起作用的父元素, 需要在元素生命周期内获取
   * @internal
   * @param item - 指定元素
   * @return 当父元素生命周期结束时，返回空
   */
  getItemCurrentParent (item: VFXItem<VFXItemContent>): VFXItem<VFXItemContent> | void {
    return this.content.getItemCurrentParent(item);
  }

  /**
   * Item 的起始和结束事件
   * @internal
   * @param item - 合成元素
   * @param start - 是起始事件
   */
  itemLifetimeEvent (item: VFXItem<any>, start: boolean) {
    const func = start ?
      (p: Plugin) => p.onCompositionItemLifeBegin(this, item) :
      (p: Plugin) => p.onCompositionItemLifeEnd(this, item);

    this.pluginSystem.plugins.forEach(func);
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
    if (this.isDestroyed) {
      return [];
    }
    const regions: Region[] = [];
    const ray = this.getHitTestRay(x, y);

    this.content.hitTest(ray, x, y, regions, force, options);
    this.refContent.forEach(ref => {
      ref.hitTest(ray, x, y, regions, force, options);
    });

    return regions;
  }

  /**
   * InteractItem 生命周期开始时的调用
   * @param item - 交互元素
   * @param type - 交互类型
   */
  addInteractiveItem (item: InteractVFXItem, type: spec.InteractType) {
    if (type === spec.InteractType.MESSAGE) {
      this.handleMessageItem?.({
        name: item.name,
        phrase: spec.MESSAGE_ITEM_PHRASE_BEGIN,
        id: item.id,
        compositionId: this.id,
      });

      return item.id;
    }
  }

  /**
   * InteractItem 生命周期结束时的调用
   * @param item - 交互元素
   * @param type - 交互类型
   */
  removeInteractiveItem (item: InteractVFXItem, type: spec.InteractType) {
    // MESSAGE ITEM的结束行为
    if (type === spec.InteractType.MESSAGE) {
      this.handleMessageItem?.({
        name: item.name,
        phrase: spec.MESSAGE_ITEM_PHRASE_END,
        id: item.id,
        compositionId: this.id,
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
      if (texture.sourceType === TextureSourceType.data && !(this.texInfo[texture.id])) {
        if (
          texture !== this.rendererOptions?.emptyTexture &&
          texture !== this.renderFrame.transparentTexture
        ) {
          texture.dispose();
        }
        continue;
      }
      if (this.autoRefTex) {
        // texInfo的类型有点不明确，改成<string, number>不会提前删除texture
        const c = --this.texInfo[texture.id];

        if (!c) {
          if (__DEBUG__) {
            console.debug(`Destroy no ref texture: ${texture?.id}.`);
            if (isNaN(c)) {
              console.error({
                content: `Texture ${texture?.id} not found usage.`,
                type: LOG_TYPE,
              });
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
  destroyItem (item: VFXItem<VFXItemContent>) {
    // 预合成元素销毁时销毁其中的item
    if (item.type == spec.ItemType.composition) {
      if (item.endBehavior !== spec.END_BEHAVIOR_FREEZE) {
        (item as CompVFXItem).items.forEach(it => this.pluginSystem.plugins.forEach(loader => loader.onCompositionItemRemoved(this, it)));
      }
    } else {
      this.content.removeItem(item);
      // 预合成中的元素移除
      this.refContent.forEach(content => content.removeItem(item));
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
        textures.forEach(tex => tex && tex.dispose());
      }
    }
    this.content.dispose();
    // FIXME: 注意这里增加了renderFrame销毁
    this.renderFrame.dispose();
    this.rendererOptions?.emptyTexture.dispose();
    this.pluginSystem?.destroyComposition(this);
    this.update = () => {
      console.error({
        content: `Update disposed composition: ${this.name}.`,
        type: LOG_TYPE,
      });
    };
    this.handlePlayerPause = noop;
    this.dispose = noop;
    if (textures && this.keepResource) {
      textures.forEach(tex => tex.dispose = textureDisposes[tex.id]);
    }
    this.compositionSourceManager.dispose();
    this.refCompositionProps.clear();
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
      console.warn('Can not translate position when container not assigned');

      return;
    }
    this.content.translateByPixel(x, y);
  }

  /**
   * 设置合成在 3D 坐标轴上相对当前的位移
   */
  translate (x: number, y: number, z: number) {
    this.content.translate(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上相对原点的位移
   */
  setPosition (x: number, y: number, z: number) {
    this.content.setPosition(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上相对当前的旋转（角度）
   */
  rotate (x: number, y: number, z: number) {
    this.content.rotate(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上的相对原点的旋转（角度）
   */
  setRotation (x: number, y: number, z: number) {
    this.content.setRotation(x, y, z);
  }
  /**
   * 设置合成在 3D 坐标轴上相对当前的缩放
   */
  scale (x: number, y: number, z: number) {
    this.content.scale(x, y, z);
  }

  /**
   * 设置合成在 3D 坐标轴上的缩放
   */
  setScale (x: number, y: number, z: number) {
    this.content.setScale(x, y, z);
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
