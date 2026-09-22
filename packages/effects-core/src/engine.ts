import { DisplayServer } from './display-server';
import { AssetServer } from './asset-server';
import { EffectsObjectServer } from './effects-object-server';
import { RenderingServer } from './rendering-server';
import { InputServer } from './input-server';
import type { Renderer } from './render';
import type { Disposable } from './utils';
import { Ticker } from './ticker';
import type { PointerEventData, Region } from './plugins';
import { PluginSystem } from './plugin-system';
import type { GLType } from './gl';
import { EventEmitter } from './events';
import { getClassesDerivedFrom } from './decorators';
import { EngineServer } from './engine-server';

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
 * Engine 基类，负责服务及引擎资源的管理和销毁
 */
export class Engine extends EventEmitter<EngineEvent> implements Disposable {
  /**
   * 创建 Engine 对象。
   */
  static create: (canvas: HTMLCanvasElement, options?: EngineOptions) => Engine;

  name = 'NewEngine';
  env = '';
  speed = 1;
  canvas: HTMLCanvasElement;
  options: EngineOptions;

  /**
   * 计时器
   * 手动渲染 `manualRender=true` 时不创建计时器
   */
  ticker: Ticker | null = null;
  /**
   * 渲染过程中错误队列
   */
  renderErrors: Set<Error> = new Set();

  renderingServer: RenderingServer;
  effectsObjectServer: EffectsObjectServer;
  displayServer: DisplayServer;
  inputServer: InputServer;
  assetServer: AssetServer;

  private _disposed = false;
  private servers: EngineServer[] = [];

  /**
   *
   */
  constructor (canvas: HTMLCanvasElement, options?: EngineOptions) {
    super();
    this.options = options ?? {};
    this.canvas = canvas;
    this.env = options?.env ?? '';
    this.name = options?.name ?? this.name;

    if (!options?.manualRender) {
      this.ticker = new Ticker(options?.fps);
      this.runRenderLoop(this.mainLoop.bind(this));
    }

    this.servers = getClassesDerivedFrom(EngineServer).map(Server => new Server(this));
    this.servers.sort((a, b) => a.order - b.order);
    this.displayServer = this.getServer(DisplayServer);
    this.inputServer = this.getServer(InputServer);
    this.renderingServer = this.getServer(RenderingServer);
    this.effectsObjectServer = this.getServer(EffectsObjectServer);
    this.assetServer = this.getServer(AssetServer);

    for (const server of this.servers) {
      server.onInit();
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

  runRenderLoop (renderFunction: (dt: number) => void): void {
    this.ticker?.add(renderFunction);
  }

  mainLoop (dt: number): void {
    // 上下文丢失/恢复期间跳过渲染，避免打到失效的 GL 上下文。
    if (this.displayServer.renderingDevice.contextWasLost) {
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
    if (this.displayServer.renderingDevice.contextWasLost || this.renderErrors.size > 0) {
      return;
    }

    for (const server of this.servers) {
      server.onDraw();
    }

    this.renderingServer.renderFrame();
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
    PluginSystem.notifyEngineDestroy(this);

    for (let i = this.servers.length - 1; i >= 0; i--) {
      this.servers[i].onBeforeExit();
    }

    for (let i = this.servers.length - 1; i >= 0; i--) {
      this.servers[i].onDispose();
    }
    this.servers = [];
  }
}
