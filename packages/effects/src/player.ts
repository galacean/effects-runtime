import type {
  Disposable, GLType, JSONValue, LostHandler, MessageItem, RestoreHandler,
  SceneLoadOptions, Texture2DSourceOptionsVideo, TouchEventType, VFXItem, VFXItemContent, Scene, math, GPUCapability,
} from '@galacean/effects-core';
import {
  Ticker,
  AssetManager,
  Composition,
  EventSystem,
  EVENT_TYPE_CLICK,
  getPixelRatio,
  gpuTimer,
  pluginLoaderMap,
  Renderer,
  setSpriteMeshMaxItemCountByGPU,
  TextureLoadAction,
  spec,
  isAndroid,
  initErrors,
  canvasPool,
  isScene,
  LOG_TYPE,
  isArray,
  isObject,
} from '@galacean/effects-core';
import type { GLRenderer } from '@galacean/effects-webgl';
import { HELP_LINK } from './constants';
import { isDowngradeIOS } from './utils';

/**
 * `onItemClicked` 点击回调函数的传入参数
 */
export interface ItemClickedData {
  name: string,
  player: Player,
  id: string,
  hitPositions: math.Vector3[],
  compositionId: number,
}

/**
 * player 创建的构造参数
 */
export interface PlayerConfig {
  /**
   * 播放器的容器，会在容器中创建 canvas，container 和 canvas 必传一个
   */
  container?: HTMLElement | null,
  /**
   * 指定 canvas 进行播放
   */
  canvas?: HTMLCanvasElement,
  /**
   * 画布比例，尽量使用默认值，如果不够清晰，可以写2，但是可能产生渲染卡顿
   */
  pixelRatio?: number | 'auto',
  /**
   * 播放器是否可交互
   */
  interactive?: boolean,
  /**
   * canvas 是否透明，如果不透明可以略微提升性能
   * @default true
   */
  transparentBackground?: boolean,
  /**
   * 渲染帧数
   * @default 60
   */
  fps?: number,
  /**
   * 是否停止计时器，否手动渲染
   * @default false
   */
  manualRender?: boolean,
  /**
   * 播放合成的环境
   * @default '' - 编辑器中为 'editor'
   */
  env?: string,
  /**
   * 指定 WebGL 创建的上下文类型，`debug-disable` 表示不创建
   */
  renderFramework?: 'webgl' | 'webgl2' | 'debug-disable',
  /**
   * player 的 name
   */
  name?: string,
  renderOptions?: {
    /**
     * 播放器是否需要截图（对应 WebGL 的 preserveDrawingBuffer 参数）
     */
    willCaptureImage?: boolean,
    /**
     * 图片预乘 Alpha
     * @default false
     */
    premultiplyAlpha?: boolean,
  },
  /**
   * 是否通知 container touchend / mouseup 事件, 默认不通知
   */
  notifyTouch?: boolean,
  /**
   * 当 WebGL context lost 时候发出的回调，这个时候播放器已经自动被销毁，业务需要做兜底逻辑
   */
  onWebGLContextLost?: (event: Event) => void,
  /**
   * 当 WebGL context restore 时候发出的回调，这个时候播放器已经自动恢复，业务可视情况做逻辑处理
   */
  onWebGLContextRestored?: () => void,
  /**
   * 播放器被元素暂停的回调
   */
  onPausedByItem?: (data: { name: string, player: Player }) => void,
  /**
   * 交互元素被点击的回调
   */
  onItemClicked?: (data: ItemClickedData) => void,
  /**
   * 交互元素发送 message 的回调
   */
  onMessageItem?: (data: { name: string, phrase: number }) => void,
  /**
   * 播放器更新的回调
   */
  onPlayableUpdate?: (data: { playing: boolean, time?: number, player: Player }) => void,
  /**
   * 渲染出错时候的回调
   * @param - err
   */
  onRenderError?: (err: Error) => void,
  // createRenderNode?: (model: Object) => any,
  /**
   * 每帧渲染调用后的回调，WebGL2 上下文生效
   * @param time - GPU 渲染使用的时间，秒
   */
  reportGPUTime?: (time: number) => void,

  [key: string]: any,
}

export type SceneType = string | JSONValue | Scene;
export type SceneWithOptionsType = { scene: SceneType, options: SceneLoadOptions };
export type SceneLoadType = SceneType | SceneWithOptionsType;

const playerMap = new Map<HTMLCanvasElement, Player>();
let enableDebugType = false;
let seed = 1;

/**
 * Galacean Effects 播放器
 */
export class Player implements Disposable, LostHandler, RestoreHandler {
  public readonly env: string;
  public readonly pixelRatio: number;
  public readonly canvas: HTMLCanvasElement;
  public readonly name: string;
  public readonly gpuCapability: GPUCapability;
  public readonly container: HTMLElement | null;

  /**
   * 当前播放的合成对象数组，请不要修改内容
   */
  protected compositions: Composition[] = [];
  /**
   * 播放器的渲染对象
   */
  public readonly renderer: Renderer;
  /**
   * 计时器
   * 手动渲染 `manualRender=true` 时不创建计时器
   */
  public readonly ticker: Ticker;

  private readonly event: EventSystem;
  private readonly handleWebGLContextLost?: (event: Event) => void;
  private readonly handleWebGLContextRestored?: () => void;
  private readonly handleMessageItem?: (item: MessageItem) => void;
  private readonly handlePlayerPause?: (item: VFXItem<VFXItemContent>) => void;
  private readonly reportGPUTime?: (time: number) => void;
  private readonly handleItemClicked?: (event: any) => void;
  private readonly handlePlayableUpdate?: (event: { playing: boolean, player: Player }) => void;
  private readonly handleRenderError?: (err: Error) => void;
  private displayAspect: number;
  private displayScale = 1;
  private forceRenderNextFrame: boolean;
  private autoPlaying: boolean;
  private resumePending = false;
  private offscreenMode: boolean;
  private disposed = false;
  private assetManager: AssetManager;
  private speed = 1;
  private baseCompositionIndex = 0;

  /**
   * 播放器的构造函数
   * @param config
   */
  constructor (config: PlayerConfig) {
    const {
      container, canvas, gl, fps, name, pixelRatio, manualRender, interactive, reportGPUTime,
      onMessageItem, onPausedByItem, onItemClicked, onPlayableUpdate, onRenderError, onWebGLContextLost, onWebGLContextRestored,
      renderFramework: glType,
      env = '',
      notifyTouch,
    } = config;

    if (initErrors.length) {
      throw new Error(`Errors before player create: ${initErrors.map((message, index) => `\n ${index + 1}: ${message}`)}`);
    }

    // v2.0.0 将 willCaptureImage, premultiplyAlpha 统一到 renderOptions 下
    const { willCaptureImage, premultiplyAlpha } = config.renderOptions ?? config ?? {};

    // 原 debug-disable 直接返回
    if (enableDebugType || glType === 'debug-disable') {
      return;
    }
    // 注意：安卓设备和 iOS 13/iOS 16.5 在 WebGL2 下有渲染或卡顿问题，故默认使用 WebGL1
    let framework: GLType = (isAndroid() || isDowngradeIOS()) ? 'webgl' : 'webgl2';

    // 用户可以通过传入 renderFramework，手动强制使用 WebGL 1/2 来渲染
    if (glType) {
      framework = glType === 'webgl' ? 'webgl' : 'webgl2';
    }

    this.handleWebGLContextLost = onWebGLContextLost;
    this.handleWebGLContextRestored = onWebGLContextRestored;
    this.reportGPUTime = reportGPUTime;
    this.handleItemClicked = onItemClicked;
    this.handleMessageItem = onMessageItem;
    this.handlePlayableUpdate = onPlayableUpdate;
    this.handleRenderError = onRenderError;
    this.handlePlayerPause = (item: VFXItem<VFXItemContent>) => {
      this.pause();
      onPausedByItem?.({
        name: item.name,
        player: this,
      });
    };

    this.pixelRatio = Number.isFinite(pixelRatio) ? pixelRatio as number : getPixelRatio();
    this.offscreenMode = true;
    this.env = env;
    if (canvas) {
      this.canvas = canvas;
    } else if (gl) {
      this.canvas = gl.canvas;
      const version = gl instanceof WebGLRenderingContext ? 'webgl' : 'webgl2';

      if (framework !== version) {
        console.error({
          content: `The gl context(${version}) is inconsistent with renderFramework or default version(${framework})`,
          type: LOG_TYPE,
        });
        framework = version;
      }
    } else {
      assertContainer(container);
      this.canvas = document.createElement('canvas');
      container.appendChild(this.canvas);
    }

    // 不允许同时存在WebGL和WebGL2的Player
    playerMap.forEach(player => {
      if (player.gpuCapability.type !== framework) {
        throw new Error(`Initialize player with different webgl version: old=${player.gpuCapability.type}, new=${framework}`);
      }
    });

    this.renderer = Renderer.create(
      this.canvas,
      framework,
      {
        preserveDrawingBuffer: willCaptureImage,
        premultipliedAlpha: premultiplyAlpha,
      }
    );

    this.renderer.env = env;
    this.renderer.addLostHandler({ lost: this.lost });
    this.renderer.addRestoreHandler({ restore: this.restore });
    this.gpuCapability = this.renderer.engine.gpuCapability;

    // 如果存在WebGL和WebGL2的Player，需要给出警告
    playerMap.forEach(player => {
      if (player.gpuCapability.type !== this.gpuCapability.type) {
        console.warn({
          content: `Create player with different webgl version: old=${player.gpuCapability.type}, new=${this.gpuCapability.type}`,
          type: LOG_TYPE,
        });
      }
    });

    if (!manualRender) {
      this.ticker = new Ticker(fps);
      this.ticker.add(this.tick.bind(this));
    }
    this.event = new EventSystem(this.canvas, !!notifyTouch);
    this.event.bindListeners();
    this.event.addEventListener(EVENT_TYPE_CLICK, this.handleClick);
    this.interactive = interactive ?? false;
    this.name = name || `${seed++}`;
    if (!gl) {
      this.resize();
    }
    setSpriteMeshMaxItemCountByGPU(this.gpuCapability.detail);
    this.container = this.canvas.parentElement;
    playerMap.set(this.canvas, this);
    assertNoConcurrentPlayers();
    broadcastPlayerEvent(this, true);
  }

  /**
   * 设置 player 的播放速度，
   * @param speed - 播放速度
   */
  setSpeed (speed: number) {
    if (!isNaN(speed)) {
      this.speed = speed;
    }
  }

  getSpeed (): number {
    return this.speed;
  }

  /**
   * 根据名称查找对应的合成，可能找不到
   * @param name - 目标合成名称
   */
  getCompositionByName (name: string) {
    return this.compositions.find(comp => comp.name === name);
  }

  /**
   * 获取当前播放的所有合成, 请不要修改返回数组的内容
   */
  getCompositions () {
    return this.compositions;
  }

  /**
   * 是否有合成在播放
   */
  get hasPlayable () {
    return this.compositions.length > 0;
  }

  /**
   * 播放器是否已暂停
   */
  get paused () {
    return this.ticker?.getPaused();
  }

  /**
   * 获取播放器是否可交互
   */
  get interactive () {
    return this.event.enabled;
  }

  /**
   * 设置播放器是否可交互
   */
  set interactive (enable) {
    this.event.enabled = enable;
  }

  /**
   * 加载动画资源
   * @param scene - 一个或一组 URL 或者通过 URL 请求的 JSONObject 或者 Scene 对象
   * @param options - 加载可选参数
   * @returns
   */
  async loadScene (scene: SceneLoadType, options?: SceneLoadOptions): Promise<Composition>;
  async loadScene (scene: SceneLoadType[], options?: SceneLoadOptions): Promise<Composition[]>;
  async loadScene (scene: SceneLoadType | SceneLoadType[], options?: SceneLoadOptions): Promise<Composition | Composition[]> {
    let composition: Composition | Composition[];
    const baseOrder = this.baseCompositionIndex;

    if (isArray(scene)) {
      this.baseCompositionIndex += scene.length;
      composition = await Promise.all(scene.map(async (scn, index) => {
        const res = await this.createComposition(scn, options);

        res.setIndex(baseOrder + index);

        return res;
      }));
    } else {
      this.baseCompositionIndex += 1;
      composition = await this.createComposition(scene, options);
      composition.setIndex(baseOrder);
    }

    this.ticker?.start();

    return composition;
  }

  private async createComposition (url: SceneLoadType, options: SceneLoadOptions = {}): Promise<Composition> {
    const renderer = this.renderer;
    const last = performance.now();
    let opts = {
      autoplay: true,
      ...options,
    };
    let scene: Scene;
    let source: SceneType;

    if (isSceneWithOptions(url)) {
      source = url.scene;
      opts = {
        ...opts,
        ...url.options || {},
      };
    } else {
      source = url;
    }

    if (this.assetManager) {
      this.assetManager.updateOptions(opts);
    } else {
      this.assetManager = new AssetManager(opts);
    }

    if (isScene(source)) {
      scene = source;
    } else {
      scene = await this.assetManager.loadScene(source, this.renderer, { env: this.env });
    }

    const composition = new Composition({
      ...opts,
      renderer,
      width: renderer.getWidth(),
      height: renderer.getHeight(),
      event: this.event,
      handlePlayerPause: this.handlePlayerPause,
      handleMessageItem: this.handleMessageItem,
    }, scene);

    if (this.ticker) {
      if (composition.renderLevel === spec.RenderLevel.B) {
        this.ticker.setFPS(Math.min(this.ticker.getFPS(), 30));
      }
    }

    await new Promise(resolve => {
      this.renderer.getShaderLibrary()!.compileAllShaders(() => {
        resolve(null);
      });
    });

    if (opts.autoplay) {
      this.autoPlaying = true;
      composition.play();
    } else {
      composition.pause();
    }

    const firstFrameTime = (performance.now() - last) + composition.statistic.loadTime;

    composition.statistic.firstFrameTime = firstFrameTime;
    console.info({
      content: `first frame: [${composition.name}]${firstFrameTime.toFixed(4)}ms`,
      type: LOG_TYPE,
    });

    this.compositions.push(composition);

    return composition;
  }

  /**
   * 播放通过 player 加载好的全部合成
   */
  play () {
    if (this.offscreenMode) {
      this.resize();
      this.offscreenMode = false;
    }
    this.autoPlaying = true;
    this.compositions.map(composition => {
      composition.play();
    });
    this.ticker?.start();
  }

  /**
   * 跳转全部合成到指定时间后播放
   * @param time - 指定时间, 单位秒
   */
  gotoAndPlay (time: number) {
    if (this.offscreenMode) {
      this.resize();
      this.offscreenMode = false;
    }
    this.autoPlaying = true;
    this.compositions.map(composition => {
      composition.gotoAndPlay(time);
    });
    if (!this.ticker) {
      this.doTick(0, true);
    } else {
      this.ticker.start();
    }
  }

  /**
   * 跳转全部合成带指定时间并停留
   * @param time - 指定时间, 单位秒
   */
  gotoAndStop (time: number) {
    if (this.offscreenMode) {
      this.resize();
      this.offscreenMode = false;
    }
    this.autoPlaying = false;
    this.compositions.map(composition => {
      composition.gotoAndStop(time);
    });
    if (!this.ticker || this.ticker?.getPaused()) {
      this.doTick(0, true);
    }
    this.handlePlayableUpdate?.({
      player: this,
      playing: false,
    });
  }

  /**
   * 顺序播放一组还未开始播放的合成
   * @param compositions - 要播放的合成数组
   */
  playSequence (compositions: Composition[]): void {
    for (let i = 0; i < compositions.length - 1; i++) {
      const composition = compositions[i];
      const preEndHandler = composition.handleEnd;

      composition.handleEnd = () => {
        preEndHandler?.call(composition, composition);
        compositions[i + 1].play();
      };
    }
    compositions[0].play();
    this.ticker?.start();
  }

  /**
   * 暂停播放器
   * @param options
   * @param options.offloadTexture - 是否卸载贴图纹理，减少内存
   * @returns
   */
  pause (options?: { offloadTexture?: boolean }) {
    if (!this.paused) {
      this.ticker?.pause();
      this.handlePlayableUpdate?.({
        player: this,
        playing: false,
      });
      if (options && options.offloadTexture) {
        this.offloadTexture();
      }
    }
  }

  /**
   * 恢复播放器
   * > 如果暂停时卸载了纹理贴图，此函数将自动请求网络重新加载纹理
   * @returns
   */
  async resume () {
    if (this.resumePending) {
      return;
    }
    if (this.paused) {
      this.resumePending = true;
      await Promise.all(this.compositions.map(c => c.reloadTexture()));
      this.resumePending = false;
      this.handleResume();
    }
    this.ticker?.resume();
  }

  /**
   * player 在定时器每帧的回调
   * @param dt - 时间差，毫秒
   */
  tick (dt: number) {
    this.doTick(dt, this.forceRenderNextFrame);
    this.forceRenderNextFrame = false;
  }
  private doTick (dt: number, forceRender: boolean) {
    dt = Math.min(dt, 33) * this.speed;
    let removed = false;
    let comps = this.compositions;
    let skipRender = false;

    comps.sort((a, b) => a.getIndex() - b.getIndex());
    comps.forEach((composition, i) => {
      if (composition.textureOffloaded) {
        skipRender = true;
        console.error({
          content: `Composition ${composition.name} texture offloaded, skip render.`,
          type: LOG_TYPE,
        });
      }

      if (composition.isDestroyed) {
        delete comps[i];
        removed = true;

        return;
      }

      if (composition.renderer) {
        composition.update(dt);
      }

      if (composition.isDestroyed) {
        delete comps[i];
        removed = true;

        return;
      }
    });
    if (removed) {
      comps = comps.filter(comp => comp);
      comps.map((comp, index) => comp.setIndex(index));
      this.compositions = comps;
    }

    this.baseCompositionIndex = comps.length;
    if (skipRender) {
      this.handleRenderError?.(new Error('play when texture offloaded'));

      return this.ticker?.pause();
    }
    if (!this.paused || forceRender) {
      const { level } = this.gpuCapability;
      const { gl } = (this.renderer as GLRenderer).context;
      const time = (level === 2 && this.reportGPUTime) ? gpuTimer(gl as WebGL2RenderingContext) : undefined;

      time?.begin();
      if (this.compositions.length || forceRender) {
        this.renderer.setFrameBuffer(null);
        this.renderer.clear({
          stencilAction: TextureLoadAction.clear,
          clearStencil: 0,
          depthAction: TextureLoadAction.clear,
          clearDepth: 1,
          colorAction: TextureLoadAction.clear,
          clearColor: [0, 0, 0, 0],
        });
        for (let i = 0; i < comps.length; i++) {
          !comps[i].renderFrame.isDestroyed && this.renderer.renderRenderFrame(comps[i].renderFrame);
        }
      }
      time?.end();
      time?.getTime()
        .then(t => this.reportGPUTime?.(t ?? 0))
        .catch;
      if (this.autoPlaying) {
        this.handlePlayableUpdate?.({
          player: this,
          playing: true,
        });
      }
    }
  }

  /**
   * 调整画布的宽高比
   * @param aspect
   * @param scale
   */
  resizeToAspect (aspect: number, scale = 1) {
    if (aspect !== this.displayAspect) {
      this.displayAspect = aspect;
    }
    if (scale !== this.displayScale) {
      this.displayScale = scale;
    }
    this.resize();
  }

  /**
   * 将播放器重新和父容器大小对齐
   */
  resize () {
    const { parentElement } = this.canvas;
    let containerWidth;
    let containerHeight;
    let canvasWidth;
    let canvasHeight;

    if (parentElement) {
      const size = this.getTargetSize(parentElement);

      containerWidth = size[0];
      containerHeight = size[1];
      canvasWidth = size[2];
      canvasHeight = size[3];
    } else {
      containerWidth = canvasWidth = this.canvas.width;
      containerHeight = canvasHeight = this.canvas.height;
    }
    const aspect = containerWidth / containerHeight;

    if (containerWidth && containerHeight) {
      const documentWidth = document.documentElement.clientWidth;

      if (canvasWidth > documentWidth * 2) {
        console.error({
          content: `DPI overflowed, width ${canvasWidth} is more than 2x document width ${documentWidth}, see ${HELP_LINK['DPI overflowed']}`,
          type: LOG_TYPE,
        });
      }
      const maxSize = this.env ? this.gpuCapability.detail.maxTextureSize : 2048;

      if ((canvasWidth > maxSize || canvasHeight > maxSize)) {
        console.error({
          content: `Container size overflowed ${canvasWidth}x${canvasHeight}, see ${HELP_LINK['Container size overflowed']}`,
          type: LOG_TYPE,
        });
        if (aspect > 1) {
          canvasWidth = Math.round(maxSize);
          canvasHeight = Math.round(maxSize / aspect);
        } else {
          canvasHeight = Math.round(maxSize);
          canvasWidth = Math.round(maxSize * aspect);
        }
      }
      // ios 14.1 -ios 14.3 resize canvas will cause memory leak
      this.renderer.resize(canvasWidth, canvasHeight);
      this.canvas.style.width = containerWidth + 'px';
      this.canvas.style.height = containerHeight + 'px';
      console.debug(`Resize player ${this.name} [${canvasWidth},${canvasHeight},${containerWidth},${containerHeight}].`);
      this.compositions?.forEach(comp => {
        comp.camera.aspect = aspect;
      });
    }
  }

  /**
   * 清空 canvas 的画面
   * @param immediate - 如果立即清理，当前画面将会消失，如果 player 还有合成在渲染，可能出现闪烁
   */
  clearCanvas (immediate?: boolean) {
    if (immediate) {
      this.renderer.clear({
        stencilAction: TextureLoadAction.clear,
        clearStencil: 0,
        depthAction: TextureLoadAction.clear,
        clearDepth: 1,
        colorAction: TextureLoadAction.clear,
        clearColor: [0, 0, 0, 0],
      });
    } else {
      this.forceRenderNextFrame = true;
    }
  }

  /**
   * @internal
   * @deprecated since 2.0.0
   * @param id
   * @param options
   */
  destroyItem (id: string, options = {}) {
  }

  /**
   * 播放器在 `webglcontextlost` 时执行的操作
   * @param e - Event
   */
  lost = (e: Event) => {
    this.ticker?.pause();
    this.compositions.forEach(comp => comp.lost(e));
    this.renderer.lost(e);
    this.handleWebGLContextLost?.(e);
    broadcastPlayerEvent(this, false);
  };

  /**
   * 播放器在 `webglcontextrestored` 时执行的操作
   * @returns
   */
  restore = async () => {
    this.renderer.restore();
    this.compositions = await Promise.all(this.compositions.map(async composition => {
      const { time: currentTime, url, speed, keepResource, reusable, renderOrder, transform, videoState } = composition;
      const newComposition = await this.loadScene(url);

      newComposition.speed = speed;
      newComposition.reusable = reusable;
      newComposition.keepResource = keepResource;
      newComposition.renderOrder = renderOrder;
      newComposition.transform = transform;

      for (let i = 0; i < videoState.length; i++) {
        if (videoState[i]) {
          const video = (newComposition.textures[i].source as Texture2DSourceOptionsVideo).video;

          video.currentTime = videoState[i] ?? 0;
          await video.play();
        }
      }
      newComposition.content.start();
      newComposition.gotoAndPlay(currentTime);

      return newComposition;
    }));
    this.handleWebGLContextRestored?.();
    this.ticker?.resume();
  };

  /**
   * 销毁当前播放的所有 Composition
   */
  destroyCurrentCompositions () {
    this.compositions.forEach(comp => comp.dispose());
    this.compositions.length = 0;
    this.baseCompositionIndex = 0;
  }

  /**
   * 销毁播放器
   * @param keepCanvas - 是否保留 canvas 画面，默认不保留，canvas 不能再被使用
   */
  dispose (keepCanvas?: boolean): void {
    console.debug(`call player destroy: ${this.name}`);
    if (this.disposed) {
      return;
    }
    playerMap.delete(this.canvas);
    this.pause();
    this.ticker?.stop();
    this.assetManager?.dispose();
    this.compositions.forEach(comp => comp.dispose());
    this.compositions.length = 0;
    (this.renderer as GLRenderer).context.removeLostHandler({ lost: this.lost });
    (this.renderer as GLRenderer).context.removeRestoreHandler({ restore: this.restore });
    this.event.dispose();
    this.renderer.dispose(!keepCanvas);
    broadcastPlayerEvent(this, false);
    if (
      this.canvas instanceof HTMLCanvasElement &&
      !keepCanvas &&
      (this.renderer as GLRenderer).context
    ) {
      // TODO: 数据模版下掉可以由文本模块单独管理
      canvasPool.dispose();
      // canvas will become a cry emoji in Android if still in dom
      if (this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.canvas.remove();
    }
    // 在报错函数中传入 player.name
    const errorMsg = getDestroyedErrorMessage(this.name);
    const throwErrorFunc = () => throwDestroyedError(errorMsg);
    const throwErrorPromiseFunc = () => throwDestroyedErrorPromise(errorMsg);

    this.tick = throwErrorFunc;
    this.resize = throwErrorFunc;
    this.loadScene = throwErrorPromiseFunc;
    this.play = throwErrorPromiseFunc;
    this.resume = throwErrorPromiseFunc;
    this.disposed = true;
  }

  private handleResume = () => {
    this.handlePlayableUpdate?.({
      player: this,
      playing: true,
    });
  };

  private offloadTexture () {
    this.compositions.forEach(comp => comp.offloadTexture());
  }

  private handleClick = (e: TouchEventType) => {
    const { x, y } = e;

    this.compositions.forEach(composition => {
      const regions = composition.hitTest(x, y);

      if (regions.length) {
        for (let i = 0; i < regions.length; i++) {
          const behavior = regions[i].behavior || spec.InteractBehavior.NOTIFY;

          if (behavior === spec.InteractBehavior.NOTIFY) {
            this.handleItemClicked?.({
              ...regions[i],
              composition: composition.name,
              player: this,
            });
          } else if (behavior === spec.InteractBehavior.RESUME_PLAYER) {
            void this.resume();
          }
        }
      }
    });
  };

  private getTargetSize (parentEle: HTMLElement) {
    assertContainer(parentEle);
    const displayAspect = this.displayAspect;
    let targetWidth;
    let targetHeight;

    if (displayAspect) {
      const parentAspect = parentEle.clientWidth / parentEle.clientHeight;

      if (parentAspect > displayAspect) {
        targetHeight = parentEle.clientHeight * this.displayScale;
        targetWidth = targetHeight * displayAspect;
      } else {
        targetWidth = parentEle.clientWidth * this.displayScale;
        targetHeight = targetWidth / displayAspect;
      }
    } else {
      targetWidth = parentEle.clientWidth;
      targetHeight = parentEle.clientHeight;
    }
    const ratio = this.pixelRatio;
    let containerWidth = targetWidth;
    let containerHeight = targetHeight;

    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
    if (targetHeight < 1 || targetHeight < 1) {
      if (this.offscreenMode) {
        targetWidth = targetHeight = containerWidth = containerHeight = 1;
      } else {
        throw Error(`Invalid container size ${targetWidth}x${targetHeight}, see ${HELP_LINK['Invalid container size']}`);
      }
    }

    return [containerWidth, containerHeight, targetWidth, targetHeight];
  }

}

export function isSceneWithOptions (scene: any): scene is SceneWithOptionsType {
  // TODO: 判断不太优雅，后期试情况优化
  return isObject(scene) && 'scene' in scene;
}

/**
 * 禁止/允许创建新的播放器，已创建的不受影响
 * @param disable - 是否禁止
 */
export function disableAllPlayer (disable: boolean) {
  enableDebugType = !!disable;
}

/**
 * 判断指定的 canvas 是否有播放器正在使用
 * @param canvas - 指定的 canvas
 * @returns
 */
export function isCanvasUsedByPlayer (canvas: HTMLCanvasElement) {
  return playerMap.has(canvas);
}

/**
 * 获取 canvas 对应的播放器
 * @param canvas - 指定的 canvas
 * @returns
 */
export function getPlayerByCanvas (canvas: HTMLCanvasElement) {
  return playerMap.get(canvas);
}

/**
 * 获取使用中的播放器
 * @returns
 */
export function getActivePlayers () {
  return Array.from(playerMap.values());
}

/**
 * 播放器在实例化、销毁（`dispose`）时分别触发插件的 `onPlayerCreated`、`onPlayerDestroy` 回调
 * @param player - 播放器
 * @param isCreate - 是否处于实例化时
 */
function broadcastPlayerEvent (player: Player, isCreate: boolean) {
  Object.values(pluginLoaderMap).forEach(ctrl => {
    const func = isCreate ? ctrl.onPlayerCreated : ctrl.onPlayerDestroy;

    func?.(player);
  });
}

/**
 * 同时允许的播放器数量超过 1 时打印错误
 */
function assertNoConcurrentPlayers () {
  const runningPlayers = [];

  for (const player of playerMap.values()) {
    if (!player.paused) {
      runningPlayers.push(player);
    }
  }
  if (runningPlayers.length > 1) {
    console.error({
      content: `Current running player count: ${runningPlayers.length}, see ${HELP_LINK['Current running player count']}`,
      type: LOG_TYPE,
    }, runningPlayers);
  }
}

/**
 * 创建播放器传入的容器不是 `HTMLElement` 时抛出错误
 * @param container
 */
function assertContainer (container?: HTMLElement | null): asserts container is HTMLElement {
  if (container === undefined || container === null) {
    throw new Error(`Container is not an HTMLElement, see ${HELP_LINK['Container is not an HTMLElement']}`);
  }
}

function getDestroyedErrorMessage (name: string) {
  return `Never use destroyed player: ${name} again, see ${HELP_LINK['Never use destroyed player again']}`;
}

function throwDestroyedError (destroyedErrorMessage: string) {
  throw new Error(destroyedErrorMessage);
}

function throwDestroyedErrorPromise (destroyedErrorMessage: string) {
  return Promise.reject(destroyedErrorMessage);
}

