import { SceneServer } from './scene-server';
import type { Engine } from './engine';
import type {
  DataArray, DataBuffer, DataBufferOptions, Framebuffer, GPUCapability, IndicesArray, Renderbuffer,
  RenderPassClearAction, ShaderLibrary, ShaderVariant, VertexBuffer,
} from './render';
import type { Disposable } from './utils';
import { addItem, removeItem } from './utils';

/** Per-engine graphics device. Backends own GPU commands, state and context here. */
export class RenderingDevice implements Disposable {
  static create: (engine: Engine) => RenderingDevice = engine => new RenderingDevice(engine);

  /** 是否不处理上下文丢失恢复（构造期配置，默认 true）。 */
  doNotHandleContextLost: boolean;
  gpuCapability: GPUCapability;
  protected _disposed = false;
  private framebuffers: Framebuffer[] = [];
  private renderbuffers: Renderbuffer[] = [];
  private _contextWasLost = false;
  private viewport?: [x: number, y: number, width: number, height: number];

  constructor (readonly engine: Engine) {
    this.doNotHandleContextLost = engine.options.doNotHandleContextLost ?? true;
  }

  get disposed (): boolean {
    return this._disposed;
  }

  /** Whether rendering is suspended while the graphics context is being restored. */
  get contextWasLost (): boolean {
    return this._contextWasLost;
  }

  protected handleContextLost (e: Event): void {
    const { engine } = this;

    if (!this.doNotHandleContextLost) {
      this._contextWasLost = true;
    }
    engine.getServer(SceneServer).compositions.forEach(comp => comp.lost(e));
    engine.emit('contextlost', { engine, e });
  }

  protected handleContextRestored (): void {
    this._contextWasLost = false;
    this.engine.emit('contextrestored', this.engine);
  }

  createVertexBuffer (data: DataArray | number, options: DataBufferOptions): DataBuffer {
    throw new Error('The active rendering backend does not provide vertex buffers.');
  }

  getWidth (): number {
    return 0;
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

  /** Restore attachment storage before rebuilding framebuffer attachments. */
  restoreGraphicsResources (): void {
    this.renderbuffers.forEach(resource => resource.restore());
    this.engine.effectsObjectServer.restoreGraphicsResources();
    this.framebuffers.forEach(resource => resource.restore());
  }

  dispose (): void {
    if (this.disposed) {
      return;
    }
    // Resource deletion needs a live device and context. Disposing a framebuffer
    // can also dispose and unregister its attachments.
    this.framebuffers.slice().forEach(framebuffer => framebuffer.dispose());
    this.renderbuffers.slice().forEach(renderbuffer => renderbuffer.dispose());
    this.framebuffers = [];
    this.renderbuffers = [];
    this._disposed = true;
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
  setViewport (x: number, y: number, width: number, height: number) {
    this.viewport = [x, y, width, height];
    this.setViewportInternal(x, y, width, height);
  }

  /** Returns the viewport currently submitted to the graphics backend. */
  getViewport (): [x: number, y: number, width: number, height: number] {
    return this.viewport ? [...this.viewport] : [0, 0, this.getWidth(), this.getHeight()];
  }

  /** Submits viewport state to the active graphics backend. */
  protected setViewportInternal (x: number, y: number, width: number, height: number) {
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

  setScissorTest (enable: boolean) {
    // OVERRIDE
  }

  setScissor (x: number, y: number, width: number, height: number) {
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
}
