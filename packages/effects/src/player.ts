import type {
  Disposable, GLType, LostHandler, RestoreHandler, SceneLoadOptions, Scene, MessageItem,
  Region, AssetManager, Composition, Renderer, Ticker,
  TouchEventType } from '@galacean/effects-core';
import {
  Engine, logger, EventEmitter, TextureLoadAction, canvasPool, getPixelRatio, initErrors,
  isArray, spec, assertExist, SceneLoader,
  EVENT_TYPE_TOUCH_END,
  EVENT_TYPE_TOUCH_MOVE,
  EVENT_TYPE_TOUCH_START,
  PointerEventData,
  PointerEventType,
} from '@galacean/effects-core';
import type { GLEngine } from '@galacean/effects-webgl';
import { HELP_LINK } from './constants';
import { handleThrowError, isDowngradeIOS, throwError, throwErrorPromise } from './utils';
import type { PlayerConfig, PlayerErrorCause, PlayerEvent } from './types';
import { assertNoConcurrentPlayers, playerMap } from './player-map';

let enableDebugType = false;
let seed = 1;

/**
 * Galacean Effects 播放器
 */
export class Player extends EventEmitter<PlayerEvent<Player>> implements Disposable, LostHandler, RestoreHandler {
  readonly env: string;
  /**
   * 播放器的 canvas 对象
   */
  readonly canvas: HTMLCanvasElement;
  /**
   * 播放器的唯一标识
   */
  readonly name: string;
  /**
   * 播放器的容器元素
   */
  readonly container: HTMLElement | null;
  /**
   * 播放器使用的引擎
   */
  readonly engine: Engine;

  private readonly onError?: (e: Error, ...args: any) => void;
  private autoPlaying: boolean;
  private resumePending = false;
  private disposed = false;
  private skipPointerMovePicking = true;

  /**
   * 计时器
   * 手动渲染 `manualRender=true` 时不创建计时器
   */
  get ticker (): Ticker | null {
    return this.engine.ticker;
  }
  /**
   * 播放器的渲染器对象
   */
  get renderer (): Renderer {
    return this.engine.renderer;
  }

  get gpuCapability () {
    return this.engine.gpuCapability;
  }
  /**
   * 当前播放的合成对象数组，请不要修改内容
   */
  private get compositions () {
    return this.engine.compositions;
  }

  private get assetManagers () {
    return this.engine.assetManagers;
  }

  private get assetService () {
    return this.engine.assetService;
  }

  private get event () {
    return this.engine.eventSystem;
  }

  private get displayAspect () {
    return this.engine.displayAspect;
  }

  private set displayAspect (value: number) {
    this.engine.displayAspect = value;
  }

  private get displayScale () {
    return this.engine.displayScale;
  }

  private set displayScale (value: number) {
    this.engine.displayScale = value;
  }

  private get offscreenMode () {
    return this.engine.offscreenMode;
  }

  private set offscreenMode (value: boolean) {
    this.engine.offscreenMode = value;
  }
  /**
   * 播放器的像素比
   */
  private get pixelRatio () {
    return this.engine.pixelRatio;
  }

  private set pixelRatio (value: number) {
    this.engine.pixelRatio = value;
  }

  /**
   * 播放器的构造函数
   * @param config
   */
  constructor (config: PlayerConfig) {
    super();

    const {
      container, canvas, fps, name, pixelRatio, manualRender,
      renderFramework: glType, notifyTouch, onError,
      interactive = false,
      renderOptions = {},
      env = '',
    } = config;
    const { willCaptureImage: preserveDrawingBuffer, premultipliedAlpha } = renderOptions;

    this.onError = onError;

    // 原 debug-disable 直接返回
    if (enableDebugType || glType === 'debug-disable') {
      return;
    }

    // 注意: iOS 13/iOS 16.5 在 WebGL2 下有渲染或卡顿问题，故默认使用 WebGL1
    let framework: GLType = isDowngradeIOS() ? 'webgl' : 'webgl2';

    // 用户可以通过传入 renderFramework，手动强制使用 WebGL 1/2 来渲染
    if (glType) {
      framework = glType === 'webgl' ? 'webgl' : 'webgl2';
    }

    this.env = env;
    this.name = name || `${seed++}`;
    let useExternalCanvas = false;

    try {
      if (initErrors.length) {
        throw new Error(
          `Errors before player create: ${initErrors.map((message, index) => `\n ${index + 1}: ${message}`)}.`,
          { cause: 'webgliniterror' },
        );
      }

      if (canvas) {
        this.canvas = canvas;
        useExternalCanvas = true;
      } else {
        assertContainer(container);
        this.canvas = document.createElement('canvas');
        container.appendChild(this.canvas);
      }
      this.container = this.canvas.parentElement;

      this.engine = Engine.create(this.canvas, {
        name,
        glType: framework,
        fps,
        env,
        preserveDrawingBuffer,
        premultipliedAlpha,
        manualRender,
        notifyTouch: notifyTouch,
        interactive,
        pixelRatio: Number.isFinite(pixelRatio) ? pixelRatio as number : getPixelRatio(),
      });
      this.engine.offscreenMode = true;

      // Bind engine events
      this.engine.on('rendererror', (e: Event | Error) => {
        this.handleEmitEvent('rendererror', e);
      });

      this.engine.on('contextlost', eventData => {
        this.lost(eventData.e);
      });

      this.engine.on('contextrestored', async () => {
        await this.restore();
      });

      this.engine.onClick = (eventData: Region) => {
        const behavior = eventData.behavior || spec.InteractBehavior.NOTIFY;

        if (behavior === spec.InteractBehavior.NOTIFY) {
          this.emit('click', {
            ...eventData,
            player: this,
            compositionId: eventData.composition.id,
            compositionName: eventData.composition.name,
          });
        } else if (behavior === spec.InteractBehavior.RESUME_PLAYER) {
          void this.resume();
        }
      };

      this.engine.runRenderLoop((dt: number) => {
        if (this.autoPlaying) {
          this.emit('update', {
            player: this,
            playing: true,
          });
        }
      });

      // this.event.addEventListener(EVENT_TYPE_CLICK, this.onClick.bind(this));
      this.event.addEventListener(EVENT_TYPE_TOUCH_START, this.onPointerDown.bind(this));
      this.event.addEventListener(EVENT_TYPE_TOUCH_END, this.onPointerUp.bind(this));
      this.event.addEventListener(EVENT_TYPE_TOUCH_MOVE, this.onPointerMove.bind(this));

      // 如果存在 WebGL 和 WebGL2 的 Player，需要给出警告
      playerMap.forEach(player => {
        if (player.gpuCapability.type !== this.gpuCapability.type) {
          logger.warn(`Create player with different WebGL version: old=${player.gpuCapability.type}, new=${this.gpuCapability.type}.\nsee ${HELP_LINK['Create player with different WebGL version']}.`);
        }
      });
      playerMap.set(this.canvas, this);

      assertNoConcurrentPlayers();
    } catch (e: any) {
      if (this.canvas && !useExternalCanvas) {
        this.canvas.remove();
      }
      this.handleThrowError(e);
    }
  }

  /**
   * 设置当前 Player 的播放速度
   * @param speed - 播放速度
   */
  setSpeed (speed: number) {
    if (!isNaN(speed)) {
      this.engine.speed = speed;
    }
  }
  /**
   * 获取当前 Player 的播放速度
   * @returns
   */
  getSpeed (): number {
    return this.engine.speed;
  }

  /**
   * 根据名称查找对应的合成（可能找不到，如果有同名的合成，默认返回第一个）
   * @example
   * ``` ts
   * const composition = player.getCompositionByName('新建合成1');
   * ```
   * @param name - 目标合成名称
   */
  getCompositionByName (name: string) {
    return this.compositions.find(comp => comp.name === name);
  }

  /**
   * 获取当前播放的所有合成（请不要修改返回的数组内容）
   */
  getCompositions () {
    return this.compositions.sort((a, b) => a.getIndex() - b.getIndex());
  }

  /**
   * Gets the array of asset managers.
   * @returns
   */
  getAssetManager (): ReadonlyArray<AssetManager> {
    return this.assetManagers;
  }

  /**
   * 获取当前播放的合成数量
   */
  get compositionCount () {
    return this.compositions.length;
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
   * @example
   * ``` ts
   * // 1. 加载单个合成链接并设置可选参数
   * const composition = await player.loadScene('xxx.json', { ... });
   * const composition = await player.loadScene({ url: 'xxx.json' }, { ... });
   *
   * // 2. 加载单个合成的 JSON 对象并设置可选参数
   * const composition = await player.loadScene(JSONValue, { ... });
   *
   * // 3. 加载多个合成链接或 JSON 对象
   * const [_, _, _] = await player.loadScene(['x1.json', 'x2.json', JSONValue]);
   *
   * // 4. 加载多个合成链接并各自设置可选参数
   * const [_, _] = await player.loadScene([{
   *   url: 'x1.json',
   *   options: { autoplay: false, ... },
   * }, {
   *   url: 'x2.json',
   *   options: { speed: 2, ... },
   * }, { ... }]);
   *
   * // 5. 加载多个合成链接并统一设置可选参数（共用）
   * const [_, _, _] = await player.loadScene(['x1.json', 'x2.json', ...], { ... });
   * const [_, _] = await player.loadScene(
   *   [{ url: 'x1.json' }, { url: 'x2.json' }, { ... }],
   *   {
   *     variables: {
   *       'name': 'value',
   *     },
   *     speed: 2,
   *     ...
   *    },
   * );
   *
   * // 6. 疯狂混合
   * await player.loadScene([
   *   {
   *     url: 'x1.json',
   *     options: {
   *       variables: {
   *         'name1': 'value1',
   *       },
   *       speed: 2,
   *     },
   *   },
   *   'x2.json',
   *   JSONValue,
   * ], {
   *   variables: {
   *     'name2': 'value2',
   *   },
   *   speed: 0.1,
   * });
   * ```
   * @param scene - 一个或一组 URL 或者通过 URL 请求的 JSONObject 或者 Scene 对象
   * @param options - 加载可选参数
   * @returns
   */
  async loadScene (scene: Scene.LoadType, options?: SceneLoadOptions): Promise<Composition>;
  async loadScene (scene: Scene.LoadType[], options?: SceneLoadOptions): Promise<Composition[]>;
  @handleThrowError<Player>
  async loadScene (
    scene: Scene.LoadType | Scene.LoadType[],
    options?: SceneLoadOptions,
  ): Promise<Composition | Composition[]> {
    assertExist(this.renderer, 'Renderer is not exist, maybe the Player has been disabled or in gl \'debug-disable\' mode.');
    const autoplay = options?.autoplay ?? true;

    if (autoplay) {
      this.autoPlaying = true;
    }

    const sceneUrls: Scene.LoadType[] = [];
    const autoplayFlags: boolean[] = [];

    if (isArray(scene)) {
      sceneUrls.push(...scene);
    } else {
      sceneUrls.push(scene);
    }

    for (const assetManager of this.assetManagers) {
      assetManager.dispose();
    }

    this.engine.assetManagers = [];
    const baseOrder = this.engine.compositions.length;
    const compositions = await Promise.all(sceneUrls.map(async (url, index) => {
      const renderOrder = baseOrder + index;
      const { source, options: compositionOptions } = this.assetService.assembleSceneLoadOptions(url, { autoplay, ...options });
      const compositionAutoplay = compositionOptions?.autoplay ?? true;
      const composition = await SceneLoader.load(source, this.engine, compositionOptions);

      composition.setIndex(renderOrder);
      composition.onItemMessage = (message: MessageItem) => { this.emit('message', message); };
      autoplayFlags[index] = compositionAutoplay;

      return composition;
    }));

    for (let i = 0; i < compositions.length; i++) {
      if (autoplayFlags[i]) {
        compositions[i].play();
      } else {
        compositions[i].pause();
      }
    }

    if (compositions.some(c => !c.getPaused())) {
      this.emit('play', { time: 0 });
    }

    return isArray(scene) ? compositions : compositions[0];
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
    this.emit('play', { time: 0 });
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
    if (this.ticker) {
      this.ticker.start();
    } else {
      this.tick(0);
    }
    this.emit('play', { time });
  }

  /**
   * 跳转全部合成到指定时间并停留
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
      this.tick(0);
    }
    this.emit('pause');
  }

  /**
   * 顺序播放一组还未开始播放的合成
   * @param compositions - 要播放的合成数组
   */
  playSequence (compositions: Composition[]): void {
    for (let i = 0; i < compositions.length - 1; i++) {
      compositions[i].on('end', () => {
        compositions[i + 1].play();
      });
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
    if (this.paused) {
      return;
    }

    this.ticker?.pause();
    this.emit('pause');
    this.emit('update', {
      player: this,
      playing: false,
    });
    this.compositions.map(composition => {
      composition.pause();
    });

    if (options && options.offloadTexture) {
      this.offloadTexture();
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
      this.emit('resume');
    }
    this.compositions.map(composition => {
      composition.resume();
    });
    this.ticker?.resume();
  }

  /**
   * player 在定时器每帧的回调
   * @param dt - 时间差，毫秒
   */
  tick (dt: number) {
    this.engine.render(dt);
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
    this.engine.resize();
  }

  /**
   * 清空 canvas 的画面
   */
  clearCanvas () {
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
   * 播放器在 `webglcontextlost` 时执行的操作
   * @param e - Event
   */
  lost = (e: Event) => {
    this.handleEmitEvent('webglcontextlost', e);
  };

  /**
   * 播放器在 `webglcontextrestored` 时执行的操作
   * @returns
   */
  restore = async () => {
    this.emit('webglcontextrestored');
  };

  /**
   * 销毁当前播放的所有 Composition
   */
  destroyCurrentCompositions () {
    this.compositions.forEach(comp => comp.dispose());
  }

  /**
   * 销毁播放器
   */
  dispose (): void {
    logger.info(`Call player destroyed: ${this.name}.`);

    if (this.disposed) {
      return;
    }

    playerMap.delete(this.canvas);
    this.pause();
    this.engine.dispose();

    if (this.canvas instanceof HTMLCanvasElement && (this.engine as GLEngine).context) {
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
    const throwErrorFunc = () => throwError(errorMsg);
    const throwErrorPromiseFunc = () => throwErrorPromise(errorMsg);

    this.tick = throwErrorFunc;
    this.resize = throwErrorFunc;
    this.loadScene = throwErrorPromiseFunc;
    this.play = throwErrorPromiseFunc;
    this.gotoAndPlay = throwErrorPromiseFunc;
    this.gotoAndStop = throwErrorPromiseFunc;
    this.playSequence = throwErrorFunc;
    this.destroyCurrentCompositions = throwErrorFunc;
    this.resume = throwErrorPromiseFunc;
    this.disposed = true;
  }

  private offloadTexture () {
    this.compositions.forEach(comp => comp.offloadTexture());
  }

  private onPointerDown (e: TouchEventType) {
    this.handlePointerEvent(e, PointerEventType.PointerDown);
  }

  private onPointerUp (e: TouchEventType) {
    this.handlePointerEvent(e, PointerEventType.PointerUp);
  }

  private onPointerMove (e: TouchEventType) {
    this.handlePointerEvent(e, PointerEventType.PointerMove);
  }

  private handlePointerEvent (e: TouchEventType, type: PointerEventType) {
    let hitRegion: Region | null = null;
    const { x, y, width, height } = e;

    if (!(type === PointerEventType.PointerMove && this.skipPointerMovePicking)) {
      for (const composition of this.compositions) {
        const regions = composition.hitTest(x, y);

        if (regions.length > 0) {
          hitRegion = regions[regions.length - 1];
        }
      }
    }

    const eventData = new PointerEventData();

    eventData.position.x = (x + 1) / 2 * width;
    eventData.position.y = (y + 1) / 2 * height;
    eventData.delta.x = e.vx * width;
    eventData.delta.y = e.vy * height;

    const raycast = eventData.pointerCurrentRaycast;

    if (hitRegion) {
      raycast.point = hitRegion.position;
      raycast.item = hitRegion.item;
    }

    let eventName: 'pointerdown' | 'pointerup' | 'pointermove' = 'pointerdown';

    switch (type) {
      case PointerEventType.PointerDown:
        eventName = 'pointerdown';

        break;
      case PointerEventType.PointerUp:
        eventName = 'pointerup';

        break;
      case PointerEventType.PointerMove:
        eventName = 'pointermove';

        break;
    }

    if (hitRegion) {
      const hitItem = hitRegion.item;
      const hitComposition = hitItem.composition as Composition;

      this.emit(eventName, eventData);
      hitComposition.emit(eventName, eventData);
      hitItem.emit(eventName, eventData);
    }
  }

  private handleThrowError (e: Error) {
    if (this.onError) {
      this.onError(e);
    } else {
      throw e;
    }
  }

  private handleEmitEvent (
    name: Exclude<PlayerErrorCause, 'webgliniterror' | 'unknown'>,
    e: Event | Error,
  ) {
    if (this.onError) {
      if (e instanceof Event) {
        this.onError(new Error(e.type, { cause: name }), e);
      } else if (e instanceof Error) {
        this.onError(new Error(e.message, { cause: name }), e);
      } else {
        this.onError(new Error('Unknown error.', { cause: name }), e);
      }
    } else {
      console.warn(`[${name}] event is deprecated, please use 'onError' instead.`);
      this.emit(name, e as any);
    }
  }
}

/**
 * 禁止/允许创建新的播放器，已创建的不受影响
 * @param disable - 是否禁止
 */
export function disableAllPlayer (disable: boolean) {
  enableDebugType = !!disable;
}

/**
 * 创建播放器传入的容器不是 `HTMLElement` 时抛出错误
 * @param container
 */
function assertContainer (container?: HTMLElement | null): asserts container is HTMLElement {
  if (container === undefined || container === null) {
    throw new Error(`Container is not an HTMLElement, see ${HELP_LINK['Container is not an HTMLElement']}.`);
  }
}

function getDestroyedErrorMessage (name: string) {
  return `Never use destroyed player: ${name} again, see ${HELP_LINK['Never use destroyed player again']}.`;
}
