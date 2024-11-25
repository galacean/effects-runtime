import type {
  Disposable, GLType, GPUCapability, LostHandler, RestoreHandler, SceneLoadOptions,
  Texture2DSourceOptionsVideo, TouchEventType, EffectsObject, MessageItem,
} from '@galacean/effects-core';
import {
  AssetManager, Composition, EVENT_TYPE_CLICK, EventSystem, logger, Renderer, Material,
  TextureLoadAction, Ticker, canvasPool, getPixelRatio, gpuTimer, initErrors, isAndroid,
  isArray, pluginLoaderMap, setSpriteMeshMaxItemCountByGPU, spec, EventEmitter,
  generateWhiteTexture, Texture, PLAYER_OPTIONS_ENV_EDITOR, isIOS, DEFAULT_FPS, Scene,
} from '@galacean/effects-core';
import type { GLRenderer } from '@galacean/effects-webgl';
import { HELP_LINK } from './constants';
import { isDowngradeIOS, throwError, throwErrorPromise } from './utils';
import type { PlayerConfig, PlayerEvent } from './types';

const playerMap = new Map<HTMLCanvasElement, Player>();
let enableDebugType = false;
let seed = 1;

/**
 * Galacean Effects 播放器
 */
export class Player extends EventEmitter<PlayerEvent<Player>> implements Disposable, LostHandler, RestoreHandler {
  readonly env: string;
  readonly pixelRatio: number;
  readonly canvas: HTMLCanvasElement;
  readonly name: string;
  readonly gpuCapability: GPUCapability;
  readonly container: HTMLElement | null;
  /**
   * 播放器的渲染对象
   */
  readonly renderer: Renderer;
  /**
   * 计时器
   * 手动渲染 `manualRender=true` 时不创建计时器
   */
  readonly ticker: Ticker;

  private readonly builtinObjects: EffectsObject[] = [];
  private readonly event: EventSystem;
  private readonly reportGPUTime?: (time: number) => void;
  /**
   * 当前播放的合成对象数组，请不要修改内容
   */
  private compositions: Composition[] = [];
  private displayAspect: number;
  private displayScale = 1;
  private forceRenderNextFrame: boolean;
  private autoPlaying: boolean;
  private resumePending = false;
  private offscreenMode: boolean;
  private disposed = false;
  private assetManagers: AssetManager[] = [];
  private speed = 1;
  private baseCompositionIndex = 0;

  /**
   * 播放器的构造函数
   * @param config
   */
  constructor (config: PlayerConfig) {
    super();
    const {
      container, canvas, fps, name, pixelRatio, manualRender, reportGPUTime,
      renderFramework: glType, notifyTouch,
      interactive = false,
      renderOptions = {},
      env = '',
    } = config;
    const { willCaptureImage: preserveDrawingBuffer, premultipliedAlpha } = renderOptions;

    if (initErrors.length) {
      throw new Error(`Errors before player create: ${initErrors.map((message, index) => `\n ${index + 1}: ${message}`)}.`);
    }

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

    this.reportGPUTime = reportGPUTime;
    this.pixelRatio = Number.isFinite(pixelRatio) ? pixelRatio as number : getPixelRatio();
    this.offscreenMode = true;
    this.env = env;
    this.name = name || `${seed++}`;

    if (canvas) {
      this.canvas = canvas;
    } else {
      assertContainer(container);
      this.canvas = document.createElement('canvas');
      container.appendChild(this.canvas);
    }

    this.container = this.canvas.parentElement;

    this.renderer = Renderer.create(
      this.canvas,
      framework,
      {
        preserveDrawingBuffer,
        premultipliedAlpha,
      }
    );
    this.renderer.env = env;
    this.renderer.addLostHandler({ lost: this.lost });
    this.renderer.addRestoreHandler({ restore: this.restore });
    this.gpuCapability = this.renderer.engine.gpuCapability;
    this.builtinObjects.push(generateWhiteTexture(this.renderer.engine));

    // 如果存在 WebGL 和 WebGL2 的 Player，需要给出警告
    playerMap.forEach(player => {
      if (player.gpuCapability.type !== this.gpuCapability.type) {
        logger.warn(`Create player with different WebGL version: old=${player.gpuCapability.type}, new=${this.gpuCapability.type}.\nsee ${HELP_LINK['Create player with different WebGL version']}.`);
      }
    });

    if (!manualRender) {
      this.ticker = new Ticker(fps);
      this.ticker.add(this.tick.bind(this));
    }

    this.event = new EventSystem(this.canvas, !!notifyTouch);
    this.event.bindListeners();
    this.event.addEventListener(EVENT_TYPE_CLICK, this.handleClick);
    this.interactive = interactive;

    this.resize();
    setSpriteMeshMaxItemCountByGPU(this.gpuCapability.detail);
    playerMap.set(this.canvas, this);
    assertNoConcurrentPlayers();
    broadcastPlayerEvent(this, true);
  }

  /**
   * 设置当前 Player 的播放速度
   * @param speed - 播放速度
   */
  setSpeed (speed: number) {
    if (!isNaN(speed)) {
      this.speed = speed;
    }
  }
  /**
   * 获取当前 Player 的播放速度
   * @returns
   */
  getSpeed (): number {
    return this.speed;
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
    return this.compositions;
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
  async loadScene<T extends Composition | Composition[]> (
    scene: Scene.LoadType | Scene.LoadType[],
    options?: SceneLoadOptions,
  ): Promise<T> {
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

    return composition as T;
  }

  private async createComposition (
    url: Scene.LoadType,
    options: SceneLoadOptions = {},
  ): Promise<Composition> {
    const renderer = this.renderer;
    const engine = renderer.engine;
    const asyncShaderCompile = engine.gpuCapability?.detail?.asyncShaderCompile;
    const last = performance.now();
    let opts = {
      autoplay: true,
      ...options,
    };
    let source: Scene.LoadType = url;

    // 加载多个合成链接并各自设置可选参数
    if (Scene.isURL(url)) {
      if (!Scene.isJSONObject(url)) {
        source = url.url;
      }
      if (Scene.isWithOptions(url)) {
        opts = {
          ...opts,
          ...url.options,
        };
      }
    }

    const assetManager = new AssetManager(opts);

    // TODO 多 json 之间目前不共用资源，如果后续需要多 json 共用，这边缓存机制需要额外处理
    // 在 assetManager.loadScene 前清除，避免 loadScene 创建的 EffectsObject 对象丢失
    engine.clearResources();
    this.assetManagers.push(assetManager);
    const scene = await assetManager.loadScene(source, this.renderer, { env: this.env });

    // 加入 json 资产数据
    engine.addPackageDatas(scene);
    // 加入内置引擎对象
    for (const effectsObject of this.builtinObjects) {
      engine.addInstance(effectsObject);
    }

    this.updateTextVariables(scene, opts.variables);

    // 加载期间 player 销毁
    if (this.disposed) {
      throw new Error('Disposed player can not used to create Composition.');
    }

    for (let i = 0; i < scene.textureOptions.length; i++) {
      scene.textureOptions[i] = scene.textureOptions[i] instanceof Texture ? scene.textureOptions[i]
        : engine.assetLoader.loadGUID(scene.textureOptions[i].id);
      scene.textureOptions[i].initialize();
    }

    if (engine.database) {
      await engine.createVFXItems(scene);
    }

    const composition = new Composition({
      ...opts,
      renderer,
      width: renderer.getWidth(),
      height: renderer.getHeight(),
      event: this.event,
      handleItemMessage: (message: MessageItem) => {
        this.emit('message', message);
      },
    }, scene);

    if (this.ticker) {
      // 中低端设备降帧到 30fps
      if (opts.renderLevel === spec.RenderLevel.B) {
        this.ticker.setFPS(Math.min(this.ticker.getFPS(), 30));
      } else {
        this.ticker.setFPS(DEFAULT_FPS);
      }
    }

    // TODO 目前编辑器会每帧调用 loadScene, 在这编译会导致闪帧，待编辑器渲染逻辑优化后移除。
    if (this.env !== PLAYER_OPTIONS_ENV_EDITOR) {
      // TODO Material 单独存表, 加速查询
      for (const guid of Object.keys(this.renderer.engine.objectInstance)) {
        const effectsObject = this.renderer.engine.objectInstance[guid];

        if (effectsObject instanceof Material) {
          effectsObject.createShaderVariant();
        }
      }
    }

    const compileStart = performance.now();

    await new Promise(resolve => {
      this.renderer.getShaderLibrary()?.compileAllShaders(() => {
        resolve(null);
      });
    });

    if (opts.autoplay) {
      this.autoPlaying = true;
      composition.play();
    } else {
      composition.gotoAndStop(0);
    }

    const compileTime = performance.now() - compileStart;
    const firstFrameTime = performance.now() - last;

    composition.statistic.compileTime = compileTime;
    composition.statistic.firstFrameTime = firstFrameTime;
    logger.info(`Shader ${asyncShaderCompile ? 'async' : 'sync'} compile [${composition.name}]: ${compileTime.toFixed(4)}ms.`);
    logger.info(`First frame [${composition.name}]: ${firstFrameTime.toFixed(4)}ms.`);

    this.compositions.push(composition);

    return composition;
  }

  /**
   * 根据用户参数修改原始数据
   * @param scene
   * @param options
   */
  private updateTextVariables (scene: Scene, variables: spec.TemplateVariables = {}) {
    const renderer = this.renderer;
    const engine = renderer.engine;

    scene.jsonScene.items.forEach(item => {
      if (item.type === spec.ItemType.text) {
        const textVariable = variables[item.name] as string;

        if (!textVariable) {
          return;
        }

        item.components.forEach(({ id }) => {
          const componentData = engine.findEffectsObjectData(id) as spec.TextComponentData;

          if (componentData?.dataType === spec.DataType.TextComponent) {
            componentData.options.text = textVariable;
          }
        });
      }
    });
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
    if (this.ticker) {
      this.ticker.start();
    } else {
      this.doTick(0, true);
    }
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
      this.doTick(0, true);
    }
    this.emit('update', {
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
    const { renderErrors } = this.renderer.engine;

    if (renderErrors.size > 0) {
      this.emit('rendererror', renderErrors.values().next().value);
      // 有渲染错误时暂停播放
      this.ticker?.pause();
    }
    dt = Math.min(dt, 33) * this.speed;
    const comps = this.compositions;
    let skipRender = false;

    comps.sort((a, b) => a.getIndex() - b.getIndex());
    const currentCompositions = [];

    for (let i = 0; i < comps.length; i++) {
      const composition = comps[i];

      if (composition.textureOffloaded) {
        skipRender = true;
        logger.error(`Composition ${composition.name} texture offloaded, skip render.`);
        currentCompositions.push(composition);
        continue;
      }
      if (!composition.isDestroyed && composition.renderer) {
        composition.update(dt);
      }
      if (!composition.isDestroyed) {
        currentCompositions.push(composition);
      }
    }
    this.compositions = currentCompositions;
    this.baseCompositionIndex = this.compositions.length;
    if (skipRender) {
      this.emit('rendererror', new Error('Play when texture offloaded.'));

      return this.ticker?.pause();
    }
    if (!this.paused || forceRender) {
      const { level } = this.gpuCapability;
      const { gl } = (this.renderer as GLRenderer).context;
      const time = (level === 2 && this.reportGPUTime) ? gpuTimer(gl as WebGL2RenderingContext) : undefined;

      time?.begin();
      if (
        this.compositions.length ||
        this.compositions.length < comps.length ||
        forceRender
      ) {
        this.renderer.setFramebuffer(null);
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
        this.emit('update', {
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
        logger.error(`DPI overflowed, width ${canvasWidth} is more than 2x document width ${documentWidth}, see ${HELP_LINK['DPI overflowed']}.`);
      }
      const maxSize = this.env ? this.gpuCapability.detail.maxTextureSize : 2048;

      if ((canvasWidth > maxSize || canvasHeight > maxSize)) {
        logger.error(`Container size overflowed ${canvasWidth}x${canvasHeight}, see ${HELP_LINK['Container size overflowed']}.`);
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
      logger.info(`Resize player ${this.name} [${canvasWidth},${canvasHeight},${containerWidth},${containerHeight}].`);
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
   * 播放器在 `webglcontextlost` 时执行的操作
   * @param e - Event
   */
  lost = (e: Event) => {
    this.ticker?.pause();
    this.compositions.forEach(comp => comp.lost(e));
    this.renderer.lost(e);
    this.emit('webglcontextlost', e);
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
      newComposition.transform.setPosition(transform.position.x, transform.position.y, transform.position.z);
      newComposition.transform.setRotation(transform.rotation.x, transform.rotation.y, transform.rotation.z);
      newComposition.transform.setScale(transform.scale.x, transform.scale.y, transform.scale.z);

      for (let i = 0; i < videoState.length; i++) {
        if (videoState[i]) {
          const video = (newComposition.textures[i].source as Texture2DSourceOptionsVideo).video;

          video.currentTime = videoState[i] ?? 0;
          await video.play();
        }
      }
      newComposition.isEnded = false;
      newComposition.gotoAndPlay(currentTime);

      return newComposition;
    }));

    this.emit('webglcontextrestored');
    this.ticker?.resume();

    if (isIOS() && this.canvas) {
      this.canvas.style.display = 'none';
      window.setTimeout(() => {
        this.canvas.style.display = '';
      }, 0);
    }
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
    logger.info(`Call player destroyed: ${this.name}.`);
    if (this.disposed) {
      return;
    }
    playerMap.delete(this.canvas);
    this.pause();
    this.ticker?.stop();
    this.assetManagers.forEach(assetManager => assetManager.dispose());
    this.compositions.forEach(comp => comp.dispose());
    this.compositions.length = 0;
    (this.renderer as GLRenderer).context.removeLostHandler({ lost: this.lost });
    (this.renderer as GLRenderer).context.removeRestoreHandler({ restore: this.restore });
    this.event.dispose();
    this.renderer.dispose(!keepCanvas);
    this.destroyBuiltinObjects();
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

  private handleResume = () => {
    this.emit('update', { player: this, playing: true });
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
            this.emit('click', {
              ...regions[i],
              compositionId: composition.id,
              compositionName: composition.name,
              player: this,
            });

            composition.emit('click', {
              ...regions[i],
              compositionId: composition.id,
              compositionName: composition.name,
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
        throw new Error(`Invalid container size ${targetWidth}x${targetHeight}, see ${HELP_LINK['Invalid container size']}.`);
      }
    }

    return [containerWidth, containerHeight, targetWidth, targetHeight];
  }

  private destroyBuiltinObjects () {
    for (const effectsObject of this.builtinObjects) {
      effectsObject.dispose();
    }

    this.builtinObjects.length = 0;
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
  Object.keys(pluginLoaderMap).forEach(key => {
    const ctrl = pluginLoaderMap[key];
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
    logger.error(`Current running player count: ${runningPlayers.length}, see ${HELP_LINK['Current running player count']}.`, runningPlayers);
  }
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
