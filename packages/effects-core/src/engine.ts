import * as spec from '@galacean/effects-specification';
import type { Database, SceneData } from './asset-loader';
import { AssetLoader } from './asset-loader';
import type { EffectsObject } from './effects-object';
import type { Material } from './material';
import type {
  DataArray, DataBuffer, DataBufferOptions, GPUCapability, Geometry, IndicesArray, Mesh, RenderPass,
  RenderPassClearAction, Renderer, RenderingData, ShaderLibrary, ShaderVariant, VertexBuffer,
} from './render';
import type { Framebuffer, Renderbuffer } from './render';
import { Graphics, RenderTargetPool } from './render';
import type { Scene, SceneRenderLevel } from './scene';
import type { Texture } from './texture';
import { TextureLoadAction, generateEmptyTexture, generateWhiteTexture } from './texture';
import type { Disposable } from './utils';
import { addItem, getPixelRatio, isPlainObject, logger, removeItem } from './utils';
import { EffectsPackage } from './effects-package';
import { passRenderLevel } from './pass-render-level';
import type { Composition } from './composition';
import type { AssetManager } from './asset-manager';
import { AssetService } from './asset-service';
import { Ticker } from './ticker';
import type { PointerEventData, Region } from './plugins';
import { EventSystem } from './plugins';
import type { ParticleSystem } from './plugins/particle/particle-system';
import { PluginSystem } from './plugin-system';
import type { GLType } from './gl';
import { HELP_LINK } from './constants';
import { EventEmitter } from './events';

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
   * 是否不处理 WebGL 上下文丢失恢复。
   * - `true`（默认）：上传 GPU 后释放 CPU 端源数据以节省内存；上下文丢失后不自动恢复，
   *   渲染暂停，等待宿主重建资源后手动恢复播放。
   * - `false`：保留 CPU 端源数据，上下文丢失后引擎自动按资源类型就地重建 GPU 资源并恢复渲染。
   *   该配置为构造期选项，运行时从 `true` 改为 `false` 无法找回已经丢弃的源数据。
   */
  doNotHandleContextLost?: boolean,
}

type EngineEvent = {
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
   * 渲染器
   */
  renderer: Renderer;
  /**
   * 渲染等级
   */
  renderLevel?: SceneRenderLevel;
  whiteTexture: Texture;
  transparentTexture: Texture;
  /**
   * GPU 能力
   */
  gpuCapability: GPUCapability;
  jsonSceneData: SceneData;
  objectInstance: Record<string, EffectsObject>;
  database?: Database; // TODO: 磁盘数据库，打包后 runtime 运行不需要
  /**
   * 渲染过程中错误队列
   */
  renderErrors: Set<Error> = new Set();
  assetManagers: AssetManager[] = [];
  assetService: AssetService;
  eventSystem: EventSystem;
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
   * 存放渲染需要用到的数据
   */
  renderingData: RenderingData;
  /**
   * 是否不处理上下文丢失恢复（构造期配置，默认 true）
   */
  doNotHandleContextLost = true;
  /**
   * WebGL 上下文是否处于丢失状态
   */
  protected contextWasLost = false;
  protected _disposed = false;
  protected textures: Texture[] = [];
  protected materials: Material[] = [];
  protected geometries: Geometry[] = [];
  protected meshes: Mesh[] = [];
  protected renderPasses: RenderPass[] = [];
  protected framebuffers: Framebuffer[] = [];
  protected renderbuffers: Renderbuffer[] = [];
  protected particleSystems: ParticleSystem[] = [];

  private _compositions: Composition[] = [];
  private _graphics: Graphics;
  private assetLoader: AssetLoader;
  private clearAction: RenderPassClearAction = {
    stencilAction: TextureLoadAction.clear,
    clearStencil: 0,
    depthAction: TextureLoadAction.clear,
    clearDepth: 1,
    colorAction: TextureLoadAction.clear,
    clearColor: [0, 0, 0, 0],
  };

  /**
   *
   */
  constructor (canvas: HTMLCanvasElement, options?: EngineOptions) {
    super();
    this.canvas = canvas;
    this.env = options?.env ?? '';
    this.doNotHandleContextLost = options?.doNotHandleContextLost ?? true;
    this.name = options?.name ?? this.name;
    this.pixelRatio = options?.pixelRatio ?? getPixelRatio();
    this.jsonSceneData = {};
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

    this.assetLoader = new AssetLoader(this);
    this.assetService = new AssetService(this);
    this.renderTargetPool = new RenderTargetPool(this);

    this.renderingData = {
      // @ts-expect-error
      currentFrame: {},
    };

    PluginSystem.notifyEngineCreated(this);
  }

  get compositions (): Composition[] {
    return this._compositions.sort((a, b) => a.getIndex() - b.getIndex());
  }

  get graphics (): Graphics {
    if (this._graphics) {
      return this._graphics;
    }

    this._graphics = new Graphics(this);

    return this._graphics;
  }

  get disposed (): boolean {
    return this._disposed;
  }

  clearResources () {
    this.jsonSceneData = {};
    this.objectInstance = {};
  }

  addEffectsObjectData (data: spec.EffectsObjectData) {
    this.jsonSceneData[data.id] = data;
  }

  findEffectsObjectData (uuid: string) {
    return this.jsonSceneData[uuid];
  }

  addInstance (effectsObject: EffectsObject) {
    this.objectInstance[effectsObject.getInstanceId()] = effectsObject;
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

    const result = this.assetLoader.loadGUID<T>(guid);

    return result;
  }

  removeInstance (id: string) {
    delete this.objectInstance[id];
  }

  addPackageDatas (scene: Scene) {
    const { jsonScene, textureOptions = [] } = scene;
    const {
      items = [], materials = [], shaders = [], geometries = [], components = [],
      animations = [], bins = [], miscs = [], compositions,
    } = jsonScene;

    for (const compositionData of compositions) {
      this.addEffectsObjectData(compositionData as unknown as spec.EffectsObjectData);
    }
    for (const vfxItemData of items) {
      if (!passRenderLevel(vfxItemData.renderLevel, scene.renderLevel)) {
        vfxItemData.components = [];
        vfxItemData.type = spec.ItemType.null;
      }
      this.addEffectsObjectData(vfxItemData);
    }
    for (const materialData of materials) {
      this.addEffectsObjectData(materialData);
    }
    for (const shaderData of shaders) {
      this.addEffectsObjectData(shaderData);
    }
    for (const geometryData of geometries) {
      this.addEffectsObjectData(geometryData);
    }
    for (const componentData of components) {
      this.addEffectsObjectData(componentData);
    }
    for (const animationData of animations) {
      this.addEffectsObjectData(animationData);
    }
    for (const miscData of miscs) {
      this.addEffectsObjectData(miscData);
    }
    for (let i = 0; i < bins.length; i++) {
      const binaryData = bins[i];
      const binaryBuffer = scene.bins[i];

      if (binaryData.dataType === spec.DataType.BinaryAsset) {
        //@ts-expect-error
        binaryData.buffer = binaryBuffer;
        if (binaryData.id) {
          this.addEffectsObjectData(binaryData);
        }
      } else {
        const effectsPackage = new EffectsPackage();

        effectsPackage.deserializeFromBinary(new Uint8Array(binaryBuffer));
        for (const effectsObjectData of effectsPackage.exportObjectDatas) {
          this.addEffectsObjectData(effectsObjectData);
        }
      }
    }
    for (const textureData of textureOptions) {
      this.addEffectsObjectData(textureData as spec.EffectsObjectData);
    }
  }

  runRenderLoop (renderFunction: (dt: number) => void): void {
    this.ticker?.add(renderFunction);
  }

  mainLoop (dt: number): void {
    // 上下文丢失/恢复期间跳过渲染，避免打到失效的 GL 上下文。
    if (this.contextWasLost) {
      return;
    }

    const { renderErrors } = this;

    if (renderErrors.size > 0) {
      this.emit('rendererror', renderErrors.values().next().value);
      // 有渲染错误时暂停播放
      this.ticker?.pause();

      return;
    }

    dt = Math.min(dt, 33) * this.speed;

    // Sort compositions by index
    //-------------------------------------------------------------------------

    const compositions = this.compositions;

    let skipRender = false;

    // Update Compositions
    //-------------------------------------------------------------------------

    for (const composition of compositions) {
      if (composition.textureOffloaded) {
        skipRender = true;
        logger.error(`Composition ${composition.name} texture offloaded, skip render.`);
        continue;
      }

      composition.update(dt);
    }

    if (skipRender) {
      this.emit('rendererror', new Error('Play when texture offloaded.'));
      this.ticker?.pause();

      return;
    }

    // Tick compositions onPreRender
    //-------------------------------------------------------------------------

    for (const composition of compositions) {
      composition.sceneTicking.preRender.tick(0);
    }

    // Render Compositions
    //-------------------------------------------------------------------------

    this.renderer.setFramebuffer(null);
    this.renderer.clear(this.clearAction);

    for (const composition of compositions) {
      composition.render();
    }

    this.renderTargetPool.flush();
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

      this.canvas.style.width = containerWidth + 'px';
      this.canvas.style.height = containerHeight + 'px';
      logger.info(`Resize engine ${this.name} [${canvasWidth},${canvasHeight},${containerWidth},${containerHeight}].`);

      this.setSize(canvasWidth, canvasHeight);
    }
  }

  setSize (width: number, height: number) {
    if (this.getWidth() !== width || this.getHeight() !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.viewport(0, 0, width, height);
    }

    this.compositions?.forEach(comp => {
      comp.camera.aspect = width / height;
    });

    this.emit('resize', this);
  }

  createVertexBuffer (data: DataArray | number, options: DataBufferOptions): DataBuffer {
    throw new Error('The active rendering backend does not provide vertex buffers.');
  }

  createDynamicVertexBuffer (data: DataArray | number, options: DataBufferOptions): DataBuffer {
    return this.createVertexBuffer(data, options);
  }

  createIndexBuffer (indices: IndicesArray, options: DataBufferOptions): DataBuffer {
    throw new Error('The active rendering backend does not provide index buffers.');
  }

  updateDynamicVertexBuffer (
    vertexBuffer: DataBuffer,
    data: DataArray,
    byteOffset = 0,
    byteLength?: number,
  ): void {
    throw new Error('The active rendering backend cannot update vertex buffers.');
  }

  updateDynamicIndexBuffer (
    indexBuffer: DataBuffer,
    indices: IndicesArray,
    byteOffset = 0,
  ): void {
    throw new Error('The active rendering backend cannot update index buffers.');
  }

  /** @hide */
  releaseBuffer (buffer: DataBuffer): boolean {
    buffer.references--;

    return buffer.references === 0;
  }

  /** @hide */
  bindBuffers (
    vertexBuffers: Record<string, VertexBuffer>,
    indexBuffer: DataBuffer | null,
    effect: ShaderVariant,
  ): void {
    throw new Error('The active rendering backend cannot bind geometry buffers.');
  }

  /**
   * 使用当前绑定的顶点和索引缓冲区绘制图元。
   * @param mode - 图元类型
   * @param indexOffset - 索引缓冲区中的字节偏移
   * @param indexCount - 索引数量
   * @param instanceCount - 实例数量
   * @hide
   */
  drawElementsType (
    mode: number,
    indexOffset: number,
    indexCount: number,
    instanceCount?: number,
  ): void {
    throw new Error('The active rendering backend cannot draw indexed primitives.');
  }

  /**
   * 使用当前绑定的顶点缓冲区绘制图元。
   * @param mode - 图元类型
   * @param vertexStart - 起始顶点
   * @param vertexCount - 顶点数量
   * @param instanceCount - 实例数量
   * @hide
   */
  drawArraysType (
    mode: number,
    vertexStart: number,
    vertexCount: number,
    instanceCount?: number,
  ): void {
    throw new Error('The active rendering backend cannot draw primitives.');
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

  addComposition (composition: Composition) {
    if (this.disposed) {
      return;
    }
    addItem(this.compositions, composition);
  }

  removeComposition (composition: Composition) {
    if (this.disposed) {
      return;
    }
    removeItem(this.compositions, composition);
  }

  getWidth (): number {
    // OVERRIDE
    return 0;
  }

  getHeight (): number {
    // OVERRIDE
    return 0;
  }

  getShaderLibrary (): ShaderLibrary | null {
    //OVERRIDE

    return null;
  }

  bindSystemFramebuffer () {
    // OVERRIDE
  }

  /**
   * 用来设置视口，即指定从标准设备到窗口坐标的x、y仿射变换。
   * @param x
   * @param y
   * @param width
   * @param height
   * example:
   * gl.viewport(0, 0, width, height);
   */
  viewport (x: number, y: number, width: number, height: number) {
    // OVERRIDE
  }

  clear (action: RenderPassClearAction) {
    // OVERRIDE
  }

  /*** 渲染状态控制 ***/

  setSampleAlphaToCoverage (enable: boolean) {
    // OVERRIDE
  }

  setBlending (enable: boolean) {
    // OVERRIDE
  }

  setDepthTest (enable: boolean) {
    // OVERRIDE
  }

  setStencilTest (enable: boolean) {
    // OVERRIDE
  }

  setCulling (enable: boolean) {
    // OVERRIDE
  }

  setPolygonOffsetFill (enable: boolean) {
    // OVERRIDE
  }

  blendColor (r: number, g: number, b: number, a: number) {
    // OVERRIDE
  }

  blendFuncSeparate (srcRGB: number, dstRGB: number, srcAlpha: number, dstAlpha: number) {
    // OVERRIDE
  }

  blendEquationSeparate (modeRGB: number, modeAlpha: number) {
    // OVERRIDE
  }

  colorMask (r: boolean, g: boolean, b: boolean, a: boolean) {
    // OVERRIDE
  }

  depthMask (flag: boolean) {
    // OVERRIDE
  }

  depthFunc (func: number) {
    // OVERRIDE
  }

  depthRange (near: number, far: number) {
    // OVERRIDE
  }

  polygonOffset (factor: number, units: number) {
    // OVERRIDE
  }

  cullFace (mode: number) {
    // OVERRIDE
  }

  frontFace (mode: number) {
    // OVERRIDE
  }

  stencilMaskSeparate (face: number, mask: number) {
    // OVERRIDE
  }

  stencilFuncSeparate (face: number, func: number, ref: number, mask: number) {
    // OVERRIDE
  }

  stencilOpSeparate (face: number, fail: number, zfail: number, zpass: number) {
    // OVERRIDE
  }

  /**
   * 销毁所有缓存的资源
   */
  dispose (): void {
    if (this.disposed) {
      return;
    }
    this._disposed = true;

    PluginSystem.notifyEngineDestroy(this);

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

    this.ticker?.stop();
    this.eventSystem?.dispose();
    this.assetService?.dispose();
    this._graphics?.dispose();

    this.renderPasses.forEach(pass => pass.dispose());
    this.meshes.forEach(mesh => mesh.dispose());
    this.geometries.forEach(geo => geo.dispose());
    this.materials.forEach(mat => mat.dispose());
    this.textures.forEach(tex => tex.dispose());
    this.assetManagers.forEach(assetManager => assetManager.dispose());
    this.compositions.forEach(comp => comp.dispose());

    this.textures = [];
    this.materials = [];
    this.geometries = [];
    this.meshes = [];
    this.renderPasses = [];
    this.particleSystems = [];
    this._compositions = [];
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
