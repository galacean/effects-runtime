import type * as spec from '@galacean/effects-specification';
import { AssetServer } from './asset-server';
import { RenderingServer } from './rendering-server';
import type { EffectsObject } from './effects-object';
import type { Material } from './material';
import type {
  Geometry, Mesh, RenderPass, Renderer,
} from './render';
import type { Framebuffer, Renderbuffer } from './render';
import { RenderTargetPool } from './render';
import type { SceneRenderLevel } from './scene';
import type { Texture } from './texture';
import { generateEmptyTexture, generateWhiteTexture } from './texture';
import type { Disposable } from './utils';
import { addItem, getPixelRatio, isPlainObject, logger, removeItem } from './utils';
import { Ticker } from './ticker';
import type { PointerEventData, Region } from './plugins';
import { EventSystem } from './plugins';
import type { ParticleSystem } from './plugins/particle/particle-system';
import { PluginSystem } from './plugin-system';
import type { GLType } from './gl';
import { HELP_LINK } from './constants';
import { EventEmitter } from './events';
import { getClassesDerivedFrom } from './decorators';
import { EngineServer } from './engine-server';
import { GraphicsServer } from './graphics-server';
import type { RestoreHandler } from './utils';

export interface EngineOptions extends WebGLContextAttributes {
  name?: string,
  glType?: GLType,
  fps?: number,
  env?: string,
  manualRender?: boolean,
  pixelRatio?: number,
  notifyTouch?: boolean,
  interactive?: boolean,
  /**
   * Engine 是否拥有 canvas 的生命周期，默认 true。
   */
  ownsCanvas?: boolean,
  /**
   * 是否不处理 WebGL 上下文丢失恢复。
   * - `true`（默认）：上传 GPU 后释放 CPU 端源数据以节省内存；上下文丢失后不自动恢复，
   *   渲染暂停，等待宿主重建资源后手动恢复播放。
   * - `false`：保留 CPU 端源数据，上下文丢失后引擎自动按资源类型就地重建 GPU 资源并恢复渲染。
   *   该配置为构造期选项，运行时从 `true` 改为 `false` 无法找回已经丢弃的源数据。
   */
  doNotHandleContextLost?: boolean,
}

export type EngineEvent = {
  contextlost: [eventData: { engine: Engine, e: Event }],
  contextrestored: [engine: Engine],
  rendererror: [e: Event | Error],
  resize: [Engine],
  click: [eventData: Region],
  pointerdown: [eventData: PointerEventData],
  pointerup: [eventData: PointerEventData],
  pointermove: [eventData: PointerEventData],
};

/**
 * Engine 基类，负责维护所有 GPU 资源的管理及销毁
 */
export class Engine extends EventEmitter<EngineEvent> implements Disposable {
  /**
   * 创建 Engine 对象。
   */
  static create: (canvas: HTMLCanvasElement, options?: EngineOptions) => Engine;

  name = 'NewEngine';
  speed = 1;
  displayAspect: number;
  displayScale = 1;
  offscreenMode = false;
  /**
   * 渲染等级
   */
  renderLevel?: SceneRenderLevel;
  whiteTexture: Texture;
  transparentTexture: Texture;
  objectInstance: Record<string, EffectsObject>;
  /**
   * 渲染过程中错误队列
   */
  renderErrors: Set<Error> = new Set();
  eventSystem: EventSystem;
  graphicsServer: GraphicsServer;
  renderingServer: RenderingServer;
  env = '';
  /**
   * 计时器
   * 手动渲染 `manualRender=true` 时不创建计时器
   */
  ticker: Ticker | null = null;
  canvas: HTMLCanvasElement;
  /**
   * 引擎的像素比
   */
  pixelRatio: number;
  /**
   * @hidden
   * Internal utility.
   * Not part of the public API — do not rely on this in your code.
   */
  renderTargetPool: RenderTargetPool;
  /**
   * 是否不处理上下文丢失恢复（构造期配置，默认 true）
   */
  doNotHandleContextLost = true;
  /**
   * Engine 是否拥有 canvas 的生命周期
   */
  readonly ownsCanvas: boolean;
  readonly options: EngineOptions;
  protected _disposed = false;
  protected textures: Texture[] = [];
  protected materials: Material[] = [];
  protected geometries: Geometry[] = [];
  protected meshes: Mesh[] = [];
  protected renderPasses: RenderPass[] = [];
  protected framebuffers: Framebuffer[] = [];
  protected renderbuffers: Renderbuffer[] = [];
  protected particleSystems: ParticleSystem[] = [];

  private servers: EngineServer[] = [];
  private assetServer: AssetServer;

  /**
   *
   */
  constructor (canvas: HTMLCanvasElement, options?: EngineOptions) {
    super();
    this.options = options ?? {};
    this.canvas = canvas;
    this.env = options?.env ?? '';
    this.ownsCanvas = options?.ownsCanvas ?? true;
    this.doNotHandleContextLost = options?.doNotHandleContextLost ?? true;
    this.name = options?.name ?? this.name;
    this.pixelRatio = options?.pixelRatio ?? getPixelRatio();
    this.objectInstance = {};
    this.whiteTexture = generateWhiteTexture(this);
    this.transparentTexture = generateEmptyTexture(this);

    if (!options?.manualRender) {
      this.ticker = new Ticker(options?.fps);
      this.runRenderLoop(this.mainLoop.bind(this));
    }

    this.eventSystem = new EventSystem(this, options?.notifyTouch ?? false);
    this.eventSystem.enabled = options?.interactive ?? false;
    this.eventSystem.bindListeners(this.canvas);

    this.renderTargetPool = new RenderTargetPool(this);

    this.initializeServers();

    if (this.graphicsServer.renderingDevice.gpuCapability) {
      this.resize();
    }

    PluginSystem.notifyEngineCreated(this);
  }

  /**
   * 渲染器
   */
  get renderer (): Renderer {
    return this.renderingServer.renderer;
  }

  get disposed (): boolean {
    return this._disposed;
  }

  /** Get a server registered before this engine was initialized. */
  getServer<T extends EngineServer> (constructor: abstract new (...args: any[]) => T): T {
    const server = this.servers.find(server => server.constructor === constructor) as T | undefined;

    return server as T;
  }

  private initializeServers (): void {
    this.servers = getClassesDerivedFrom(EngineServer).map(Server => new Server(this));
    this.servers.sort((a, b) => a.order - b.order);
    this.assetServer = this.getServer(AssetServer);
    this.renderingServer = this.getServer(RenderingServer);
    this.graphicsServer = this.getServer(GraphicsServer);

    for (const server of this.servers) {
      server.onInit();
    }
  }

  clearResources () {
    for (const id of Object.keys(this.objectInstance)) {
      this.objectInstance[id].unregisterObject();
    }
    this.assetServer.jsonSceneData = {};
    this.objectInstance = {};
  }

  /**
   * @ignore
   */
  findObject<T> (guid: spec.DataPath): T {
    // 编辑器可能传 Class 对象，这边判断处理一下直接返回原对象。
    if (!(isPlainObject(guid))) {
      return guid as T;
    }

    if (this.objectInstance[guid.id]) {
      return this.objectInstance[guid.id] as T;
    }

    const result = this.assetServer.loadGUID<T>(guid);

    return result;
  }

  runRenderLoop (renderFunction: (dt: number) => void): void {
    this.ticker?.add(renderFunction);
  }

  mainLoop (dt: number): void {
    // 上下文丢失/恢复期间跳过渲染，避免打到失效的 GL 上下文。
    if (this.graphicsServer.renderingDevice.contextWasLost) {
      return;
    }

    const { renderErrors } = this;

    if (renderErrors.size > 0) {
      this.emit('rendererror', renderErrors.values().next().value);
      // 有渲染错误时暂停播放
      this.ticker?.pause();

      return;
    }

    dt *= this.speed;

    for (const server of this.servers) {
      server.onUpdate(dt);
    }

    for (const server of this.servers) {
      server.onLateUpdate(dt);
    }

    this.onDraw();
  }

  /** Render current scene state without advancing timelines, Animator or scripts. */
  onDraw (): void {
    if (this.graphicsServer.renderingDevice.contextWasLost || this.renderErrors.size > 0) {
      return;
    }

    for (const server of this.servers) {
      server.onDraw();
    }

    this.renderingServer.renderFrame();
  }

  /**
   * 将渲染器重新和父容器大小对齐
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
      const maxSize = this.env ? this.graphicsServer.renderingDevice.gpuCapability.detail.maxTextureSize : 2048;

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

      this.canvas.style.width = containerWidth + 'px';
      this.canvas.style.height = containerHeight + 'px';
      logger.info(`Resize engine ${this.name} [${canvasWidth},${canvasHeight},${containerWidth},${containerHeight}].`);

      this.setSize(canvasWidth, canvasHeight);
    }
  }

  setSize (width: number, height: number) {
    if (this.graphicsServer.renderingDevice.getWidth() !== width || this.graphicsServer.renderingDevice.getHeight() !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.graphicsServer.renderingDevice.setViewport(0, 0, width, height);
    }

    this.emit('resize', this);
  }

  addTexture (tex: Texture) {
    if (this.disposed) {
      return;
    }
    addItem(this.textures, tex);
  }

  removeTexture (tex: Texture) {
    if (this.disposed) {
      return;
    }
    removeItem(this.textures, tex);
  }

  addMaterial (mat: Material) {
    if (this.disposed) {
      return;
    }
    addItem(this.materials, mat);
  }

  removeMaterial (mat: Material) {
    if (this.disposed) {
      return;
    }
    removeItem(this.materials, mat);
  }

  addGeometry (geo: Geometry) {
    if (this.disposed) {
      return;
    }
    addItem(this.geometries, geo);
  }

  removeGeometry (geo: Geometry) {
    if (this.disposed) {
      return;
    }
    removeItem(this.geometries, geo);
  }

  /** @internal */
  addParticleSystem (particleSystem: ParticleSystem): void {
    if (this.disposed) {
      return;
    }
    addItem(this.particleSystems, particleSystem);
  }

  /** @internal */
  removeParticleSystem (particleSystem: ParticleSystem): void {
    if (this.disposed) {
      return;
    }
    removeItem(this.particleSystems, particleSystem);
  }

  addMesh (mesh: Mesh) {
    if (this.disposed) {
      return;
    }
    addItem(this.meshes, mesh);
  }

  removeMesh (mesh: Mesh) {
    if (this.disposed) {
      return;
    }
    removeItem(this.meshes, mesh);
  }

  addRenderPass (pass: RenderPass) {
    if (this.disposed) {
      return;
    }
    addItem(this.renderPasses, pass);
  }

  removeRenderPass (pass: RenderPass) {
    if (this.disposed) {
      return;
    }
    removeItem(this.renderPasses, pass);
  }

  addFramebuffer (framebuffer: Framebuffer) {
    if (this.disposed) {
      return;
    }
    addItem(this.framebuffers, framebuffer);
  }

  removeFramebuffer (framebuffer: Framebuffer) {
    if (this.disposed) {
      return;
    }
    removeItem(this.framebuffers, framebuffer);
  }

  addRenderbuffer (renderbuffer: Renderbuffer) {
    if (this.disposed) {
      return;
    }
    addItem(this.renderbuffers, renderbuffer);
  }

  removeRenderbuffer (renderbuffer: Renderbuffer) {
    if (this.disposed) {
      return;
    }
    removeItem(this.renderbuffers, renderbuffer);
  }

  /**
   * 销毁所有缓存的资源
   */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this._disposed = true;

    this.ticker?.stop();
    this.eventSystem?.dispose();
    PluginSystem.notifyEngineDestroy(this);

    for (let i = this.servers.length - 1; i >= 0; i--) {
      this.servers[i].onBeforeExit();
    }

    // Release remaining engine-owned resources while the device is still alive.
    const info: string[] = [];

    if (this.renderPasses.length > 0) {
      info.push(`Pass ${this.renderPasses.length}`);
    }
    if (this.meshes.length > 0) {
      info.push(`Mesh ${this.meshes.length}`);
    }
    if (this.geometries.length > 0) {
      info.push(`Geom ${this.geometries.length}`);
    }
    if (this.textures.length > 0) {
      info.push(`Tex ${this.textures.length}`);
    }

    if (info.length > 0) {
      logger.warn(`Release GPU memory: ${info.join(', ')}.`);
    }

    this.renderPasses.slice().forEach(pass => pass.dispose());
    this.meshes.slice().forEach(mesh => mesh.dispose());
    this.geometries.slice().forEach(geo => geo.dispose());
    this.materials.slice().forEach(mat => mat.dispose());
    this.framebuffers.slice().forEach(framebuffer => framebuffer.dispose());
    this.renderbuffers.slice().forEach(renderbuffer => renderbuffer.dispose());
    this.textures.slice().forEach(tex => tex.dispose());

    this.textures = [];
    this.materials = [];
    this.geometries = [];
    this.meshes = [];
    this.renderPasses = [];
    this.framebuffers = [];
    this.renderbuffers = [];
    this.particleSystems = [];
    this.renderTargetPool.dispose();

    for (let i = this.servers.length - 1; i >= 0; i--) {
      this.servers[i].onDispose();
    }
    this.servers = [];
  }

  /** @internal Rebuild engine-owned resources after the device restores shaders. */
  restoreGraphicsResources (): void {
    this.geometries.forEach(geo => geo.restore());
    this.particleSystems.forEach(system => system.rebuild());
    this.renderbuffers.forEach(resource => (resource as unknown as RestoreHandler).restore());
    this.textures.forEach(resource => (resource as unknown as RestoreHandler).restore());
    this.framebuffers.forEach(resource => (resource as unknown as RestoreHandler).restore());
  }

  private getTargetSize (parentEle: HTMLElement) {
    if (parentEle === undefined || parentEle === null) {
      throw new Error(`Container is not an HTMLElement, see ${HELP_LINK['Container is not an HTMLElement']}.`);
    }
    const displayAspect = this.displayAspect;
    // 小程序环境没有 getComputedStyle
    const computedStyle = window.getComputedStyle?.(parentEle);
    let targetWidth;
    let targetHeight;
    let finalWidth = 0;
    let finalHeight = 0;

    if (computedStyle) {
      finalWidth = parseInt(computedStyle.width, 10);
      finalHeight = parseInt(computedStyle.height, 10);
    } else {
      finalWidth = parentEle.clientWidth;
      finalHeight = parentEle.clientHeight;
    }

    if (displayAspect) {
      const parentAspect = finalWidth / finalHeight;

      if (parentAspect > displayAspect) {
        targetHeight = finalHeight * this.displayScale;
        targetWidth = targetHeight * displayAspect;
      } else {
        targetWidth = finalWidth * this.displayScale;
        targetHeight = targetWidth / displayAspect;
      }
    } else {
      targetWidth = finalWidth;
      targetHeight = finalHeight;
    }
    const ratio = this.pixelRatio;
    let containerWidth = targetWidth;
    let containerHeight = targetHeight;

    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
    if (targetWidth < 1 || targetHeight < 1) {
      if (this.offscreenMode) {
        targetWidth = targetHeight = containerWidth = containerHeight = 1;
      } else {
        throw new Error(`Invalid container size ${targetWidth}x${targetHeight}, see ${HELP_LINK['Invalid container size']}.`);
      }
    }

    return [containerWidth, containerHeight, targetWidth, targetHeight];
  }
}
